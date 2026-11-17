import type { GameState, StackItem } from "./model.js";
import { EngineError } from "./model.js";

/** Read-only stack primitives shared by spell, ability, trigger and copy systems. */
export function getStackTop(state: Pick<GameState, "stack">): StackItem | null {
  return state.stack[state.stack.length - 1] ?? null;
}

export function validateStackObjectForPush(state: GameState, item: StackItem): void {
  if (state.status !== "active") throw new EngineError("NOT_ACTIVE_GAME", "La partie n'est pas active.");
  if (state.awaitingResolutionId !== null) throw new EngineError("RESOLUTION_REQUIRED", "La pile est en cours de résolution.");
  if (state.priorityPlayerId !== item.controller_id) throw new EngineError("NOT_PRIORITY_PLAYER", "Le contrôleur de l'objet doit avoir la priorité pour l'ajouter à la pile.");
  if (state.stack.some(existing => existing.id === item.id)) throw new EngineError("STACK_ITEM_MISMATCH", "Identifiant d'objet de pile déjà utilisé.");
  if (item.kind === "spell" && item.source_instance_id !== null) {
    const source = state.cards[item.source_instance_id];
    if (!source || source.zone !== "stack") throw new EngineError("STACK_ITEM_MISMATCH", "La carte du sort doit déjà être dans la zone de pile.");
  }
  const controller = state.players.find(player => player.id === item.controller_id);
  if (!controller || controller.isEliminated) throw new EngineError("PLAYER_ELIMINATED", "Le contrôleur n'est pas un joueur actif.");
  if (!item.id.trim()) throw new EngineError("STACK_ITEM_MISMATCH", "Identifiant d'objet de pile invalide.");
}

export function appendStackObject(state: GameState, item: StackItem): GameState {
  validateStackObjectForPush(state, item);
  return {
    ...state,
    revision: state.revision + 1,
    stack: [...state.stack, item],
    consecutivePasses: [],
    priorityWindowClosed: false
  };
}

export function markTopStackObjectResolving(state: GameState, stackItemId: string): GameState {
  if (state.awaitingResolutionId !== null) throw new EngineError("RESOLUTION_REQUIRED", "Une résolution est déjà en attente.");
  const top = getStackTop(state);
  if (!top || top.id !== stackItemId) throw new EngineError("STACK_ITEM_MISMATCH", "L'objet demandé n'est pas au sommet de la pile.");
  return {
    ...state, revision: state.revision + 1, priorityPlayerId: null,
    consecutivePasses: [], awaitingResolutionId: stackItemId, priorityWindowClosed: false
  };
}

export function removeResolvedStackObject(state: GameState, stackItemId: string): GameState {
  if (state.awaitingResolutionId === null) throw new EngineError("NO_PENDING_RESOLUTION", "Aucune résolution n'est en attente.");
  if (state.awaitingResolutionId !== stackItemId) throw new EngineError("STACK_ITEM_MISMATCH", "L'objet à résoudre ne correspond pas au sommet attendu.");
  const top = getStackTop(state);
  if (!top || top.id !== stackItemId) throw new EngineError("STACK_ITEM_MISMATCH", "Le sommet de pile a changé.");
  return {
    ...state, revision: state.revision + 1, stack: state.stack.slice(0, -1),
    awaitingResolutionId: null, consecutivePasses: [], priorityWindowClosed: false
  };
}

/** Resolution is injected: this module owns lifecycle, never card-specific effect semantics. */
export function resolveTopStackObject(
  state: GameState,
  stackItemId: string,
  resolveEffect: (current: GameState, item: StackItem) => GameState
): GameState {
  if (state.awaitingResolutionId !== stackItemId) throw new EngineError("STACK_ITEM_MISMATCH", "Cet objet n'attend pas sa résolution.");
  const top = getStackTop(state);
  if (!top || top.id !== stackItemId) throw new EngineError("STACK_ITEM_MISMATCH", "L'objet demandé n'est pas au sommet de la pile.");
  return removeResolvedStackObject(resolveEffect(state, top), stackItemId);
}
