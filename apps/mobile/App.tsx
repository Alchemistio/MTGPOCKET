import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StatusBar, StyleSheet,
  Text, TextInput, View
} from "react-native";
import {
  advanceAfterAllPass, advanceAutomaticStep, createGame, passPriority,
  type GameState
} from "@commander-pocket/game-engine";
import {
  ScryfallClient, ScryfallRepository, type CardDefinition
} from "@commander-pocket/card-data";
import { createMobileCardRepository } from "./src/data/card-repository.js";
import { NetworkRoomModal, type MobileGameView, type MobileStackItemView, type RoomSession } from "./src/network/NetworkRoomModal.js";
import { RoomClient } from "./src/network/room-client.js";
import { NetworkPregameModal } from "./src/network/NetworkPregameModal.js";

const initialPlayers = [
  { id: "p1", name: "Vous", seat: 0 },
  { id: "p2", name: "Joueur 2", seat: 1 },
  { id: "p3", name: "Joueur 3", seat: 2 },
  { id: "p4", name: "Joueur 4", seat: 3 }
];

function createDemoGame(): GameState {
  return advanceAutomaticStep(createGame("mobile-demo", initialPlayers));
}

interface PlayerPanelData {
  id: string;
  name: string;
  life: number;
  handCount: number;
  battlefieldCount: number;
  graveyardCount: number;
  libraryCount: number;
  commanderCastCount: Readonly<Record<string, number>>;
  manaPool: Readonly<Record<string, number>>;
  isEliminated: boolean;
}

