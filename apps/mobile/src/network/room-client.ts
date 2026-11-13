import type { PlayerSetup } from "@commander-pocket/game-engine";
import type { GameCommandEnvelope } from "@commander-pocket/protocol";

export interface SeatCredential {
  playerId: string;
  token: string;
}

export type RoomClientEvent =
  | { type: "room-created"; gameId: string; credentials: SeatCredential[]; view: unknown }
  | { type: "room-joined"; view: unknown }
  | { type: "game-view"; view: unknown }
  | { type: "command-result"; result: unknown }
  | { type: "command-rejected"; code: string }
  | { type: "room-error"; code: string }
  | { type: "protocol-error"; code: string }
  | { type: "pong"; timestamp: number }
  | { type: "disconnected"; reason: string };

type SocketFactory = (url: string) => WebSocket;

interface PendingHandshake {
  expected: "room-created" | "room-joined";
  resolve: (event: RoomClientEvent) => void;
  reject: (error: Error) => void;
}

/** Small typed WebSocket client for the LAN room protocol. */
export class RoomClient {
  private socket: WebSocket | null = null;
  private pendingHandshake: PendingHandshake | null = null;
  private readonly listeners = new Set<(event: RoomClientEvent) => void>();

  constructor(private readonly createSocket: SocketFactory = url => new WebSocket(url)) {}

  onEvent(listener: (event: RoomClientEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(url: string): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      throw new Error("Une connexion est déjà en cours.");
    }
    const socket = this.createSocket(url);
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        this.socket = null;
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        reject(new Error("Impossible d’ouvrir la connexion au serveur."));
      };
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
      socket.addEventListener("message", event => this.handleMessage(String(event.data)));
      socket.addEventListener("close", event => {
        this.socket = null;
        this.pendingHandshake?.reject(new Error("Connexion fermée avant la fin de l’opération."));
        this.pendingHandshake = null;
        this.emit({ type: "disconnected", reason: event.reason || "Connexion fermée." });
      });
    });
  }

  createRoom(gameId: string, players: readonly PlayerSetup[]): Promise<Extract<RoomClientEvent, { type: "room-created" }>> {
    return this.handshake(
      "room-created",
      { type: "create-room", gameId, players }
    ) as Promise<Extract<RoomClientEvent, { type: "room-created" }>>;
  }

  joinRoom(gameId: string, playerId: string, token: string): Promise<Extract<RoomClientEvent, { type: "room-joined" }>> {
    return this.handshake(
      "room-joined",
      { type: "join-room", gameId, playerId, token }
    ) as Promise<Extract<RoomClientEvent, { type: "room-joined" }>>;
  }

  sendCommand(command: GameCommandEnvelope): void {
    this.send({ type: "command", command });
  }

  ping(): void {
    this.send({ type: "ping" });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  private handshake(
    expected: PendingHandshake["expected"],
    payload: Record<string, unknown>
  ): Promise<RoomClientEvent> {
    if (this.pendingHandshake) return Promise.reject(new Error("Une opération de salle est déjà en cours."));
    return new Promise((resolve, reject) => {
      this.pendingHandshake = { expected, resolve, reject };
      try {
        this.send(payload);
      } catch (error) {
        this.pendingHandshake = null;
        reject(error instanceof Error ? error : new Error("Échec d’envoi."));
      }
    });
  }

  private send(payload: unknown): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Le client n’est pas connecté.");
    }
    this.socket.send(JSON.stringify(payload));
  }

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      this.emit({ type: "protocol-error", code: "INVALID_JSON" });
      return;
    }
    const event = parseRoomEvent(parsed);
    if (!event) {
      this.emit({ type: "protocol-error", code: "INVALID_ENVELOPE" });
      return;
    }
    if (this.pendingHandshake) {
      if (event.type === this.pendingHandshake.expected) {
        const pending = this.pendingHandshake;
        this.pendingHandshake = null;
        pending.resolve(event);
        this.emit(event);
        return;
      }
      if (event.type === "room-error" || event.type === "protocol-error") {
        const pending = this.pendingHandshake;
        this.pendingHandshake = null;
        pending.reject(new Error(event.code));
      }
    }
    this.emit(event);
  }

  private emit(event: RoomClientEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function parseRoomEvent(value: unknown): RoomClientEvent | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  switch (value.type) {
    case "room-created": {
      if (typeof value.gameId !== "string" || !Array.isArray(value.credentials)) return null;
      const credentials = value.credentials.filter((item): item is SeatCredential =>
        isRecord(item) && typeof item.playerId === "string" && typeof item.token === "string"
      );
      if (credentials.length !== value.credentials.length) return null;
      return { type: "room-created", gameId: value.gameId, credentials, view: value.view };
    }
    case "room-joined":
    case "game-view":
      return { type: value.type, view: value.view };
    case "command-result":
      return { type: "command-result", result: value.result };
    case "command-rejected":
    case "room-error":
    case "protocol-error":
      return { type: value.type, code: typeof value.code === "string" ? value.code : "UNKNOWN_ERROR" };
    case "pong":
      return typeof value.timestamp === "number" ? { type: "pong", timestamp: value.timestamp } : null;
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
