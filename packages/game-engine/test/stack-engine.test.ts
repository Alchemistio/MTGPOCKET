import { describe, expect, it } from "vitest";
import {
  appendStackObject, getStackTop, markTopStackObjectResolving, removeResolvedStackObject
} from "../src/stack-engine.js";
import { advanceAutomaticStep, createGame } from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];
const item = {
  id: "trigger-1", controller_id: "p1", source_instance_id: null,
  kind: "triggered-ability" as const, payload: { effect: "opaque-to-lifecycle" }
};

describe("generic stack engine", () => {
  it("owns append, top lookup, resolution lock and removal lifecycle", () => {
    let state = advanceAutomaticStep(createGame("stack-engine", players));
    state = appendStackObject(state, item);
    expect(getStackTop(state)?.id).toBe(item.id);
    state = markTopStackObjectResolving(state, item.id);
    expect(state.awaitingResolutionId).toBe(item.id);
    state = removeResolvedStackObject(state, item.id);
    expect(state.stack).toHaveLength(0);
    expect(state.awaitingResolutionId).toBeNull();
  });
  it("rejects a non-top resolution and duplicate stack ids", () => {
    const state = appendStackObject(advanceAutomaticStep(createGame("stack-invalid", players)), item);
    expect(() => appendStackObject(state, item)).toThrow("déjà utilisé");
    expect(() => markTopStackObjectResolving(state, "other")).toThrow("STACK_ITEM_MISMATCH");
  });
});
