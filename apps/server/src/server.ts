import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { PlayerSetup } from "@commander-pocket/game-engine";
import type { RoomCommand } from "./game-room.js";
import { RoomRegistry } from "./room-registry.js";
import { toPlayerView } from "./player-view.js";

const port = Number(process.env.PORT ?? 3000);
const rooms = new RoomRegistry();

interface ClientSession {
  socket: WebSocket;
  gameId: string;
  playerId: string;
}

const clients = new Set<ClientSession>();

const httpServer = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "commander-pocket-server" }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const websocketServer = new WebSocketServer({ server: httpServer, path: "/ws" });

websocketServer.on("connection", socket => {
  let session: ClientSession | null = null;

  socket.on("message", raw => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString()) as unknown;
    } catch {
      send(socket, { type: "protocol-error", code: "INVALID_JSON" });
      return;
    }
    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      send(socket, { type: "protocol-error", code: "INVALID_ENVELOPE" });
      return;
    }

    if (parsed.type === "ping") {
      send(socket, { type: "pong", timestamp: Date.now() });
      return;
    }

    if (parsed.type === "create-room") {
      if (session || typeof parsed.gameId !== "string" || !isPlayerSetupList(parsed.players)) {
        send(socket, { type: "room-error", code: "INVALID_CREATE_ROOM" });
        return;
      }
      try {
        const { room, credentials } = rooms.create(parsed.gameId, parsed.players);
        const host = parsed.players.find(player => player.seat === 0);
        if (!host) throw new Error("HOST_SEAT_MISSING");
        session = { socket, gameId: parsed.gameId, playerId: host.id };
        clients.add(session);
        send(socket, {
          type: "room-created",
          gameId: room.id,
          credentials,
          view: toPlayerView(room.state, host.id)
        });
      } catch (error) {
        send(socket, { type: "room-error", code: error instanceof Error ? error.message : "ROOM_CREATE_FAILED" });
      }
      return;
    }

    if (parsed.type === "join-room") {
      if (session || typeof parsed.gameId !== "string" || typeof parsed.playerId !== "string" || typeof parsed.token !== "string") {
        send(socket, { type: "room-error", code: "INVALID_JOIN_ROOM" });
        return;
      }
      const room = rooms.authenticate(parsed.gameId, parsed.playerId, parsed.token);
      if (!room) {
        send(socket, { type: "room-error", code: "INVALID_SEAT_CREDENTIALS" });
        return;
      }
      session = { socket, gameId: parsed.gameId, playerId: parsed.playerId };
      clients.add(session);
      send(socket, { type: "room-joined", view: toPlayerView(room.state, parsed.playerId) });
      return;
    }

    if (parsed.type === "command") {
      if (!session || !isRoomCommand(parsed.command)) {
        send(socket, { type: "command-rejected", code: "NOT_JOINED_OR_INVALID_COMMAND" });
        return;
      }
      if (parsed.command.gameId !== session.gameId || parsed.command.playerId !== session.playerId) {
        send(socket, { type: "command-rejected", code: "SEAT_MISMATCH" });
        return;
      }
      const room = rooms.get(session.gameId);
      if (!room) {
        send(socket, { type: "command-rejected", code: "UNKNOWN_GAME" });
        return;
      }
      const result = room.apply(parsed.command);
      send(socket, { type: "command-result", result });
      if (result.accepted) {
        for (const client of clients) {
          if (client.gameId === session.gameId) {
            send(client.socket, { type: "game-view", view: toPlayerView(room.state, client.playerId) });
          }
        }
      }
      return;
    }

    send(socket, { type: "protocol-error", code: "UNKNOWN_MESSAGE_TYPE" });
  });

  socket.on("close", () => {
    if (session) clients.delete(session);
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlayerSetupList(value: unknown): value is PlayerSetup[] {
  return Array.isArray(value) && value.length === 4 && value.every(player =>
    isRecord(player) && typeof player.id === "string" &&
    typeof player.name === "string" && typeof player.seat === "number"
  );
}

function isRoomCommand(value: unknown): value is RoomCommand {
  return isRecord(value)
    && value.protocolVersion === 1
    && typeof value.gameId === "string"
    && typeof value.commandId === "string"
    && typeof value.playerId === "string"
    && typeof value.expectedRevision === "number"
    && typeof value.type === "string";
}

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

httpServer.listen(port, "0.0.0.0", () => {
  process.stdout.write(`Commander Pocket server listening on :${port}\n`);
});
