import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const port = Number(process.env.PORT ?? 3000);

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
  socket.on("message", raw => {
    let message: unknown;
    try {
      message = JSON.parse(raw.toString()) as unknown;
    } catch {
      send(socket, { type: "protocol-error", code: "INVALID_JSON" });
      return;
    }

    if (typeof message !== "object" || message === null || !("type" in message)) {
      send(socket, { type: "protocol-error", code: "INVALID_ENVELOPE" });
      return;
    }
    if (message.type === "ping") {
      send(socket, { type: "pong", timestamp: Date.now() });
      return;
    }
    send(socket, { type: "command-rejected", code: "GAME_COMMANDS_NOT_ENABLED" });
  });
});

function send(socket: WebSocket, payload: unknown): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

httpServer.listen(port, "0.0.0.0", () => {
  process.stdout.write(`Commander Pocket server listening on :${port}\n`);
});
