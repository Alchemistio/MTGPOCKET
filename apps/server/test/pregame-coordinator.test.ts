import { describe, expect, it } from "vitest";
import type { CardDefinition, CommanderDeckList } from "@commander-pocket/card-data";
import { PregameCoordinator } from "../src/pregame-coordinator.js";
import { toPlayerView } from "../src/player-view.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function card(providerId: string, name: string, typeLine: string, colorIdentity: string[] = []): CardDefinition {
  return {
    provider: "scryfall", providerId, oracleId: providerId, name, layout: "normal",
    manaCost: null, manaValue: 0, typeLine, oracleText: "", colors: colorIdentity,
    colorIdentity, legalities: { commander: "legal" }, faces: [],
    raw: {
      id: providerId, name, layout: "normal", cmc: 0, type_line: typeLine,
      colors: colorIdentity, color_identity: colorIdentity, legalities: { commander: "legal" },
      set: "tst", collector_number: "1"
    }
  };
}

const commander = card("cmd", "Test Commander", "Legendary Creature — Wizard");
const island = card("island", "Island", "Basic Land — Island", ["U"]);
const catalog = { cmd: commander, island };
const deck: CommanderDeckList = {
  commanderIds: ["cmd"],
  cards: [{ cardId: "cmd", quantity: 1 }, { cardId: "island", quantity: 99 }]
};

function coordinator() {
  let seed = 0;
  return new PregameCoordinator("pregame-room", players, catalog, {
    isCommanderEligible: candidate => candidate.providerId === "cmd"
  }, () => `server-seed-${++seed}`);
}

function submitAll(coordinator: PregameCoordinator) {
  for (const player of players) {
    expect(coordinator.submitDeck(player.id, deck).accepted).toBe(true);
  }
}

describe("PregameCoordinator", () => {
  it("validates four decks server-side before dealing private opening hands", () => {
    const room = coordinator();
    const invalid = room.submitDeck("p1", { ...deck, cards: [{ cardId: "cmd", quantity: 1 }] });
    expect(invalid).toMatchObject({ accepted: false, code: "INVALID_DECK" });
    expect(room.state.cards).toEqual({});

    submitAll(room);
    expect(room.state.status).toBe("pregame");
    expect(room.state.deckSetupComplete).toBe(false);
    expect(room.state.players.map(player => player.hand)).toHaveLength(4);
    expect(room.state.players.every(player => player.hand.length === 7)).toBe(true);
    expect(room.state.players.every(player => player.library.length === 92)).toBe(true);
    expect(room.state.players.every(player => player.command.length === 1)).toBe(true);
    expect(toPlayerView(room.state, "p1").players[1]?.hand).toEqual([]);
    expect(toPlayerView(room.state, "p1").players[1]?.handCount).toBe(7);
  });

  it("coordinates simultaneous mulligan declarations and starts only after every player keeps", () => {
    const room = coordinator();
    submitAll(room);

    expect(room.declareMulligan("p1", "mulligan").roundResolved).toBe(false);
    expect(room.declareMulligan("p2", "keep").roundResolved).toBe(false);
    expect(room.declareMulligan("p3", "keep").roundResolved).toBe(false);
    const firstRound = room.declareMulligan("p4", "keep");
    expect(firstRound.roundResolved).toBe(true);
    expect(room.state.players[0]?.mulliganCount).toBe(1);
    expect(room.state.players.slice(1).every(player => player.hasKeptHand)).toBe(true);

    expect(room.declareMulligan("p1", "mulligan").roundResolved).toBe(true);
    expect(room.state.players[0]?.pendingBottomCount).toBe(1);
    const playerHand = room.state.players[0]?.hand ?? [];
    const bottomed = room.chooseBottomCards("p1", [playerHand[0]!]);
    expect(bottomed.pendingBottomByPlayer).toEqual({});

    const ready = room.declareMulligan("p1", "keep");
    expect(ready.readyToStart).toBe(true);
    expect(room.start().status).toBe("active");
  });

  it("does not allow one player to submit another player's deck", () => {
    const room = coordinator();
    expect(room.submitDeck("intruder", deck)).toMatchObject({ accepted: false, code: "UNKNOWN_PLAYER" });
    expect(room.submitDeck("p1", deck).accepted).toBe(true);
    expect(room.submitDeck("p1", deck)).toMatchObject({ accepted: false, code: "DUPLICATE_SUBMISSION" });
  });
});
