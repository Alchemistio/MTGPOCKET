import { describe, expect, it } from "vitest";
import type { CardDefinition, CommanderDeckList } from "@commander-pocket/card-data";
import { PregameCoordinator } from "../src/pregame-coordinator.js";
import { PregameSessionRegistry } from "../src/pregame-session-registry.js";
import { RoomRegistry } from "../src/room-registry.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function card(providerId: string, name: string, typeLine: string): CardDefinition {
  return {
    provider: "scryfall", providerId, oracleId: providerId, name, layout: "normal",
    manaCost: null, manaValue: 0, typeLine, oracleText: "", colors: ["U"],
    colorIdentity: ["U"], legalities: { commander: "legal" }, faces: [],
    raw: { id: providerId, name, layout: "normal", cmc: 0, type_line: typeLine,
      colors: ["U"], color_identity: ["U"], legalities: { commander: "legal" },
      set: "tst", collector_number: "1" }
  };
}
const commander = card("cmd", "Test Commander", "Legendary Creature — Wizard");
const island = card("island", "Island", "Basic Land — Island");
const catalog = { cmd: commander, island };
const deck: CommanderDeckList = {
  commanderIds: ["cmd"],
  cards: [{ cardId: "cmd", quantity: 1 }, { cardId: "island", quantity: 99 }]
};

describe("PregameSessionRegistry", () => {
  it("requires the seat token and only returns the requesting player's private view", () => {
    const rooms = new RoomRegistry();
    const { credentials } = rooms.create("g1", players);
    let seed = 0;
    const sessions = new PregameSessionRegistry(rooms, {
      create: (gameId, setup) => new PregameCoordinator(gameId, setup, catalog, {
        isCommanderEligible: candidate => candidate.providerId === "cmd"
      }, () => `seed-${++seed}`)
    });

    expect(sessions.submitDeck("g1", "p1", "bad-token", deck)).toEqual({
      accepted: false, code: "UNAUTHENTICATED"
    });

    for (const credential of credentials) {
      const result = sessions.submitDeck("g1", credential.playerId, credential.token, deck);
      expect(result.accepted).toBe(true);
    }
    const alice = credentials.find(item => item.playerId === "p1")!;
    const bob = credentials.find(item => item.playerId === "p2")!;
    const aliceView = sessions.submitDeck("g1", "p1", alice.token, deck);
    expect(aliceView).toMatchObject({ accepted: true, result: { accepted: false, code: "DUPLICATE_SUBMISSION" } });

    // A token issued for another room must not authenticate against this room.
    const secondRooms = new RoomRegistry();
    const secondCredentials = secondRooms.create("g2", players).credentials;
    const secondSessions = new PregameSessionRegistry(secondRooms, {
      create: (gameId, setup) => new PregameCoordinator(gameId, setup, catalog, {
        isCommanderEligible: candidate => candidate.providerId === "cmd"
      }, () => `seed-${++seed}`)
    });
    for (const credential of secondCredentials) secondSessions.submitDeck("g2", credential.playerId, credential.token, deck);
    const bobResult = secondSessions.declareMulligan("g2", "p2", secondCredentials.find(item => item.playerId === "p2")!.token, "keep");
    expect(bobResult.accepted).toBe(true);
    if (bobResult.accepted) {
      expect(bobResult.view.players.find(player => player.id === "p2")?.hand).toHaveLength(7);
      expect(bobResult.view.players.find(player => player.id === "p1")?.hand).toEqual([]);
    }
    const seatViews = secondSessions.viewsForGame("g2");
    expect(seatViews).toHaveLength(4);
    const alicePrivateView = seatViews.find(item => item.playerId === "p1")?.view;
    const bobSeatView = seatViews.find(item => item.playerId === "p2")?.view;
    expect(alicePrivateView?.players.find(player => player.id === "p1")?.hand).toHaveLength(7);
    expect(alicePrivateView?.players.find(player => player.id === "p2")?.hand).toEqual([]);
    expect(bobSeatView?.players.find(player => player.id === "p2")?.hand).toHaveLength(7);
    expect(bobSeatView?.players.find(player => player.id === "p1")?.hand).toEqual([]);
    expect(sessions.declareMulligan("g1", "p2", secondCredentials.find(item => item.playerId === "p2")!.token, "keep"))
      .toEqual({ accepted: false, code: "UNAUTHENTICATED" });
    expect(sessions.declareMulligan("g1", "p2", bob.token, "keep").accepted).toBe(true);
  });

  it("does not start until the coordinator confirms all players kept and bottomed", () => {
    const rooms = new RoomRegistry();
    const credentials = rooms.create("g3", players).credentials;
    let seed = 0;
    const sessions = new PregameSessionRegistry(rooms, {
      create: (gameId, setup) => new PregameCoordinator(gameId, setup, catalog, {
        isCommanderEligible: candidate => candidate.providerId === "cmd"
      }, () => `seed-${++seed}`)
    });
    for (const credential of credentials) sessions.submitDeck("g3", credential.playerId, credential.token, deck);
    const alice = credentials.find(item => item.playerId === "p1")!;
    const blocked = sessions.start("g3", "p1", alice.token);
    expect(blocked).toMatchObject({ accepted: false });
    for (const credential of credentials) sessions.declareMulligan("g3", credential.playerId, credential.token, "keep");
    const started = sessions.start("g3", "p1", alice.token);
    expect(started.accepted).toBe(true);
    if (started.accepted) expect(started.view.step).toBeDefined();
  });
});
