import { describe, expect, it } from "vitest";
import { evaluateContinuousLayers, type LayerEvaluationPlugin } from "../src/layer-engine.js";

type Characteristics = { readonly types: readonly string[] };
type Payload = { readonly add: string };
const plugin: LayerEvaluationPlugin<Characteristics, { readonly marker: string }, Payload> = {
  layer: 4,
  evaluate(_input, current, effects) {
    const types = [...current.types];
    for (const effect of effects) if (!types.includes(effect.payload.add)) types.push(effect.payload.add);
    return { characteristics: { types }, appliedEffectIds: effects.map(effect => effect.id) };
  }
};
const input = {
  instanceId: "entrant",
  initial: { types: ["Creature"] },
  context: { marker: "entry" },
  validSourceInstanceIds: ["entrant", "source"]
};

describe("generic continuous layer engine", () => {
  it("runs registered layers in CR layer order and reports unsupported effects explicitly", () => {
    const result = evaluateContinuousLayers(input, [
      { id: "layer-6", layer: 6, sourceInstanceId: "source", timestamp: 1, payload: { add: "Flying" } },
      { id: "layer-4", layer: 4, sourceInstanceId: "source", timestamp: 2, payload: { add: "Artifact" } }
    ], [plugin]);
    expect(result.characteristics.types).toEqual(["Creature", "Artifact"]);
    expect(result.appliedEffectIds).toEqual(["layer-4"]);
    expect(result.unsupportedEffectIds).toEqual(["layer-6"]);
  });
  it("rejects duplicate ids, unknown sources, invalid timestamps and duplicate plugins", () => {
    const valid = { id: "x", layer: 4 as const, sourceInstanceId: "source", timestamp: 0, payload: { add: "Artifact" } };
    expect(() => evaluateContinuousLayers(input, [valid, valid], [plugin])).toThrow("INVALID_OR_DUPLICATE_CONTINUOUS_EFFECT_ID");
    expect(() => evaluateContinuousLayers(input, [{ ...valid, sourceInstanceId: "missing" }], [plugin])).toThrow("UNKNOWN_CONTINUOUS_EFFECT_SOURCE");
    expect(() => evaluateContinuousLayers(input, [{ ...valid, timestamp: -1 }], [plugin])).toThrow("INVALID_CONTINUOUS_EFFECT_TIMESTAMP");
    expect(() => evaluateContinuousLayers(input, [], [plugin, plugin])).toThrow("DUPLICATE_LAYER_EVALUATOR");
  });
  it("preserves caller-resolved dependency order even when timestamps disagree", () => {
    const result = evaluateContinuousLayers(input, [
      { id: "dependency-first", layer: 4, sourceInstanceId: "source", timestamp: 20, payload: { add: "Artifact" } },
      { id: "timestamp-first", layer: 4, sourceInstanceId: "source", timestamp: 10, payload: { add: "Enchantment" } }
    ], [{
      layer: 4,
      evaluate(_input, current, effects) {
        return { characteristics: { types: [...current.types, ...effects.map(effect => effect.payload.add)] }, appliedEffectIds: effects.map(effect => effect.id) };
      }
    }]);
    expect(result.characteristics.types).toEqual(["Creature", "Artifact", "Enchantment"]);
    expect(result.appliedEffectIds).toEqual(["dependency-first", "timestamp-first"]);
  });
  it("does not mutate the input characteristics", () => {
    const result = evaluateContinuousLayers(input, [
      { id: "x", layer: 4, sourceInstanceId: "source", timestamp: 0, payload: { add: "Artifact" } }
    ], [plugin]);
    expect(result.characteristics.types).toEqual(["Creature", "Artifact"]);
    expect(input.initial.types).toEqual(["Creature"]);
  });
});
