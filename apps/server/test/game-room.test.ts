import { describe, expect, it } from "vitest";
import { GameRoom } from "../src/game-room.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function command(playerId: string, revision: number, commandId: string) {
  return { protocolVersion: 1 as const, gameId: "room-1", commandId, playerId, expectedRevision: revision, type: "pass-priority", payload: {} };
}

describe("GameRoom", () => {
  it("starts at upkeep and advances only after all four seats pass", () => {
    const room = new GameRoom("room-1", players);
    expect(room.state.step).toBe("upkeep");
    expect(room.state.priorityPlayerId).toBe("p1");
    const a = room.apply(command("p1", room.state.revision, "a"));
    const b = room.apply(command("p2", room.state.revision, "b"));
    const c = room.apply(command("p3", room.state.revision, "c"));
    const d = room.apply(command("p4", room.state.revision, "d"));
    expect(a.accepted && a.outcome).toBe("passed");
    expect(b.accepted && b.outcome).toBe("passed");
    expect(c.accepted && c.outcome).toBe("passed");
    expect(d.accepted && d.outcome).toBe("step-advanced");
    expect(room.state.step).toBe("draw");
    expect(room.state.priorityPlayerId).toBe("p1");
  });

  it("rejects stale commands and does not apply duplicate command ids twice", () => {
    const room = new GameRoom("room-1", players);
    const revision = room.state.revision;
    const first = room.apply(command("p1", revision, "same-id"));
    const retry = room.apply(command("p1", revision, "same-id"));
    expect(first).toEqual(retry);
    const stale = room.apply(command("p2", revision, "stale"));
    expect(stale).toMatchObject({ accepted: false, code: "STALE_REVISION" });
  });
});
