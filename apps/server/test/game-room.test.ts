import { describe, expect, it } from "vitest";
import { GameRoom } from "../src/game-room.js";
import { addCardInstance, advanceAutomaticStep, applyStateBasedActions, changeLife, createGame, moveCardToZone, pushStackItem } from "@commander-pocket/game-engine";
import type { CardDefinition } from "@commander-pocket/card-data";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function command(playerId: string, revision: number, commandId: string) {
  return { protocolVersion: 1 as const, gameId: "room-1", commandId, playerId, expectedRevision: revision, type: "pass-priority", payload: {} };
}

describe("GameRoom", () => {
  it("starts at upkeep and advances only after all four seats pass", () => {
    const room = new GameRoom("room-1", players);
    expect(room.state.step).toBe("upkeep");
    expect(room.state.priorityPlayerId).toBe("p1");
    const a = room.apply(command("p1", room.state.revision, "a"));
    const b = room.apply(command("p2", room.state.revision, "b"));
    const c = room.apply(command("p3", room.state.revision, "c"));
    const d = room.apply(command("p4", room.state.revision, "d"));
    expect(a.accepted && a.outcome).toBe("passed");
    expect(b.accepted && b.outcome).toBe("passed");
    expect(c.accepted && c.outcome).toBe("passed");
    expect(d.accepted && d.outcome).toBe("step-advanced");
    expect(room.state.step).toBe("draw");
    expect(room.state.priorityPlayerId).toBe("p1");
  });

  it("casts a simple instant, pays its mana, resolves its effect and replays", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "test-instant", oracleId: "test-oracle",
      name: "Test Instant", layout: "normal", manaCost: "{U}", manaValue: 1,
      typeLine: "Instant", oracleText: "", colors: ["U"], colorIdentity: ["U"],
      legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "test-instant", oracle_id: "test-oracle", name: "Test Instant", layout: "normal",
        mana_cost: "{U}", cmc: 1, type_line: "Instant", oracle_text: "",
        colors: ["U"], color_identity: ["U"], legalities: { commander: "legal" },
        set: "tst", collector_number: "2"
      }
    };
    const base = { ...advanceAutomaticStep(createGame("room-1", players)), deckSetupComplete: true };
    const funded = {
      ...base,
      players: base.players.map(player => player.id === "p1" ? { ...player, manaPool: { U: 1 } } : player)
    };
    const withCard = addCardInstance(funded, {
      instance_id: "spell-1", card_id: definition.providerId, owner_id: "p1", zone: "hand"
    });
    const room = new GameRoom("room-1", players, withCard,
      state => changeLife(state, "p2", -3),
      cardId => cardId === definition.providerId ? definition : undefined
    );
    const cast = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-instant",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "cast-spell", payload: { instanceId: "spell-1" }
    });
    expect(cast).toMatchObject({ accepted: true, outcome: "spell-cast" });
    expect(room.state.cards["spell-1"]?.zone).toBe("stack");
    expect(room.state.players[0]?.manaPool.U).toBe(0);
    let result;
    for (const player of players) {
      result = room.apply(command(player.id, room.state.revision, "spell-pass-" + player.id));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.cards["spell-1"]?.zone).toBe("graveyard");
    expect(room.state.players[1]?.life).toBe(37);
    expect(room.replay()).toEqual(room.state);
  });

  it("resolves the top stack item after all seats pass and replays the resolved state", () => {
    const initial = pushStackItem(advanceAutomaticStep(createGame("room-1", players)), {
      id: "trigger-life", controller_id: "p1", source_instance_id: null,
      kind: "triggered-ability", payload: { effect: "lose-life" }
    });
    const room = new GameRoom("room-1", players, initial, state => changeLife(state, "p2", -3));
    let result;
    for (const player of players) {
      result = room.apply(command(player.id, room.state.revision, "pass-" + player.id));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.stack).toHaveLength(0);
    expect(room.state.awaitingResolutionId).toBeNull();
    expect(room.state.players[1]?.life).toBe(37);
    expect(room.state.priorityPlayerId).toBe("p1");
    expect(room.replay()).toEqual(room.state);
  });

  it("journals accepted commands and deterministically replays from its authoritative snapshot", () => {
    const room = new GameRoom("room-1", players);
    const snapshotRevision = room.state.revision;
    const first = room.apply(command("p1", room.state.revision, "event-1"));
    const second = room.apply(command("p2", room.state.revision, "event-2"));
    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);
    expect(room.eventLog).toHaveLength(2);
    expect(room.eventLog[0]).toMatchObject({
      protocolVersion: 1, gameId: "room-1", revision: first.revision,
      eventId: "p1:event-1", type: "command-applied",
      payload: { engineVersion: 1, snapshotRevision }
    });
    expect(room.replay()).toEqual(room.state);
  });

  it("rejects stale commands and does not apply duplicate command ids twice", () => {
    const room = new GameRoom("room-1", players);
    const revision = room.state.revision;
    const first = room.apply(command("p1", revision, "same-id"));
    const retry = room.apply(command("p1", revision, "same-id"));
    expect(first).toEqual(retry);
    expect(room.eventLog).toHaveLength(1);
    const stale = room.apply(command("p2", revision, "stale"));
    expect(stale).toMatchObject({ accepted: false, code: "STALE_REVISION" });
    expect(room.eventLog).toHaveLength(1);
  });
  it("scopes idempotency keys to the authenticated player seat", () => {
    const room = new GameRoom("room-1", players);
    const first = room.apply(command("p1", room.state.revision, "shared-id"));
    expect(first.accepted).toBe(true);

    // The same opaque command ID from another seat is a distinct command,
    // not a replay of the first player's cached response.
    const second = room.apply(command("p2", room.state.revision, "shared-id"));
    expect(second.accepted).toBe(true);
    expect(second.revision).toBeGreaterThan(first.revision);
  });

  it("resolves a commander-return choice only when submitted by its owner", () => {
    let state = createGame("room-1", players);
    state = addCardInstance(state, { instance_id: "cmd1", card_id: "commander", owner_id: "p1", zone: "command", is_commander: true });
    state = moveCardToZone(state, "cmd1", "exile");
    state = applyStateBasedActions(state);
    const room = new GameRoom("room-1", players, state);
    const rejected = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "wrong-owner",
      playerId: "p2", expectedRevision: state.revision,
      type: "resolve-commander-return", payload: { instanceId: "cmd1", choice: "command" }
    });
    expect(rejected).toMatchObject({ accepted: false, code: "NOT_COMMANDER_OWNER" });
    const accepted = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "owner-choice",
      playerId: "p1", expectedRevision: state.revision,
      type: "resolve-commander-return", payload: { instanceId: "cmd1", choice: "command" }
    });
    expect(accepted).toMatchObject({ accepted: true, outcome: "decision-resolved" });
    expect(room.state.cards.cmd1?.zone).toBe("command");
  });
});
