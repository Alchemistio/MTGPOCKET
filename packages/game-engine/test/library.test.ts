import { describe, expect, it } from "vitest";
import { addCardInstance, createGame, drawCards, shuffleLibrary } from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function gameWithDeck() {
  let game = createGame("library", players);
  for (let i = 1; i <= 8; i += 1) {
    game = addCardInstance(game, { instance_id: `c${i}`, card_id: `scryfall-${i}`, owner_id: "p1", zone: "library" });
  }
  return game;
}

describe("library operations", () => {
  it("shuffles deterministically for a given seed", () => {
    const a = shuffleLibrary(gameWithDeck(), "p1", "seed-123");
    const b = shuffleLibrary(gameWithDeck(), "p1", "seed-123");
    expect(a.players[0]?.library).toEqual(b.players[0]?.library);
  });

  it("draws from the top of library and reports an empty-library attempt", () => {
    const start = gameWithDeck();
    const result = drawCards(start, "p1", 9);
    expect(result.drawn).toHaveLength(8);
    expect(result.failedToDraw).toBe(true);
    expect(result.state.players[0]?.hand).toHaveLength(8);
    expect(result.state.players[0]?.library).toHaveLength(0);
  });
});
