import { describe, expect, it } from "vitest";
import { addCardInstance, applyStateBasedActions, createGame, createPregameGame, moveCardToZone } from "@commander-pocket/game-engine";
import type { CardDefinition } from "@commander-pocket/card-data";
import { toPlayerView } from "../src/player-view.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

describe("toPlayerView", () => {
  it("exposes the explicit lifecycle status instead of inferring it from the current step", () => {
    expect(toPlayerView(createPregameGame("pregame-status", players), "p1").status).toBe("pregame");
    expect(toPlayerView(createGame("active-status", players), "p1").status).toBe("active");
  });
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
  it("projects readable hand cards only to their owner and gates casting on server handlers", () => {
    let game = createGame("hand-card-view", players);
    game = addCardInstance(game, { instance_id: "private-instant", card_id: "scryfall-instant", owner_id: "p1", zone: "hand" });
    game = addCardInstance(game, { instance_id: "opponent-instant", card_id: "scryfall-instant", owner_id: "p2", zone: "hand" });
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "scryfall-instant", oracleId: "oracle-instant",
      name: "Test Instant", layout: "normal", manaCost: "{U}", manaValue: 1,
      typeLine: "Instant", oracleText: "", colors: ["U"], colorIdentity: ["U"],
      legalities: { commander: "legal" }, faces: [],
      raw: { id: "scryfall-instant", name: "Test Instant", layout: "normal", cmc: 1,
        mana_cost: "{U}", type_line: "Instant", oracle_text: "", colors: ["U"],
        color_identity: ["U"], legalities: { commander: "legal" }, set: "tst", collector_number: "1" }
    };
    const resolveCard = (cardId: string) => cardId === definition.providerId ? definition : undefined;
    const ownerView = toPlayerView(game, "p1", resolveCard, true);
    const opponentView = toPlayerView(game, "p2", resolveCard, true);
    expect(ownerView.spellCastingAvailable).toBe(true);
    expect(ownerView.players[0]?.handCards).toMatchObject([{
      instanceId: "private-instant", name: "Test Instant", manaCost: "{U}", isSupportedSpell: true
    }]);
    expect(ownerView.players[1]?.handCards).toEqual([]);
    expect(opponentView.players[0]?.handCards).toEqual([]);
    expect(opponentView.players[1]?.handCards[0]?.instanceId).toBe("opponent-instant");
    expect(toPlayerView(game, "p1").spellCastingAvailable).toBe(false);
  });

  it("shows a pending commander-return choice only to its owner", () => {
    let game = createGame("commander-choice-view", players);
    game = addCardInstance(game, { instance_id: "cmd1", card_id: "commander", owner_id: "p1", zone: "command", is_commander: true });
    game = moveCardToZone(game, "cmd1", "graveyard");
    game = applyStateBasedActions(game);
    const ownerView = toPlayerView(game, "p1");
    const opponentView = toPlayerView(game, "p2");
    expect(ownerView.pendingCommanderChoices).toEqual([{ instanceId: "cmd1", fromZone: "graveyard" }]);
    expect(opponentView.pendingCommanderChoices).toEqual([]);
    expect(opponentView.pendingCommanderChoiceCount).toBe(1);
  });
});
