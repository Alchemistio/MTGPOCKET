import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RoomRegistry } from "../src/room-registry.js";
import { JsonFileRoomPersistence, type RoomPersistence } from "../src/room-persistence.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

describe("RoomRegistry", () => {
  it("authenticates a player with their seat token", () => {
    const registry = new RoomRegistry();
    const { room, credentials } = registry.create("g1", players);
    const alice = credentials.find(c => c.playerId === "p1");
    expect(alice).toBeDefined();
    expect(registry.authenticate("g1", "p1", alice!.token)).toBe(room);
    expect(registry.authenticate("g1", "p1", "wrong-token")).toBeNull();
  });

  it("restores a persisted room after restart and keeps seat credentials private", () => {
    const directory = mkdtempSync(join(tmpdir(), "commander-pocket-registry-"));
    try {
      const persistence = new JsonFileRoomPersistence(directory);
      const registry = new RoomRegistry(undefined, undefined, undefined, persistence);
      const { room, credentials } = registry.create("persisted-g1", players);
      const alice = credentials.find(credential => credential.playerId === "p1")!;
      const command = {
        protocolVersion: 1 as const, gameId: "persisted-g1", commandId: "persisted-pass",
        playerId: "p1", expectedRevision: room.state.revision, type: "pass-priority", payload: {}
      };
      const accepted = registry.apply("persisted-g1", command);
      expect(accepted.accepted).toBe(true);

      const restoredRegistry = new RoomRegistry(undefined, undefined, undefined, persistence);
      expect(restoredRegistry.wasRestored("persisted-g1")).toBe(true);
      const restored = restoredRegistry.authenticate("persisted-g1", "p1", alice.token);
      expect(restored).not.toBeNull();
      expect(restored!.state).toEqual(room.state);
      expect(restoredRegistry.apply("persisted-g1", command)).toEqual(accepted);
      expect(restored!.eventLog).toHaveLength(1);
      expect(restoredRegistry.authenticate("persisted-g1", "p1", "wrong-token")).toBeNull();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("persists the post-pregame snapshot and server-only shuffle seeds", () => {
    const directory = mkdtempSync(join(tmpdir(), "commander-pocket-seeds-"));
    try {
      const persistence = new JsonFileRoomPersistence(directory);
      const registry = new RoomRegistry(undefined, undefined, undefined, persistence);
      const { room } = registry.create("seeded-g1", players);
      const activeState = {
        ...room.state,
        revision: room.state.revision + 1,
        status: "active" as const,
        deckSetupComplete: true,
        phase: "beginning" as const,
        step: "upkeep" as const,
        priorityPlayerId: "p1"
      };
      const seedLog = [
        { sequence: 0, purpose: "opening-hand" as const, playerId: "p1", seed: "opening-seed" },
        { sequence: 1, purpose: "mulligan" as const, playerId: "p2", seed: "mulligan-seed" }
      ];
      registry.replaceStateFromPregame("seeded-g1", activeState, seedLog);
      const persisted = persistence.loadAll()[0];
      expect(persisted?.checkpoint.snapshot).toEqual(activeState);
      expect(persisted?.seedLog).toEqual(seedLog);

      const restored = new RoomRegistry(undefined, undefined, undefined, persistence);
      expect(restored.get("seeded-g1")?.state).toEqual(activeState);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rolls back an accepted command when durable persistence fails", () => {
    let saves = 0;
    const persistence: RoomPersistence = {
      loadAll: () => [],
      save: () => { saves += 1; if (saves > 1) throw new Error("disk full"); },
      delete: () => undefined
    };
    const registry = new RoomRegistry(undefined, undefined, undefined, persistence);
    const { room } = registry.create("rollback-g1", players);
    const before = room.state;
    const result = registry.apply("rollback-g1", {
      protocolVersion: 1, gameId: "rollback-g1", commandId: "will-rollback",
      playerId: "p1", expectedRevision: room.state.revision, type: "pass-priority", payload: {}
    });
    expect(result).toMatchObject({ accepted: false, code: "PERSISTENCE_FAILED" });
    expect(registry.get("rollback-g1")?.state).toEqual(before);
    expect(registry.get("rollback-g1")?.eventLog).toHaveLength(0);
  });

  it("rejects duplicate player IDs without registering a room", () => {
    const registry = new RoomRegistry();
    const invalid = [...players];
    invalid[3] = { ...invalid[3]!, id: "p1" };
    expect(() => registry.create("duplicate-player", invalid)).toThrow("DUPLICATE_PLAYER_ID");
    expect(registry.get("duplicate-player")).toBeUndefined();
  });

  it("rejects duplicate and out-of-range seats without registering a room", () => {
    const duplicate = [...players];
    duplicate[3] = { ...duplicate[3]!, seat: 2 };
    const outOfRange = [...players];
    outOfRange[3] = { ...outOfRange[3]!, seat: 4 };
    const registry = new RoomRegistry();
    expect(() => registry.create("duplicate-seat", duplicate)).toThrow("DUPLICATE_SEAT");
    expect(() => registry.create("bad-seat", outOfRange)).toThrow("INVALID_SEAT");
    expect(registry.get("duplicate-seat")).toBeUndefined();
    expect(registry.get("bad-seat")).toBeUndefined();
  });

  it("rejects an empty room ID and an incomplete player set", () => {
    const registry = new RoomRegistry();
    expect(() => registry.create("  ", players)).toThrow("INVALID_GAME_ID");
    expect(() => registry.create("three-players", players.slice(0, 3))).toThrow("INVALID_PLAYER_COUNT");
  });
});
