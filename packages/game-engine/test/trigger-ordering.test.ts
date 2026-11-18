import { describe, expect, it } from "vitest";
import {
  createPendingTriggerBatch,
  getNextTriggerOrderControllerId,
  getPendingTriggerStackItemsBottomToTop,
  recordPendingTriggerOrder
} from "../src/trigger-ordering.js";
import { advanceAutomaticStep, createGame, EngineError, type StackItem } from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function trigger(id: string, controllerId: string): StackItem {
  return {
    id, controller_id: controllerId, source_instance_id: `source-${id}`,
    kind: "triggered-ability", payload: { effect: "opaque" }
  };
}

describe("pending trigger batch ordering", () => {
  it("groups candidates in APNAP order starting with the active player and preserves snapshots", () => {
    let state = advanceAutomaticStep(createGame("trigger-order", players));
    state = { ...state, activePlayerId: "p3", activePlayerSeat: 2 };
    const candidates = [
      trigger("p1-a", "p1"), trigger("p3-a", "p3"), trigger("p4-a", "p4"),
      trigger("p3-b", "p3"), trigger("p2-a", "p2")
    ];
    const batch = createPendingTriggerBatch(state, "batch-1", candidates);
    expect(batch?.groups.map(group => group.controllerId)).toEqual(["p3", "p4", "p1", "p2"]);
    expect(batch?.groups.map(group => group.candidateStackItems.map(item => item.id))).toEqual([
      ["p3-a", "p3-b"], ["p4-a"], ["p1-a"], ["p2-a"]
    ]);
    expect(batch?.groups.map(group => group.orderedStackItemIds)).toEqual([
      null, ["p4-a"], ["p1-a"], ["p2-a"]
    ]);
    // The source can leave after the event: the candidate snapshot remains in the batch.
    expect(batch?.groups[0]?.candidateStackItems[0]?.source_instance_id).toBe("source-p3-a");
  });

  it("requires each controller to order only their own group in APNAP sequence", () => {
    let state = advanceAutomaticStep(createGame("trigger-order-sequence", players));
    state = { ...state, activePlayerId: "p2", activePlayerSeat: 1 };
    const batch = createPendingTriggerBatch(state, "batch-2", [
      trigger("p1-a", "p1"), trigger("p2-a", "p2"), trigger("p2-b", "p2"),
      trigger("p4-a", "p4"), trigger("p4-b", "p4")
    ])!;
    expect(getNextTriggerOrderControllerId(batch)).toBe("p2");
    expect(() => recordPendingTriggerOrder(batch, "p4", ["p4-b", "p4-a"]))
      .toThrowError(expect.objectContaining({ code: "INVALID_TRIGGER_ORDER" }));
    expect(() => recordPendingTriggerOrder(batch, "p2", ["p2-a", "p2-a"])).toThrow(EngineError);
    expect(() => recordPendingTriggerOrder(batch, "p2", ["p2-a"])).toThrow(EngineError);

    const afterP2 = recordPendingTriggerOrder(batch, "p2", ["p2-b", "p2-a"]);
    expect(getNextTriggerOrderControllerId(afterP2)).toBe("p4");
    const afterP4 = recordPendingTriggerOrder(afterP2, "p4", ["p4-a", "p4-b"]);
    expect(getNextTriggerOrderControllerId(afterP4)).toBeNull();
    expect(getPendingTriggerStackItemsBottomToTop(afterP4)?.map(item => item.id)).toEqual([
      "p2-b", "p2-a", "p4-a", "p4-b", "p1-a"
    ]);
    // The last APNAP group's last inserted object is the top and resolves first.
    expect(getPendingTriggerStackItemsBottomToTop(afterP4)?.at(-1)?.id).toBe("p1-a");
  });

  it("rejects duplicate candidates, unknown controllers and eliminated controllers", () => {
    const state = advanceAutomaticStep(createGame("trigger-order-invalid", players));
    expect(() => createPendingTriggerBatch(state, "batch", [trigger("same", "p1"), trigger("same", "p2")]))
      .toThrow(EngineError);
    expect(() => createPendingTriggerBatch(state, "batch", [trigger("unknown", "p9")]))
      .toThrow(EngineError);
    const eliminated = {
      ...state,
      players: state.players.map(player => player.id === "p2" ? { ...player, isEliminated: true } : player)
    };
    expect(() => createPendingTriggerBatch(eliminated, "batch", [trigger("dead", "p2")]))
      .toThrow(EngineError);
  });

  it("returns no batch when the event produced no triggers", () => {
    const state = advanceAutomaticStep(createGame("trigger-order-empty", players));
    expect(createPendingTriggerBatch(state, "empty", [])).toBeNull();
  });
});
