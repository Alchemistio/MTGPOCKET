import { describe, expect, it } from "vitest";
import {
  addCardInstance, createEnteringPermanentCharacteristicsContext, createGame,
  createZoneChangeReplacementSession, evaluateEnteringPermanentLayer4,
  type Layer4TypeChangingEffect, type PermanentCharacteristics
} from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];
const bear: PermanentCharacteristics = {
  name: "Example Bear", faceIndex: null, supertypes: [], cardTypes: ["Creature"],
  subtypes: ["Bear"], colors: ["G"], colorIdentity: ["G"], manaCost: "{1}{G}",
  manaValue: 2, power: "2", toughness: "2", loyalty: null, defense: null, oracleText: ""
};
function makeContext() {
  let state = createGame("layer4", players);
  state = addCardInstance(state, { instance_id: "entrant", card_id: "entrant-card", owner_id: "p1", zone: "hand" });
  state = addCardInstance(state, { instance_id: "source", card_id: "source-card", owner_id: "p2", zone: "battlefield" });
  return createEnteringPermanentCharacteristicsContext(
    state, createZoneChangeReplacementSession(state, "entrant", "battlefield"), bear,
    [{ instanceId: "source", characteristics: bear }]
  );
}
function effect(
  id: string, timestamp: number, operation: Layer4TypeChangingEffect["operation"],
  selector: Layer4TypeChangingEffect["selector"] = {}, sourceInstanceId = "source"
): Layer4TypeChangingEffect {
  return { id, layer: 4, sourceInstanceId, timestamp, selector, operation };
}

describe("entering permanent layer-4 type changes", () => {
  it("applies timestamp order and rechecks selectors against updated characteristics", () => {
    const result = evaluateEnteringPermanentLayer4(makeContext(), [
      effect("remove-creature", 20, { kind: "remove", cardTypes: ["Creature"] }, { subtypesAny: ["Bear"] }),
      effect("add-artifact", 10, { kind: "add", cardTypes: ["Artifact"] }, { cardTypesAny: ["Creature"] }),
      effect("remove-bear", 30, { kind: "remove", subtypes: ["Bear"] }, { cardTypesAny: ["Artifact"] })
    ]);
    expect(result.characteristics.cardTypes).toEqual(["Artifact"]);
    expect(result.characteristics.subtypes).toEqual([]);
    expect(result.appliedEffectIds).toEqual(["add-artifact", "remove-creature", "remove-bear"]);
  });
  it("does not mutate context or existing battlefield characteristics", () => {
    const input = makeContext();
    const result = evaluateEnteringPermanentLayer4(input, [effect("legendary", 1, { kind: "add", supertypes: ["Legendary"] })]);
    expect(result.characteristics.supertypes).toEqual(["Legendary"]);
    expect(input.entrant.characteristics.supertypes).toEqual([]);
    expect(input.existingBattlefield[0]?.characteristics.supertypes).toEqual([]);
  });
  it("supports effects sourced by the entrant itself", () => {
    const result = evaluateEnteringPermanentLayer4(makeContext(), [
      effect("self-zombie", 1, { kind: "add", subtypes: ["Zombie"] }, {}, "entrant")
    ]);
    expect(result.characteristics.subtypes).toEqual(["Bear", "Zombie"]);
  });
  it("filters by destination controller", () => {
    const input = makeContext();
    const redirected = { ...input, entrant: { ...input.entrant, controllerId: "p2" } };
    const result = evaluateEnteringPermanentLayer4(redirected, [
      effect("only-p1", 1, { kind: "add", cardTypes: ["Artifact"] }, { controllerId: "p1" }),
      effect("only-p2", 2, { kind: "add", cardTypes: ["Enchantment"] }, { controllerId: "p2" })
    ]);
    expect(result.characteristics.cardTypes).toEqual(["Creature", "Enchantment"]);
    expect(result.appliedEffectIds).toEqual(["only-p2"]);
  });

  it("preserves caller order for equal timestamps and deduplicates added types", () => {
    const result = evaluateEnteringPermanentLayer4(makeContext(), [
      effect("first", 10, { kind: "add", cardTypes: ["Artifact", "Artifact"] }),
      effect("second", 10, { kind: "remove", cardTypes: ["Creature"] })
    ]);
    expect(result.characteristics.cardTypes).toEqual(["Artifact"]);
    expect(result.appliedEffectIds).toEqual(["first", "second"]);
  });
  it("rejects an explicitly empty selector list", () => {
    expect(() => evaluateEnteringPermanentLayer4(makeContext(), [
      effect("empty-selector", 1, { kind: "add", cardTypes: ["Artifact"] }, { cardTypesAny: [] })
    ])).toThrow("INVALID_LAYER4_EFFECT_SELECTOR");
  });

  it("rejects duplicate ids, invalid timestamps, unknown sources and empty operations", () => {
    const input = makeContext();
    const valid = effect("same", 1, { kind: "add", cardTypes: ["Artifact"] });
    expect(() => evaluateEnteringPermanentLayer4(input, [valid, valid])).toThrow("INVALID_OR_DUPLICATE_LAYER4_EFFECT_ID");
    expect(() => evaluateEnteringPermanentLayer4(input, [effect("bad-time", -1, { kind: "add", cardTypes: ["Artifact"] })]))
      .toThrow("INVALID_LAYER4_EFFECT_TIMESTAMP");
    expect(() => evaluateEnteringPermanentLayer4(input, [
      effect("bad-source", 1, { kind: "add", cardTypes: ["Artifact"] }, {}, "missing")
    ])).toThrow("UNKNOWN_LAYER4_EFFECT_SOURCE");
    expect(() => evaluateEnteringPermanentLayer4(input, [effect("empty", 1, { kind: "add" })]))
      .toThrow("INVALID_LAYER4_TYPE_OPERATION");
  });
});
