import { describe, expect, it } from "vitest";
import {
  addCardInstance, chooseMulliganBottomCards, createPregameGame, initializeOpeningHands, placeCommandersInCommandZone,
  resolveMulliganRound, startGame
} from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function preparedPregame() {
  let game = createPregameGame("opening", players);
  for (const player of players) {
    for (let i = 0; i < 9; i += 1) {
      game = addCardInstance(game, {
        instance_id: `${player.id}-card-${i}`,
        card_id: `card-${i}`,
        owner_id: player.id,
        zone: "library"
      });
    }
  }
  for (const player of players) {
    game = addCardInstance(game, { instance_id: `${player.id}-commander`, card_id: "commander", owner_id: player.id, zone: "library" });
  }
  game = placeCommandersInCommandZone(game, {
    p1: ["p1-commander"], p2: ["p2-commander"], p3: ["p3-commander"], p4: ["p4-commander"]
  });
  return initializeOpeningHands(game, { p1: "seed-a", p2: "seed-b", p3: "seed-c", p4: "seed-d" });
}

describe("Commander multiplayer London mulligan", () => {
  it("does not bottom a card for the first mulligan (CR 103.5c)", () => {
    const first = resolveMulliganRound(preparedPregame(), [
      { playerId: "p1", action: "mulligan" },
      { playerId: "p2", action: "keep" },
      { playerId: "p3", action: "keep" },
      { playerId: "p4", action: "keep" }
    ], { p1: "mulligan-one" });
    expect(first.readyToStart).toBe(false);
    expect(first.state.players[0]?.mulliganCount).toBe(1);
    expect(first.state.players[0]?.pendingBottomCount).toBe(0);
    const second = resolveMulliganRound(first.state, [{ playerId: "p1", action: "keep" }], {});
    expect(second.readyToStart).toBe(true);
    expect(second.state.players[0]?.hand).toHaveLength(7);
    expect(startGame(second.state).status).toBe("active");
  });

  it("requires a bottom choice immediately after the second mulligan", () => {
    const first = resolveMulliganRound(preparedPregame(), [
      { playerId: "p1", action: "mulligan" },
      { playerId: "p2", action: "keep" },
      { playerId: "p3", action: "keep" },
      { playerId: "p4", action: "keep" }
    ], { p1: "mulligan-one" });
    const second = resolveMulliganRound(first.state, [
      { playerId: "p1", action: "mulligan" }
    ], { p1: "mulligan-two" });
    expect(second.state.players[0]?.pendingBottomCount).toBe(1);
    const hand = second.state.players[0]?.hand ?? [];
    const chosenBottom = hand[0];
    expect(chosenBottom).toBeDefined();
    const bottomed = chooseMulliganBottomCards(second.state, "p1", [chosenBottom!]);
    expect(bottomed.players[0]?.hand).toHaveLength(6);
    expect(bottomed.players[0]?.library[0]).toBe(chosenBottom);
    const third = resolveMulliganRound(bottomed, [{ playerId: "p1", action: "keep" }], {});
    expect(third.readyToStart).toBe(true);
    expect(startGame(third.state).status).toBe("active");
  });

  it("allows more than eight mulligans and caps bottom choices at the actual hand size", () => {
    let state = preparedPregame();
    for (let round = 1; round <= 9; round += 1) {
      const decisions = round === 1
        ? [
            { playerId: "p1", action: "mulligan" as const },
            { playerId: "p2", action: "keep" as const },
            { playerId: "p3", action: "keep" as const },
            { playerId: "p4", action: "keep" as const }
          ]
        : [{ playerId: "p1", action: "mulligan" as const }];
      state = resolveMulliganRound(state, decisions, {
        p1: `many-mulligans-${round}`
      }).state;
      const player = state.players.find(item => item.id === "p1");
      expect(player?.mulliganCount).toBe(round);
      if (player && player.pendingBottomCount > 0) {
        expect(player.pendingBottomCount).toBeLessThanOrEqual(player.hand.length);
        state = chooseMulliganBottomCards(state, "p1", player.hand.slice(0, player.pendingBottomCount));
      }
    }
    const kept = resolveMulliganRound(state, [{ playerId: "p1", action: "keep" }], {});
    expect(kept.readyToStart).toBe(true);
    expect(startGame(kept.state).status).toBe("active");
  });

  it("cannot start while any player has not kept an opening hand", () => {
    expect(() => startGame(preparedPregame())).toThrowError();
  });
});
