import { describe, expect, it } from "vitest";
import { activateStackAbility } from "../src/activated-abilities.js";
import { addCardInstance, advanceAutomaticStep, createGame } from "../src/index.js";
import type { GameState } from "../src/model.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function setup(): GameState {
  let state = advanceAutomaticStep(createGame("activation-engine", players));
  state = addCardInstance(state, {
    instance_id: "source", card_id: "test-artifact", owner_id: "p1", zone: "battlefield"
  });
  return {
    ...state,
    players: state.players.map(player => player.id === "p1"
      ? { ...player, manaPool: { W: 1, C: 2 } }
      : player)
  };
}

const request = {
  controllerId: "p1",
  sourceInstanceId: "source",
  manaCost: "{1}{W}",
  tapSource: true,
  stackItem: {
    id: "activated:source:1",
    controller_id: "p1",
    source_instance_id: "source",
    kind: "activated-ability" as const,
    payload: { effect: "test-draw", amount: 1 }
  }
};

describe("activated ability transaction", () => {
  it("pays mana, taps the source and pushes one activated ability atomically", () => {
    const initial = setup();
    const next = activateStackAbility(initial, request);
    expect(next.revision).toBe(initial.revision + 1);
    expect(next.players.find(player => player.id === "p1")?.manaPool).toEqual({ W: 0, C: 1 });
    expect(next.cards.source?.is_tapped).toBe(true);
    expect(next.stack).toEqual([request.stackItem]);
    expect(next.priorityPlayerId).toBe("p1");
    expect(initial.cards.source?.is_tapped).toBe(false);
    expect(initial.players.find(player => player.id === "p1")?.manaPool).toEqual({ W: 1, C: 2 });
  });

  it("does not mutate the input when mana payment fails", () => {
    const initial = setup();
    const unfunded = {
      ...initial,
      players: initial.players.map(player => player.id === "p1"
        ? { ...player, manaPool: { W: 0, C: 1 } }
        : player)
    };
    expect(() => activateStackAbility(unfunded, request)).toThrow("insuffisante");
    expect(unfunded.cards.source?.is_tapped).toBe(false);
    expect(unfunded.stack).toHaveLength(0);
    expect(unfunded.players.find(player => player.id === "p1")?.manaPool).toEqual({ W: 0, C: 1 });
  });

  it("rejects a tapped source without paying mana or adding to the stack", () => {
    const initial = setup();
    const tapped = {
      ...initial,
      cards: { ...initial.cards, source: { ...initial.cards.source!, is_tapped: true } }
    };
    expect(() => activateStackAbility(tapped, request)).toThrow("déjà engagée");
    expect(tapped.players.find(player => player.id === "p1")?.manaPool).toEqual({ W: 1, C: 2 });
    expect(tapped.stack).toHaveLength(0);
  });

  it("rejects a source controlled by another player", () => {
    const initial = setup();
    const stolen = {
      ...initial,
      cards: { ...initial.cards, source: { ...initial.cards.source!, controller_id: "p2" } }
    };
    expect(() => activateStackAbility(stolen, request)).toThrow("contrôleur");
    expect(stolen.stack).toHaveLength(0);
  });

  it("rejects unsupported hybrid or malformed costs without mutation", () => {
    const initial = setup();
    expect(() => activateStackAbility(initial, { ...request, manaCost: "{W/U}" })).toThrow("Symbole");
    expect(() => activateStackAbility(initial, { ...request, manaCost: "{1" })).toThrow("non pris en charge");
    expect(initial.stack).toHaveLength(0);
    expect(initial.cards.source?.is_tapped).toBe(false);
  });

  it("rejects a stack item that does not describe the announced source and controller", () => {
    const initial = setup();
    expect(() => activateStackAbility(initial, {
      ...request,
      stackItem: { ...request.stackItem, source_instance_id: "other" }
    })).toThrow("ne correspond pas");
    expect(initial.stack).toHaveLength(0);
  });
});
