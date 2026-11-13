import React, { useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import {
  advanceAfterAllPass, advanceAutomaticStep, createGame, passPriority,
  type GameState, type PlayerState
} from "@commander-pocket/game-engine";

const initialPlayers = [
  { id: "p1", name: "Vous", seat: 0 },
  { id: "p2", name: "Joueur 2", seat: 1 },
  { id: "p3", name: "Joueur 3", seat: 2 },
  { id: "p4", name: "Joueur 4", seat: 3 }
];

function createDemoGame(): GameState {
  return advanceAutomaticStep(createGame("mobile-demo", initialPlayers));
}

function PlayerPanel({ player, hasPriority, onPass }: {
  player: PlayerState;
  hasPriority: boolean;
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
        <Text style={styles.metric}>Main {player.hand.length}</Text>
        <Text style={styles.metric}>Taxe {commanderTax}</Text>
        <Text style={styles.metric}>Mana {mana}</Text>
      </View>
      <View style={styles.battlefield}>
        <Text style={styles.hint}>CHAMP DE BATAILLE</Text>
        <View style={styles.pileRow}>
          <View style={styles.cardPile}><Text style={styles.pileTitle}>Permanents</Text><Text style={styles.pileCount}>{player.battlefield.length}</Text></View>
          <View style={styles.cardPile}><Text style={styles.pileTitle}>Cimetière</Text><Text style={styles.pileCount}>{player.graveyard.length}</Text></View>
          <View style={styles.cardPile}><Text style={styles.pileTitle}>Bibliothèque</Text><Text style={styles.pileCount}>{player.library.length}</Text></View>
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Passer la priorité pour ${player.name}`} disabled={!hasPriority} onPress={onPass} style={[styles.priorityButton, !hasPriority && styles.priorityButtonDisabled]}>
        <Text style={styles.priorityButtonText}>{hasPriority ? "PASSER LA PRIORITÉ" : player.isEliminated ? "ÉLIMINÉ" : "EN ATTENTE"}</Text>
      </Pressable>
    </View>
  );
}

export default function App() {
  const [game, setGame] = useState<GameState>(createDemoGame);
  const priorityPlayer = game.players.find(player => player.id === game.priorityPlayerId);

  function pass(playerId: string) {
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
        <Text style={styles.turn}>TOUR {game.turnNumber} · {game.phase.toUpperCase()} · {game.step.toUpperCase()}</Text>
        <Text style={styles.priority}>{priorityPlayer ? `Priorité : ${priorityPlayer.name}` : "Résolution / transition"}</Text>
      </View>
      <View style={styles.board}>
        {game.players.map(player => (
          <PlayerPanel key={player.id} player={player} hasPriority={game.priorityPlayerId === player.id} onPass={() => pass(player.id)} />
        ))}
      </View>
      <View style={styles.bottomBar}>
        <Text style={styles.drawerTitle}>PILE · {game.stack.length} OBJET(S)</Text>
        <Text style={styles.drawerHint}>{game.awaitingResolutionId ? "Résolution en attente" : "Les réponses et déclenchements seront affichés ici."}</Text>
        <Text style={styles.handLabel}>MAIN · {game.players[0]?.hand.length ?? 0} CARTES</Text>
      </View>
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
  bottomBar: { minHeight: 48, marginTop: 6, borderRadius: 8, backgroundColor: "#151f2d", paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  drawerTitle: { color: "#e6edf5", fontSize: 11, fontWeight: "900" },
  drawerHint: { color: "#8998aa", fontSize: 10 },
  handLabel: { color: "#c7d4e4", fontSize: 11, fontWeight: "800" }
});
