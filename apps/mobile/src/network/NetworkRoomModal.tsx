import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from "react-native";
import { RoomClient, type SeatCredential } from "./room-client.js";

export interface MobileGameView {
  id: string;
  revision: number;
  turnNumber: number;
  phase: string;
  step: string;
  priorityPlayerId: string | null;
  stack: readonly unknown[];
  awaitingResolutionId: string | null;
  players: readonly {
    id: string;
    name: string;
    life: number;
    handCount: number;
    libraryCount: number;
    graveyard: readonly string[];
    battlefield: readonly string[];
    commanderCastCount: Readonly<Record<string, number>>;
    manaPool: Readonly<Record<string, number>>;
    isEliminated: boolean;
  }[];
}

export interface RoomSession {
  gameId: string;
  playerId: string;
  token: string;
}

interface Props {
  visible: boolean;
  client: RoomClient;
  onClose: () => void;
  onConnected: (session: RoomSession, view: MobileGameView) => void;
}

const players = [
  { id: "p1", name: "Hôte", seat: 0 },
  { id: "p2", name: "Joueur 2", seat: 1 },
  { id: "p3", name: "Joueur 3", seat: 2 },
  { id: "p4", name: "Joueur 4", seat: 3 }
];

export function NetworkRoomModal({ visible, client, onClose, onConnected }: Props) {
  const [mode, setMode] = useState<"host" | "join">("host");
  const [url, setUrl] = useState("ws://192.168.1.10:3000/ws");
  const [gameId, setGameId] = useState("commander-table-1");
  const [playerId, setPlayerId] = useState("p2");
  const [token, setToken] = useState("");
  const [credentials, setCredentials] = useState<SeatCredential[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setStatus(null);
    try {
      await client.connect(url.trim());
      if (mode === "host") {
        const created = await client.createRoom(gameId.trim(), players);
        const hostCredential = created.credentials.find(item => item.playerId === "p1");
        if (!hostCredential) throw new Error("Le serveur n’a pas fourni le jeton de l’hôte.");
        setCredentials(created.credentials);
        onConnected(
          { gameId: created.gameId, playerId: hostCredential.playerId, token: hostCredential.token },
          created.view as MobileGameView
        );
        setStatus("Salle créée. Partage les jetons de siège avec les trois autres joueurs.");
      } else {
        const joined = await client.joinRoom(gameId.trim(), playerId.trim(), token.trim());
        setCredentials([]);
        onConnected(
          { gameId: gameId.trim(), playerId: playerId.trim(), token: token.trim() },
          joined.view as MobileGameView
        );
        setStatus("Connexion à la salle établie.");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>PARTIE EN RÉSEAU LOCAL</Text>
            <Text style={styles.subtitle}>Même Wi-Fi · serveur sur un appareil du réseau</Text>
          </View>
          <Pressable onPress={onClose}><Text style={styles.close}>FERMER ✕</Text></Pressable>
        </View>
        <View style={styles.modeRow}>
          <Pressable onPress={() => { setMode("host"); setCredentials([]); setStatus(null); }} style={[styles.modeButton, mode === "host" && styles.modeSelected]}>
            <Text style={styles.modeText}>CRÉER UNE SALLE</Text>
          </Pressable>
          <Pressable onPress={() => { setMode("join"); setCredentials([]); setStatus(null); }} style={[styles.modeButton, mode === "join" && styles.modeSelected]}>
            <Text style={styles.modeText}>REJOINDRE</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>URL DU SERVEUR WEBSOCKET</Text>
        <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder="ws://192.168.1.10:3000/ws" placeholderTextColor="#7d8ba0" />
        <Text style={styles.label}>IDENTIFIANT DE SALLE</Text>
        <TextInput value={gameId} onChangeText={setGameId} autoCapitalize="none" style={styles.input} placeholder="commander-table-1" placeholderTextColor="#7d8ba0" />
        {mode === "join" ? (
          <>
            <Text style={styles.label}>SIÈGE</Text>
            <TextInput value={playerId} onChangeText={setPlayerId} autoCapitalize="none" style={styles.input} placeholder="p2" placeholderTextColor="#7d8ba0" />
            <Text style={styles.label}>JETON DE SIÈGE</Text>
            <TextInput value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder="Jeton transmis par l’hôte" placeholderTextColor="#7d8ba0" />
          </>
        ) : (
          <Text style={styles.info}>L’hôte occupe le siège p1. Le serveur crée quatre sièges et leurs jetons privés.</Text>
        )}
        <Pressable onPress={connect} disabled={busy || !url.trim() || !gameId.trim() || (mode === "join" && (!playerId.trim() || !token.trim()))} style={[styles.connectButton, busy && styles.disabled]}>
          {busy ? <ActivityIndicator color="#f3fff8" /> : <Text style={styles.connectText}>{mode === "host" ? "CRÉER ET CONNECTER" : "REJOINDRE LA PARTIE"}</Text>}
        </Pressable>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        {credentials.length > 0 ? (
          <View style={styles.credentials}>
            <Text style={styles.credentialsTitle}>JETONS À TRANSMETTRE AUX AUTRES JOUEURS</Text>
            {credentials.filter(item => item.playerId !== "p1").map(item => (
              <Text key={item.playerId} style={styles.credential}>{item.playerId}  ·  {item.token}</Text>
            ))}
          </View>
        ) : null}
        <Text style={styles.footer}>Le serveur doit être lancé sur le réseau local. La découverte automatique et la reconnexion seront ajoutées ensuite.</Text>
      </View>
    </Modal>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: "#0b1018", padding: 18, paddingTop: 36 } as const,
  header: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginBottom: 16 },
  title: { color: "#f1f5f9", fontSize: 14, fontWeight: "900" as const, letterSpacing: 1 },
  subtitle: { color: "#8ea0b5", fontSize: 10, marginTop: 4 },
  close: { color: "#9dd9bb", fontSize: 11, fontWeight: "900" as const },
  modeRow: { flexDirection: "row" as const, gap: 8, marginBottom: 14 },
  modeButton: { flex: 1, padding: 11, borderRadius: 6, backgroundColor: "#202d3e", alignItems: "center" as const },
  modeSelected: { backgroundColor: "#2f795d" },
  modeText: { color: "#f1f5f9", fontSize: 10, fontWeight: "900" as const },
  label: { color: "#9baabd", fontSize: 9, fontWeight: "900" as const, letterSpacing: 0.7, marginTop: 9, marginBottom: 5 },
  input: { minHeight: 40, borderRadius: 6, borderWidth: 1, borderColor: "#35465c", backgroundColor: "#172333", color: "#f1f5f9", paddingHorizontal: 11, fontSize: 12 },
  info: { color: "#9baabd", fontSize: 11, lineHeight: 17, marginTop: 12 },
  connectButton: { minHeight: 42, backgroundColor: "#2f795d", borderRadius: 6, justifyContent: "center" as const, alignItems: "center" as const, marginTop: 16 },
  disabled: { opacity: 0.5 },
  connectText: { color: "#f3fff8", fontSize: 11, fontWeight: "900" as const },
  status: { color: "#d9e6f3", fontSize: 11, marginTop: 12 },
  credentials: { marginTop: 14, padding: 12, backgroundColor: "#172333", borderRadius: 7 },
  credentialsTitle: { color: "#9dd9bb", fontSize: 9, fontWeight: "900" as const, marginBottom: 8 },
  credential: { color: "#edf2f8", fontSize: 11, marginTop: 4, fontVariant: ["tabular-nums"] as const },
  footer: { color: "#708198", fontSize: 9, lineHeight: 14, marginTop: "auto" as const }
};
