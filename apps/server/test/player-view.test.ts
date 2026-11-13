import { describe, expect, it } from "vitest";
import { addCardInstance, createGame } from "@commander-pocket/game-engine";
import { toPlayerView } from "../src/player-view.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

describe("toPlayerView", () => {
  it("reveals only the viewer's hand and hides all library identities", () => {
    let game = createGame("privacy", players);
    game = addCardInstance(game, { instance_id: "alice-hand", card_id: "secret-a", owner_id: "p1", zone: "hand" });
    game = addCardInstance(game, { instance_id: "bob-hand", card_id: "secret-b", owner_id: "p2", zone: "hand" });
    game = addCardInstance(game, { instance_id: "bob-library", card_id: "secret-c", owner_id: "p2", zone: "library" });
    const view = toPlayerView(game, "p1");
    expect(view.players[0]?.hand).toEqual(["alice-hand"]);
    expect(view.players[1]?.hand).toEqual([]);
    expect(view.players[1]?.handCount).toBe(1);
    expect(view.visibleCards["alice-hand"]?.card_id).toBe("secret-a");
    expect(view.visibleCards["bob-hand"]).toBeUndefined();
    expect(view.visibleCards["bob-library"]).toBeUndefined();
  });
});
