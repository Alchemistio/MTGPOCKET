import { describe, expect, it } from "vitest";
import { GameRoom } from "../src/game-room.js";
import { addCardInstance, advanceAutomaticStep, applyStateBasedActions, changeLife, createGame, createPendingTriggerBatch, moveCardToZone, pushStackItem } from "@commander-pocket/game-engine";
import type { CardDefinition } from "@commander-pocket/card-data";
import type { GameState, ZoneChangeEvent } from "@commander-pocket/game-engine";
import { basicLandManaOptions, createBasicPermanentEntryReplacements, resolveBasicSpellEffect, scanBasicZoneChangeTriggers, supportsBasicSpell } from "../src/basic-spell-effects.js";
import { toPlayerView } from "../src/player-view.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

function command(playerId: string, revision: number, commandId: string) {
  return { protocolVersion: 1 as const, gameId: "room-1", commandId, playerId, expectedRevision: revision, type: "pass-priority", payload: {} };
}

describe("GameRoom", () => {
  it("compiles only exact self-entry +1/+1 counter text into a replacement", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "counter-entry", oracleId: "counter-entry-oracle",
      name: "Counter Adept", layout: "normal", manaCost: "{2}{G}", manaValue: 3,
      typeLine: "Creature — Elf", oracleText: "Counter Adept enters the battlefield with 3 +1/+1 counters on it.",
      colors: ["G"], colorIdentity: ["G"], legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "counter-entry", oracle_id: "counter-entry-oracle", name: "Counter Adept",
        layout: "normal", mana_cost: "{2}{G}", cmc: 3, type_line: "Creature — Elf",
        oracle_text: "Counter Adept enters the battlefield with 3 +1/+1 counters on it.",
        colors: ["G"], color_identity: ["G"], legalities: { commander: "legal" },
        set: "tst", collector_number: "20"
      }
    };
    expect(supportsBasicSpell(definition)).toBe(true);
    const replacements = createBasicPermanentEntryReplacements(definition, "p1");
    expect(replacements).toHaveLength(1);
    expect(replacements[0]?.id).toBe("self-enters-with-p1p1:counter-entry");
    expect(replacements[0]?.kind).toBe("self");
    expect(createBasicPermanentEntryReplacements({
      ...definition, oracleText: "Counter Adept enters the battlefield with X +1/+1 counters on it."
    }, "p1")).toEqual([]);
  });

  it("scans every battlefield permanent for matching entry triggers and captures source controllers", () => {
    const definitions: Record<string, CardDefinition> = {
      "global-creature-trigger": {
        provider: "scryfall", providerId: "global-creature-trigger", oracleId: "global-creature-trigger-oracle",
        name: "Watcher Enchantment", layout: "normal", manaCost: "{2}{W}", manaValue: 3,
        typeLine: "Enchantment", oracleText: "Whenever another creature enters the battlefield, draw a card.",
        colors: ["W"], colorIdentity: ["W"], legalities: { commander: "legal" }, faces: [],
        raw: { id: "global-creature-trigger", name: "Watcher Enchantment", layout: "normal", mana_cost: "{2}{W}", cmc: 3, type_line: "Enchantment", oracle_text: "Whenever another creature enters the battlefield, draw a card.", colors: ["W"], color_identity: ["W"], legalities: { commander: "legal" }, set: "tst", collector_number: "81" }
      },
      "global-permanent-trigger": {
        provider: "scryfall", providerId: "global-permanent-trigger", oracleId: "global-permanent-trigger-oracle",
        name: "Welcome Shrine", layout: "normal", manaCost: "{3}", manaValue: 3,
        typeLine: "Artifact", oracleText: "Whenever a permanent enters the battlefield, you gain 2 life.",
        colors: [], colorIdentity: [], legalities: { commander: "legal" }, faces: [],
        raw: { id: "global-permanent-trigger", name: "Welcome Shrine", layout: "normal", mana_cost: "{3}", cmc: 3, type_line: "Artifact", oracle_text: "Whenever a permanent enters the battlefield, you gain 2 life.", colors: [], color_identity: [], legalities: { commander: "legal" }, set: "tst", collector_number: "82" }
      },
      "entrant-trigger": {
        provider: "scryfall", providerId: "entrant-trigger", oracleId: "entrant-trigger-oracle",
        name: "New Recruit", layout: "normal", manaCost: "{W}", manaValue: 1,
        typeLine: "Creature — Soldier", oracleText: "When New Recruit enters the battlefield, draw a card.",
        colors: ["W"], colorIdentity: ["W"], legalities: { commander: "legal" }, faces: [],
        raw: { id: "entrant-trigger", name: "New Recruit", layout: "normal", mana_cost: "{W}", cmc: 1, type_line: "Creature — Soldier", oracle_text: "When New Recruit enters the battlefield, draw a card.", colors: ["W"], color_identity: ["W"], legalities: { commander: "legal" }, set: "tst", collector_number: "83" }
      }
    };
    let state = advanceAutomaticStep(createGame("room-1", players));
    state = addCardInstance(state, {
      instance_id: "watcher-instance", card_id: "global-creature-trigger", owner_id: "p2", zone: "battlefield"
    });
    state = addCardInstance(state, {
      instance_id: "shrine-instance", card_id: "global-permanent-trigger", owner_id: "p3", zone: "battlefield"
    });
    state = addCardInstance(state, {
      instance_id: "recruit-instance", card_id: "entrant-trigger", owner_id: "p1", zone: "battlefield"
    });
    const after = state.cards["recruit-instance"]!;
    const before = { ...after, zone: "hand" as const };
    const event: ZoneChangeEvent = {
      eventId: "entry-event-1", simultaneousGroupId: null,
      instanceBefore: before, instanceAfter: after,
      fromZone: "hand", toZone: "battlefield", ownerId: "p1",
      controllerBefore: "p1", controllerAfter: "p1",
      cause: "spell-resolution", replacementTrace: [], lastKnownInfo: before
    };
    const candidates = scanBasicZoneChangeTriggers(
      state, event, cardId => definitions[cardId], state.revision
    );
    expect(candidates.map(candidate => ({
      source: candidate.sourceInstanceId,
      controller: candidate.controllerAtTrigger,
      effect: (candidate.stackItem.payload as { effect: string }).effect,
      eventId: candidate.eventId
    }))).toEqual([
      { source: "recruit-instance", controller: "p1", effect: "etb-draw-one", eventId: "entry-event-1" },
      { source: "watcher-instance", controller: "p2", effect: "etb-draw-one", eventId: "entry-event-1" },
      { source: "shrine-instance", controller: "p3", effect: "etb-gain-life", eventId: "entry-event-1" }
    ]);
    expect(new Set(candidates.map(candidate => candidate.stackItem.id)).size).toBe(3);
  });

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

  it("plays one basic land from hand without using the stack or paying mana", () => {
    const plains: CardDefinition = {
      provider: "scryfall", providerId: "plains-id", oracleId: "plains-oracle",
      name: "Plains", layout: "normal", manaCost: "", manaValue: 0,
      typeLine: "Basic Land — Plains", oracleText: "", colors: [], colorIdentity: [],
      legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "plains-id", oracle_id: "plains-oracle", name: "Plains", layout: "normal",
        mana_cost: "", cmc: 0, type_line: "Basic Land — Plains", oracle_text: "",
        colors: [], color_identity: [], legalities: { commander: "legal" }, set: "tst", collector_number: "9"
      }
    };
    const initialGame = advanceAutomaticStep(createGame("room-1", players));
    const base: GameState = {
      ...initialGame, deckSetupComplete: true, phase: "precombat-main", step: "main-1"
    };
    let initial = addCardInstance(base, {
      instance_id: "plains-one", card_id: plains.providerId, owner_id: "p1", zone: "hand"
    });
    initial = addCardInstance(initial, {
      instance_id: "plains-two", card_id: plains.providerId, owner_id: "p1", zone: "hand"
    });
    const room = new GameRoom("room-1", players, initial, undefined,
      cardId => cardId === plains.providerId ? plains : undefined);
    const first = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "play-first-land",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "play-land", payload: { instanceId: "plains-one" }
    });
    expect(first).toMatchObject({ accepted: true, outcome: "land-played" });
    expect(room.state.cards["plains-one"]).toMatchObject({
      zone: "battlefield", owner_id: "p1", controller_id: "p1", is_tapped: false
    });
    expect(room.state.players[0]?.landsPlayedThisTurn).toBe(1);
    expect(room.state.players[0]?.manaPool).toEqual({});
    expect(room.state.stack).toHaveLength(0);
    expect(room.state.players[0]?.battlefield).toContain("plains-one");

    const second = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "play-second-land",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "play-land", payload: { instanceId: "plains-two" }
    });
    expect(second).toMatchObject({ accepted: false, code: "LAND_PLAY_LIMIT" });
    expect(room.state.cards["plains-two"]?.zone).toBe("hand");
    expect(room.replay()).toEqual(room.state);
  });

  it("rejects a land play outside a main phase without moving the card", () => {
    const plains: CardDefinition = {
      provider: "scryfall", providerId: "timing-plains", oracleId: "timing-plains-oracle",
      name: "Plains", layout: "normal", manaCost: "", manaValue: 0,
      typeLine: "Basic Land — Plains", oracleText: "", colors: [], colorIdentity: [],
      legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "timing-plains", name: "Plains", layout: "normal", mana_cost: "", cmc: 0,
        type_line: "Basic Land — Plains", oracle_text: "", colors: [], color_identity: [],
        legalities: { commander: "legal" }, set: "tst", collector_number: "10"
      }
    };
    const initialGame = advanceAutomaticStep(createGame("room-1", players));
    const base: GameState = { ...initialGame, deckSetupComplete: true };
    const initial = addCardInstance(base, {
      instance_id: "timing-plains-instance", card_id: plains.providerId, owner_id: "p1", zone: "hand"
    });
    const room = new GameRoom("room-1", players, initial, undefined,
      cardId => cardId === plains.providerId ? plains : undefined);
    const result = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "play-land-at-upkeep",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "play-land", payload: { instanceId: "timing-plains-instance" }
    });
    expect(result).toMatchObject({ accepted: false, code: "LAND_TIMING" });
    expect(room.state.cards["timing-plains-instance"]?.zone).toBe("hand");
    expect(room.state.players[0]?.landsPlayedThisTurn).toBe(0);
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

  it("taps an untapped basic land for mana and rejects a second tap", () => {
    const island: CardDefinition = {
      provider: "scryfall", providerId: "island-id", oracleId: "island-oracle",
      name: "Island", layout: "normal", manaCost: "", manaValue: 0,
      typeLine: "Basic Land — Island", oracleText: "", colors: [], colorIdentity: [],
      legalities: { commander: "legal" }, faces: [],
      raw: { id: "island-id", oracle_id: "island-oracle", name: "Island", layout: "normal",
        mana_cost: "", cmc: 0, type_line: "Basic Land — Island", oracle_text: "",
        colors: [], color_identity: [], legalities: { commander: "legal" }, set: "tst", collector_number: "5" }
    };
    expect(basicLandManaOptions(island)).toEqual(["U"]);
    expect(basicLandManaOptions({
      ...island, providerId: "wastes-id", typeLine: "Basic Land", oracleText: "{T}: Add {C}."
    })).toEqual(["C"]);
    const base: GameState = { ...advanceAutomaticStep(createGame("room-1", players)), deckSetupComplete: true, phase: "precombat-main", step: "main-1" };
    const initial = addCardInstance(base, {
      instance_id: "island-instance", card_id: island.providerId, owner_id: "p1", zone: "battlefield"
    });
    const room = new GameRoom("room-1", players, initial, undefined,
      cardId => cardId === island.providerId ? island : undefined);
    const tap = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "tap-island",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "tap-for-mana", payload: { instanceId: "island-instance", color: "U" }
    });
    expect(tap).toMatchObject({ accepted: true, outcome: "mana-added" });
    expect(room.state.cards["island-instance"]?.is_tapped).toBe(true);
    expect(room.state.players[0]?.manaPool.U).toBe(1);
    const secondTap = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "tap-island-again",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "tap-for-mana", payload: { instanceId: "island-instance", color: "U" }
    });
    expect(secondTap).toMatchObject({ accepted: false, code: "PERMANENT_TAPPED" });
    expect(room.replay()).toEqual(room.state);
  });

  it("casts Divination through the typed stack handler and draws two cards", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "divination-id", oracleId: "divination-oracle",
      name: "Divination", layout: "normal", manaCost: "{2}{U}", manaValue: 3,
      typeLine: "Sorcery", oracleText: "Draw two cards.", colors: ["U"], colorIdentity: ["U"],
      legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "divination-id", oracle_id: "divination-oracle", name: "Divination", layout: "normal",
        mana_cost: "{2}{U}", cmc: 3, type_line: "Sorcery", oracle_text: "Draw two cards.",
        colors: ["U"], color_identity: ["U"], legalities: { commander: "legal" },
        set: "tst", collector_number: "3"
      }
    };
    expect(supportsBasicSpell(definition)).toBe(true);
    expect(supportsBasicSpell({ ...definition, oracleText: "Target player draws two cards." })).toBe(false);
    const base: GameState = {
      ...advanceAutomaticStep(createGame("room-1", players)),
      deckSetupComplete: true,
      phase: "precombat-main",
      step: "main-1",
      players: advanceAutomaticStep(createGame("room-1", players)).players.map(player =>
        player.id === "p1" ? { ...player, manaPool: { U: 3 } } : player)
    };
    let initial = addCardInstance(base, {
      instance_id: "divination-instance", card_id: definition.providerId, owner_id: "p1", zone: "hand"
    });
    initial = addCardInstance(initial, {
      instance_id: "draw-one", card_id: "draw-card-one", owner_id: "p1", zone: "library"
    });
    initial = addCardInstance(initial, {
      instance_id: "draw-two", card_id: "draw-card-two", owner_id: "p1", zone: "library"
    });
    const room = new GameRoom("room-1", players, initial, (state, item) => {
      if (item.kind === "spell") throw new Error("BASIC_SPELL_SHOULD_USE_TYPED_HANDLER");
      return resolveBasicSpellEffect(state, item);
    }, cardId => cardId === definition.providerId ? definition : undefined, supportsBasicSpell);
    const cast = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-divination",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "cast-spell", payload: { instanceId: "divination-instance" }
    });
    expect(cast).toMatchObject({ accepted: true, outcome: "spell-cast" });
    expect(room.state.players[0]?.manaPool.U).toBe(0);
    let result;
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "divination-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.players[0]?.hand).toEqual(expect.arrayContaining(["draw-one", "draw-two"]));
    expect(room.state.cards["divination-instance"]?.zone).toBe("graveyard");
    expect(room.replay()).toEqual(room.state);
  });

  it("resolves an allowlisted ETB life-gain trigger only after it leaves the stack", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "lone-missionary-fixture", oracleId: "lone-missionary-oracle",
      name: "Lone Missionary", layout: "normal", manaCost: "", manaValue: 0,
      typeLine: "Creature — Kor Monk", oracleText: "When Lone Missionary enters the battlefield, you gain 4 life.",
      colors: ["W"], colorIdentity: ["W"], legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "lone-missionary-fixture", oracle_id: "lone-missionary-oracle", name: "Lone Missionary",
        layout: "normal", mana_cost: "", cmc: 0, type_line: "Creature — Kor Monk",
        oracle_text: "When Lone Missionary enters the battlefield, you gain 4 life.",
        colors: ["W"], color_identity: ["W"], legalities: { commander: "legal" },
        set: "tst", collector_number: "14"
      }
    };
    expect(supportsBasicSpell(definition)).toBe(true);
    expect(supportsBasicSpell({
      ...definition, oracleText: "When Lone Missionary enters the battlefield, you gain four life."
    })).toBe(false);
    const base: GameState = {
      ...advanceAutomaticStep(createGame("room-1", players)),
      deckSetupComplete: true, phase: "precombat-main", step: "main-1"
    };
    const initial = addCardInstance(base, {
      instance_id: "lone-missionary", card_id: definition.providerId, owner_id: "p1", zone: "hand"
    });
    const room = new GameRoom("room-1", players, initial, (state, item) => {
      if (item.kind === "triggered-ability") throw new Error("ETB_TRIGGER_SHOULD_USE_TYPED_HANDLER");
      return resolveBasicSpellEffect(state, item);
    }, cardId => cardId === definition.providerId ? definition : undefined, supportsBasicSpell);
    const cast = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-missionary",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "cast-spell", payload: { instanceId: "lone-missionary" }
    });
    expect(cast).toMatchObject({ accepted: true, outcome: "spell-cast" });
    let result;
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "missionary-spell-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.players[0]?.life).toBe(40);
    expect(room.state.stack).toMatchObject([{
      kind: "triggered-ability", controller_id: "p1", source_instance_id: "lone-missionary",
      payload: {
        effect: "etb-gain-life", amount: 4, sourceName: "Lone Missionary",
        zoneChangeEventId: "zone-change:spell:p1:cast-missionary"
      }
    }]);
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "missionary-trigger-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.players[0]?.life).toBe(44);
    expect(room.replay()).toEqual(room.state);
  });

  it("casts a vanilla creature during a main phase and puts it onto its controller's battlefield", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "vanilla-creature", oracleId: "vanilla-creature-oracle",
      name: "Vanilla Scout", layout: "normal", manaCost: "{1}{W}", manaValue: 2,
      typeLine: "Creature — Human Soldier", oracleText: "", colors: ["W"], colorIdentity: ["W"],
      legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "vanilla-creature", oracle_id: "vanilla-creature-oracle", name: "Vanilla Scout",
        layout: "normal", mana_cost: "{1}{W}", cmc: 2, type_line: "Creature — Human Soldier",
        oracle_text: "", colors: ["W"], color_identity: ["W"], legalities: { commander: "legal" },
        set: "tst", collector_number: "6"
      }
    };
    expect(supportsBasicSpell(definition)).toBe(true);
    expect(supportsBasicSpell({ ...definition, typeLine: "Artifact" })).toBe(true);
    expect(supportsBasicSpell({ ...definition, typeLine: "Enchantment" })).toBe(true);
    expect(supportsBasicSpell({ ...definition, oracleText: "Flying" })).toBe(false);
    expect(supportsBasicSpell({ ...definition, layout: "transform" })).toBe(false);

    const initialGame = advanceAutomaticStep(createGame("room-1", players));
    const base: GameState = {
      ...initialGame, deckSetupComplete: true, phase: "precombat-main", step: "main-1",
      players: initialGame.players.map(player => player.id === "p1"
        ? { ...player, manaPool: { W: 1, C: 1 } }
        : player)
    };
    const initial = addCardInstance(base, {
      instance_id: "vanilla-scout", card_id: definition.providerId, owner_id: "p1", zone: "hand"
    });
    const room = new GameRoom("room-1", players, initial, resolveBasicSpellEffect,
      cardId => cardId === definition.providerId ? definition : undefined, supportsBasicSpell);

    const cast = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-vanilla-creature",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "cast-spell", payload: { instanceId: "vanilla-scout" }
    });
    expect(cast).toMatchObject({ accepted: true, outcome: "spell-cast" });
    expect(room.state.cards["vanilla-scout"]?.zone).toBe("stack");
    expect(room.state.players[0]?.manaPool).toEqual({ W: 0, C: 0 });

    let result;
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "vanilla-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.cards["vanilla-scout"]).toMatchObject({
      zone: "battlefield", owner_id: "p1", controller_id: "p1", is_tapped: false
    });
    expect(room.state.players[0]?.battlefield).toContain("vanilla-scout");
    expect(room.state.players[0]?.graveyard).not.toContain("vanilla-scout");
    expect(room.replay()).toEqual(room.state);
    const restored = GameRoom.restore(
      room.checkpoint,
      resolveBasicSpellEffect,
      cardId => cardId === definition.providerId ? definition : undefined,
      supportsBasicSpell
    );
    expect(restored.state).toEqual(room.state);
  });

  it("puts a permanent spell into its owner's graveyard when battlefield entry is prevented", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "prevented-creature", oracleId: "prevented-creature-oracle",
      name: "Prevented Creature", layout: "normal", manaCost: "{W}", manaValue: 1,
      typeLine: "Creature — Soldier", oracleText: "", colors: ["W"], colorIdentity: ["W"],
      legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "prevented-creature", name: "Prevented Creature", layout: "normal", mana_cost: "{W}", cmc: 1,
        type_line: "Creature — Soldier", oracle_text: "", colors: ["W"], color_identity: ["W"],
        legalities: { commander: "legal" }, set: "tst", collector_number: "71"
      }
    };
    const initialGame = advanceAutomaticStep(createGame("room-1", players));
    const base: GameState = {
      ...initialGame, deckSetupComplete: true, phase: "precombat-main", step: "main-1",
      players: initialGame.players.map(player => player.id === "p1" ? { ...player, manaPool: { W: 1 } } : player)
    };
    const initial = addCardInstance(base, {
      instance_id: "prevented-creature-instance", card_id: definition.providerId, owner_id: "p1", zone: "hand"
    });
    const cardResolver = (cardId: string) => cardId === definition.providerId ? definition : undefined;
    const preventEntry = () => [{
      id: "prevent-battlefield-entry", kind: "general" as const, controllerId: "p2",
      applies: (proposal: import("@commander-pocket/game-engine").ZoneChangeProposal) =>
        proposal.toZone === "battlefield",
      replace: () => null
    }];
    const room = new GameRoom("room-1", players, initial, resolveBasicSpellEffect, cardResolver,
      supportsBasicSpell, preventEntry);
    const cast = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-prevented-creature",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "cast-spell", payload: { instanceId: "prevented-creature-instance" }
    });
    expect(cast).toMatchObject({ accepted: true, outcome: "spell-cast" });
    let result;
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "prevent-entry-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.cards["prevented-creature-instance"]?.zone).toBe("graveyard");
    expect(room.state.players[0]?.graveyard).toContain("prevented-creature-instance");
    expect(room.state.players[0]?.battlefield).not.toContain("prevented-creature-instance");
    expect(room.state.stack).toHaveLength(0);
    expect(room.state.awaitingResolutionId).toBeNull();
    expect(room.state.pendingZoneChangeChoice).toBeNull();
    expect(room.replay()).toEqual(room.state);
  });

  it("puts a supported ETB draw trigger on the stack after its permanent resolves", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "wall-of-omens-fixture", oracleId: "wall-of-omens-oracle",
      name: "Wall of Omens", layout: "normal", manaCost: "{1}{W}", manaValue: 2,
      typeLine: "Creature — Wall", oracleText: "When Wall of Omens enters the battlefield, draw a card.",
      colors: ["W"], colorIdentity: ["W"], legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "wall-of-omens-fixture", oracle_id: "wall-of-omens-oracle", name: "Wall of Omens",
        layout: "normal", mana_cost: "{1}{W}", cmc: 2, type_line: "Creature — Wall",
        oracle_text: "When Wall of Omens enters the battlefield, draw a card.",
        colors: ["W"], color_identity: ["W"], legalities: { commander: "legal" },
        set: "tst", collector_number: "12"
      }
    };
    expect(supportsBasicSpell(definition)).toBe(true);
    expect(supportsBasicSpell({ ...definition, oracleText: "When Wall of Omens enters the battlefield, scry 1." })).toBe(false);
    const initialGame = advanceAutomaticStep(createGame("room-1", players));
    const base: GameState = {
      ...initialGame, deckSetupComplete: true, phase: "precombat-main", step: "main-1",
      players: initialGame.players.map(player => player.id === "p1" ? { ...player, manaPool: { W: 1, C: 1 } } : player)
    };
    let initial = addCardInstance(base, {
      instance_id: "wall-of-omens", card_id: definition.providerId, owner_id: "p1", zone: "hand"
    });
    initial = addCardInstance(initial, {
      instance_id: "top-card", card_id: "draw-fixture", owner_id: "p1", zone: "library"
    });
    const room = new GameRoom("room-1", players, initial, (state, item) => {
      if (item.kind === "triggered-ability") throw new Error("ETB_TRIGGER_SHOULD_USE_TYPED_HANDLER");
      return resolveBasicSpellEffect(state, item);
    }, cardId => cardId === definition.providerId ? definition : undefined, supportsBasicSpell);
    const cast = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-wall",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "cast-spell", payload: { instanceId: "wall-of-omens" }
    });
    expect(cast).toMatchObject({ accepted: true, outcome: "spell-cast" });
    let result;
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "wall-spell-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.cards["wall-of-omens"]?.zone).toBe("battlefield");
    expect(room.state.stack).toMatchObject([{
      kind: "triggered-ability", controller_id: "p1", source_instance_id: "wall-of-omens",
      payload: {
        effect: "etb-draw-one", sourceName: "Wall of Omens",
        zoneChangeEventId: "zone-change:spell:p1:cast-wall"
      }
    }]);
    expect(room.state.players[0]?.hand).not.toContain("top-card");
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "wall-trigger-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.players[0]?.hand).toContain("top-card");
    expect(room.state.stack).toHaveLength(0);
    expect(room.replay()).toEqual(room.state);
    const restored = GameRoom.restore(
      room.checkpoint,
      resolveBasicSpellEffect,
      cardId => cardId === definition.providerId ? definition : undefined,
      supportsBasicSpell
    );
    expect(restored.state).toEqual(room.state);
  });

  it("suspends a permanent spell for sequential replacement choices and restores the pending decision", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "choice-creature", oracleId: "choice-creature-oracle",
      name: "Choice Creature", layout: "normal", manaCost: "{W}", manaValue: 1,
      typeLine: "Creature — Soldier", oracleText: "", colors: ["W"], colorIdentity: ["W"],
      legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "choice-creature", name: "Choice Creature", layout: "normal", mana_cost: "{W}", cmc: 1,
        type_line: "Creature — Soldier", oracle_text: "", colors: ["W"], color_identity: ["W"],
        legalities: { commander: "legal" }, set: "tst", collector_number: "70"
      }
    };
    const initialGame = advanceAutomaticStep(createGame("room-1", players));
    const base: GameState = {
      ...initialGame, deckSetupComplete: true, phase: "precombat-main", step: "main-1",
      players: initialGame.players.map(player => player.id === "p1" ? { ...player, manaPool: { W: 1 } } : player)
    };
    const initial = addCardInstance(base, {
      instance_id: "choice-creature-instance", card_id: definition.providerId, owner_id: "p1", zone: "hand"
    });
    const resolveEntryReplacements = (_state: GameState, _item: import("@commander-pocket/game-engine").StackItem) => [
      {
        id: "copy-choice-a", kind: "copy" as const, controllerId: "p1",
        applies: (proposal: import("@commander-pocket/game-engine").ZoneChangeProposal) =>
          proposal.toZone === "battlefield" && proposal.entersTapped !== true,
        replace: (proposal: import("@commander-pocket/game-engine").ZoneChangeProposal) =>
          ({ ...proposal, entersTapped: true })
      },
      {
        id: "copy-choice-b", kind: "copy" as const, controllerId: "p1",
        applies: (proposal: import("@commander-pocket/game-engine").ZoneChangeProposal) =>
          proposal.toZone === "battlefield" && proposal.entersTapped !== true,
        replace: (proposal: import("@commander-pocket/game-engine").ZoneChangeProposal) =>
          ({ ...proposal, entersWithP1P1Counters: 9 })
      },
      {
        id: "general-choice-a", kind: "general" as const, controllerId: "p1",
        applies: (proposal: import("@commander-pocket/game-engine").ZoneChangeProposal) =>
          proposal.toZone === "battlefield" && proposal.entersWithP1P1Counters === undefined,
        replace: (proposal: import("@commander-pocket/game-engine").ZoneChangeProposal) =>
          ({ ...proposal, entersTapped: true })
      },
      {
        id: "general-choice-b", kind: "general" as const, controllerId: "p1",
        applies: (proposal: import("@commander-pocket/game-engine").ZoneChangeProposal) =>
          proposal.toZone === "battlefield" && proposal.entersWithP1P1Counters === undefined,
        replace: (proposal: import("@commander-pocket/game-engine").ZoneChangeProposal) =>
          ({ ...proposal, entersWithP1P1Counters: 2 })
      }
    ];
    const cardResolver = (cardId: string) => cardId === definition.providerId ? definition : undefined;
    const room = new GameRoom("room-1", players, initial, resolveBasicSpellEffect, cardResolver,
      supportsBasicSpell, resolveEntryReplacements);
    const cast = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-choice-creature",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "cast-spell", payload: { instanceId: "choice-creature-instance" }
    });
    expect(cast).toMatchObject({ accepted: true, outcome: "spell-cast" });
    let result;
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "choice-spell-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "decision-required" });
    expect(room.state.awaitingResolutionId).toBe("spell:p1:cast-choice-creature");
    expect(room.state.stack).toHaveLength(1);
    expect(room.state.cards["choice-creature-instance"]?.zone).toBe("stack");
    const pending = room.state.pendingZoneChangeChoice;
    expect(pending?.candidateEffectIds).toEqual(["copy-choice-a", "copy-choice-b"]);
    expect(toPlayerView(room.state, "p1").pendingZoneChangeChoice?.candidateEffectIds).toEqual(["copy-choice-a", "copy-choice-b"]);
    expect(toPlayerView(room.state, "p2").pendingZoneChangeChoice).toBeNull();

    const wrongPlayer = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "wrong-choice-player",
      playerId: "p2", expectedRevision: room.state.revision,
      type: "resolve-zone-change-replacement",
      payload: { pendingId: pending?.id, effectId: "copy-choice-a" }
    });
    expect(wrongPlayer).toMatchObject({ accepted: false, code: "NOT_PENDING_ZONE_CHANGE_CHOOSER" });

    const firstChoice = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "first-entry-choice",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "resolve-zone-change-replacement",
      payload: { pendingId: pending?.id, effectId: "copy-choice-a" }
    });
    expect(firstChoice).toMatchObject({ accepted: true, outcome: "decision-required" });
    expect(room.state.cards["choice-creature-instance"]?.zone).toBe("stack");
    expect(room.state.stack).toHaveLength(1);
    expect(room.state.pendingZoneChangeChoice?.candidateEffectIds).toEqual(["general-choice-a", "general-choice-b"]);

    const secondPending = room.state.pendingZoneChangeChoice;
    const secondChoice = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "second-entry-choice",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "resolve-zone-change-replacement",
      payload: { pendingId: secondPending?.id, effectId: "general-choice-b" }
    });
    expect(secondChoice).toMatchObject({ accepted: true, outcome: "decision-resolved" });
    expect(room.state.pendingZoneChangeChoice).toBeNull();
    expect(room.state.awaitingResolutionId).toBeNull();
    expect(room.state.stack).toHaveLength(0);
    expect(room.state.cards["choice-creature-instance"]).toMatchObject({
      zone: "battlefield", is_tapped: true, counters: { p1p1: 2 }
    });
    expect(room.replay()).toEqual(room.state);
    const restored = GameRoom.restore(room.checkpoint, resolveBasicSpellEffect, cardResolver,
      supportsBasicSpell, resolveEntryReplacements);
    expect(restored.state).toEqual(room.state);
  });

  it("rejects a permanent spell outside its controller's main phase without spending mana", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "timing-creature", oracleId: "timing-creature-oracle",
      name: "Timing Creature", layout: "normal", manaCost: "{W}", manaValue: 1,
      typeLine: "Creature — Soldier", oracleText: "", colors: ["W"], colorIdentity: ["W"],
      legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "timing-creature", name: "Timing Creature", layout: "normal", mana_cost: "{W}", cmc: 1,
        type_line: "Creature — Soldier", oracle_text: "", colors: ["W"], color_identity: ["W"],
        legalities: { commander: "legal" }, set: "tst", collector_number: "7"
      }
    };
    const initialGame = advanceAutomaticStep(createGame("room-1", players));
    const base: GameState = {
      ...initialGame,
      deckSetupComplete: true,
      players: initialGame.players.map(player => player.id === "p1"
        ? { ...player, manaPool: { W: 1 } }
        : player)
    };
    const initial = addCardInstance(base, {
      instance_id: "timing-creature-instance", card_id: definition.providerId, owner_id: "p1", zone: "hand"
    });
    const room = new GameRoom("room-1", players, initial, resolveBasicSpellEffect,
      cardId => cardId === definition.providerId ? definition : undefined, supportsBasicSpell);
    const result = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-at-upkeep",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "cast-spell", payload: { instanceId: "timing-creature-instance" }
    });
    expect(result).toMatchObject({ accepted: false, code: "PERMANENT_TIMING" });
    expect(room.state.players[0]?.manaPool.W).toBe(1);
    expect(room.state.cards["timing-creature-instance"]?.zone).toBe("hand");
  });

  it("resolves a supported life-gain instant without treating unknown text as a no-op", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "life-gain-id", oracleId: "life-gain-oracle",
      name: "Life Gain", layout: "normal", manaCost: "{W}", manaValue: 1,
      typeLine: "Instant", oracleText: "You gain 3 life.", colors: ["W"], colorIdentity: ["W"],
      legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "life-gain-id", oracle_id: "life-gain-oracle", name: "Life Gain", layout: "normal",
        mana_cost: "{W}", cmc: 1, type_line: "Instant", oracle_text: "You gain 3 life.",
        colors: ["W"], color_identity: ["W"], legalities: { commander: "legal" },
        set: "tst", collector_number: "4"
      }
    };
    const base: GameState = {
      ...advanceAutomaticStep(createGame("room-1", players)),
      deckSetupComplete: true, phase: "precombat-main", step: "main-1",
      players: advanceAutomaticStep(createGame("room-1", players)).players.map(player =>
        player.id === "p1" ? { ...player, manaPool: { W: 1 } } : player)
    };
    const initial = addCardInstance(base, {
      instance_id: "life-gain-instance", card_id: definition.providerId, owner_id: "p1", zone: "hand"
    });
    const room = new GameRoom("room-1", players, initial, (state, item) => {
      if (item.kind === "spell") throw new Error("BASIC_SPELL_SHOULD_USE_TYPED_HANDLER");
      return resolveBasicSpellEffect(state, item);
    }, cardId => cardId === definition.providerId ? definition : undefined, supportsBasicSpell);
    const cast = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-life-gain",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "cast-spell", payload: { instanceId: "life-gain-instance" }
    });
    expect(cast).toMatchObject({ accepted: true, outcome: "spell-cast" });
    let result;
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "life-gain-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.players[0]?.life).toBe(43);
    expect(room.state.cards["life-gain-instance"]?.zone).toBe("graveyard");
    expect(room.replay()).toEqual(room.state);

    const unsupportedDefinition = { ...definition, providerId: "unsupported-id", oracleText: "Scry 2." };
    const unsupportedState = addCardInstance(base, {
      instance_id: "unsupported-instance", card_id: unsupportedDefinition.providerId, owner_id: "p1", zone: "hand"
    });
    const unsupportedRoom = new GameRoom("room-1", players, unsupportedState, resolveBasicSpellEffect,
      cardId => cardId === unsupportedDefinition.providerId ? unsupportedDefinition : undefined, supportsBasicSpell);
    const rejected = unsupportedRoom.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "cast-unsupported",
      playerId: "p1", expectedRevision: unsupportedRoom.state.revision,
      type: "cast-spell", payload: { instanceId: "unsupported-instance" }
    });
    expect(rejected).toMatchObject({ accepted: false, code: "UNSUPPORTED_SPELL_EFFECT" });
    expect(unsupportedRoom.state.cards["unsupported-instance"]?.zone).toBe("hand");
  });

  it("activates a server-compiled artifact ability, resolves it through the typed handler, and replays", () => {
    const definition: CardDefinition = {
      provider: "scryfall", providerId: "life-artifact", oracleId: "life-artifact-oracle",
      name: "Life Engine", layout: "normal", manaCost: "{2}", manaValue: 2,
      typeLine: "Artifact", oracleText: "{1}, {T}: You gain 1 life.",
      colors: [], colorIdentity: [], legalities: { commander: "legal" }, faces: [],
      raw: {
        id: "life-artifact", oracle_id: "life-artifact-oracle", name: "Life Engine",
        layout: "normal", mana_cost: "{2}", cmc: 2, type_line: "Artifact",
        oracle_text: "{1}, {T}: You gain 1 life.", colors: [], color_identity: [],
        legalities: { commander: "legal" }, set: "tst", collector_number: "81"
      }
    };
    const base = advanceAutomaticStep(createGame("room-1", players));
    const funded: GameState = {
      ...base, deckSetupComplete: true,
      players: base.players.map(player => player.id === "p1"
        ? { ...player, manaPool: { C: 1, W: 1 } }
        : player)
    };
    const initial = addCardInstance(funded, {
      instance_id: "life-engine", card_id: definition.providerId, owner_id: "p1", zone: "battlefield"
    });
    const room = new GameRoom("room-1", players, initial, undefined,
      cardId => cardId === definition.providerId ? definition : undefined);
    const activated = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "activate-life-engine",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "activate-ability", payload: { instanceId: "life-engine", abilityIndex: 0, effect: "client-cannot-override" }
    });
    expect(activated).toMatchObject({ accepted: true, outcome: "ability-activated" });
    expect(room.state.cards["life-engine"]?.is_tapped).toBe(true);
    expect(room.state.players[0]?.manaPool).toEqual({ C: 0, W: 1 });
    expect(room.state.stack[0]).toMatchObject({
      kind: "activated-ability", source_instance_id: "life-engine",
      payload: { effect: "activated-gain-life", amount: 1 }
    });
    let result;
    for (const playerId of ["p1", "p2", "p3", "p4"]) {
      result = room.apply(command(playerId, room.state.revision, "ability-pass-" + playerId));
    }
    expect(result).toMatchObject({ accepted: true, outcome: "stack-resolved" });
    expect(room.state.players[0]?.life).toBe(41);
    expect(room.state.cards["life-engine"]?.zone).toBe("battlefield");
    expect(room.state.stack).toHaveLength(0);
    expect(room.replay()).toEqual(room.state);
  });

  it("rejects unsupported, mistargeted-by-index, and creature tap abilities without paying costs", () => {
    const artifact: CardDefinition = {
      provider: "scryfall", providerId: "unsupported-artifact", oracleId: null,
      name: "Unknown Engine", layout: "normal", manaCost: "{2}", manaValue: 2,
      typeLine: "Artifact", oracleText: "{T}: Scry 1.",
      colors: [], colorIdentity: [], legalities: {}, faces: [],
      raw: {
        id: "unsupported-artifact", name: "Unknown Engine", layout: "normal", cmc: 2,
        type_line: "Artifact", colors: [], color_identity: [], legalities: {},
        set: "tst", collector_number: "82"
      }
    };
    const creature: CardDefinition = {
      ...artifact, providerId: "creature-engine", name: "Creature Engine",
      typeLine: "Creature — Human", oracleText: "{T}: You gain 1 life.",
      raw: { ...artifact.raw, id: "creature-engine", name: "Creature Engine", type_line: "Creature — Human", oracle_text: "{T}: You gain 1 life." }
    };
    const base = advanceAutomaticStep(createGame("room-1", players));
    const funded: GameState = {
      ...base, deckSetupComplete: true,
      players: base.players.map(player => player.id === "p1"
        ? { ...player, manaPool: { C: 1 } }
        : player)
    };
    let state = addCardInstance(funded, {
      instance_id: "unknown", card_id: artifact.providerId, owner_id: "p1", zone: "battlefield"
    });
    state = addCardInstance(state, {
      instance_id: "creature", card_id: creature.providerId, owner_id: "p1", zone: "battlefield"
    });
    const room = new GameRoom("room-1", players, state, () => state,
      cardId => cardId === artifact.providerId ? artifact : cardId === creature.providerId ? creature : undefined);
    const unknown = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "unknown-ability",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "activate-ability", payload: { instanceId: "unknown", abilityIndex: 0 }
    });
    expect(unknown).toMatchObject({ accepted: false, code: "UNSUPPORTED_ACTIVATED_ABILITY" });
    const creatureTap = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "creature-tap-ability",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "activate-ability", payload: { instanceId: "creature", abilityIndex: 0 }
    });
    expect(creatureTap).toMatchObject({ accepted: false, code: "CREATURE_TAP_ABILITY_UNSUPPORTED" });
    expect(room.state.players[0]?.manaPool).toEqual({ C: 1 });
    expect(room.state.stack).toHaveLength(0);
    expect(room.state.cards.creature?.is_tapped).toBe(false);
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

  it("restores a room checkpoint by replaying its versioned command journal", () => {
    const room = new GameRoom("room-1", players);
    const firstCommand = command("p1", room.state.revision, "persisted-1");
    const first = room.apply(firstCommand);
    const second = room.apply(command("p2", room.state.revision, "persisted-2"));
    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);

    const checkpoint = room.checkpoint;
    const restored = GameRoom.restore(checkpoint);
    expect(restored.state).toEqual(room.state);
    expect(restored.eventLog).toEqual(room.eventLog);

    // The replayed command cache survives restoration, so a network retry is idempotent.
    expect(restored.apply(firstCommand)).toEqual(first);
    expect(restored.eventLog).toHaveLength(2);
  });

  it("migrates a persisted room snapshot created before land-play counters existed", () => {
    const room = new GameRoom("room-1", players);
    room.apply(command("p1", room.state.revision, "legacy-room-event"));
    const checkpoint = room.checkpoint;
    const legacySnapshot = {
      ...checkpoint.snapshot,
      players: checkpoint.snapshot.players.map(player => {
        const legacyPlayer = { ...player } as Record<string, unknown>;
        delete legacyPlayer.landsPlayedThisTurn;
        return legacyPlayer;
      })
    };
    const legacyCheckpoint = { ...checkpoint, snapshot: legacySnapshot } as unknown as typeof checkpoint;
    const restored = GameRoom.restore(legacyCheckpoint);
    expect(restored.state.players.every(player => player.landsPlayedThisTurn === 0)).toBe(true);
    expect(restored.state).toEqual(room.state);
  });

  it("rejects a checkpoint whose accepted command result was altered", () => {
    const room = new GameRoom("room-1", players);
    room.apply(command("p1", room.state.revision, "tamper-check"));
    const checkpoint = room.checkpoint;
    const altered = {
      ...checkpoint,
      events: checkpoint.events.map((event, index) => index === 0
        ? { ...event, payload: { ...event.payload, result: { ...event.payload.result, revision: 999 } } }
        : event)
    };
    expect(() => GameRoom.restore(altered)).toThrow("EVENT_REPLAY_MISMATCH");
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


describe("GameRoom ETB trigger-order decisions", () => {
  const triggerItem = (id: string, controllerId: string) => ({
    id, controller_id: controllerId, source_instance_id: "source-" + id,
    kind: "triggered-ability" as const, payload: { effect: "fixture" }
  });

  it("authenticates APNAP choices, projects them privately, and replays the pending batch", () => {
    let state = advanceAutomaticStep(createGame("room-1", players));
    const batch = createPendingTriggerBatch(state, "etb-batch-1", [
      triggerItem("p1-a", "p1"), triggerItem("p1-b", "p1"),
      triggerItem("p2-only", "p2"),
      triggerItem("p3-a", "p3"), triggerItem("p3-b", "p3")
    ]);
    expect(batch).not.toBeNull();
    state = { ...state, pendingTriggerBatch: batch };
    const room = new GameRoom("room-1", players, state);

    expect(toPlayerView(room.state, "p1").pendingTriggerOrder).toEqual({
      id: "etb-batch-1", candidateStackItemIds: ["p1-a", "p1-b"]
    });
    expect(toPlayerView(room.state, "p2").pendingTriggerOrder).toBeNull();
    expect(toPlayerView(room.state, "p2").pendingTriggerOrderCount).toBe(2);

    const wrongSeat = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "p3-too-early",
      playerId: "p3", expectedRevision: room.state.revision,
      type: "order-etb-triggers", payload: { pendingId: "etb-batch-1", orderedStackItemIds: ["p3-a", "p3-b"] }
    });
    expect(wrongSeat).toMatchObject({ accepted: false, code: "NOT_NEXT_TRIGGER_ORDER_CONTROLLER" });

    const p1Order = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "p1-order",
      playerId: "p1", expectedRevision: room.state.revision,
      type: "order-etb-triggers", payload: { pendingId: "etb-batch-1", orderedStackItemIds: ["p1-b", "p1-a"] }
    });
    expect(p1Order).toMatchObject({ accepted: true, outcome: "trigger-order-recorded" });
    expect(toPlayerView(room.state, "p1").pendingTriggerOrder).toBeNull();
    expect(toPlayerView(room.state, "p3").pendingTriggerOrder).toEqual({
      id: "etb-batch-1", candidateStackItemIds: ["p3-a", "p3-b"]
    });

    const p3Order = room.apply({
      protocolVersion: 1, gameId: "room-1", commandId: "p3-order",
      playerId: "p3", expectedRevision: room.state.revision,
      type: "order-etb-triggers", payload: { pendingId: "etb-batch-1", orderedStackItemIds: ["p3-a", "p3-b"] }
    });
    expect(p3Order).toMatchObject({ accepted: true, outcome: "trigger-order-recorded" });
    expect(room.state.pendingTriggerBatch?.groups.map(group => group.orderedStackItemIds)).toEqual([
      ["p1-b", "p1-a"], ["p2-only"], ["p3-a", "p3-b"]
    ]);
    expect(toPlayerView(room.state, "p1").pendingTriggerOrderCount).toBe(0);
    expect(room.replay()).toEqual(room.state);
    expect(GameRoom.restore(room.checkpoint).state).toEqual(room.state);
  });

  it("rejects malformed, stale, foreign and non-permutation decisions", () => {
    let state = advanceAutomaticStep(createGame("room-1", players));
    state = { ...state, pendingTriggerBatch: createPendingTriggerBatch(state, "etb-batch-2", [
      triggerItem("p1-a", "p1"), triggerItem("p1-b", "p1")
    ]) };
    const room = new GameRoom("room-1", players, state);
    const base = {
      protocolVersion: 1 as const, gameId: "room-1", playerId: "p1",
      expectedRevision: room.state.revision, type: "order-etb-triggers"
    };
    expect(room.apply({
      ...base, commandId: "bad-id", payload: { pendingId: "wrong", orderedStackItemIds: ["p1-a", "p1-b"] }
    })).toMatchObject({ accepted: false, code: "INVALID_TRIGGER_ORDER" });
    expect(room.apply({
      ...base, commandId: "bad-permutation", payload: { pendingId: "etb-batch-2", orderedStackItemIds: ["p1-a", "p1-a"] }
    })).toMatchObject({ accepted: false, code: "INVALID_TRIGGER_ORDER" });
    expect(room.apply({
      ...base, commandId: "foreign", payload: { pendingId: "etb-batch-2", orderedStackItemIds: ["p1-a", "p3-a"] }
    })).toMatchObject({ accepted: false, code: "INVALID_TRIGGER_ORDER" });
    expect(room.apply({
      ...base, commandId: "valid", payload: { pendingId: "etb-batch-2", orderedStackItemIds: ["p1-a", "p1-b"] }
    })).toMatchObject({ accepted: true });
    expect(room.apply({
      ...base, commandId: "stale-after-valid", payload: { pendingId: "etb-batch-2", orderedStackItemIds: ["p1-a", "p1-b"] }
    })).toMatchObject({ accepted: false, code: "STALE_REVISION" });
  });
});
