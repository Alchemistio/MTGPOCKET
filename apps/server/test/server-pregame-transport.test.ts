import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createCommanderPocketServer } from "../src/server.js";

import type { CardDefinition, CommanderDeckList } from "@commander-pocket/card-data";
import { addCardInstance, advanceAutomaticStep, createGame, type PlayerSetup } from "@commander-pocket/game-engine";
import { PregameCoordinator } from "../src/pregame-coordinator.js";
import { JsonFileRoomPersistence } from "../src/room-persistence.js";
import { resolveBasicSpellEffect, supportsBasicSpell } from "../src/basic-spell-effects.js";

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
      expect(created).toMatchObject({ type: "room-created", view: { status: "pregame" } });
      expect(persistence.loadAll()[0]?.pregameCheckpoint?.submittedDecks).toHaveLength(0);
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

  it("casts vanilla and ETB permanents through the authenticated four-seat WebSocket transport", async () => {
    const plains: CardDefinition = {
      ...card("ws-plains", "Plains", "Basic Land — Plains"),
      manaCost: "", manaValue: 0
    };
    const scout: CardDefinition = {
      ...card("ws-scout", "Vanilla Scout", "Creature — Human Soldier", ["W"]),
      manaCost: "{W}", manaValue: 1
    };
    const wall: CardDefinition = {
      ...card("ws-wall-of-omens", "Wall of Omens", "Creature — Wall", ["W"]),
      manaCost: "", manaValue: 0,
      oracleText: "When Wall of Omens enters the battlefield, draw a card.",
      raw: {
        id: "ws-wall-of-omens", name: "Wall of Omens", layout: "normal", mana_cost: "",
        cmc: 0, type_line: "Creature — Wall",
        oracle_text: "When Wall of Omens enters the battlefield, draw a card.",
        colors: ["W"], color_identity: ["W"], legalities: { commander: "legal" },
        set: "tst", collector_number: "13"
      }
    };
    const libraryCard = card("ws-library-card", "Library Card", "Sorcery");
    const definitions = new Map([
      [plains.providerId, plains],
      [scout.providerId, scout],
      [wall.providerId, wall],
      [libraryCard.providerId, libraryCard]
    ]);
    const runtime = createCommanderPocketServer({
      resolveCard: cardId => definitions.get(cardId),
      resolveStackEffect: resolveBasicSpellEffect,
      supportsSpell: supportsBasicSpell
    });
    runtime.httpServer.listen(0, "127.0.0.1");
    await once(runtime.httpServer, "listening");
    const address = runtime.httpServer.address() as AddressInfo;
    const clients = players.map(() => new WebSocket(`ws://127.0.0.1:${address.port}/ws`));
    const queues = clients.map(createMessageQueue);
    try {
      await Promise.all(clients.map(client => once(client, "open")));
      clients[0]?.send(JSON.stringify({ type: "create-room", gameId: "ws-vanilla-permanent", players }));
      const created = await queues[0]!.next();
      const credentials = created.credentials as Array<{ playerId: string; token: string }>;
      for (let index = 1; index < players.length; index += 1) {
        const player = players[index]!;
        const credential = credentials.find(item => item.playerId === player.id);
        clients[index]?.send(JSON.stringify({
          type: "join-room", gameId: "ws-vanilla-permanent", playerId: player.id, token: credential?.token
        }));
        expect(await queues[index]!.next()).toMatchObject({ type: "room-joined" });
      }

      let state = { ...advanceAutomaticStep(createGame("ws-vanilla-permanent", players)), deckSetupComplete: true };
      state = addCardInstance(state, {
        instance_id: "plains-instance", card_id: plains.providerId, owner_id: "p1", zone: "battlefield"
      });
      state = addCardInstance(state, {
        instance_id: "plains-hand-instance", card_id: plains.providerId, owner_id: "p1", zone: "hand"
      });
      state = addCardInstance(state, {
        instance_id: "scout-instance", card_id: scout.providerId, owner_id: "p1", zone: "hand"
      });
      state = addCardInstance(state, {
        instance_id: "wall-instance", card_id: wall.providerId, owner_id: "p1", zone: "hand"
      });
      state = addCardInstance(state, {
        instance_id: "library-instance", card_id: libraryCard.providerId, owner_id: "p1", zone: "library"
      });
      state = addCardInstance(state, {
        instance_id: "etb-library-instance", card_id: libraryCard.providerId, owner_id: "p1", zone: "library"
      });
      const room = runtime.rooms.get("ws-vanilla-permanent");
      if (!room) throw new Error("ROOM_NOT_FOUND");
      room.replaceStateFromPregame(state);
      let revision = room.state.revision;

      type TransportView = {
        revision: number;
        stack: unknown[];
        players: Array<{
          id: string;
          handCards: unknown[];
          battlefieldCards: Array<{ instanceId: string; name: string }>;
          landsPlayedThisTurn: number;
        }>;
      };
      async function sendCommand(playerIndex: number, commandId: string, type: string, payload: unknown = {}): Promise<TransportView[]> {
        const player = players[playerIndex]!;
        clients[playerIndex]?.send(JSON.stringify({
          type: "command",
          command: {
            protocolVersion: 1, gameId: "ws-vanilla-permanent", commandId,
            playerId: player.id, expectedRevision: revision, type, payload
          }
        }));
        const result = await queues[playerIndex]!.next();
        expect(result).toMatchObject({ type: "command-result", result: { accepted: true } });
        const views = await Promise.all(queues.map(queue => queue.next()));
        expect(views.every(message => message.type === "game-view")).toBe(true);
        const projectedViews = views.map(message => message.view as TransportView);
        revision = projectedViews[0]!.revision;
        return projectedViews;
      }

      // Advance upkeep and draw, then reach the active player's first main phase.
      for (const [index, playerId] of [0, 1, 2, 3, 0, 1, 2, 3].entries()) {
        await sendCommand(playerId, "advance-" + index, "pass-priority");
      }
      expect(room.state.step).toBe("main-1");

      await sendCommand(0, "tap-plains", "tap-for-mana", { instanceId: "plains-instance", color: "W" });
      const castViews = await sendCommand(0, "cast-scout", "cast-spell", { instanceId: "scout-instance" });
      expect(room.state.cards["scout-instance"]?.zone).toBe("stack");
      expect(room.state.players[0]?.manaPool.W).toBe(0);
      expect(castViews.every(view => view.stack.length === 1)).toBe(true);

      let finalViews: TransportView[] = [];
      for (const [index, playerId] of [0, 1, 2, 3].entries()) {
        finalViews = await sendCommand(playerId, "resolve-scout-" + index, "pass-priority");
      }
      expect(room.state.cards["scout-instance"]?.zone).toBe("battlefield");
      expect(room.state.players[0]?.battlefield).toContain("scout-instance");
      expect(room.state.cards["scout-instance"]?.controller_id).toBe("p1");
      for (const view of finalViews) {
        expect(view.players.find(player => player.id === "p1")?.battlefieldCards).toEqual(
          expect.arrayContaining([expect.objectContaining({
            instanceId: "scout-instance", name: "Vanilla Scout"
          })])
        );
        for (const player of view.players.filter(item => item.id !== "p1")) {
          expect(player.handCards).toEqual([]);
        }
      }

      const landViews = await sendCommand(0, "play-plains-from-hand", "play-land", {
        instanceId: "plains-hand-instance"
      });
      expect(room.state.cards["plains-hand-instance"]?.zone).toBe("battlefield");
      expect(room.state.players[0]?.landsPlayedThisTurn).toBe(1);
      expect(landViews.every(view => {
        const host = view.players.find(player => player.id === "p1");
        return host?.landsPlayedThisTurn === 1 && host.battlefieldCards.some(card =>
          card.instanceId === "plains-hand-instance" && card.name === "Plains"
        );
      })).toBe(true);

      const etbCastViews = await sendCommand(0, "cast-wall", "cast-spell", {
        instanceId: "wall-instance"
      });
      expect(room.state.cards["wall-instance"]?.zone).toBe("stack");
      expect(etbCastViews.every(view => view.stack.length === 1)).toBe(true);

      let triggerViews: TransportView[] = [];
      for (const [index, playerId] of [0, 1, 2, 3].entries()) {
        triggerViews = await sendCommand(playerId, "resolve-wall-spell-" + index, "pass-priority");
      }
      expect(room.state.cards["wall-instance"]?.zone).toBe("battlefield");
      expect(room.state.stack).toMatchObject([{
        kind: "triggered-ability", controller_id: "p1", source_instance_id: "wall-instance",
        payload: { effect: "etb-draw-one", sourceName: "Wall of Omens" }
      }]);
      expect(triggerViews.every(view => view.stack.length === 1)).toBe(true);

      let resolvedViews: TransportView[] = [];
      for (const [index, playerId] of [0, 1, 2, 3].entries()) {
        resolvedViews = await sendCommand(playerId, "resolve-wall-trigger-" + index, "pass-priority");
      }
      expect(room.state.players[0]?.hand).toContain("etb-library-instance");
      expect(room.state.stack).toHaveLength(0);
      for (const view of resolvedViews) {
        for (const player of view.players.filter(item => item.id !== "p1")) {
          expect(player.handCards).toEqual([]);
        }
      }
    } finally {
      await Promise.all(clients.map(client => new Promise<void>(resolve => {
        if (client.readyState === WebSocket.CLOSED) resolve();
        else { client.once("close", () => resolve()); client.close(); }
      })));
      await runtime.close();
    }
  });


});
