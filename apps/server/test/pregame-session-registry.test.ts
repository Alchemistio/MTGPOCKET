import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CardDefinition, CommanderDeckList } from "@commander-pocket/card-data";
import type { PlayerSetup } from "@commander-pocket/game-engine";
import { PregameCoordinator } from "../src/pregame-coordinator.js";
import { PregameSessionRegistry } from "../src/pregame-session-registry.js";
import { RoomRegistry } from "../src/room-registry.js";
import { JsonFileRoomPersistence, type PersistedRoomRecord, type RoomPersistence } from "../src/room-persistence.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function card(providerId: string, name: string, typeLine: string): CardDefinition {
  return {
    provider: "scryfall", providerId, oracleId: providerId, name, layout: "normal",
    manaCost: null, manaValue: 0, typeLine, oracleText: "", colors: ["U"],
    colorIdentity: ["U"], legalities: { commander: "legal" }, faces: [],
    raw: { id: providerId, name, layout: "normal", cmc: 0, type_line: typeLine,
      colors: ["U"], color_identity: ["U"], legalities: { commander: "legal" },
      set: "tst", collector_number: "1" }
  };
}
const commander = card("cmd", "Test Commander", "Legendary Creature — Wizard");
const island = card("island", "Island", "Basic Land — Island");
const catalog = { cmd: commander, island };
const deck: CommanderDeckList = {
  commanderIds: ["cmd"],
  cards: [{ cardId: "cmd", quantity: 1 }, { cardId: "island", quantity: 99 }]
};

