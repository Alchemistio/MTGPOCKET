import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import type { CommanderDeckList, ScryfallRepository, CardDefinition } from "@commander-pocket/card-data";
import type { RoomClient } from "./room-client.js";
import { NetworkPregamePanel } from "./NetworkPregamePanel.js";

interface Props {
  visible: boolean;
  client: RoomClient;
  playerId: string;
  repository: ScryfallRepository | null;
  onClose: () => void;
  onGameStarted: (view: unknown) => void;
}
interface PregameView {
  revision: number;
  step: string;
  players: readonly { id: string; name: string; hand: readonly string[]; handCount: number }[];
}

export function NetworkPregameModal({ visible, client, playerId, repository, onClose, onGameStarted }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, number>>({});
  const [cardsById, setCardsById] = useState<Record<string, CardDefinition>>({});
  const [commanderId, setCommanderId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(true);

  const total = useMemo(() => Object.values(entries).reduce((sum, quantity) => sum + quantity, 0), [entries]);
  const deck: CommanderDeckList = useMemo(() => ({
    commanderIds: commanderId ? [commanderId] : [],
    cards: Object.entries(entries).map(([cardId, quantity]) => ({ cardId, quantity }))
  }), [commanderId, entries]);
  const ready = total === 100 && commanderId !== null && entries[commanderId] === 1;

  async function search() {
    if (!repository || !query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const page = await repository.searchCards(query.trim(), 1);
      setResults(page.data);
      if (!page.data.length) setError("Aucune carte trouvée.");
    } catch {
      setResults([]);
      setError("Recherche Scryfall impossible.");
    } finally {
      setLoading(false);
    }
  }

  function add(card: CardDefinition) {
    setCardsById(current => ({ ...current, [card.providerId]: card }));
    setEntries(current => ({ ...current, [card.providerId]: (current[card.providerId] ?? 0) + 1 }));
  }
  function setCommander(card: CardDefinition) {
    setCardsById(current => ({ ...current, [card.providerId]: card }));
    setCommanderId(card.providerId);
    setEntries(current => ({ ...current, [card.providerId]: Math.max(1, current[card.providerId] ?? 0) }));
  }
  function remove(cardId: string) {
    setEntries(current => {
      const quantity = current[cardId] ?? 0;
      if (quantity <= 1) {
        const next = { ...current };
        delete next[cardId];
        return next;
      }
      return { ...current, [cardId]: quantity - 1 };
    });
    if (commanderId === cardId && (entries[cardId] ?? 0) <= 1) setCommanderId(null);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PRÉ-PARTIE COMMANDER</Text>
            <Text style={styles.subtitle}>Deck local · validation finale côté serveur</Text>
          </View>
          <Pressable onPress={onClose}><Text style={styles.close}>FERMER ✕</Text></Pressable>
        </View>
        {showSetup ? <>
          <View style={styles.countRow}>
            <Text style={styles.count}>{total}/100 cartes</Text>
            <Text style={styles.countHint}>{commanderId ? cardsById[commanderId]?.name ?? "Commandant choisi" : "Choisir 1 commandant"}</Text>
          </View>
          <View style={styles.searchRow}>
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} placeholder="Nom, type ou requête Scryfall"
              placeholderTextColor="#7d8ba0" autoCapitalize="none" autoCorrect={false} style={styles.input} />
            <Pressable disabled={loading || !repository} onPress={search} style={styles.searchButton}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>CHERCHER</Text>}
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <FlatList data={results} keyExtractor={item => item.providerId} style={styles.results}
            renderItem={({ item }) => (
              <View style={styles.result}>
                <View style={styles.resultCopy}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardType}>{item.typeLine}</Text>
                </View>
                <Pressable onPress={() => add(item)} style={styles.smallButton}><Text style={styles.buttonText}>+1</Text></Pressable>
                <Pressable onPress={() => setCommander(item)} style={styles.commanderButton}><Text style={styles.buttonText}>CMD</Text></Pressable>
              </View>
            )} />
          <Text style={styles.section}>LISTE · {Object.keys(entries).length} NOMS</Text>
          <FlatList data={Object.entries(entries)} keyExtractor={item => item[0]} style={styles.deckList}
            renderItem={({ item: [cardId, quantity] }) => (
              <View style={styles.deckRow}>
                <Text numberOfLines={1} style={styles.deckName}>{cardsById[cardId]?.name ?? cardId}{cardId === commanderId ? " · CMD" : ""}</Text>
                <Text style={styles.quantity}>×{quantity}</Text>
                <Pressable onPress={() => remove(cardId)} style={styles.removeButton}><Text style={styles.buttonText}>−</Text></Pressable>
              </View>
            )} />
          <Pressable disabled={!ready} onPress={() => setShowSetup(false)} style={[styles.continue, !ready && styles.disabled]}>
            <Text style={styles.buttonText}>{ready ? "CONTINUER VERS LE MULLIGAN" : "100 CARTES + 1 COMMANDANT REQUIS"}</Text>
          </Pressable>
          <Text style={styles.note}>Ce constructeur est minimal : la liste sera contrôlée par le catalogue et la politique Commander du serveur.</Text>
        </> : <>
          <Pressable onPress={() => setShowSetup(true)} style={styles.back}><Text style={styles.backText}>← MODIFIER LE DECK</Text></Pressable>
          <NetworkPregamePanel client={client} playerId={playerId} deck={deck}
            onGameStarted={onGameStarted} />
        </>}
      </View>
    </Modal>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: "#0b1018", padding: 14, paddingTop: 34 } as const,
  header: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginBottom: 10 },
  title: { color: "#f1f5f9", fontSize: 14, fontWeight: "900" as const, letterSpacing: 1 },
  subtitle: { color: "#8ea0b5", fontSize: 10, marginTop: 3 },
  close: { color: "#9dd9bb", fontSize: 10, fontWeight: "900" as const },
  countRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginBottom: 8 },
  count: { color: "#f1f5f9", fontSize: 15, fontWeight: "900" as const },
  countHint: { color: "#9dd9bb", fontSize: 10, maxWidth: "65%" as const },
  searchRow: { flexDirection: "row" as const, gap: 7 },
  input: { flex: 1, minHeight: 40, borderRadius: 6, borderWidth: 1, borderColor: "#35465c", backgroundColor: "#172333", color: "#f1f5f9", paddingHorizontal: 10, fontSize: 11 },
  searchButton: { minWidth: 78, justifyContent: "center" as const, alignItems: "center" as const, backgroundColor: "#276d53", borderRadius: 6, paddingHorizontal: 9 },
  buttonText: { color: "#f4fff8", fontSize: 9, fontWeight: "900" as const },
  error: { color: "#e5a1a1", fontSize: 10, marginTop: 5 },
  results: { maxHeight: 190, marginTop: 6, borderBottomWidth: 1, borderBottomColor: "#263446" },
  result: { minHeight: 43, flexDirection: "row" as const, alignItems: "center" as const, gap: 5, borderBottomWidth: 1, borderBottomColor: "#263446", paddingVertical: 4 },
  resultCopy: { flex: 1 },
  cardName: { color: "#edf2f8", fontSize: 10, fontWeight: "800" as const },
  cardType: { color: "#8294aa", fontSize: 8, marginTop: 2 },
  smallButton: { backgroundColor: "#31445a", padding: 8, borderRadius: 4, minWidth: 34, alignItems: "center" as const },
  commanderButton: { backgroundColor: "#715b32", padding: 8, borderRadius: 4 },
  section: { color: "#a9bacd", fontSize: 9, fontWeight: "900" as const, marginTop: 8, marginBottom: 3 },
  deckList: { flex: 1, minHeight: 60 },
  deckRow: { minHeight: 28, flexDirection: "row" as const, alignItems: "center" as const, borderBottomWidth: 1, borderBottomColor: "#1e2a39", gap: 7 },
  deckName: { flex: 1, color: "#dce6f2", fontSize: 9 },
  quantity: { color: "#9dd9bb", fontSize: 9, fontWeight: "800" as const },
  removeButton: { backgroundColor: "#653c40", width: 26, height: 23, borderRadius: 4, alignItems: "center" as const, justifyContent: "center" as const },
  continue: { minHeight: 38, backgroundColor: "#276d53", borderRadius: 6, alignItems: "center" as const, justifyContent: "center" as const, marginTop: 8 },
  disabled: { opacity: 0.35 },
  note: { color: "#71839a", fontSize: 8, lineHeight: 12, marginTop: 6 },
  back: { paddingVertical: 8 },
  backText: { color: "#9dd9bb", fontSize: 10, fontWeight: "900" as const }
};
