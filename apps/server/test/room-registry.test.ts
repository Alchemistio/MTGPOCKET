import { describe, expect, it } from "vitest";
import { RoomRegistry } from "../src/room-registry.js";

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
