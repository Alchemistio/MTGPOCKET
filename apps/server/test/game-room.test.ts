import { describe, expect, it } from "vitest";
import { GameRoom } from "../src/game-room.js";
import { addCardInstance, advanceAutomaticStep, applyStateBasedActions, changeLife, createGame, moveCardToZone, pushStackItem } from "@commander-pocket/game-engine";
import type { CardDefinition } from "@commander-pocket/card-data";
import type { GameState } from "@commander-pocket/game-engine";

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

  it("automatically skips cleanup when no player needs to discard", () => {
    const state: GameState = {
      ...advanceAutomaticStep(createGame("room-1", players)),
      deckSetupComplete: true,
      phase: "ending",
      step: "end"
    };
    const room = new GameRoom("room-1", players, state);
    let result;
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "empty-cleanup-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "step-advanced" });
    expect(room.state.pendingDiscardCount).toBe(0);
    expect(room.state.step).toBe("upkeep");
    expect(room.state.activePlayerId).toBe("p2");
    expect(room.state.priorityPlayerId).toBe("p2");
    expect(room.state.turnNumber).toBe(2);
    expect(room.replay()).toEqual(room.state);
  });

  it("handles cleanup discard and advances to the next player's upkeep", () => {
    let state: GameState = { ...advanceAutomaticStep(createGame("room-1", players)), deckSetupComplete: true, phase: "ending", step: "end" };
    for (let index = 0; index < 8; index += 1) {
      state = addCardInstance(state, {
        instance_id: "hand-" + index, card_id: "test-card", owner_id: "p1", zone: "hand"
      });
    }
    const room = new GameRoom("room-1", players, state);
    let result;
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "end-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "step-advanced" });
    expect(room.state.step).toBe("cleanup");
    expect(room.state.pendingDiscardPlayerId).toBe("p1");
    expect(room.state.pendingDiscardCount).toBe(1);

    const discard = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cleanup-discard",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "discard-cards", payload: { instanceIds: ["hand-0"] }
    });
    expect(discard).toMatchObject({ accepted: true, outcome: "decision-resolved" });
    expect(room.state.cards["hand-0"]?.zone).toBe("graveyard");
    expect(room.state.step).toBe("upkeep");
    expect(room.state.activePlayerId).toBe("p2");
    expect(room.state.priorityPlayerId).toBe("p2");
    expect(room.state.turnNumber).toBe(2);
    expect(room.replay()).toEqual(room.state);
  });

  it("casts an instant and a response, completes the turn through cleanup, and replays", () => {
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
    const base: GameState = { ...advanceAutomaticStep(createGame("room-1", players)), deckSetupComplete: true, phase: "precombat-main", step: "main-1" };
    const funded = {
      ...base,
      players: base.players.map(player => player.id === "p1" || player.id === "p2"
        ? { ...player, manaPool: { U: 1 } }
        : player)
    };
    let withFiller: GameState = funded;
    const fillerIds = Array.from({ length: 8 }, (_, index) => "filler-" + index);
    for (const instanceId of fillerIds) {
      withFiller = addCardInstance(withFiller, {
        instance_id: instanceId, card_id: "filler-card", owner_id: "p1", zone: "hand"
      });
    }
    const withFirstSpell = addCardInstance(withFiller, {
      instance_id: "spell-1", card_id: definition.providerId, owner_id: "p1", zone: "hand"
    });
    const withBothSpells = addCardInstance(withFirstSpell, {
      instance_id: "response-1", card_id: definition.providerId, owner_id: "p2", zone: "hand"
    });
    const room = new GameRoom("room-1", players, withBothSpells,
      (state, item) => item.source_instance_id === "response-1"
        ? changeLife(state, "p2", 5)
        : changeLife(state, "p2", -3),
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

    room.apply(command("p1", room.state.revision, "pass-to-response"));
    const response = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-response",
      playerId: "p2", expectedRevision: room.state.revision,
      type: "cast-spell", payload: { instanceId: "response-1" }
    });
    expect(response).toMatchObject({ accepted: true, outcome: "spell-cast" });
    expect(room.state.stack.map(item => item.source_instance_id)).toEqual(["spell-1", "response-1"]);
    expect(room.state.players[1]?.manaPool.U).toBe(0);

    let result;
    for (const playerId of ["p2", "p3", "p4", "p1"]) {
      result = room.apply(command(playerId, room.state.revision, "response-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.cards["response-1"]?.zone).toBe("graveyard");
    expect(room.state.cards["spell-1"]?.zone).toBe("stack");
    expect(room.state.players[1]?.life).toBe(45);

    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "spell-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.cards["spell-1"]?.zone).toBe("graveyard");
    expect(room.state.players[1]?.life).toBe(42);

    let phaseIndex = 0;
    while (room.state.step !== "end") {
      for (const playerId of ["p1", "p2", "p3", "p4"]) {
        const phaseResult = room.apply(command(playerId, room.state.revision, "phase-" + phaseIndex + "-" + playerId));
        expect(phaseResult.accepted).toBe(true);
      }
      phaseIndex += 1;
      if (phaseIndex > 10) throw new Error("Turn did not reach the end step.");
    }
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      room.apply(command(playerId, room.state.revision, "end-" + playerId));
    }
    expect(room.state.step).toBe("cleanup");
    expect(room.state.pendingDiscardPlayerId).toBe("p1");
    expect(room.state.pendingDiscardCount).toBe(1);
    const discard = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "full-turn-discard",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "discard-cards", payload: { instanceIds: ["filler-0"] }
    });
    expect(discard).toMatchObject({ accepted: true, outcome: "decision-resolved" });
    expect(room.state.players[0]?.hand).toHaveLength(7);
    expect(room.state.players[0]?.graveyard).toContain("filler-0");
    expect(room.state.step).toBe("upkeep");
    expect(room.state.activePlayerId).toBe("p2");
    expect(room.state.priorityPlayerId).toBe("p2");
    expect(room.state.turnNumber).toBe(2);
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
