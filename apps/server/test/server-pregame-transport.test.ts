import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createCommanderPocketServer } from "../src/server.js";

describe("WebSocket pregame transport", () => {
  it("requires an authenticated room seat and fails closed when server catalog policy is not configured", async () => {
    const runtime = createCommanderPocketServer();
    runtime.httpServer.listen(0, "127.0.0.1");
    await once(runtime.httpServer, "listening");
    const address = runtime.httpServer.address() as AddressInfo;
    const client = new WebSocket(`ws://127.0.0.1:${address.port}/ws`);
    await once(client, "open");

    const receive = (): Promise<Record<string, unknown>> => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WEBSOCKET_RESPONSE_TIMEOUT")), 2_000);
      client.once("message", raw => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(raw.toString()) as Record<string, unknown>);
        } catch (error) {
          reject(error);
        }
      });
    });

    try {
      client.send(JSON.stringify({ type: "pregame-start" }));
      expect(await receive()).toMatchObject({
        type: "pregame-result", accepted: false, code: "NOT_JOINED"
      });

      client.send(JSON.stringify({
        type: "create-room",
        gameId: "ws-pregame",
        players: [
          { id: "p1", name: "Alice", seat: 0 },
          { id: "p2", name: "Bob", seat: 1 },
          { id: "p3", name: "Chloe", seat: 2 },
          { id: "p4", name: "David", seat: 3 }
        ]
      }));
      const created = await receive();
      expect(created.type).toBe("room-created");
      client.send(JSON.stringify({ type: "pregame-start" }));
      expect(await receive()).toMatchObject({
        type: "pregame-result", accepted: false, code: "PREGAME_NOT_CONFIGURED"
      });
    } finally {
      client.close();
      await once(client, "close");
      await runtime.close();
    }
  });
});
