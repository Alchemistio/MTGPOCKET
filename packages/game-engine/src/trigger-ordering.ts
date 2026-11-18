import { EngineError, type GameState, type PendingTriggerBatch, type PendingTriggerOrderGroup, type PlayerId, type StackItem } from "./model.js";

/**
 * Creates a serializable APNAP batch from already-detected triggered abilities.
 * Items are snapshots: this function deliberately does not re-check whether a
 * source is still on the battlefield after the triggering event.
 */
export function createPendingTriggerBatch(
  state: GameState,
  batchId: string,
  candidates: readonly StackItem[]
): PendingTriggerBatch | null {
  if (candidates.length === 0) return null;
  if (state.status !== "active" || !batchId.trim() || state.activePlayerId === null) {
    throw new EngineError("INVALID_TRIGGER_BATCH", "Le batch de triggers ou le joueur actif est invalide.");
  }
  if (state.stack.some(item => candidates.some(candidate => candidate.id === item.id))) {
    throw new EngineError("INVALID_TRIGGER_BATCH", "Un candidat utilise déjà un identifiant présent sur la pile.");
  }

  const active = state.players.find(player => player.id === state.activePlayerId);
  if (!active || active.isEliminated || active.seat !== state.activePlayerSeat) {
    throw new EngineError("INVALID_TRIGGER_BATCH", "Le joueur actif du batch est introuvable ou éliminé.");
  }

  const seen = new Set<string>();
  const grouped = new Map<PlayerId, StackItem[]>();
  for (const candidate of candidates) {
    if (candidate.kind !== "triggered-ability" || !candidate.id.trim() || seen.has(candidate.id)) {
      throw new EngineError("INVALID_TRIGGER_BATCH", "Le batch contient un candidat invalide ou dupliqué.");
    }
    seen.add(candidate.id);
    const controller = state.players.find(player => player.id === candidate.controller_id);
    if (!controller || controller.isEliminated) {
      throw new EngineError("INVALID_TRIGGER_BATCH", "Un candidat n'a pas de contrôleur actif valide.");
    }
    const group = grouped.get(controller.id) ?? [];
    group.push({ ...candidate });
    grouped.set(controller.id, group);
  }

  const apnapPlayers = [...state.players].sort((left, right) => {
    const leftDistance = (left.seat - active.seat + state.players.length) % state.players.length;
    const rightDistance = (right.seat - active.seat + state.players.length) % state.players.length;
    return leftDistance - rightDistance;
  });
  const groups: PendingTriggerOrderGroup[] = [];
  for (const player of apnapPlayers) {
    const items = grouped.get(player.id);
    if (!items?.length) continue;
    groups.push({
      controllerId: player.id,
      candidateStackItems: items,
      orderedStackItemIds: items.length === 1 ? [items[0]!.id] : null
    });
  }

  return {
    id: batchId,
    activePlayerId: active.id,
    createdAtRevision: state.revision,
    groups
  };
}

/** The next controller who must submit an order; single-item groups are auto-ordered. */
export function getNextTriggerOrderControllerId(batch: PendingTriggerBatch): PlayerId | null {
  return batch.groups.find(group => group.orderedStackItemIds === null)?.controllerId ?? null;
}

/**
 * Records the next APNAP controller's exact permutation. The supplied order is
 * the order of insertion onto the stack (bottom to top), not resolution order.
 */
export function recordPendingTriggerOrder(
  batch: PendingTriggerBatch,
  controllerId: PlayerId,
  orderedStackItemIds: readonly string[]
): PendingTriggerBatch {
  const nextControllerId = getNextTriggerOrderControllerId(batch);
  if (nextControllerId === null || nextControllerId !== controllerId) {
    throw new EngineError("INVALID_TRIGGER_ORDER", "Ce joueur n'est pas le prochain contrôleur APNAP à ordonner ses triggers.");
  }
  const groupIndex = batch.groups.findIndex(group => group.controllerId === controllerId);
  const group = batch.groups[groupIndex];
  if (!group || group.orderedStackItemIds !== null) {
    throw new EngineError("INVALID_TRIGGER_ORDER", "Le groupe de triggers est déjà ordonné ou introuvable.");
  }

  const expected = new Set(group.candidateStackItems.map(item => item.id));
  const supplied = new Set(orderedStackItemIds);
  if (orderedStackItemIds.length !== expected.size || supplied.size !== expected.size ||
      supplied.size !== orderedStackItemIds.length ||
      [...expected].some(id => !supplied.has(id))) {
    throw new EngineError("INVALID_TRIGGER_ORDER", "L'ordre doit être une permutation exacte des triggers de ce contrôleur.");
  }

  const groups = [...batch.groups];
  groups[groupIndex] = { ...group, orderedStackItemIds: [...orderedStackItemIds] };
  return { ...batch, groups };
}

/**
 * Returns stack insertion order (bottom to top) once every controller has
 * ordered their group. The top object will therefore resolve first.
 */
export function getPendingTriggerStackItemsBottomToTop(
  batch: PendingTriggerBatch
): readonly StackItem[] | null {
  if (batch.groups.some(group => group.orderedStackItemIds === null)) return null;
  const byId = new Map<string, StackItem>();
  for (const group of batch.groups) {
    for (const item of group.candidateStackItems) byId.set(item.id, item);
  }
  const ordered: StackItem[] = [];
  for (const group of batch.groups) {
    for (const id of group.orderedStackItemIds ?? []) {
      const item = byId.get(id);
      if (!item) throw new EngineError("INVALID_TRIGGER_BATCH", "Un identifiant ordonné ne correspond à aucun candidat.");
      ordered.push(item);
    }
  }
  return ordered;
}


/**
 * Atomically consumes a fully ordered trigger batch and appends its snapshots
 * to the stack in APNAP insertion order (bottom to top). This is deliberately
 * a mechanical primitive: it does not run state-based actions, grant priority,
 * or decide when the rules checkpoint permits triggers to be stacked.
 */
export function finalizePendingTriggerBatch(state: GameState, batchId: string): GameState {
  const batch = state.pendingTriggerBatch;
  if (!batch || batch.id !== batchId) {
    throw new EngineError("INVALID_TRIGGER_BATCH", "Le batch de triggers demandé est absent ou périmé.");
  }
  if (state.status !== "active" || state.awaitingResolutionId !== null) {
    throw new EngineError("INVALID_TRIGGER_BATCH", "La partie ou la pile ne permet pas de finaliser ce batch.");
  }
  const orderedItems = getPendingTriggerStackItemsBottomToTop(batch);
  if (orderedItems === null) {
    throw new EngineError("INVALID_TRIGGER_BATCH", "Tous les groupes APNAP doivent être ordonnés avant l'insertion.");
  }
  const existingIds = new Set(state.stack.map(item => item.id));
  if (orderedItems.some(item => existingIds.has(item.id)) ||
      new Set(orderedItems.map(item => item.id)).size !== orderedItems.length) {
    throw new EngineError("INVALID_TRIGGER_BATCH", "Le batch contient un identifiant déjà utilisé sur la pile.");
  }

  return {
    ...state,
    revision: state.revision + 1,
    stack: [...state.stack, ...orderedItems],
    pendingTriggerBatch: null,
    consecutivePasses: [],
    priorityWindowClosed: false
  };
}
