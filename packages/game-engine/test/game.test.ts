import { describe, expect, it } from "vitest";
import { advanceAfterAllPass, createGame, passPriority, type GameState } from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

describe("createGame", () => {
  it("initializes four players at 40 life", () => {
    const game = createGame("g1", players);
    expect(game.players).toHaveLength(4);
    expect(game.players.every(p => p.life === 40)).toBe(true);
    expect(game.step).toBe("untap");
  });
  it("rejects non-four-player tables", () => {
    expect(() => createGame("g1", players.slice(0, 3))).toThrowError();
  });
});

describe("priority", () => {
  it("cycles clockwise and closes an empty stack window after four passes", () => {
    let game: GameState = { ...createGame("g1", players), priorityPlayerId: "p1" };
    const a = passPriority(game, "p1");
    const b = passPriority(a.state, "p2");
    const c = passPriority(b.state, "p3");
    const d = passPriority(c.state, "p4");
    expect(a.outcome).toBe("passed");
    expect(d.outcome).toBe("step-advance");
    expect(d.state.priorityWindowClosed).toBe(true);
    expect(advanceAfterAllPass(d.state).step).toBe("upkeep");
  });
  it("does not permit a step advance before all players pass", () => {
    expect(() => advanceAfterAllPass(createGame("g1", players))).toThrowError();
  });
  it("rejects a pass from a player without priority", () => {
    const game: GameState = { ...createGame("g1", players), priorityPlayerId: "p1" };
    expect(() => passPriority(game, "p2")).toThrowError();
  });
});
