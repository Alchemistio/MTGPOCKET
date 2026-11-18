import { describe, expect, it } from "vitest";
import { addCardInstance, applyStateBasedActions, changeLife, createGame } from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

describe("CR 800.4a object cleanup", () => {
  it("removes objects owned by the departing player and exiles objects they still control", () => {
    let game = createGame("leave", players);
    game = addCardInstance(game, { instance_id: "owned-p1", card_id: "owned", owner_id: "p1", zone: "battlefield" });
    game = addCardInstance(game, { instance_id: "borrowed-p2", card_id: "borrowed", owner_id: "p2", controller_id: "p1", zone: "battlefield" });
    game = changeLife(game, "p1", -40);
    game = applyStateBasedActions(game);
    expect(game.cards["owned-p1"]).toBeUndefined();
    expect(game.cards["borrowed-p2"]?.zone).toBe("exile");
    expect(game.players[1]?.exile).toContain("borrowed-p2");
    expect(game.players[0]?.battlefield).toHaveLength(0);
  });
});
