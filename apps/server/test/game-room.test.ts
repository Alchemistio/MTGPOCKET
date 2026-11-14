import { describe, expect, it } from "vitest";
import { GameRoom } from "../src/game-room.js";
import { addCardInstance, applyStateBasedActions, createGame, moveCardToZone } from "@commander-pocket/game-engine";

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

  it("journals accepted commands and deterministically replays from its authoritative snapshot", () => {
    const room = new GameRoom("room-1", players);
    const snapshotRevision = room.state.revision;
    const first = room.apply(command("p1", room.state.revision, "event-1"));
    const second = room.apply(command("p2", room.state.revision, "event-2"));
    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);
    expect(room.eventLog).toHaveLength(2);
    expect(room.eventLog[0]).toMatchObject({
      protocolVersion: 1, gameId: "room-1", revision: first.revision,
      eventId: "p1:event-1", type: "command-applied",
      payload: { engineVersion: 1, snapshotRevision }
    });
    expect(room.replay()).toEqual(room.state);
  });

  it("rejects stale commands and does not apply duplicate command ids twice", () {
    const room = new GameRoom("room-1", players);
    const revision = room.state.revision;
    const first = room.apply(command("p1", revision, "same-id"));
    const retry = room.apply(command("p1", revision, "same-id"));
    expect(first).toEqual(retry);
    expect(room.eventLog).toHaveLength(1);
    const stale = room.apply(command("p2", revision, "stale"));
    expect(stale).toMatchObject({ accepted: false, code: "STALE_REVISION" });
    expect(room.eventLog).toHaveLength(1);
  });
  it("scopes idempotency keys to the authenticated player seat", () => {
    const room = new GameRoom("room-1", players);
    const first = room.apply(command("p1", room.state.revision, "shared-id"));
    expect(first.accepted).toBe(true);

    // The same opaque command ID from another seat is a distinct command,
    // not a replay of the first player's cached response.
    const second = room.apply(command("p2", room.state.revision, "shared-id"));
    expect(second.accepted).toBe(true);
    expect(second.revision).toBeGreaterThan(first.revision);
  });

  it("resolves a commander-return choice only when submitted by its owner", () => {
    let state = createGame("room-1", players);
    state = addCardInstance(state, { instance_id: "cmd1", card_id: "commander", owner_id: "p1", zone: "command", is_commander: true });
    state = moveCardToZone(state, "cmd1", "exile");
    state = applyStateBasedActions(state);
    const room = new GameRoom("room-1", players, state);
    const rejected = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "wrong-owner",
      playerId: "p2", expectedRevision: state.revision,
      type: "resolve-commander-return", payload: { instanceId: "cmd1", choice: "command" }
    });
    expect(rejected).toMatchObject({ accepted: false, code: "NOT_COMMANDER_OWNER" });
    const accepted = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "owner-choice",
      playerId: "p1", expectedRevision: state.revision,
      type: "resolve-commander-return", payload: { instanceId: "cmd1", choice: "command" }
    });
    expect(accepted).toMatchObject({ accepted: true, outcome: "decision-resolved" });
    expect(room.state.cards.cmd1?.zone).toBe("command");
  });
});
