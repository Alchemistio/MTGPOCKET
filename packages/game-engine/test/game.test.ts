import { describe, expect, it } from "vitest";
import { advanceAfterAllPass, advanceAutomaticStep, applyStateBasedActions, changeLife, createGame, passPriority, type GameState } from "../src/index.js";

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
  it("automatically advances from untap to upkeep without a priority window", () => {
    const game = advanceAutomaticStep(createGame("g1", players));
    expect(game.step).toBe("upkeep");
    expect(game.priorityPlayerId).toBe("p1");
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

describe("multiplayer elimination", () => {
  it("continues the turn without an active player and passes priority clockwise", () => {
    let game = advanceAutomaticStep(createGame("elimination", players));
    game = changeLife(game, "p1", -40);
    game = applyStateBasedActions(game);
    expect(game.activePlayerId).toBeNull();
    expect(game.priorityPlayerId).toBe("p2");
    expect(game.players[0]?.isEliminated).toBe(true);
    const a = passPriority(game, "p2");
    const b = passPriority(a.state, "p3");
    const c = passPriority(b.state, "p4");
    expect(c.outcome).toBe("step-advance");
    const next = advanceAfterAllPass(c.state);
    expect(next.step).toBe("draw");
    expect(next.priorityPlayerId).toBe("p2");
  });

  it("ends in a draw when all remaining players lose simultaneously", () => {
    let game = createGame("draw", players);
    for (const player of players) game = changeLife(game, player.id, -40);
    game = applyStateBasedActions(game);
    expect(game.status).toBe("finished");
    expect(game.result).toEqual({ type: "draw" });
  });
});
