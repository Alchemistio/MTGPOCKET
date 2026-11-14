import { describe, expect, it } from "vitest";
import {
  addCardInstance, advanceAfterAllPass, advanceAutomaticStep, createGame, discardCards,
  passPriority, type GameState
} from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function passAll(state: GameState): GameState {
  let current = state;
  for (const player of ["p1", "p2", "p3", "p4"]) {
    const result = passPriority(current, player);
    current = result.state;
  }
  return current;
}

describe("turn-based actions", () => {
  it("untaps the active player's permanents in the untap step", () => {
    let game = createGame("untap", players);
    game = addCardInstance(game, { instance_id: "perm", card_id: "permanent", owner_id: "p1", zone: "battlefield" });
    game = { ...game, deckSetupComplete: true, cards: { ...game.cards, perm: { ...game.cards.perm!, is_tapped: true } } };
    const next = advanceAutomaticStep(game);
    expect(next.step).toBe("upkeep");
    expect(next.cards.perm?.is_tapped).toBe(false);
  });

  it("draws one card before priority in the draw step", () => {
    let game = createGame("draw-step", players);
    game = addCardInstance(game, { instance_id: "top", card_id: "card", owner_id: "p1", zone: "library" });
    game = { ...game, deckSetupComplete: true, phase: "beginning", step: "upkeep", priorityPlayerId: "p1" };
    const afterPasses = passAll(game);
    const drawStep = advanceAfterAllPass(afterPasses);
    expect(drawStep.step).toBe("draw");
    expect(drawStep.players[0]?.hand).toContain("top");
    expect(drawStep.players[0]?.library).toHaveLength(0);
  });

  it("eliminates a player who attempts to draw from an empty library before priority", () => {
    let game = createGame("empty-draw", players);
    game = { ...game, deckSetupComplete: true, phase: "beginning", step: "upkeep", priorityPlayerId: "p1" };
    const drawStep = advanceAfterAllPass(passAll(game));
    expect(drawStep.step).toBe("draw");
    expect(drawStep.players[0]?.isEliminated).toBe(true);
    expect(drawStep.activePlayerId).toBeNull();
    expect(drawStep.priorityPlayerId).toBe("p2");
  });

  it("clears marked damage and floating mana when cleanup begins", () => {
    let game = createGame("cleanup", players);
    game = addCardInstance(game, { instance_id: "perm", card_id: "permanent", owner_id: "p1", zone: "battlefield" });
    game = {
      ...game, phase: "ending", step: "end", priorityPlayerId: "p1",
      cards: { ...game.cards, perm: { ...game.cards.perm!, damage_marked: 4 } },
      players: game.players.map(p => p.id === "p1" ? { ...p, manaPool: { R: 2 } } : p)
    };
    const cleanup = advanceAfterAllPass(passAll(game));
    expect(cleanup.step).toBe("cleanup");
    expect(cleanup.cards.perm?.damage_marked).toBe(0);
    expect(cleanup.players[0]?.manaPool).toEqual({});
  });
  it("requires the active player to discard to maximum hand size before the next turn", () => {
    let game = createGame("cleanup-discard", players);
    for (let i = 0; i < 8; i += 1) {
      game = addCardInstance(game, { instance_id: `hand-${i}`, card_id: `card-${i}`, owner_id: "p1", zone: "hand" });
    }
    game = { ...game, phase: "ending", step: "end", priorityPlayerId: "p1" };
    const cleanup = advanceAfterAllPass(passAll(game));
    expect(cleanup.pendingDiscardPlayerId).toBe("p1");
    expect(cleanup.pendingDiscardCount).toBe(1);
    expect(() => advanceAutomaticStep(cleanup)).toThrowError();
    const discarded = discardCards(cleanup, "p1", ["hand-0"]);
    expect(discarded.players[0]?.graveyard).toContain("hand-0");
    const nextTurn = advanceAutomaticStep(discarded);
    expect(nextTurn.step).toBe("untap");
    expect(nextTurn.activePlayerId).toBe("p2");
  });

});
