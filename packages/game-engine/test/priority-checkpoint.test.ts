import { describe, expect, it } from "vitest";
import { changeLife, createGame, EngineError, runStateBasedActionCheckpoint } from "../src/index.js";
import type { StackItem } from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 },
  { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 },
  { id: "p4", name: "David", seat: 3 }
];

function trigger(id: string, controller_id: string): StackItem {
  return {
    id, controller_id, source_instance_id: "source-" + id,
    kind: "triggered-ability", payload: { effect: "test" }
  };
}

describe("state-based action priority checkpoint", () => {
  it("repeats atomic SBA passes and preserves the two CR 603.3b trigger classes", () => {
    const initial = createGame("sba-checkpoint", players);
    const ordinaryA = trigger("ordinary-a", "p1");
    const ordinaryB = trigger("ordinary-b", "p2");
    const stackA = trigger("stack-a", "p3");
    let calls = 0;

    const result = runStateBasedActionCheckpoint(initial, state => {
      calls += 1;
      if (calls === 1) {
        return {
          state: changeLife(state, "p1", -1),
          performed: true,
          ordinaryTriggers: [ordinaryA],
          stackTriggers: []
        };
      }
      if (calls === 2) {
        return {
          state: changeLife(state, "p2", -1),
          performed: true,
          ordinaryTriggers: [ordinaryB],
          stackTriggers: [stackA]
        };
      }
      return { state, performed: false, ordinaryTriggers: [], stackTriggers: [] };
    });

    expect(calls).toBe(3);
    expect(result.passes).toBe(2);
    expect(result.state.players.find(player => player.id === "p1")?.life).toBe(39);
    expect(result.state.players.find(player => player.id === "p2")?.life).toBe(39);
    expect(result.ordinaryTriggers.map(item => item.id)).toEqual(["ordinary-a", "ordinary-b"]);
    expect(result.stackTriggers.map(item => item.id)).toEqual(["stack-a"]);
    expect(initial.players.every(player => player.life === 40)).toBe(true);
    expect(result.state.stack).toEqual([]);
  });

  it("returns immediately when no state-based action is performed", () => {
    const initial = createGame("sba-stable", players);
    const result = runStateBasedActionCheckpoint(initial, state => ({
      state, performed: false, ordinaryTriggers: [], stackTriggers: []
    }));
    expect(result).toEqual({
      state: initial, ordinaryTriggers: [], stackTriggers: [], passes: 0
    });
  });

  it("rejects inconsistent pass reports and duplicate trigger snapshots", () => {
    const initial = createGame("sba-invalid", players);
    expect(() => runStateBasedActionCheckpoint(initial, state => ({
      state: { ...state, revision: state.revision + 1 },
      performed: false, ordinaryTriggers: [], stackTriggers: []
    }))).toThrowError(expect.objectContaining({ code: "INVALID_SBA_CHECKPOINT" }));

    expect(() => runStateBasedActionCheckpoint(initial, state => ({
      state: changeLife(state, "p1", -1), performed: true,
      ordinaryTriggers: [trigger("duplicate", "p1")],
      stackTriggers: [trigger("duplicate", "p2")]
    }))).toThrowError(expect.objectContaining({ code: "INVALID_SBA_CHECKPOINT" }));
  });

  it("fails closed when SBA passes do not stabilize within the safety limit", () => {
    const initial = createGame("sba-limit", players);
    expect(() => runStateBasedActionCheckpoint(initial, state => ({
      state: changeLife(state, "p1", -1),
      performed: true, ordinaryTriggers: [], stackTriggers: []
    }), 2)).toThrowError(EngineError);
  });
});