describe("PregameSessionRegistry", () => {
  it("requires the seat token and only returns the requesting player's private view", () => {
    const rooms = new RoomRegistry();
    const { credentials } = rooms.create("g1", players);
    let seed = 0;
    const sessions = new PregameSessionRegistry(rooms, {
      create: (gameId, setup) => new PregameCoordinator(gameId, setup, catalog, {
        isCommanderEligible: candidate => candidate.providerId === "cmd"
      }, () => `seed-${++seed}`)
    });

    expect(sessions.submitDeck("g1", "p1", "bad-token", deck)).toEqual({
      accepted: false, code: "UNAUTHENTICATED"
    });

    for (const credential of credentials) {
      const result = sessions.submitDeck("g1", credential.playerId, credential.token, deck);
      expect(result.accepted).toBe(true);
    }
    const alice = credentials.find(item => item.playerId === "p1")!;
    const bob = credentials.find(item => item.playerId === "p2")!;
    const aliceView = sessions.submitDeck("g1", "p1", alice.token, deck);
    expect(aliceView).toMatchObject({ accepted: true, result: { accepted: false, code: "DUPLICATE_SUBMISSION" } });

    // A token issued for another room must not authenticate against this room.
    const secondRooms = new RoomRegistry();
    const secondCredentials = secondRooms.create("g2", players).credentials;
    const secondSessions = new PregameSessionRegistry(secondRooms, {
      create: (gameId, setup) => new PregameCoordinator(gameId, setup, catalog, {
        isCommanderEligible: candidate => candidate.providerId === "cmd"
      }, () => `seed-${++seed}`)
    });
    for (const credential of secondCredentials) secondSessions.submitDeck("g2", credential.playerId, credential.token, deck);
    const bobResult = secondSessions.declareMulligan("g2", "p2", secondCredentials.find(item => item.playerId === "p2")!.token, "keep");
    expect(bobResult.accepted).toBe(true);
    if (bobResult.accepted) {
      expect(bobResult.view.players.find(player => player.id === "p2")?.hand).toHaveLength(7);
      expect(bobResult.view.players.find(player => player.id === "p1")?.hand).toEqual([]);
    }
    const seatViews = secondSessions.viewsForGame("g2");
    expect(seatViews).toHaveLength(4);
    const alicePrivateView = seatViews.find(item => item.playerId === "p1")?.view;
    const bobSeatView = seatViews.find(item => item.playerId === "p2")?.view;
    expect(alicePrivateView?.players.find(player => player.id === "p1")?.hand).toHaveLength(7);
    expect(alicePrivateView?.players.find(player => player.id === "p2")?.hand).toEqual([]);
    expect(bobSeatView?.players.find(player => player.id === "p2")?.hand).toHaveLength(7);
    expect(bobSeatView?.players.find(player => player.id === "p1")?.hand).toEqual([]);
    expect(sessions.declareMulligan("g1", "p2", secondCredentials.find(item => item.playerId === "p2")!.token, "keep"))
      .toEqual({ accepted: false, code: "UNAUTHENTICATED" });
    expect(sessions.declareMulligan("g1", "p2", bob.token, "keep").accepted).toBe(true);
  });

  it("restores submitted decks, mulligan declarations, bottom choices and seeds after restart", () => {
    const directory = mkdtempSync(join(tmpdir(), "commander-pocket-pregame-restart-"));
    try {
      const persistence = new JsonFileRoomPersistence(directory);
      let seed = 0;
      const factory = {
        create: (gameId: string, setup: readonly PlayerSetup[]) => new PregameCoordinator(gameId, setup, catalog, {
          isCommanderEligible: candidate => candidate.providerId === "cmd"
        }, () => `resume-seed-${++seed}`)
      };
      const originalRooms = new RoomRegistry(undefined, undefined, undefined, persistence);
      const credentials = originalRooms.create("resumable-pregame", players).credentials;
      const original = new PregameSessionRegistry(originalRooms, factory);
      for (const credential of credentials.slice(0, 3)) {
        expect(original.submitDeck("resumable-pregame", credential.playerId, credential.token, deck)).toMatchObject({
          accepted: true, result: { accepted: true }
        });
      }

      const restoredRooms = new RoomRegistry(undefined, undefined, undefined, persistence);
      const restored = new PregameSessionRegistry(restoredRooms, factory);
      const p4 = credentials[3]!;
      const finalDeck = restored.submitDeck("resumable-pregame", p4.playerId, p4.token, deck);
      expect(finalDeck).toMatchObject({ accepted: true, result: { accepted: true, allDecksSubmitted: true } });

      const p1 = credentials[0]!;
      expect(restored.declareMulligan("resumable-pregame", p1.playerId, p1.token, "mulligan").accepted).toBe(true);

      const secondRestartRooms = new RoomRegistry(undefined, undefined, undefined, persistence);
      const secondRestart = new PregameSessionRegistry(secondRestartRooms, factory);
      expect(secondRestart.declareMulligan("resumable-pregame", p1.playerId, p1.token, "keep")).toEqual({
        accepted: false, code: "DUPLICATE_MULLIGAN_DECLARATION"
      });
      for (const credential of credentials.slice(1)) {
        const result = secondRestart.declareMulligan("resumable-pregame", credential.playerId, credential.token, "keep");
        expect(result.accepted).toBe(true);
      }
      const p1Hand = secondRestartRooms.getPregameCheckpoint("resumable-pregame")?.state.players
        .find(player => player.id === "p1")?.hand ?? [];
      expect(p1Hand).toHaveLength(7);
      expect(secondRestart.chooseBottomCards("resumable-pregame", p1.playerId, p1.token, [p1Hand[0]!]).accepted).toBe(true);
      expect(secondRestart.declareMulligan("resumable-pregame", p1.playerId, p1.token, "keep").accepted).toBe(true);

      const thirdRestartRooms = new RoomRegistry(undefined, undefined, undefined, persistence);
      const thirdRestart = new PregameSessionRegistry(thirdRestartRooms, factory);
      const restoredCheckpoint = thirdRestartRooms.getPregameCheckpoint("resumable-pregame");
      expect(restoredCheckpoint?.state.players.find(player => player.id === "p1")?.pendingBottomCount).toBe(0);
      expect(restoredCheckpoint?.generatedSeeds).toHaveLength(5);
      const started = thirdRestart.start("resumable-pregame", p1.playerId, p1.token);
      expect(started).toMatchObject({ accepted: true, view: { status: "active", step: "upkeep" } });
      expect(thirdRestartRooms.getPregameCheckpoint("resumable-pregame")).toBeUndefined();
      expect(thirdRestartRooms.get("resumable-pregame")?.state.players.find(player => player.id === "p1")?.hand).toHaveLength(7);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rolls back a pregame mutation when durable checkpoint persistence fails", () => {
    let saves = 0;
    let persisted: PersistedRoomRecord[] = [];
    const persistence: RoomPersistence = {
      loadAll: () => persisted,
      save: record => {
        saves += 1;
        if (saves === 3) throw new Error("DISK_FULL");
        persisted = [JSON.parse(JSON.stringify(record)) as PersistedRoomRecord];
      },
      delete: () => undefined
    };
    const rooms = new RoomRegistry(undefined, undefined, undefined, persistence);
    const credentials = rooms.create("pregame-rollback", players).credentials;
    const sessions = new PregameSessionRegistry(rooms, {
      create: (gameId, setup) => new PregameCoordinator(gameId, setup, catalog, {
        isCommanderEligible: candidate => candidate.providerId === "cmd"
      })
    });
    const alice = credentials[0]!;
    const failed = sessions.submitDeck("pregame-rollback", alice.playerId, alice.token, deck);
    expect(failed).toEqual({ accepted: false, code: "DISK_FULL" });
    expect(rooms.getPregameCheckpoint("pregame-rollback")?.submittedDecks).toHaveLength(0);
    expect(persisted[0]?.pregameCheckpoint?.submittedDecks).toHaveLength(0);

    const retried = sessions.submitDeck("pregame-rollback", alice.playerId, alice.token, deck);
    expect(retried).toMatchObject({ accepted: true, result: { accepted: true } });
    expect(rooms.getPregameCheckpoint("pregame-rollback")?.submittedDecks).toHaveLength(1);
  });

  it("does not start until the coordinator confirms all players kept and bottomed", () => {
    const rooms = new RoomRegistry();
    const credentials = rooms.create("g3", players).credentials;
    let seed = 0;
    const sessions = new PregameSessionRegistry(rooms, {
      create: (gameId, setup) => new PregameCoordinator(gameId, setup, catalog, {
        isCommanderEligible: candidate => candidate.providerId === "cmd"
      }, () => `seed-${++seed}`)
    });
    for (const credential of credentials) sessions.submitDeck("g3", credential.playerId, credential.token, deck);
    const alice = credentials.find(item => item.playerId === "p1")!;
    const blocked = sessions.start("g3", "p1", alice.token);
    expect(blocked).toMatchObject({ accepted: false });
    for (const credential of credentials) sessions.declareMulligan("g3", credential.playerId, credential.token, "keep");
    const started = sessions.start("g3", "p1", alice.token);
    expect(started.accepted).toBe(true);
    const room = rooms.get("g3");
    expect(room).toBeDefined();
    if (started.accepted && room) {
      expect(started.view.status).toBe("active");
      expect(started.view.step).toBe("upkeep");
      expect(started.view.priorityPlayerId).toBe("p1");
      expect(room.state.status).toBe("active");
      expect(room.state.deckSetupComplete).toBe(true);
      expect(room.state.players.every(player => player.hand.length === 7)).toBe(true);
      expect(room.state.cards).toEqual(expect.objectContaining({
        "p1:cmd:0": expect.objectContaining({ zone: "command", is_commander: true })
      }));
      const result = room.apply({
        protocolVersion: 1, gameId: "g3", commandId: "first-priority-pass",
        playerId: "p1", expectedRevision: room.state.revision,
        type: "pass-priority", payload: {}
      });
      expect(result).toMatchObject({ accepted: true, outcome: "passed" });
      expect(room.state.priorityPlayerId).toBe("p2");
      expect(room.eventLog).toHaveLength(1);
      expect(room.replay()).toEqual(room.state);
    }
  });
});
