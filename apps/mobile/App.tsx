import React from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";

const seats = [
  { id: "p2", name: "Joueur 2", life: 40, hand: 7, commanderTax: 0, mana: "—", color: "#23344a" },
  { id: "p3", name: "Joueur 3", life: 40, hand: 7, commanderTax: 0, mana: "—", color: "#3a2d46" },
  { id: "p4", name: "Joueur 4", life: 40, hand: 7, commanderTax: 0, mana: "—", color: "#254238" },
  { id: "p1", name: "Vous", life: 40, hand: 7, commanderTax: 0, mana: "—", color: "#49382b" }
];

function PlayerPanel({ player }: { player: (typeof seats)[number] }) {
  return (
    <View style={[styles.player, { borderColor: player.color }]}>
      <View style={styles.playerHeader}>
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={styles.life}>{player.life} PV</Text>
      </View>
      <View style={styles.telemetry}>
        <Text style={styles.metric}>Main {player.hand}</Text>
        <Text style={styles.metric}>Taxe {player.commanderTax}</Text>
        <Text style={styles.metric}>Mana {player.mana}</Text>
      </View>
      <View style={styles.battlefield}>
        <Text style={styles.hint}>Champ de bataille</Text>
        <View style={styles.pileRow}>
          <View style={styles.cardPile}><Text style={styles.pileTitle}>Créatures</Text><Text style={styles.pileCount}>—</Text></View>
          <View style={styles.cardPile}><Text style={styles.pileTitle}>Autres</Text><Text style={styles.pileCount}>—</Text></View>
          <View style={styles.cardPile}><Text style={styles.pileTitle}>Jetons</Text><Text style={styles.pileCount}>x0</Text></View>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <View style={styles.topBar}>
        <Text style={styles.brand}>COMMANDER POCKET</Text>
        <Text style={styles.turn}>Tour 1 · Début · Dégagement</Text>
        <Text style={styles.priority}>Initialisation</Text>
      </View>
      <View style={styles.board}>
        {seats.map(player => <PlayerPanel key={player.id} player={player} />)}
      </View>
      <View style={styles.bottomBar}>
        <Text style={styles.drawerTitle}>PILE · 0 OBJET</Text>
        <Text style={styles.drawerHint}>La fenêtre de priorité et les réponses apparaîtront ici.</Text>
        <Text style={styles.handLabel}>MAIN · 7 CARTES</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0b1018", paddingHorizontal: 10, paddingTop: 8, paddingBottom: 7 },
  topBar: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  brand: { color: "#f1f5f9", fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  turn: { color: "#a8b4c5", fontSize: 12, fontWeight: "600" },
  priority: { color: "#9dd9bb", fontSize: 11, fontWeight: "700" },
  board: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  player: { width: "49.3%", flexGrow: 1, minHeight: "46%", borderWidth: 1, borderRadius: 9, backgroundColor: "#131c29", padding: 8 },
  playerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  playerName: { color: "#edf2f8", fontSize: 13, fontWeight: "800" },
  life: { color: "#fff", fontSize: 17, fontWeight: "900", fontVariant: ["tabular-nums"] },
  telemetry: { flexDirection: "row", gap: 14, paddingTop: 4 },
  metric: { color: "#9baabd", fontSize: 10, fontWeight: "600" },
  battlefield: { flex: 1, justifyContent: "center", paddingTop: 4 },
  hint: { color: "#607086", fontSize: 10, textAlign: "center", marginBottom: 5 },
  pileRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  cardPile: { minWidth: 74, borderRadius: 6, backgroundColor: "#202d3e", padding: 7, alignItems: "center" },
  pileTitle: { color: "#b7c3d2", fontSize: 9, fontWeight: "700" },
  pileCount: { color: "#f1f5f9", fontSize: 12, fontWeight: "900", marginTop: 2 },
  bottomBar: { minHeight: 54, marginTop: 6, borderRadius: 8, backgroundColor: "#151f2d", paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  drawerTitle: { color: "#e6edf5", fontSize: 11, fontWeight: "900" },
  drawerHint: { color: "#8998aa", fontSize: 10 },
  handLabel: { color: "#c7d4e4", fontSize: 11, fontWeight: "800" }
});
