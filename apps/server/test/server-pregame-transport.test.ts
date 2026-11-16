import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createCommanderPocketServer } from "../src/server.js";

import type { CardDefinition, CommanderDeckList } from "@commander-pocket/card-data";
import type { PlayerSetup } from "@commander-pocket/game-engine";
import { PregameCoordinator } from "../src/pregame-coordinator.js";
import { JsonFileRoomPersistence } from "../src/room-persistence.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 },
  { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloe", seat: 2 },
  { id: "p4", name: "David", seat: 3 }
];
function card(providerId: string, name: string, typeLine: string, colorIdentity: string[] = []): CardDefinition {
  return {
    provider: "scryfall", providerId, oracleId: providerId, name, layout: "normal",
    manaCost: null, manaValue: 0, typeLine, oracleText: "", colors: colorIdentity,
    colorIdentity, legalities: { commander: "legal" }, faces: [],
    raw: { id: providerId, name, layout: "normal", cmc: 0, type_line: typeLine,
      colors: colorIdentity, color_identity: colorIdentity, legalities: { commander: "legal" },
      set: "tst", collector_number: "1" }
  };
}
const catalog = {
  cmd: card("cmd", "Test Commander", "Legendary Creature — Wizard", ["U"]),
  island: card("island", "Island", "Basic Land — Island", ["U"])
};
const deck: CommanderDeckList = {
  commanderIds: ["cmd"],
  cards: [{ cardId: "cmd", quantity: 1 }, { cardId: "island", quantity: 99 }]
};
function createMessageQueue(client: WebSocket) {
  const buffered: Record<string, unknown>[] = [];
  const waiters: Array<(message: Record<string, unknown>) => void> = [];
  client.on("message", raw => {
    const message = JSON.parse(raw.toString()) as Record<string, unknown>;
    const waiter = waiters.shift();
    if (waiter) waiter(message);
    else buffered.push(message);
  });
  return {
    next(): Promise<Record<string, unknown>> {
      const message = buffered.shift();
      if (message) return Promise.resolve(message);
      return new Promise(resolve => waiters.push(resolve));
    }
  };
}

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
  it("restores a submitted deck when a WebSocket server runtime is recreated", async () => {
    const directory = mkdtempSync(join(tmpdir(), "commander-pocket-ws-restart-"));
    const persistence = new JsonFileRoomPersistence(directory);
    const factory = {
      create: (gameId: string, setup: readonly PlayerSetup[]) => new PregameCoordinator(gameId, setup, catalog, {
        isCommanderEligible: candidate => candidate.providerId === "cmd"
      })
    };
    let runtime = createCommanderPocketServer({ persistence, pregameFactory: factory });
    let runtimeClosed = false;
    let client: WebSocket | null = null;
    try {
      runtime.httpServer.listen(0, "127.0.0.1");
      await once(runtime.httpServer, "listening");
      const firstAddress = runtime.httpServer.address() as AddressInfo;
      client = new WebSocket(`ws://127.0.0.1:${firstAddress.port}/ws`);
      const firstQueue = createMessageQueue(client);
      await once(client, "open");
      client.send(JSON.stringify({ type: "create-room", gameId: "ws-restart-pregame", players }));
      const created = await firstQueue.next();
      expect(created.type).toBe("room-created");
      const credentials = created.credentials as Array<{ playerId: string; token: string }>;
      const alice = credentials.find(item => item.playerId === "p1")!;
      client.send(JSON.stringify({ type: "pregame-submit-deck", deck }));
      expect(await firstQueue.next()).toMatchObject({
        type: "pregame-result", accepted: true, result: { accepted: true }
      });
      expect((await firstQueue.next()).type).toBe("pregame-view");

      client.close();
      await once(client, "close");
      await runtime.close();
      runtimeClosed = true;

      runtime = createCommanderPocketServer({ persistence, pregameFactory: factory });
      runtimeClosed = false;
      runtime.httpServer.listen(0, "127.0.0.1");
      await once(runtime.httpServer, "listening");
      const secondAddress = runtime.httpServer.address() as AddressInfo;
      client = new WebSocket(`ws://127.0.0.1:${secondAddress.port}/ws`);
      const secondQueue = createMessageQueue(client);
      await once(client, "open");
      client.send(JSON.stringify({
        type: "join-room", gameId: "ws-restart-pregame", playerId: alice.playerId, token: alice.token
      }));
      expect(await secondQueue.next()).toMatchObject({ type: "room-joined", view: { status: "pregame" } });

      client.send(JSON.stringify({ type: "pregame-submit-deck", deck }));
      expect(await secondQueue.next()).toMatchObject({
        type: "pregame-result", accepted: true, result: { accepted: false, code: "DUPLICATE_SUBMISSION" }
      });
    } finally {
      if (client && client.readyState !== WebSocket.CLOSED) {
        client.close();
        await once(client, "close");
      }
      if (!runtimeClosed) await runtime.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("runs deck submission, mulligan, start and first priority across four private WebSocket seats", async () => {
    let seed = 0;
    const runtime = createCommanderPocketServer({
      pregameFactory: {
        create: (gameId, setup) => new PregameCoordinator(gameId, setup, catalog, {
          isCommanderEligible: candidate => candidate.providerId === "cmd"
        }, () => `ws-seed-${++seed}`)
      }
    });
    runtime.httpServer.listen(0, "127.0.0.1");
    await once(runtime.httpServer, "listening");
    const address = runtime.httpServer.address() as AddressInfo;
    const clients = players.map(() => new WebSocket(`ws://127.0.0.1:${address.port}/ws`));
    const queues = clients.map(createMessageQueue);
    try {
      await Promise.all(clients.map(client => once(client, "open")));
      clients[0]?.send(JSON.stringify({ type: "create-room", gameId: "ws-four-seat", players }));
      const created = await queues[0]!.next();
      expect(created.type).toBe("room-created");
      const credentials = created.credentials as Array<{ playerId: string; token: string }>;
      expect(credentials).toHaveLength(4);
      for (let index = 1; index < players.length; index += 1) {
        const player = players[index]!;
        const credential = credentials.find(item => item.playerId === player.id);
        expect(credential).toBeDefined();
        clients[index]?.send(JSON.stringify({
          type: "join-room", gameId: "ws-four-seat", playerId: player.id, token: credential?.token
        }));
        expect(await queues[index]!.next()).toMatchObject({ type: "room-joined" });
      }
      for (let index = 0; index < players.length; index += 1) {
        clients[index]?.send(JSON.stringify({ type: "pregame-submit-deck", deck }));
        expect(await queues[index]!.next()).toMatchObject({ type: "pregame-result", accepted: true });
        const views = await Promise.all(queues.map(queue => queue.next()));
        expect(views.every(message => message.type === "pregame-view")).toBe(true);
      }
      for (let index = 0; index < players.length; index += 1) {
        clients[index]?.send(JSON.stringify({ type: "pregame-mulligan", action: "keep" }));
        expect(await queues[index]!.next()).toMatchObject({ type: "pregame-result", accepted: true });
        const views = await Promise.all(queues.map(queue => queue.next()));
        expect(views.every(message => message.type === "pregame-view")).toBe(true);
      }
      clients[0]?.send(JSON.stringify({ type: "pregame-start" }));
      const startResult = await queues[0]!.next();
      expect(startResult).toMatchObject({
        type: "pregame-result", accepted: true,
        view: { status: "active", phase: "beginning", step: "upkeep", priorityPlayerId: "p1" }
      });
      const activeViews = await Promise.all(queues.map(queue => queue.next()));
      expect(activeViews.every(message => message.type === "pregame-view")).toBe(true);
      for (let viewerIndex = 0; viewerIndex < players.length; viewerIndex += 1) {
        const view = activeViews[viewerIndex]?.view as {
          status: string;
          revision: number;
          players: Array<{ id: string; hand: string[]; handCount: number }>;
        };
        expect(view.status).toBe("active");
        for (let playerIndex = 0; playerIndex < players.length; playerIndex += 1) {
          const playerView = view.players.find(player => player.id === players[playerIndex]?.id);
          expect(playerView).toBeDefined();
          if (playerIndex === viewerIndex) expect(playerView?.hand).toHaveLength(7);
          else {
            expect(playerView?.hand).toEqual([]);
            expect(playerView?.handCount).toBe(7);
          }
        }
      }
      const hostView = activeViews[0]?.view as { revision: number };
      clients[0]?.send(JSON.stringify({
        type: "command",
        command: {
          protocolVersion: 1, gameId: "ws-four-seat", commandId: "first-pass",
          playerId: "p1", expectedRevision: hostView.revision, type: "pass-priority", payload: {}
        }
      }));
      expect(await queues[0]!.next()).toMatchObject({
        type: "command-result", result: { accepted: true, outcome: "passed" }
      });
      const gameViews = await Promise.all(queues.map(queue => queue.next()));
      expect(gameViews.every(message => message.type === "game-view")).toBe(true);
      for (const message of gameViews) expect(message.view).toMatchObject({ status: "active", priorityPlayerId: "p2" });
    } finally {
      await Promise.all(clients.map(client => new Promise<void>(resolve => {
        if (client.readyState === WebSocket.CLOSED) resolve();
        else { client.once("close", () => resolve()); client.close(); }
      })));
      await runtime.close();
    }
  });

});
