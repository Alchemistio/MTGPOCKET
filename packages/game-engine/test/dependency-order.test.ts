import { describe, expect, it } from "vitest";
import { applyContinuousEffectsInDependencyOrder, type DependencyOrderedEffect } from "../src/dependency-order.js";

interface Effect extends DependencyOrderedEffect { readonly label: string }
const effect = (id: string, timestamp: number, extra: Partial<Effect> = {}): Effect => ({
  id, layerKey: "layer-4", timestamp, characteristicDefiningAbility: false, label: id, ...extra
});

describe("continuous effect dependency ordering (CR 613.8)", () => {
  it("applies a dependency before its dependent even when its timestamp is later", () => {
    const result = applyContinuousEffectsInDependencyOrder([], [
      effect("dependent", 1), effect("dependency", 20)
    ], {
      dependsOn: (candidate, other) => candidate.id === "dependent" && other.id === "dependency",
      apply: (current, next) => [...current, next.id]
    });
    expect(result.appliedEffectIds).toEqual(["dependency", "dependent"]);
    expect(result.state).toEqual(["dependency", "dependent"]);
  });

  it("uses timestamp order for independent effects and reevaluates after each application", () => {
    const result = applyContinuousEffectsInDependencyOrder({ enabled: false, order: [] as string[] }, [
      effect("early", 1), effect("becomes-dependent", 2), effect("later", 3)
    ], {
      dependsOn: (candidate, other, state) =>
        state.enabled && candidate.id === "becomes-dependent" && other.id === "later",
      apply: (state, next) => ({
        enabled: state.enabled || next.id === "early",
        order: [...state.order, next.id]
      })
    });
    expect(result.appliedEffectIds).toEqual(["early", "later", "becomes-dependent"]);
  });

  it("uses timestamp order inside a dependency loop, but does not pull downstream effects into it", () => {
    const result = applyContinuousEffectsInDependencyOrder([] as string[], [
      effect("loop-late", 20), effect("loop-early", 10), effect("waits-for-loop", 1)
    ], {
      dependsOn: (candidate, other) =>
        (candidate.id === "loop-late" && other.id === "loop-early") ||
        (candidate.id === "loop-early" && other.id === "loop-late") ||
        (candidate.id === "waits-for-loop" && other.id === "loop-late"),
      apply: (next, state) => [...state, next.id]
    });
    expect(result.appliedEffectIds).toEqual(["loop-early", "loop-late", "waits-for-loop"]);
    expect(result.dependencyLoopEffectIds).toEqual(["loop-early", "loop-late"]);
  });

  it("does not consider a CDA effect dependent on a non-CDA effect", () => {
    const result = applyContinuousEffectsInDependencyOrder([] as string[], [
      effect("non-cda", 1), effect("cda", 2, { characteristicDefiningAbility: true })
    ], {
      dependsOn: () => true,
      apply: (state, next) => [...state, next.id]
    });
    expect(result.appliedEffectIds).toEqual(["non-cda", "cda"]);
  });

  it("rejects mixed layers, duplicate ids and invalid timestamps", () => {
    expect(() => applyContinuousEffectsInDependencyOrder([], [
      effect("a", 1), effect("b", 2, { layerKey: "layer-5" })
    ], { dependsOn: () => false, apply: (state, next) => [...state, next.id] })).toThrow("MIXED_LAYER_OR_SUBLAYER_DEPENDENCY_GROUP");
    expect(() => applyContinuousEffectsInDependencyOrder([], [
      effect("a", 1), effect("a", 2)
    ], { dependsOn: () => false, apply: (state, next) => [...state, next.id] })).toThrow("INVALID_OR_DUPLICATE_CONTINUOUS_EFFECT_ID");
    expect(() => applyContinuousEffectsInDependencyOrder([], [
      effect("a", -1)
    ], { dependsOn: () => false, apply: (state, next) => [...state, next.id] })).toThrow("INVALID_CONTINUOUS_EFFECT_TIMESTAMP");
  });

  it("does not mutate the original input state when handlers are immutable", () => {
    const initial = { applied: [] as string[] };
    const result = applyContinuousEffectsInDependencyOrder(initial, [effect("a", 1)], {
      dependsOn: () => false,
      apply: (state, next) => ({ applied: [...state.applied, next.id] })
    });
    expect(initial.applied).toEqual([]);
    expect(result.state.applied).toEqual(["a"]);
  });
});
