import type { InstanceId, PlayerId } from "./model.js";
import type { EnteringPermanentCharacteristicsContext, PermanentCharacteristics } from "./entering-characteristics.js";

export interface TypeChangingEffectSelector {
  readonly controllerId?: PlayerId;
  readonly cardTypesAny?: readonly string[];
  readonly supertypesAny?: readonly string[];
  readonly subtypesAny?: readonly string[];
}
export type TypeChangingOperation =
  | { readonly kind: "add"; readonly supertypes?: readonly string[]; readonly cardTypes?: readonly string[]; readonly subtypes?: readonly string[] }
  | { readonly kind: "remove"; readonly supertypes?: readonly string[]; readonly cardTypes?: readonly string[]; readonly subtypes?: readonly string[] };

/** A compiled layer-4 effect. Dependencies must be resolved by the caller first. */
export interface Layer4TypeChangingEffect {
  readonly id: string;
  readonly layer: 4;
  readonly sourceInstanceId: InstanceId;
  readonly timestamp: number;
  readonly selector: TypeChangingEffectSelector;
  readonly operation: TypeChangingOperation;
}
export interface Layer4EvaluationResult {
  readonly layer: 4;
  readonly instanceId: InstanceId;
  readonly characteristics: PermanentCharacteristics;
  readonly appliedEffectIds: readonly string[];
}

/** Applies supplied type-changing effects to the proposed entrant in timestamp order. */
export function evaluateEnteringPermanentLayer4(
  context: EnteringPermanentCharacteristicsContext,
  effects: readonly Layer4TypeChangingEffect[]
): Layer4EvaluationResult {
  const validSources = new Set<InstanceId>([
    context.entrant.instanceId,
    ...context.existingBattlefield.map(permanent => permanent.instanceId)
  ]);
  const ids = effects.map(effect => effect.id);
  if (ids.some(id => id.trim().length === 0) || new Set(ids).size !== ids.length) {
    throw new Error("INVALID_OR_DUPLICATE_LAYER4_EFFECT_ID");
  }
  for (const effect of effects) {
    if (effect.layer !== 4) throw new Error("INVALID_CONTINUOUS_EFFECT_LAYER");
    if (!Number.isSafeInteger(effect.timestamp) || effect.timestamp < 0) {
      throw new Error("INVALID_LAYER4_EFFECT_TIMESTAMP");
    }
    if (!validSources.has(effect.sourceInstanceId)) throw new Error("UNKNOWN_LAYER4_EFFECT_SOURCE");
    validateOperation(effect.operation);
    validateSelector(effect.selector);
  }
  // Array#sort is stable: equal timestamps retain the caller's pre-resolved order.
  const ordered = [...effects].sort((a, b) => a.timestamp - b.timestamp);
  let characteristics = cloneCharacteristics(context.entrant.characteristics);
  const appliedEffectIds: string[] = [];
  for (const effect of ordered) {
    if (!matchesSelector(effect.selector, context.entrant.controllerId, characteristics)) continue;
    characteristics = applyOperation(characteristics, effect.operation);
    appliedEffectIds.push(effect.id);
  }
  return { layer: 4, instanceId: context.entrant.instanceId, characteristics, appliedEffectIds };
}

function validateSelector(selector: TypeChangingEffectSelector): void {
  for (const values of [selector.cardTypesAny, selector.supertypesAny, selector.subtypesAny]) {
    if (values && (values.length === 0 || values.some(value => value.trim().length === 0))) throw new Error("INVALID_LAYER4_EFFECT_SELECTOR");
  }
}
function validateOperation(operation: TypeChangingOperation): void {
  const values = [...(operation.supertypes ?? []), ...(operation.cardTypes ?? []), ...(operation.subtypes ?? [])];
  if (values.length === 0 || values.some(value => value.trim().length === 0)) {
    throw new Error("INVALID_LAYER4_TYPE_OPERATION");
  }
}
function matchesSelector(
  selector: TypeChangingEffectSelector, controllerId: PlayerId, characteristics: PermanentCharacteristics
): boolean {
  if (selector.controllerId !== undefined && selector.controllerId !== controllerId) return false;
  if (selector.cardTypesAny && !selector.cardTypesAny.some(value => characteristics.cardTypes.includes(value))) return false;
  if (selector.supertypesAny && !selector.supertypesAny.some(value => characteristics.supertypes.includes(value))) return false;
  if (selector.subtypesAny && !selector.subtypesAny.some(value => characteristics.subtypes.includes(value))) return false;
  return true;
}
function applyOperation(
  current: PermanentCharacteristics, operation: TypeChangingOperation
): PermanentCharacteristics {
  const transform = <T extends string>(values: readonly T[], changes: readonly T[] | undefined): readonly T[] => {
    if (!changes) return [...values];
    if (operation.kind === "add") {
      const next = [...values];
      for (const value of changes) if (!next.includes(value)) next.push(value);
      return next;
    }
    return values.filter(value => !changes.includes(value));
  };
  return {
    ...current,
    supertypes: transform(current.supertypes, operation.supertypes),
    cardTypes: transform(current.cardTypes, operation.cardTypes),
    subtypes: transform(current.subtypes, operation.subtypes)
  };
}
function cloneCharacteristics(value: PermanentCharacteristics): PermanentCharacteristics {
  return {
    ...value, supertypes: [...value.supertypes], cardTypes: [...value.cardTypes],
    subtypes: [...value.subtypes], colors: [...value.colors], colorIdentity: [...value.colorIdentity]
  };
}
