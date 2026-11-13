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
});
