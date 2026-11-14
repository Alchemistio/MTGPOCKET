import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { PlayerSetup } from "@commander-pocket/game-engine";
import type { CommanderDeckList } from "@commander-pocket/card-data";
import type { PregameCoordinatorFactory } from "./pregame-session-registry.js";
import { PregameSessionRegistry } from "./pregame-session-registry.js";
import { loadServerPregameConfigFromEnvironment } from "./server-catalog.js";
import type { RoomCommand } from "./game-room.js";
import { RoomRegistry } from "./room-registry.js";
import { toPlayerView } from "./player-view.js";

interface ClientSession { socket: WebSocket; gameId: string; playerId: string; token: string; }
export interface CommanderPocketServerOptions { port?: number; pregameFactory?: PregameCoordinatorFactory; }
export interface CommanderPocketServerRuntime {
  httpServer: Server; websocketServer: WebSocketServer; rooms: RoomRegistry; close(): Promise<void>;
}
export function createCommanderPocketServer(options: CommanderPocketServerOptions = {}): CommanderPocketServerRuntime {
  const rooms = new RoomRegistry();
  const pregame = options.pregameFactory ? new PregameSessionRegistry(rooms, options.pregameFactory) : null;
  const clients = new Set<ClientSession>();
  const httpServer = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok", service: "commander-pocket-server" }));
      return;
    }
    response.writeHead(404); response.end();
  });
  const websocketServer = new WebSocketServer({ server: httpServer, path: "/ws", maxPayload: 64 * 1024 });
  websocketServer.on("connection", socket => {
    let session: ClientSession | null = null;
    socket.on("message", raw => {
      let parsed: unknown;
      try { parsed = JSON.parse(raw.toString()) as unknown; }
      catch { send(socket, { type: "protocol-error", code: "INVALID_JSON" }); return; }
      if (!isRecord(parsed) || typeof parsed.type !== "string") {
        send(socket, { type: "protocol-error", code: "INVALID_ENVELOPE" }); return;
      }
      if (parsed.type === "ping") { send(socket, { type: "pong", timestamp: Date.now() }); return; }
      if (parsed.type === "create-room") {
        if (session || typeof parsed.gameId !== "string" || !isPlayerSetupList(parsed.players)) {
          send(socket, { type: "room-error", code: "INVALID_CREATE_ROOM" }); return;
        }
        try {
          const { room, credentials } = rooms.create(parsed.gameId, parsed.players);
          const host = parsed.players.find(player => player.seat === 0);
          const hostCredential = credentials.find(credential => credential.playerId === host?.id);
          if (!host || !hostCredential) throw new Error("HOST_SEAT_MISSING");
          session = { socket, gameId: parsed.gameId, playerId: host.id, token: hostCredential.token };
          clients.add(session);
          send(socket, { type: "room-created", gameId: room.id, credentials, view: toPlayerView(room.state, host.id) });
        } catch (error) {
          send(socket, { type: "room-error", code: error instanceof Error ? error.message : "ROOM_CREATE_FAILED" });
        }
        return;
      }
      if (parsed.type === "join-room") {
        if (session || typeof parsed.gameId !== "string" || typeof parsed.playerId !== "string" || typeof parsed.token !== "string") {
          send(socket, { type: "room-error", code: "INVALID_JOIN_ROOM" }); return;
        }
        const room = rooms.authenticate(parsed.gameId, parsed.playerId, parsed.token);
        if (!room) { send(socket, { type: "room-error", code: "INVALID_SEAT_CREDENTIALS" }); return; }
        session = { socket, gameId: parsed.gameId, playerId: parsed.playerId, token: parsed.token };
        clients.add(session);
        send(socket, { type: "room-joined", view: toPlayerView(room.state, parsed.playerId) });
        return;
      }
      if (parsed.type.startsWith("pregame-")) { handlePregameMessage(socket, session, parsed, pregame, clients); return; }
      if (parsed.type === "command") {
        if (!session || !isRoomCommand(parsed.command)) {
          send(socket, { type: "command-rejected", code: "NOT_JOINED_OR_INVALID_COMMAND" }); return;
        }
        if (parsed.command.gameId !== session.gameId || parsed.command.playerId !== session.playerId) {
          send(socket, { type: "command-rejected", code: "SEAT_MISMATCH" }); return;
        }
        const room = rooms.get(session.gameId);
        if (!room) { send(socket, { type: "command-rejected", code: "UNKNOWN_GAME" }); return; }
        const result = room.apply(parsed.command);
        send(socket, { type: "command-result", result });
        if (result.accepted) for (const client of clients) {
          if (client.gameId === session.gameId) send(client.socket, { type: "game-view", view: toPlayerView(room.state, client.playerId) });
        }
        return;
      }
      send(socket, { type: "protocol-error", code: "UNKNOWN_MESSAGE_TYPE" });
    });
    socket.on("close", () => { if (session) clients.delete(session); });
  });
  return {
    httpServer, websocketServer, rooms,
    close: () => new Promise<void>((resolve, reject) => {
      websocketServer.close(error => {
        if (error) reject(error);
        else httpServer.close(closeError => closeError ? reject(closeError) : resolve());
      });
    })
  };
}
function handlePregameMessage(
  socket: WebSocket, session: ClientSession | null, message: Record<string, unknown>,
  registry: PregameSessionRegistry | null, clients: ReadonlySet<ClientSession>
): void {
  if (!session) { send(socket, { type: "pregame-result", accepted: false, code: "NOT_JOINED" }); return; }
  if (!registry) { send(socket, { type: "pregame-result", accepted: false, code: "PREGAME_NOT_CONFIGURED" }); return; }
  let result: unknown;
  switch (message.type) {
    case "pregame-submit-deck":
      if (!isCommanderDeckList(message.deck)) {
        send(socket, { type: "pregame-result", accepted: false, code: "INVALID_DECK_PAYLOAD" }); return;
      }
      result = registry.submitDeck(session.gameId, session.playerId, session.token, message.deck); break;
    case "pregame-mulligan":
      if (message.action !== "keep" && message.action !== "mulligan") {
        send(socket, { type: "pregame-result", accepted: false, code: "INVALID_MULLIGAN_ACTION" }); return;
      }
      result = registry.declareMulligan(session.gameId, session.playerId, session.token, message.action); break;
    case "pregame-bottom":
      if (!Array.isArray(message.instanceIds) ||
          !message.instanceIds.every(item => typeof item === "string" && item.length > 0) || message.instanceIds.length > 20) {
        send(socket, { type: "pregame-result", accepted: false, code: "INVALID_BOTTOM_SELECTION" }); return;
      }
      result = registry.chooseBottomCards(session.gameId, session.playerId, session.token, message.instanceIds as string[]); break;
    case "pregame-start":
      result = registry.start(session.gameId, session.playerId, session.token); break;
    default:
      send(socket, { type: "pregame-result", accepted: false, code: "UNKNOWN_PREGAME_MESSAGE" }); return;
  }
  const response = asRecord(result);
  send(socket, { type: "pregame-result", ...response });
  if (response.accepted === true) for (const seatView of registry.viewsForGame(session.gameId)) {
    for (const client of clients) {
      if (client.gameId === session.gameId && client.playerId === seatView.playerId) {
        send(client.socket, { type: "pregame-view", view: seatView.view });
      }
    }
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isPlayerSetupList(value: unknown): value is PlayerSetup[] {
  return Array.isArray(value) && value.length === 4 && value.every(player =>
    isRecord(player) && typeof player.id === "string" && typeof player.name === "string" && typeof player.seat === "number");
}
function isCommanderDeckList(value: unknown): value is CommanderDeckList {
  if (!isRecord(value) || !Array.isArray(value.commanderIds) || !Array.isArray(value.cards)) return false;
  if (!value.commanderIds.every(id => typeof id === "string" && id.length > 0)) return false;
  return value.cards.every(entry => isRecord(entry) && typeof entry.cardId === "string" &&
    entry.cardId.length > 0 && Number.isInteger(entry.quantity) && (entry.quantity as number) > 0 && (entry.quantity as number) <= 100);
}
function isRoomCommand(value: unknown): value is RoomCommand {
  return isRecord(value) && value.protocolVersion === 1 && typeof value.gameId === "string" &&
    typeof value.commandId === "string" && typeof value.playerId === "string" &&
    typeof value.expectedRevision === "number" && typeof value.type === "string";
}
function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : { accepted: false, code: "PREGAME_ERROR" };
}
function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}
const port = Number(process.env.PORT ?? 3000);
const configuredPregame = loadServerPregameConfigFromEnvironment();
const runtime = createCommanderPocketServer({
  port, ...(configuredPregame ? { pregameFactory: configuredPregame.factory } : {})
});
runtime.httpServer.listen(port, "0.0.0.0", () => {
  process.stdout.write("Commander Pocket server listening on :" + port + "\n");
});
