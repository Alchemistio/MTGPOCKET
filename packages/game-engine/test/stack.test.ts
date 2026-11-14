import { describe, expect, it } from "vitest";
import {
  advanceAutomaticStep, changeLife, createGame, passPriority, pushStackItem,
  resolveStackItem
} from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

describe("stack lifecycle", () => {
  it("pushes an item, waits for all passes, resolves it, then returns priority", () => {
    let game = advanceAutomaticStep(createGame("stack", players));
    game = pushStackItem(game, {
      id: "trigger-1", controller_id: "p1", source_instance_id: null,
      kind: "triggered-ability", payload: { testEffect: "lose-life" }
    });
    expect(game.priorityPlayerId).toBe("p1");
    const a = passPriority(game, "p1");
    const b = passPriority(a.state, "p2");
    const c = passPriority(b.state, "p3");
    const d = passPriority(c.state, "p4");
    expect(d.outcome).toBe("resolution-required");
    expect(d.state.awaitingResolutionId).toBe("trigger-1");
    const resolved = resolveStackItem(d.state, "trigger-1", current => changeLife(current, "p2", -3));
    expect(resolved.players[1]?.life).toBe(37);
    expect(resolved.stack).toHaveLength(0);
    expect(resolved.priorityPlayerId).toBe("p1");
  });
  it("checks state-based actions after resolution and transfers priority if the active player loses", () => {
    let game = advanceAutomaticStep(createGame("stack-loss", players));
    game = pushStackItem(game, {
      id: "trigger-loss", controller_id: "p1", source_instance_id: null,
      kind: "triggered-ability", payload: {}
    });
    const a = passPriority(game, "p1");
    const b = passPriority(a.state, "p2");
    const c = passPriority(b.state, "p3");
    const d = passPriority(c.state, "p4");
    const resolved = resolveStackItem(d.state, "trigger-loss", current => changeLife(current, "p1", -40));
    expect(resolved.players[0]?.isEliminated).toBe(true);
    expect(resolved.activePlayerId).toBeNull();
    expect(resolved.priorityPlayerId).toBe("p2");
    expect(resolved.stack).toHaveLength(0);
  });

});
