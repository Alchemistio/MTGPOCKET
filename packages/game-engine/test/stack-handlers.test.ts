import { describe, expect, it } from "vitest";
import { executeStackItemHandler, type StackHandlerRegistry } from "../src/stack-handlers.js";
import { createGame } from "../src/game.js";
import { advanceAutomaticStep } from "../src/turns.js";
import { markTopStackObjectResolving, appendStackObject } from "../src/stack-engine.js";
import type { GameState } from "../src/model.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];
type Payloads = {
  spell: { amount: number };
  "activated-ability": never;
  "triggered-ability": never;
  copy: never;
};
function resolvingState(payload: unknown = { amount: 3 }): GameState {
  const base = advanceAutomaticStep(createGame("stack-handler", players));
  const withItem = appendStackObject(base, {
    id: "spell-1", controller_id: "p1", source_instance_id: null, kind: "spell", payload
  });
  return markTopStackObjectResolving(withItem, "spell-1");
}
const handlers: StackHandlerRegistry<Payloads> = {
  spell: {
    decode(payload) {
      if (typeof payload !== "object" || payload === null ||
          typeof (payload as { amount?: unknown }).amount !== "number") {
        return { ok: false, reason: "amount must be a number" };
      }
      return { ok: true, value: { amount: (payload as { amount: number }).amount } };
    },
    resolve(state, _item, payload) {
      return {
        ...state, revision: state.revision + 1,
        players: state.players.map(player => player.id === "p1"
          ? { ...player, life: player.life + payload.amount } : player)
      };
    }
  }
};
describe("typed stack handler boundary", () => {
  it("decodes by stack kind and delegates effect semantics without removing the item", () => {
    const state = resolvingState();
    const result = executeStackItemHandler(state, "spell-1", handlers);
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") throw new Error("Expected resolved handler");
    expect(result.state.players[0]?.life).toBe(43);
    expect(result.state.stack).toHaveLength(1);
    expect(result.state.awaitingResolutionId).toBe("spell-1");
    expect(state.players[0]?.life).toBe(40);
  });
  it("keeps the locked item untouched when no handler exists", () => {
    const state = resolvingState();
    const result = executeStackItemHandler(state, "spell-1", {});
    expect(result).toEqual({ status: "handler-unavailable", kind: "spell" });
    expect(state.stack).toHaveLength(1);
    expect(state.awaitingResolutionId).toBe("spell-1");
  });
  it("does not invoke the resolver or mutate state when payload decoding fails", () => {
    const state = resolvingState({ amount: "three" });
    const result = executeStackItemHandler(state, "spell-1", handlers);
    expect(result).toEqual({ status: "invalid-payload", kind: "spell", reason: "amount must be a number" });
    expect(state.players[0]?.life).toBe(40);
    expect(state.stack).toHaveLength(1);
  });
  it("rejects dispatch for an item that is not the locked top item", () => {
    const state = resolvingState();
    expect(() => executeStackItemHandler(state, "other", handlers)).toThrow("n'attend pas sa résolution");
  });
});
