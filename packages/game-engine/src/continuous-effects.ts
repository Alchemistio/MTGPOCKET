import type { InstanceId, PlayerId } from "./model.js";
import type { EnteringPermanentCharacteristicsContext, PermanentCharacteristics } from "./entering-characteristics.js";
import { applyContinuousEffectsInDependencyOrder } from "./dependency-order.js";

export interface TypeChangingEffectSelector {
  readonly controllerId?: PlayerId;
  readonly cardTypesAny?: readonly string[];
  readonly supertypesAny?: readonly string[];
  readonly subtypesAny?: readonly string[];
}
export type TypeChangingOperation =
  | { readonly kind: "add"; readonly supertypes?: readonly string[]; readonly cardTypes?: readonly string[]; readonly subtypes?: readonly string[] }
  | { readonly kind: "remove"; readonly supertypes?: readonly string[]; readonly cardTypes?: readonly string[]; readonly subtypes?: readonly string[] };

/** A compiled layer-4 effect. CDA status is supplied by the rules compiler. */
export interface Layer4TypeChangingEffect {
  readonly id: string;
  readonly layer: 4;
  readonly sourceInstanceId: InstanceId;
  readonly timestamp: number;
  readonly characteristicDefiningAbility?: boolean;
  readonly selector: TypeChangingEffectSelector;
  readonly operation: TypeChangingOperation;
}
export interface Layer4EvaluationResult {
  readonly layer: 4;
  readonly instanceId: InstanceId;
  readonly characteristics: PermanentCharacteristics;
  readonly appliedEffectIds: readonly string[];
  readonly dependencyLoopEffectIds: readonly string[];
}

/**
 * Applies structured type-changing effects to the proposed entrant.
 * Selector and operation semantics are sufficiently explicit here to evaluate the
 * CR 613.8a dependency test for this narrow effect family.
 */
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

  const dependencyEffects = effects.map(effect => ({
    ...effect,
    layerKey: "layer-4",
    characteristicDefiningAbility: effect.characteristicDefiningAbility ?? false
  }));
  const appliedEffectIds: string[] = [];
  const ordered = applyContinuousEffectsInDependencyOrder(
    cloneCharacteristics(context.entrant.characteristics),
    dependencyEffects,
    {
      dependsOn: (candidate, other, current) =>
        layer4TypeChangingEffectDependsOn(candidate, other, context.entrant.controllerId, current),
      apply: (effect, current) => {
        if (!matchesSelector(effect.selector, context.entrant.controllerId, current)) return current;
        appliedEffectIds.push(effect.id);
        return applyOperation(current, effect.operation);
      }
    }
  );
  return {
    layer: 4,
    instanceId: context.entrant.instanceId,
    characteristics: ordered.state,
    appliedEffectIds,
    dependencyLoopEffectIds: ordered.dependencyLoopEffectIds
  };
}

function layer4TypeChangingEffectDependsOn(
  candidate: Layer4TypeChangingEffect,
  other: Layer4TypeChangingEffect,
  controllerId: PlayerId,
  current: PermanentCharacteristics
): boolean {
  const candidateAppliesBefore = matchesSelector(candidate.selector, controllerId, current);
  const afterOther = matchesSelector(other.selector, controllerId, current)
    ? applyOperation(current, other.operation)
    : current;
  const candidateAppliesAfter = matchesSelector(candidate.selector, controllerId, afterOther);
  if (candidateAppliesBefore !== candidateAppliesAfter) return true;
  if (!candidateAppliesBefore) return false;

  // If the other effect changes the set of characteristics this operation would
  // actually add/remove, it changes what this effect does to the entrant.
  return !sameOperationDelta(
    operationDelta(current, candidate.operation),
    operationDelta(afterOther, candidate.operation)
  );
}

function operationDelta(
  current: PermanentCharacteristics,
  operation: TypeChangingOperation
): { supertypes: string[]; cardTypes: string[]; subtypes: string[] } {
  const changed = (values: readonly string[], requested: readonly string[] | undefined): string[] =>
    (requested ?? []).filter(value => operation.kind === "add" ? !values.includes(value) : values.includes(value));
  return {
    supertypes: changed(current.supertypes, operation.supertypes),
    cardTypes: changed(current.cardTypes, operation.cardTypes),
    subtypes: changed(current.subtypes, operation.subtypes)
  };
}
function sameOperationDelta(
  left: ReturnType<typeof operationDelta>,
  right: ReturnType<typeof operationDelta>
): boolean {
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every(value => b.includes(value));
  return same(left.supertypes, right.supertypes) &&
    same(left.cardTypes, right.cardTypes) &&
    same(left.subtypes, right.subtypes);
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
