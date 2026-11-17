import { describe, expect, it } from "vitest";
import {
  addCardInstance, createEnteringPermanentCharacteristicsContext, createGame,
  createZoneChangeReplacementSession, type PermanentCharacteristics
} from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];
const creature: PermanentCharacteristics = {
  name: "Example Bear", faceIndex: null, supertypes: [], cardTypes: ["Creature"],
  subtypes: ["Bear"], colors: ["G"], colorIdentity: ["G"], manaCost: "{1}{G}",
  manaValue: 2, power: "2", toughness: "2", loyalty: null, defense: null,
  oracleText: ""
};

function fixture() {
  let state = createGame("entering-characteristics", players);
  state = addCardInstance(state, {
    instance_id: "entrant", card_id: "entrant-card", owner_id: "p1", zone: "hand"
  });
  state = addCardInstance(state, {
    instance_id: "existing", card_id: "existing-card", owner_id: "p2", zone: "battlefield"
  });
  return state;
}

describe("entering permanent characteristics context", () => {
  it("captures the entrant and every current battlefield source with selected entry modifiers", () => {
    const state = fixture();
    const session = {
      ...createZoneChangeReplacementSession(state, "entrant", "battlefield", "p2"),
      proposal: {
        ...createZoneChangeReplacementSession(state, "entrant", "battlefield", "p2").proposal,
        entersTapped: true,
        entersWithP1P1Counters: 2
      }
    };
    const context = createEnteringPermanentCharacteristicsContext(
      state, session, creature, [{ instanceId: "existing", characteristics: creature }]
    );
    expect(context).toMatchObject({
      stateRevision: state.revision,
      entrant: {
        instanceId: "entrant", controllerId: "p2", fromZone: "hand",
        entersTapped: true, entersWithP1P1Counters: 2,
        characteristics: { name: "Example Bear", cardTypes: ["Creature"] }
      },
      existingBattlefield: [{
        instanceId: "existing", controllerId: "p2",
        characteristics: { name: "Example Bear" }
      }]
    });
  });

  it("defensively copies characteristic arrays", () => {
    const state = fixture();
    const session = createZoneChangeReplacementSession(state, "entrant", "battlefield");
    const supplied = { ...creature, cardTypes: ["Creature"] };
    const context = createEnteringPermanentCharacteristicsContext(
      state, session, supplied, [{ instanceId: "existing", characteristics: creature }]
    );
    supplied.cardTypes.push("Artifact");
    expect(context.entrant.characteristics.cardTypes).toEqual(["Creature"]);
  });

  it("rejects missing battlefield characteristics instead of silently omitting a source", () => {
    const state = fixture();
    const session = createZoneChangeReplacementSession(state, "entrant", "battlefield");
    expect(() => createEnteringPermanentCharacteristicsContext(state, session, creature, []))
      .toThrow("INCOMPLETE_BATTLEFIELD_CHARACTERISTICS_INPUT");
  });

  it("rejects duplicate or non-battlefield sources", () => {
    const state = fixture();
    const session = createZoneChangeReplacementSession(state, "entrant", "battlefield");
    expect(() => createEnteringPermanentCharacteristicsContext(state, session, creature, [
      { instanceId: "existing", characteristics: creature },
      { instanceId: "existing", characteristics: creature }
    ])).toThrow("DUPLICATE_BATTLEFIELD_CHARACTERISTICS_INPUT");
    expect(() => createEnteringPermanentCharacteristicsContext(state, session, creature, [
      { instanceId: "entrant", characteristics: creature }
    ])).toThrow("UNKNOWN_BATTLEFIELD_CHARACTERISTICS_SOURCE");
  });

  it("rejects stale sessions and non-battlefield destinations", () => {
    const state = fixture();
    const session = createZoneChangeReplacementSession(state, "entrant", "battlefield");
    const changed = addCardInstance(state, {
      instance_id: "new-card", card_id: "new-card", owner_id: "p3", zone: "hand"
    });
    expect(() => createEnteringPermanentCharacteristicsContext(
      changed, session, creature, [{ instanceId: "existing", characteristics: creature }]
    )).toThrow("STALE_ZONE_CHANGE_REPLACEMENT_SESSION");
    const nonBattlefield = createZoneChangeReplacementSession(state, "entrant", "graveyard");
    expect(() => createEnteringPermanentCharacteristicsContext(
      state, nonBattlefield, creature, [{ instanceId: "existing", characteristics: creature }]
    )).toThrow("ENTERING_CHARACTERISTICS_REQUIRE_BATTLEFIELD_DESTINATION");
  });
});
