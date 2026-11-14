import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { CommanderDeckList } from "@commander-pocket/card-data";
import type { RoomClient, RoomClientEvent } from "./room-client.js";

interface PregameView {
  revision: number;
  step: string;
  players: readonly { id: string; name: string; hand: readonly string[]; handCount: number }[];
}
interface Props {
  client: RoomClient;
  playerId: string;
  deck: CommanderDeckList;
  initialView?: PregameView;
  onGameStarted?: (view: PregameView) => void;
}
interface ProgressResult {
  readyToStart?: boolean;
  allDecksSubmitted?: boolean;
  pendingBottomByPlayer?: Record<string, number>;
}

export function NetworkPregamePanel({ client, playerId, deck, initialView, onGameStarted }: Props) {
  const [view, setView] = useState<PregameView | undefined>(initialView);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingBottom, setPendingBottom] = useState(0);
  const [readyToStart, setReadyToStart] = useState(false);
  const [deckSubmitted, setDeckSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("En attente du serveur…");

  useEffect(() => client.onEvent((event: RoomClientEvent) => {
    if (event.type !== "pregame-result") return;
    setBusy(false);
    if (!event.accepted) { setStatus(event.code ?? "Action refusée."); return; }
    if (event.view && isRecord(event.view)) {
      const nextView = event.view as unknown as PregameView;
      setView(nextView);
      if (nextView.step !== "pregame") onGameStarted?.(nextView);
    }
    if (isRecord(event.result)) {
      const result = event.result as ProgressResult;
      if (result.allDecksSubmitted) setDeckSubmitted(true);
      if (result.pendingBottomByPlayer) {
        setPendingBottom(result.pendingBottomByPlayer[playerId] ?? 0);
        setSelected([]);
      }
      if (typeof result.readyToStart === "boolean") setReadyToStart(result.readyToStart);
    }
    setStatus("Action confirmée par le serveur.");
  }), [client, onGameStarted, playerId]);

  const hand = useMemo(() => view?.players.find(player => player.id === playerId)?.hand ?? [], [view, playerId]);
  function run(action: () => void, label: string) {
    try { setBusy(true); setStatus(label); action(); }
    catch (error) { setBusy(false); setStatus(error instanceof Error ? error.message : "Envoi impossible."); }
  }
  function toggleCard(id: string) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }
  return (
    <ScrollView style={styles.panel} contentContainerStyle={styles.content}>
      <Text style={styles.title}>PRÉ-PARTIE · 4 JOUEURS</Text>
      <Text style={styles.status}>{status}</Text>
      {!deckSubmitted
        ? <ActionButton label="ENVOYER MON DECK" disabled={busy} onPress={() => run(() => client.submitPregameDeck(deck), "Envoi du deck…")} />
        : <Text style={styles.confirmed}>Deck envoyé au serveur</Text>}
      <View style={styles.separator} />
      <Text style={styles.section}>MULLIGAN</Text>
      <View style={styles.actions}>
        <ActionButton label="GARDER" disabled={busy || !deckSubmitted || pendingBottom > 0} onPress={() => run(() => client.declareMulligan("keep"), "Déclaration envoyée…")} />
        <ActionButton label="REMULLIGAN" disabled={busy || !deckSubmitted || pendingBottom > 0} onPress={() => run(() => client.declareMulligan("mulligan"), "Mulligan demandé…")} />
      </View>
      {pendingBottom > 0 ? <>
        <Text style={styles.section}>REMETTRE {pendingBottom} CARTE(S) SOUS LA BIBLIOTHÈQUE</Text>
        <Text style={styles.hint}>Sélectionne exactement {pendingBottom} carte(s) de ta main.</Text>
        {hand.map((id, index) => {
          const active = selected.includes(id);
          return <Pressable key={id} accessibilityRole="checkbox" accessibilityState={{ checked: active }}
            onPress={() => toggleCard(id)} style={[styles.card, active && styles.cardSelected]}>
            <Text style={styles.cardText}>{active ? "☑" : "□"}  Carte {index + 1}</Text>
            <Text style={styles.cardId}>{id}</Text>
          </Pressable>;
        })}
        <ActionButton label={`CONFIRMER ${selected.length}/${pendingBottom}`} disabled={busy || selected.length !== pendingBottom}
          onPress={() => run(() => client.chooseBottomCards(selected), "Choix envoyé…")} />
      </> : null}
      {readyToStart ? <ActionButton label="DÉMARRER LA PARTIE" disabled={busy}
        onPress={() => run(() => client.startPregame(), "Démarrage demandé…")} /> : null}
      {view ? <Text style={styles.meta}>Révision serveur : {view.revision} · Étape : {view.step}</Text> : null}
    </ScrollView>
  );
}
function ActionButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
const styles = {
  panel: { flex: 1, backgroundColor: "#101925" } as const,
  content: { padding: 16, gap: 10 },
  title: { color: "#e9f2fc", fontSize: 14, fontWeight: "900" as const, letterSpacing: 1 },
  status: { color: "#a9bacd", fontSize: 11 },
  confirmed: { color: "#8fe0b5", fontSize: 11, fontWeight: "800" as const },
  separator: { height: 1, backgroundColor: "#344256", marginVertical: 4 },
  section: { color: "#b8c8da", fontSize: 10, fontWeight: "900" as const, letterSpacing: 0.8 },
  actions: { flexDirection: "row" as const, gap: 8 },
  button: { minHeight: 40, paddingHorizontal: 12, borderRadius: 6, backgroundColor: "#276d53", alignItems: "center" as const, justifyContent: "center" as const, flex: 1 },
  disabled: { opacity: 0.4 },
  buttonText: { color: "#f4fff8", fontSize: 10, fontWeight: "900" as const },
  hint: { color: "#91a4ba", fontSize: 10 },
  card: { minHeight: 42, padding: 9, borderWidth: 1, borderColor: "#40516a", borderRadius: 5, backgroundColor: "#1b293a" },
  cardSelected: { borderColor: "#8fe0b5", backgroundColor: "#234536" },
  cardText: { color: "#edf4fc", fontSize: 11, fontWeight: "800" as const },
  cardId: { color: "#8194aa", fontSize: 8, marginTop: 3 },
  meta: { color: "#70849c", fontSize: 9, marginTop: 4 }
};