function PlayerPanel({ player, hasPriority, canPass, onPass }: {
  player: PlayerPanelData;
  hasPriority: boolean;
  canPass: boolean;
  onPass: () => void;
}) {
  const commanderTax = Object.values(player.commanderCastCount).reduce((sum, count) => sum + count * 2, 0);
  const mana = Object.values(player.manaPool).reduce((sum, amount) => sum + amount, 0);
  return (
    <View style={[styles.player, hasPriority && styles.playerPriority, player.isEliminated && styles.playerEliminated]}>
      <View style={styles.playerHeader}>
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={styles.life}>{player.life} PV</Text>
      </View>
      <View style={styles.telemetry}>
        <Text style={styles.metric}>Main {player.handCount}</Text>
        <Text style={styles.metric}>Taxe {commanderTax}</Text>
        <Text style={styles.metric}>Mana {mana}</Text>
      </View>
      <View style={styles.battlefield}>
        <Text style={styles.hint}>CHAMP DE BATAILLE</Text>
        <View style={styles.pileRow}>
          <View style={styles.cardPile}><Text style={styles.pileTitle}>Permanents</Text><Text style={styles.pileCount}>{player.battlefieldCount}</Text></View>
          <View style={styles.cardPile}><Text style={styles.pileTitle}>Cimetière</Text><Text style={styles.pileCount}>{player.graveyardCount}</Text></View>
          <View style={styles.cardPile}><Text style={styles.pileTitle}>Bibliothèque</Text><Text style={styles.pileCount}>{player.libraryCount}</Text></View>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Passer la priorité pour ${player.name}`} disabled={!canPass} onPress={onPass} style={[styles.priorityButton, !canPass && styles.priorityButtonDisabled]}>
        <Text style={styles.priorityButtonText}>{canPass ? "PASSER LA PRIORITÉ" : player.isEliminated ? "ÉLIMINÉ" : hasPriority ? "PRIORITÉ ADVERSE" : "EN ATTENTE"}</Text>
      </Pressable>
    </View>
  );
}

function CardLookupModal({ visible, onClose, repository, storageWarning }: {
  visible: boolean;
  onClose: () => void;
  repository: ScryfallRepository | null;
  storageWarning: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardDefinition[]>([]);
  const [selected, setSelected] = useState<CardDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!repository || !query.trim()) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const page = await repository.searchCards(query.trim(), 1);
      setResults(page.data);
      if (page.data.length === 0) setError("Aucune carte trouvée.");
    } catch {
      setError("Recherche indisponible. Vérifie la connexion ou réessaie.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={styles.lookupScreen}>
        <View style={styles.lookupHeader}>
          <View>
            <Text style={styles.lookupTitle}>RECHERCHE DE CARTES</Text>
            <Text style={styles.lookupSubtitle}>Scryfall · cache local</Text>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer la recherche">
            <Text style={styles.closeButton}>FERMER ✕</Text>
          </Pressable>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={search}
            placeholder="Ex. t:creature c:blue"
            placeholderTextColor="#7d8ba0"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
            accessibilityLabel="Requête de recherche Scryfall"
          />
          <Pressable onPress={search} disabled={!repository || loading || !query.trim()} style={[styles.searchButton, (!repository || loading || !query.trim()) && styles.priorityButtonDisabled]}>
            <Text style={styles.searchButtonText}>CHERCHER</Text>
          </Pressable>
        </View>
        {!repository ? <Text style={styles.lookupSubtitle}>Initialisation du catalogue local…</Text> : null}
        {storageWarning ? <Text style={styles.storageWarning}>{storageWarning}</Text> : null}
        {error ? <Text style={styles.searchError}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#9dd9bb" /> : null}
        {selected ? (
          <View style={styles.cardDetail}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailName}>{selected.name}</Text>
              <Text style={styles.detailMana}>{selected.manaCost ?? "—"}</Text>
            </View>
            <Text style={styles.detailType}>{selected.typeLine}</Text>
            {selected.faces.length > 0 ? selected.faces.map((face, index) => (
              <View key={`${selected.providerId}-face-${index}`} style={styles.faceBlock}>
                <Text style={styles.faceName}>{face.name}</Text>
                <Text style={styles.faceType}>{face.type_line ?? "—"}</Text>
                <Text style={styles.oracleText}>{face.oracle_text ?? ""}</Text>
              </View>
            )) : <Text style={styles.oracleText}>{selected.oracleText}</Text>}
            <Pressable onPress={() => setSelected(null)} style={styles.backButton}><Text style={styles.backButtonText}>RETOUR AUX RÉSULTATS</Text></Pressable>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={card => card.providerId}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.resultList}
            renderItem={({ item }) => (
              <Pressable onPress={() => setSelected(item)} style={styles.resultRow}>
                <View style={styles.resultCopy}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultType}>{item.typeLine}</Text>
                </View>
                <Text style={styles.resultMana}>{item.manaCost ?? "—"}</Text>
              </Pressable>
            )}
            ListEmptyComponent={!loading && !error ? <Text style={styles.emptyResults}>Recherche par nom, type, couleur ou texte Oracle.</Text> : undefined}
          />
        )}
      </View>
    </Modal>
  );
}

export default function App() {
  const [game, setGame] = useState<GameState>(createDemoGame);
  const [roomClient] = useState(() => new RoomClient());
  const [roomView, setRoomView] = useState<MobileGameView | null>(null);
  const [roomSession, setRoomSession] = useState<RoomSession | null>(null);
  const [networkVisible, setNetworkVisible] = useState(false);
  const [pregameVisible, setPregameVisible] = useState(false);
  const [networkMessage, setNetworkMessage] = useState<string | null>(null);
  const [repository, setRepository] = useState<ScryfallRepository | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [lookupVisible, setLookupVisible] = useState(false);
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([]);
  const [stackDrawerOpen, setStackDrawerOpen] = useState(false);
  const [autoYield, setAutoYield] = useState(false);
  const autoYieldRevision = useRef<number | null>(null);
  const displayPlayers: PlayerPanelData[] = roomView
    ? roomView.players.map(player => ({
        id: player.id, name: player.name, life: player.life, handCount: player.handCount,
        battlefieldCount: player.battlefield.length, graveyardCount: player.graveyard.length,
        libraryCount: player.libraryCount, commanderCastCount: player.commanderCastCount,
        manaPool: player.manaPool, isEliminated: player.isEliminated
      }))
    : game.players.map(player => ({
        id: player.id, name: player.name, life: player.life, handCount: player.hand.length,
        battlefieldCount: player.battlefield.length, graveyardCount: player.graveyard.length,
        libraryCount: player.library.length, commanderCastCount: player.commanderCastCount,
        manaPool: player.manaPool, isEliminated: player.isEliminated
      }));
  const priorityPlayerId = roomView ? roomView.priorityPlayerId : game.priorityPlayerId;
  const turnNumber = roomView?.turnNumber ?? game.turnNumber;
  const phase = roomView?.phase ?? game.phase;
  const step = roomView?.step ?? game.step;
  const stackCount = roomView?.stack.length ?? game.stack.length;
  const pendingDecisionCount = roomView?.pendingCommanderChoiceCount ?? 0;
  const awaitingResolutionId = roomView ? roomView.awaitingResolutionId : game.awaitingResolutionId;
  const priorityPlayer = displayPlayers.find(player => player.id === priorityPlayerId);
  const viewerId = roomSession?.playerId ?? "p1";
  const viewerHandCount = displayPlayers.find(player => player.id === viewerId)?.handCount ?? 0;
  const ownHandCards = roomView?.players.find(player => player.id === viewerId)?.handCards ?? [];
  const discardPending = Boolean(roomView && roomSession &&
    roomView.pendingDiscardPlayerId === roomSession.playerId && roomView.pendingDiscardCount > 0);

  useEffect(() => {
    const unsubscribe = roomClient.onEvent(event => {
    if (event.type === "game-view") {
      setRoomView(event.view as MobileGameView);
      setSelectedDiscardIds([]);
    }
    if (event.type === "command-result") {
      const result = event.result as { accepted?: unknown; code?: unknown } | null;
      if (result?.accepted === false) setNetworkMessage(typeof result.code === "string" ? result.code : "ACTION_REJECTED");
      else setNetworkMessage(null);
    }
    if (event.type === "command-rejected" || event.type === "room-error" || event.type === "protocol-error") {
      setNetworkMessage(event.code);
    }
    if (event.type === "disconnected") {
      setRoomView(null);
      setRoomSession(null);
      setSelectedDiscardIds([]);
      setNetworkMessage("Connexion réseau fermée.");
    }
    });
    return () => { unsubscribe(); roomClient.disconnect(); };
  }, [roomClient]);

  useEffect(() => {
    if (!autoYield || !roomView || !roomSession || !roomView.spellCastingAvailable) {
      autoYieldRevision.current = null;
      return;
    }
    if (roomView.priorityPlayerId !== roomSession.playerId) {
      autoYieldRevision.current = null;
      return;
    }
    const ownPlayer = roomView.players.find(player => player.id === roomSession.playerId);
    const hasSupportedResponse = ownPlayer?.handCards.some(card => card.isSupportedSpell) ?? false;
    const hasPendingChoice = roomView.pendingDiscardPlayerId === roomSession.playerId ||
      roomView.pendingCommanderChoices.length > 0;
    if (hasSupportedResponse || hasPendingChoice || autoYieldRevision.current === roomView.revision) return;
    autoYieldRevision.current = roomView.revision;
    try {
      roomClient.sendCommand({
        protocolVersion: 1,
        gameId: roomSession.gameId,
        commandId: Date.now().toString() + "-" + Math.random().toString(36).slice(2),
        playerId: roomSession.playerId,
        expectedRevision: roomView.revision,
        type: "pass-priority",
        payload: {}
      });
    } catch {
      setNetworkMessage("Auto-yield : envoi impossible.");
    }
  }, [autoYield, roomView, roomSession, roomClient]);

  useEffect(() => {
    let cancelled = false;
    createMobileCardRepository().then(value => {
      if (!cancelled) setRepository(value);
    }).catch(() => {
      if (!cancelled) {
        setRepository(new ScryfallRepository(new ScryfallClient()));
        setStorageWarning("Cache SQLite indisponible : recherche en ligne sans persistance locale.");
      }
    });
    return () => { cancelled = true; };
  }, []);

  function resolveCommanderChoice(instanceId: string, choice: "command" | "stay") {
    if (!roomView || !roomSession) return;
    roomClient.sendCommand({
      protocolVersion: 1,
      gameId: roomSession.gameId,
      commandId: Date.now().toString() + "-" + Math.random().toString(36).slice(2),
      playerId: roomSession.playerId,
      expectedRevision: roomView.revision,
      type: "resolve-commander-return",
      payload: { instanceId, choice }
    });
  }

  function castSpell(instanceId: string) {
    if (!roomView || !roomSession || !roomView.spellCastingAvailable ||
        roomView.priorityPlayerId !== roomSession.playerId) return;
    setNetworkMessage(null);
    roomClient.sendCommand({
      protocolVersion: 1,
      gameId: roomSession.gameId,
      commandId: Date.now().toString() + "-" + Math.random().toString(36).slice(2),
      playerId: roomSession.playerId,
      expectedRevision: roomView.revision,
      type: "cast-spell",
      payload: { instanceId }
    });
  }

  function toggleDiscardCard(instanceId: string) {
    if (!roomView || !discardPending) return;
    setSelectedDiscardIds(current => {
      if (current.includes(instanceId)) return current.filter(id => id !== instanceId);
      if (current.length >= roomView.pendingDiscardCount) return current;
      return [...current, instanceId];
    });
  }

  function confirmDiscard() {
    if (!roomView || !roomSession || !discardPending ||
        selectedDiscardIds.length !== roomView.pendingDiscardCount) return;
    setNetworkMessage(null);
    roomClient.sendCommand({
      protocolVersion: 1,
      gameId: roomSession.gameId,
      commandId: Date.now().toString() + "-" + Math.random().toString(36).slice(2),
      playerId: roomSession.playerId,
      expectedRevision: roomView.revision,
      type: "discard-cards",
      payload: { instanceIds: selectedDiscardIds }
    });
  }

  function pass(playerId: string) {
    if (roomView && roomSession) {
      if (playerId !== roomSession.playerId) return;
      setNetworkMessage(null);
      roomClient.sendCommand({
        protocolVersion: 1,
        gameId: roomSession.gameId,
        commandId: Date.now().toString() + "-" + Math.random().toString(36).slice(2),
        playerId: roomSession.playerId,
        expectedRevision: roomView.revision,
        type: "pass-priority",
        payload: {}
      });
      return;
    }
    setGame(current => {
      const result = passPriority(current, playerId);
      return result.outcome === "step-advance" ? advanceAfterAllPass(result.state) : result.state;
    });
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <View style={styles.topBar}>
        <Text style={styles.brand}>COMMANDER POCKET</Text>
        <Text style={styles.turn}>TOUR {turnNumber} · {phase.toUpperCase()} · {step.toUpperCase()}</Text>
        <Text style={styles.priority}>{priorityPlayer ? `Priorité : ${priorityPlayer.name}` : "Résolution / transition"}</Text>
      </View>
      <View style={styles.board}>
        {displayPlayers.map(player => (
          <PlayerPanel
            key={player.id}
            player={player}
            hasPriority={priorityPlayerId === player.id}
            canPass={priorityPlayerId === player.id && (!roomView || roomSession?.playerId === player.id)}
            onPass={() => pass(player.id)}
          />
        ))}
      </View>
      {roomView && stackDrawerOpen ? (
        <View style={styles.stackDrawer}>
          <View style={styles.stackDrawerHeader}>
            <Text style={styles.stackDrawerTitle}>PILE · {roomView.stack.length}</Text>
            <Pressable
              disabled={!roomView.spellCastingAvailable}
              onPress={() => setAutoYield(enabled => !enabled)}
              accessibilityRole="switch"
              accessibilityState={{ checked: autoYield, disabled: !roomView.spellCastingAvailable }}
              accessibilityLabel="Auto-yield quand aucune réponse supportée n'est disponible"
              style={[styles.autoYieldToggle, autoYield && styles.autoYieldEnabled, !roomView.spellCastingAvailable && styles.handCardDisabled]}
            >
              <Text style={styles.autoYieldText}>AUTO-YIELD {autoYield ? "ON" : "OFF"}</Text>
            </Pressable>
            <Pressable onPress={() => setStackDrawerOpen(false)} accessibilityRole="button">
              <Text style={styles.stackDrawerClose}>FERMER ✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.stackDrawerItems}>
            {roomView.stack.length === 0 ? (
              <Text style={styles.stackEmpty}>Aucun objet sur la pile.</Text>
            ) : [...roomView.stack].reverse().map((item: MobileStackItemView) => {
              const payload = typeof item.payload === "object" && item.payload !== null
                ? item.payload as Record<string, unknown> : {};
              const title = typeof payload.name === "string" ? payload.name : item.kind;
              const controller = displayPlayers.find(player => player.id === item.controller_id)?.name ?? item.controller_id;
              const manaCost = typeof payload.manaCost === "string" ? payload.manaCost : "";
              return (
                <View key={item.id} style={styles.stackItemRow}>
                  <View style={styles.stackItemCopy}>
                    <Text numberOfLines={1} style={styles.stackItemName}>{title}</Text>
                    <Text style={styles.stackItemMeta}>{controller} · {item.kind}</Text>
                  </View>
                  {manaCost ? <Text style={styles.stackItemMana}>{manaCost}</Text> : null}
                </View>
              );
            })}
          </ScrollView>
          <Text style={styles.stackDrawerHint}>
            {roomView.awaitingResolutionId ? "Tous les joueurs ont passé · résolution serveur en attente" : "L'ordre de résolution est du sommet vers le bas"}
          </Text>
        </View>
      ) : null}
      {roomView?.pendingCommanderChoices.map(choice => (
        <View key={choice.instanceId} style={styles.pendingChoice}>
          <Text style={styles.pendingChoiceText}>Commandant au {choice.fromZone === "graveyard" ? "cimetière" : "bannissement"} : choisir son retour</Text>
          <Pressable onPress={() => resolveCommanderChoice(choice.instanceId, "command")} style={styles.choiceButton}>
            <Text style={styles.choiceButtonText}>ZONE DE COMMANDEMENT</Text>
          </Pressable>
          <Pressable onPress={() => resolveCommanderChoice(choice.instanceId, "stay")} style={styles.choiceButton}>
            <Text style={styles.choiceButtonText}>LE LAISSER</Text>
          </Pressable>
        </View>
      ))}
      {roomView && roomSession ? (
        <View style={styles.handTray}>
          <View style={styles.handHeader}>
            <Text style={styles.handTrayTitle}>MAIN PRIVÉE · {ownHandCards.length}</Text>
            <Text style={styles.handTrayHint}>
              {discardPending
                ? "Choisis " + roomView.pendingDiscardCount + " carte(s) à défausser"
                : roomView.spellCastingAvailable
                  ? roomView.priorityPlayerId === roomSession.playerId ? "Sélectionne un instant ou rituel simple" : "En attente de priorité"
                  : "Effets de cartes serveur non configurés"}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handScroll}>
            {ownHandCards.map(card => {
              const selected = selectedDiscardIds.includes(card.instanceId);
              const canCast = !discardPending && roomView.spellCastingAvailable &&
                roomView.priorityPlayerId === roomSession.playerId && card.isSupportedSpell;
              const disabled = !discardPending && !canCast;
              const actionLabel = discardPending
                ? selected ? "À DÉFAUSSER" : "CHOISIR"
                : canCast ? "JOUER"
                  : !roomView.spellCastingAvailable ? "EFFETS OFF"
                    : card.isSupportedSpell ? "ATTENDRE" : "NON PRIS EN CHARGE";
              return (
                <Pressable
                  key={card.instanceId}
                  disabled={disabled}
                  onPress={() => discardPending ? toggleDiscardCard(card.instanceId) : castSpell(card.instanceId)}
                  accessibilityRole="button"
                  accessibilityLabel={discardPending
                    ? (selected ? "Retirer " : "Sélectionner ") + card.name + " pour la défausse"
                    : "Jouer " + card.name}
                  accessibilityState={{ disabled, selected }}
                  style={[styles.handCard, selected && styles.handCardSelected, disabled && styles.handCardDisabled]}
                >
                  <Text numberOfLines={1} style={styles.handCardName}>{card.name}</Text>
                  <Text numberOfLines={1} style={styles.handCardMeta}>{card.manaCost ?? "—"} · {card.typeLine || "Type inconnu"}</Text>
                  <Text style={styles.handCardAction}>{actionLabel}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {discardPending ? (
            <Pressable
              disabled={selectedDiscardIds.length !== roomView.pendingDiscardCount}
              onPress={confirmDiscard}
              accessibilityRole="button"
              style={[styles.discardConfirm, selectedDiscardIds.length !== roomView.pendingDiscardCount && styles.handCardDisabled]}
            >
              <Text style={styles.discardConfirmText}>
                CONFIRMER LA DÉFAUSSE · {selectedDiscardIds.length}/{roomView.pendingDiscardCount}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.bottomBar}>
        <Pressable onPress={() => setStackDrawerOpen(open => !open)} accessibilityRole="button" accessibilityLabel={stackDrawerOpen ? "Fermer la pile" : "Ouvrir la pile"}><Text style={styles.drawerTitle}>PILE · {stackCount} OBJET(S) {stackDrawerOpen ? "▾" : "▴"}</Text></Pressable>
        <Text style={styles.drawerHint}>{awaitingResolutionId ? "Résolution en attente" : pendingDecisionCount > 0 ? "Choix du commandant en attente" : roomView ? "Salle LAN connectée" : "Réponses et déclenchements à venir"}</Text>
        <Text style={styles.handLabel}>MAIN · {viewerHandCount} CARTES</Text>
        <Pressable onPress={() => setNetworkVisible(true)} style={styles.lookupButton} accessibilityRole="button">
          <Text style={styles.lookupButtonText}>{roomView ? "RÉSEAU ✓" : "RÉSEAU"}</Text>
        </Pressable>
        {roomSession ? <Pressable onPress={() => setPregameVisible(true)} style={styles.lookupButton} accessibilityRole="button"><Text style={styles.lookupButtonText}>PRÉ-PARTIE</Text></Pressable> : null}
        <Pressable onPress={() => setLookupVisible(true)} style={styles.lookupButton} accessibilityRole="button">
          <Text style={styles.lookupButtonText}>CARTES</Text>
        </Pressable>
      </View>
      {networkMessage ? <Text style={styles.networkMessage}>{networkMessage}</Text> : null}
      <NetworkRoomModal
        visible={networkVisible}
        client={roomClient}
        onClose={() => setNetworkVisible(false)}
        onConnected={(session, view) => {
          setRoomSession(session);
          setRoomView(view);
          setSelectedDiscardIds([]);
          setNetworkMessage(null);
        }}
      />
      {roomSession ? <NetworkPregameModal visible={pregameVisible} client={roomClient} playerId={roomSession.playerId} repository={repository} onClose={() => setPregameVisible(false)} onGameStarted={view => { setRoomView(view as MobileGameView); setSelectedDiscardIds([]); setPregameVisible(false); }} /> : null}
      <CardLookupModal visible={lookupVisible} onClose={() => setLookupVisible(false)} repository={repository} storageWarning={storageWarning} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b1018", paddingHorizontal: 10, paddingTop: 8, paddingBottom: 7 },
  topBar: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  brand: { color: "#f1f5f9", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  turn: { color: "#a8b4c5", fontSize: 11, fontWeight: "700" },
  priority: { color: "#9dd9bb", fontSize: 11, fontWeight: "700" },
  board: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  player: { width: "49%", flexGrow: 1, minHeight: "46%", borderWidth: 1, borderColor: "#29384b", borderRadius: 9, backgroundColor: "#131c29", padding: 8 },
  playerPriority: { borderColor: "#8bd5b1", borderWidth: 2 },
  playerEliminated: { opacity: 0.4 },
  playerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  playerName: { color: "#edf2f8", fontSize: 13, fontWeight: "800" },
  life: { color: "#fff", fontSize: 17, fontWeight: "900", fontVariant: ["tabular-nums"] },
  telemetry: { flexDirection: "row", gap: 14, paddingTop: 4 },
  metric: { color: "#9baabd", fontSize: 10, fontWeight: "600" },
  battlefield: { flex: 1, justifyContent: "center", paddingTop: 4 },
  hint: { color: "#607086", fontSize: 9, textAlign: "center", marginBottom: 5, letterSpacing: 1 },
  pileRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  cardPile: { minWidth: 70, borderRadius: 6, backgroundColor: "#202d3e", padding: 7, alignItems: "center" },
  pileTitle: { color: "#b7c3d2", fontSize: 9, fontWeight: "700" },
  pileCount: { color: "#f1f5f9", fontSize: 12, fontWeight: "900", marginTop: 2 },
  priorityButton: { minHeight: 28, borderRadius: 5, backgroundColor: "#2f795d", alignItems: "center", justifyContent: "center", marginTop: 5 },
  priorityButtonDisabled: { backgroundColor: "#263243" },
  priorityButtonText: { color: "#edf8f2", fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  pendingChoice: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, backgroundColor: "#302a1e", borderColor: "#8b7342", borderWidth: 1, borderRadius: 7, padding: 6, marginTop: 5 },
  pendingChoiceText: { color: "#f0dfb8", fontSize: 9, flex: 1, fontWeight: "700" },
  choiceButton: { backgroundColor: "#46513e", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 6 },
  choiceButtonText: { color: "#f4f7ed", fontSize: 8, fontWeight: "900" },
  stackDrawer: { position: "absolute", left: 10, right: 10, bottom: 142, maxHeight: 142, zIndex: 20, borderRadius: 8, borderWidth: 1, borderColor: "#526b83", backgroundColor: "#101a27", padding: 8 },
  stackDrawerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 },
  stackDrawerTitle: { color: "#edf3f9", fontSize: 10, fontWeight: "900" },
  stackDrawerClose: { color: "#a8b8ca", fontSize: 8, fontWeight: "900" },
  autoYieldToggle: { borderWidth: 1, borderColor: "#64748b", borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#263548" },
  autoYieldEnabled: { borderColor: "#9dd9bb", backgroundColor: "#285541" },
  autoYieldText: { color: "#eaf5ef", fontSize: 8, fontWeight: "900" },
  stackDrawerItems: { maxHeight: 86 },
  stackItemRow: { minHeight: 32, borderTopWidth: 1, borderTopColor: "#2c3d52", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  stackItemCopy: { flex: 1, paddingRight: 8 },
  stackItemName: { color: "#edf3f9", fontSize: 10, fontWeight: "800" },
  stackItemMeta: { color: "#9bacc0", fontSize: 8, marginTop: 2 },
  stackItemMana: { color: "#d8e3f0", fontSize: 10, fontWeight: "800" },
  stackEmpty: { color: "#91a2b7", fontSize: 10, paddingVertical: 10, textAlign: "center" },
  stackDrawerHint: { color: "#91a2b7", fontSize: 8, marginTop: 4 },
  handTray: { minHeight: 82, marginTop: 5, borderRadius: 8, backgroundColor: "#111b28", borderWidth: 1, borderColor: "#29384b", paddingHorizontal: 7, paddingVertical: 5 },
  handHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 3, marginBottom: 4 },
  handTrayTitle: { color: "#e6edf5", fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  handTrayHint: { color: "#91a2b7", fontSize: 9, fontWeight: "600" },
  handScroll: { flexDirection: "row", gap: 6, paddingBottom: 1 },
  handCard: { width: 132, minHeight: 54, borderRadius: 6, backgroundColor: "#243448", borderWidth: 1, borderColor: "#526b83", paddingHorizontal: 7, paddingVertical: 5, justifyContent: "space-between" },
  handCardSelected: { borderColor: "#e4bd72", backgroundColor: "#3a3325" },
  handCardDisabled: { opacity: 0.48 },
  handCardName: { color: "#f2f6fb", fontSize: 10, fontWeight: "900" },
  handCardMeta: { color: "#b3c1d1", fontSize: 8 },
  handCardAction: { color: "#a7dfbf", fontSize: 8, fontWeight: "900", textAlign: "right" },
  discardConfirm: { alignSelf: "flex-end", backgroundColor: "#8b6730", borderRadius: 5, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  discardConfirmText: { color: "#fff3dc", fontSize: 9, fontWeight: "900" },
  bottomBar: { minHeight: 48, marginTop: 6, borderRadius: 8, backgroundColor: "#151f2d", paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  drawerTitle: { color: "#e6edf5", fontSize: 11, fontWeight: "900" },
  drawerHint: { color: "#8998aa", fontSize: 10 },
  handLabel: { color: "#c7d4e4", fontSize: 11, fontWeight: "800" },
  lookupButton: { backgroundColor: "#31445a", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 5 },
  lookupButtonText: { color: "#e7eff8", fontSize: 10, fontWeight: "900" },
  networkMessage: { color: "#d9bd7d", fontSize: 9, textAlign: "center", marginTop: 4 },
  lookupScreen: { flex: 1, backgroundColor: "#0b1018", padding: 16, paddingTop: 34 },
  lookupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  lookupTitle: { color: "#f1f5f9", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  lookupSubtitle: { color: "#8ea0b5", fontSize: 10, marginTop: 3 },
  closeButton: { color: "#9dd9bb", fontSize: 11, fontWeight: "900" },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, minHeight: 42, borderRadius: 7, borderWidth: 1, borderColor: "#35465c", backgroundColor: "#172333", color: "#f1f5f9", paddingHorizontal: 12, fontSize: 13 },
  searchButton: { backgroundColor: "#2f795d", justifyContent: "center", paddingHorizontal: 14, borderRadius: 7 },
  searchButtonText: { color: "#effaf4", fontSize: 10, fontWeight: "900" },
  storageWarning: { color: "#d9bd7d", fontSize: 10, marginBottom: 6 },
  searchError: { color: "#e5a1a1", fontSize: 11, marginVertical: 6 },
  resultList: { paddingBottom: 20 },
  resultRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: "#263446", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 4 },
  resultCopy: { flex: 1, paddingRight: 10 },
  resultName: { color: "#f1f5f9", fontSize: 13, fontWeight: "800" },
  resultType: { color: "#9baabd", fontSize: 10, marginTop: 3 },
  resultMana: { color: "#d8e3f0", fontSize: 11, fontWeight: "700" },
  emptyResults: { color: "#8798ac", fontSize: 12, textAlign: "center", marginTop: 24 },
  cardDetail: { flex: 1, borderRadius: 9, backgroundColor: "#152131", padding: 14 },
  detailHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailName: { color: "#fff", fontSize: 17, fontWeight: "900", flex: 1 },
  detailMana: { color: "#cbd8e8", fontSize: 13, fontWeight: "800" },
  detailType: { color: "#aab9cb", fontSize: 11, marginTop: 7, marginBottom: 12 },
  faceBlock: { borderTopWidth: 1, borderTopColor: "#31445a", paddingTop: 10, marginTop: 8 },
  faceName: { color: "#e8eff7", fontSize: 13, fontWeight: "800" },
  faceType: { color: "#aab9cb", fontSize: 10, marginTop: 3 },
  oracleText: { color: "#e2e9f1", fontSize: 12, lineHeight: 18, marginTop: 8 },
  backButton: { alignSelf: "flex-start", backgroundColor: "#31445a", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 5, marginTop: 14 },
  backButtonText: { color: "#e8eff7", fontSize: 10, fontWeight: "900" }
});
