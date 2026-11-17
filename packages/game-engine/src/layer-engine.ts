import type { InstanceId } from "./model.js";

/** Comprehensive Rules continuous-effect layer number (613.1). */
export type ContinuousEffectLayer = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ContinuousEffectEnvelope<Payload = unknown> {
  readonly id: string;
  readonly layer: ContinuousEffectLayer;
  readonly sourceInstanceId: InstanceId;
  readonly timestamp: number;
  readonly payload: Payload;
}

export interface LayerEvaluationInput<Characteristics, Context> {
  readonly instanceId: InstanceId;
  readonly initial: Characteristics;
  readonly context: Context;
  readonly validSourceInstanceIds: readonly InstanceId[];
}

export interface LayerEvaluationPlugin<Characteristics, Context, Payload = unknown> {
  readonly layer: ContinuousEffectLayer;
  evaluate(
    input: LayerEvaluationInput<Characteristics, Context>,
    current: Characteristics,
    effects: readonly ContinuousEffectEnvelope<Payload>[]
  ): { readonly characteristics: Characteristics; readonly appliedEffectIds: readonly string[] };
}

export interface LayerEvaluationResult<Characteristics> {
  readonly instanceId: InstanceId;
  readonly characteristics: Characteristics;
  readonly appliedEffectIds: readonly string[];
  /** Effects deliberately not evaluated because their layer has no registered implementation. */
  readonly unsupportedEffectIds: readonly string[];
}

/**
 * Generic layer orchestrator. It does not infer CR 613.7 dependencies:
 * callers must supply effects in a dependency-resolved order within each layer.
 * Stable timestamp order is the fallback only where no explicit dependency order exists.
 */
export function evaluateContinuousLayers<Characteristics, Context, Payload = unknown>(
  input: LayerEvaluationInput<Characteristics, Context>,
  effects: readonly ContinuousEffectEnvelope<Payload>[],
  plugins: readonly LayerEvaluationPlugin<Characteristics, Context, Payload>[]
): LayerEvaluationResult<Characteristics> {
  const ids = effects.map(effect => effect.id);
  if (ids.some(id => !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error("INVALID_OR_DUPLICATE_CONTINUOUS_EFFECT_ID");
  }
  const sources = new Set(input.validSourceInstanceIds);
  for (const effect of effects) {
    if (!sources.has(effect.sourceInstanceId)) throw new Error("UNKNOWN_CONTINUOUS_EFFECT_SOURCE");
    if (!Number.isSafeInteger(effect.timestamp) || effect.timestamp < 0) {
      throw new Error("INVALID_CONTINUOUS_EFFECT_TIMESTAMP");
    }
  }
  const pluginByLayer = new Map<ContinuousEffectLayer, LayerEvaluationPlugin<Characteristics, Context, Payload>>();
  for (const plugin of plugins) {
    if (pluginByLayer.has(plugin.layer)) throw new Error("DUPLICATE_LAYER_EVALUATOR");
    pluginByLayer.set(plugin.layer, plugin);
  }

  let characteristics = input.initial;
  const appliedEffectIds: string[] = [];
  const unsupportedEffectIds: string[] = [];
  const layers: ContinuousEffectLayer[] = [1, 2, 3, 4, 5, 6, 7];
  for (const layer of layers) {
    const layerEffects = effects.filter(effect => effect.layer === layer);
    if (layerEffects.length === 0) continue;
    const plugin = pluginByLayer.get(layer);
    if (!plugin) {
      unsupportedEffectIds.push(...layerEffects.map(effect => effect.id));
      continue;
    }
    // Stable sort: ties retain the caller's already-resolved order.
    const ordered = [...layerEffects].sort((a, b) => a.timestamp - b.timestamp);
    const result = plugin.evaluate(input, characteristics, ordered);
    const allowed = new Set(ordered.map(effect => effect.id));
    const returned = result.appliedEffectIds;
    if (new Set(returned).size !== returned.length || returned.some(id => !allowed.has(id))) {
      throw new Error("INVALID_LAYER_EVALUATOR_RESULT");
    }
    characteristics = result.characteristics;
    appliedEffectIds.push(...returned);
    const returnedSet = new Set(returned);
    unsupportedEffectIds.push(...ordered.filter(effect => !returnedSet.has(effect.id)).map(effect => effect.id));
  }
  return { instanceId: input.instanceId, characteristics, appliedEffectIds, unsupportedEffectIds };
}
