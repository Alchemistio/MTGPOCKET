export interface DependencyOrderedEffect {
  readonly id: string;
  /** Identifies one exact layer and sublayer; dependencies never cross this boundary. */
  readonly layerKey: string;
  readonly timestamp: number;
  readonly characteristicDefiningAbility: boolean;
}

export interface DependencyOrderResult<State> {
  readonly state: State;
  readonly appliedEffectIds: readonly string[];
  /** Effects whose dependency loop required the CR 613.8b timestamp fallback. */
  readonly dependencyLoopEffectIds: readonly string[];
}

export interface DependencyOrderOptions<State, Effect extends DependencyOrderedEffect> {
  /** Implements the CR 613.8a test (text/existence, applicability, or what the effect does). */
  readonly dependsOn: (effect: Effect, other: Effect, state: State) => boolean;
  /** Applies exactly one effect and returns the next immutable evaluation state. */
  readonly apply: (effect: Effect, state: State) => State;
}

/**
 * Applies effects in one layer/sublayer using the dynamic dependency system (CR 613.8).
 * The caller supplies the semantic dependency predicate; this engine owns ordering,
 * timestamp fallback, dependency-loop handling, and reevaluation after each application.
 */
export function applyContinuousEffectsInDependencyOrder<
  State,
  Effect extends DependencyOrderedEffect
>(
  initialState: State,
  effects: readonly Effect[],
  options: DependencyOrderOptions<State, Effect>
): DependencyOrderResult<State> {
  if (effects.length === 0) return { state: initialState, appliedEffectIds: [], dependencyLoopEffectIds: [] };
  const ids = effects.map(effect => effect.id);
  if (ids.some(id => !id.trim()) || new Set(ids).size !== ids.length) {
    throw new Error("INVALID_OR_DUPLICATE_CONTINUOUS_EFFECT_ID");
  }
  const layerKey = effects[0].layerKey;
  if (!layerKey.trim() || effects.some(effect => effect.layerKey !== layerKey)) {
    throw new Error("MIXED_LAYER_OR_SUBLAYER_DEPENDENCY_GROUP");
  }
  if (effects.some(effect => !Number.isSafeInteger(effect.timestamp) || effect.timestamp < 0)) {
    throw new Error("INVALID_CONTINUOUS_EFFECT_TIMESTAMP");
  }

  const originalIndex = new Map(effects.map((effect, index) => [effect.id, index]));
  const byTimestamp = (left: Effect, right: Effect): number =>
    left.timestamp - right.timestamp || originalIndex.get(left.id)! - originalIndex.get(right.id)!;
  let remaining = [...effects];
  let state = initialState;
  const appliedEffectIds: string[] = [];
  const dependencyLoopEffectIds: string[] = [];

  while (remaining.length > 0) {
    const dependencies = new Map<string, Set<string>>();
    for (const effect of remaining) {
      const effectDependencies = new Set<string>();
      for (const other of remaining) {
        if (effect.id === other.id) continue;
        // CR 613.8a: CDA effects depend only on other CDA effects, and non-CDA
        // effects depend only on other non-CDA effects.
        if (effect.characteristicDefiningAbility !== other.characteristicDefiningAbility) continue;
        if (options.dependsOn(effect, other, state)) effectDependencies.add(other.id);
      }
      dependencies.set(effect.id, effectDependencies);
    }

    const ready = remaining.filter(effect => dependencies.get(effect.id)!.size === 0).sort(byTimestamp);
    if (ready.length > 0) {
      const next = ready[0];
      state = options.apply(next, state);
      appliedEffectIds.push(next.id);
      remaining = remaining.filter(effect => effect.id !== next.id);
      continue;
    }

    // No sink exists: find cyclic strongly connected components. Effects downstream
    // of a loop are not part of the loop and must continue waiting.
    const cycleGroups = findSinkDependencyCycles(remaining, dependencies);
    if (cycleGroups.length === 0) throw new Error("DEPENDENCY_ORDERING_STALLED");
    cycleGroups.sort((a, b) => byTimestamp(a[0], b[0]));
    const loop = cycleGroups[0].sort(byTimestamp);
    const loopIds = new Set(loop.map(effect => effect.id));
    for (const effect of loop) {
      state = options.apply(effect, state);
      appliedEffectIds.push(effect.id);
      dependencyLoopEffectIds.push(effect.id);
      remaining = remaining.filter(candidate => !loopIds.has(candidate.id));
    }
  }

  return { state, appliedEffectIds, dependencyLoopEffectIds };
}

function findSinkDependencyCycles<Effect extends DependencyOrderedEffect>(
  effects: readonly Effect[],
  dependencies: ReadonlyMap<string, ReadonlySet<string>>
): Effect[][] {
  let nextIndex = 0;
  const indexById = new Map<string, number>();
  const lowLinkById = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const visit = (id: string): void => {
    indexById.set(id, nextIndex);
    lowLinkById.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);

    for (const dependencyId of dependencies.get(id) ?? []) {
      if (!indexById.has(dependencyId)) {
        visit(dependencyId);
        lowLinkById.set(id, Math.min(lowLinkById.get(id)!, lowLinkById.get(dependencyId)!));
      } else if (onStack.has(dependencyId)) {
        lowLinkById.set(id, Math.min(lowLinkById.get(id)!, indexById.get(dependencyId)!));
      }
    }

    if (lowLinkById.get(id) === indexById.get(id)) {
      const component: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
      } while (member !== id);
      components.push(component);
    }
  };

  for (const effect of effects) if (!indexById.has(effect.id)) visit(effect.id);

  const componentById = new Map<string, number>();
  components.forEach((component, componentIndex) => {
    for (const id of component) componentById.set(id, componentIndex);
  });
  const cyclicSinkComponents = components.filter((component, componentIndex) => {
    const cyclic = component.length > 1;
    if (!cyclic) return false;
    return component.every(id =>
      [...(dependencies.get(id) ?? [])].every(dependencyId => componentById.get(dependencyId) === componentIndex)
    );
  });

  const effectById = new Map(effects.map(effect => [effect.id, effect]));
  return cyclicSinkComponents.map(component => component.map(id => effectById.get(id)!));
}
