import type { PlayerSetup } from "@commander-pocket/game-engine";
import type { CommanderDeckList } from "@commander-pocket/card-data";
import type { GameCommandEnvelope, PregameClientMessage, PregameServerMessage } from "@commander-pocket/protocol";

export interface SeatCredential {
  playerId: string;
  token: string;
}

export type RoomClientEvent =
  | { type: "room-created"; gameId: string; credentials: SeatCredential[]; view: unknown }
  | { type: "room-joined"; view: unknown }
  | { type: "game-view"; view: unknown }
  | { type: "command-result"; result: unknown }
  | { type: "pregame-result"; accepted: boolean; code?: string; result?: unknown; revision?: number; view?: unknown }
  | { type: "pregame-view"; view: unknown }
  | { type: "pregame-timeout" }
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
  timeout: ReturnType<typeof setTimeout>;
}

/** Small typed WebSocket client for the LAN room and pregame protocols. */
export class RoomClient {
  private socket: WebSocket | null = null;
  private pendingHandshake: PendingHandshake | null = null;
  private pendingPregameTimeout: ReturnType<typeof setTimeout> | null = null;
  private pregameTimedOut = false;
  private ignoreLatePregameResult = false;
  private readonly listeners = new Set<(event: RoomClientEvent) => void>();

  constructor(
    private readonly createSocket: SocketFactory = url => new WebSocket(url),
    private readonly timeoutMs = 10_000
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("timeoutMs must be a positive finite number.");
  }

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
    this.pregameTimedOut = false;
    this.ignoreLatePregameResult = false;
    this.socket = socket;
    socket.addEventListener("message", event => this.handleMessage(String(event.data)));
    socket.addEventListener("close", event => this.handleSocketClose(socket, event));
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timeout);
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onCloseBeforeOpen);
      };
      const onOpen = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onError = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (this.socket === socket) this.socket = null;
        reject(new Error("Impossible d’ouvrir la connexion au serveur."));
      };
      const onCloseBeforeOpen = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (this.socket === socket) this.socket = null;
        reject(new Error("Connexion fermée avant son ouverture."));
      };
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        if (this.socket === socket) this.socket = null;
        try { socket.close(); } catch { /* Ignore a close failure after the timeout. */ }
        reject(new Error("Délai dépassé pendant l’ouverture de la connexion."));
      }, this.timeoutMs);
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
      socket.addEventListener("close", onCloseBeforeOpen);
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

  submitPregameDeck(deck: CommanderDeckList): void {
    this.sendPregame({
      type: "pregame-submit-deck",
      deck: { commanderIds: [...deck.commanderIds], cards: deck.cards.map(card => ({ ...card })) }
    });
  }

  declareMulligan(action: "keep" | "mulligan"): void {
    this.sendPregame({ type: "pregame-mulligan", action });
  }

  chooseBottomCards(instanceIds: readonly string[]): void {
    this.sendPregame({ type: "pregame-bottom", instanceIds: [...instanceIds] });
  }

  startPregame(): void {
    this.sendPregame({ type: "pregame-start" });
  }

  ping(): void {
    this.send({ type: "ping" });
  }

  disconnect(): void {
    this.socket?.close();
  }

  private sendPregame(message: PregameClientMessage): void {
    if (this.pregameTimedOut) {
      throw new Error("Le délai de réponse pré-partie a expiré. Reconnectez-vous avant de réessayer.");
    }
    if (this.pendingPregameTimeout !== null) {
      throw new Error("Une action de pré-partie est déjà en attente.");
    }
    this.send(message);
    this.pendingPregameTimeout = setTimeout(() => {
      this.pendingPregameTimeout = null;
      this.pregameTimedOut = true;
      this.ignoreLatePregameResult = true;
      this.emit({ type: "pregame-timeout" });
    }, this.timeoutMs);
  }

  private handshake(
    expected: PendingHandshake["expected"],
    payload: Record<string, unknown>
  ): Promise<RoomClientEvent> {
    if (this.pendingHandshake) return Promise.reject(new Error("Une opération de salle est déjà en cours."));
    return new Promise((resolve, reject) => {
      const pending: PendingHandshake = {
        expected, resolve, reject,
        timeout: setTimeout(() => {
          if (this.pendingHandshake !== pending) return;
          this.pendingHandshake = null;
          reject(new Error("Délai dépassé en attendant la réponse du serveur."));
        }, this.timeoutMs)
      };
      this.pendingHandshake = pending;
      try {
        this.send(payload);
      } catch (error) {
        clearTimeout(pending.timeout);
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
    if (event.type === "pregame-result") {
      if (this.ignoreLatePregameResult) {
        this.ignoreLatePregameResult = false;
        return;
      }
      if (this.pendingPregameTimeout !== null) {
        clearTimeout(this.pendingPregameTimeout);
        this.pendingPregameTimeout = null;
      }
    }
    if (this.pendingHandshake) {
      if (event.type === this.pendingHandshake.expected) {
        const pending = this.pendingHandshake;
        this.pendingHandshake = null;
        clearTimeout(pending.timeout);
        pending.resolve(event);
        this.emit(event);
        return;
      }
      if (event.type === "room-error" || event.type === "protocol-error") {
        const pending = this.pendingHandshake;
        this.pendingHandshake = null;
        clearTimeout(pending.timeout);
        pending.reject(new Error(event.code));
      }
    }
    this.emit(event);
  }

  private handleSocketClose(socket: WebSocket, event: CloseEvent): void {
    if (this.socket !== socket) return;
    this.socket = null;
    if (this.pendingPregameTimeout !== null) {
      clearTimeout(this.pendingPregameTimeout);
      this.pendingPregameTimeout = null;
    }
    if (this.pendingHandshake) {
      const pending = this.pendingHandshake;
      this.pendingHandshake = null;
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connexion fermée avant la fin de l’opération."));
    }
    this.emit({ type: "disconnected", reason: event.reason || "Connexion fermée." });
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
    case "pregame-view":
      return { type: value.type, view: value.view };
    case "command-result":
      return { type: "command-result", result: value.result };
    case "pregame-result": {
      if (typeof value.accepted !== "boolean") return null;
      const message: PregameServerMessage = {
        type: "pregame-result",
        accepted: value.accepted,
        ...(typeof value.code === "string" ? { code: value.code } : {}),
        ...(typeof value.revision === "number" ? { revision: value.revision } : {}),
        ...(Object.hasOwn(value, "result") ? { result: value.result } : {}),
        ...(Object.hasOwn(value, "view") ? { view: value.view } : {})
      };
      return message;
    }
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
