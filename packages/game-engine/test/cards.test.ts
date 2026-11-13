import { describe, expect, it } from "vitest";
import {
  addCardInstance, applyStateBasedActions, createGame, getCommanderTax,
  moveCardToZone, recordCommanderCast, recordCommanderCombatDamage
} from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

describe("card zones", () => {
  it("moves a card between owner zones and onto the battlefield", () => {
    let game = createGame("zones", players);
    game = addCardInstance(game, { instance_id: "c1", card_id: "scryfall-1", owner_id: "p1", zone: "library" });
    game = moveCardToZone(game, "c1", "hand");
    expect(game.players[0]?.hand).toContain("c1");
    game = moveCardToZone(game, "c1", "battlefield");
    expect(game.players[0]?.hand).not.toContain("c1");
    expect(game.players[0]?.battlefield).toContain("c1");
    expect(game.cards.c1?.zone).toBe("battlefield");
  });
});

describe("Commander tracking", () => {
  it("adds two generic mana per previous command-zone cast", () => {
    let game = createGame("commander", players);
    game = addCardInstance(game, { instance_id: "cmd1", card_id: "commander-card", owner_id: "p1", zone: "command", is_commander: true });
    expect(getCommanderTax(game, "cmd1")).toBe(0);
    game = recordCommanderCast(game, "cmd1", "p1");
    expect(getCommanderTax(game, "cmd1")).toBe(2);
  });

  it("tracks damage per commander and applies the 21-damage loss check", () => {
    let game = createGame("damage", players);
    game = addCardInstance(game, { instance_id: "cmd1", card_id: "commander-card", owner_id: "p1", zone: "command", is_commander: true });
    game = moveCardToZone(game, "cmd1", "battlefield");
    game = recordCommanderCombatDamage(game, "cmd1", "p2", 11);
    game = recordCommanderCombatDamage(game, "cmd1", "p2", 10);
    expect(game.players[1]?.commanderDamageReceived.cmd1).toBe(21);
    game = applyStateBasedActions(game);
    expect(game.players[1]?.isEliminated).toBe(true);
  });
});
