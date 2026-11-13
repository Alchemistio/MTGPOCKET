import { EngineError, type GameState, type PlayerId, type PlayerState } from "./model.js";
import { nextTurnStep } from "./turns.js";

export interface PlayerSetup { id: PlayerId; name: string; seat: number; }

function makePlayer(input: PlayerSetup): PlayerState {
  return {
    ...input, life: 40, hand: [], library: [], graveyard: [], exile: [],
    battlefield: [], command: [], commanderCastCount: {}, commanderDamageReceived: {},
    manaPool: {}, isEliminated: false, attemptedEmptyLibraryDraw: false, mulliganCount: 0, pendingBottomCount: 0, hasKeptHand: false
  };
}

export function createGame(id: string, players: readonly PlayerSetup[]): GameState {
  if (players.length !== 4) throw new EngineError("INVALID_PLAYER_COUNT", "Commander Pocket requiert quatre sièges.");
  if (new Set(players.map(p => p.id)).size !== players.length) throw new EngineError("DUPLICATE_PLAYER", "Chaque joueur doit avoir un identifiant unique.");
  const seats = [...players].sort((a, b) => a.seat - b.seat);
  if (seats.some((p, i) => p.seat !== i)) throw new Error("Les sièges doivent être numérotés de 0 à 3.");
  const first = seats[0];
  if (!first) throw new Error("Premier joueur introuvable.");
  return {
    id, revision: 0, players: seats.map(makePlayer), cards: {}, activePlayerId: first.id,
    activePlayerSeat: first.seat, result: null, turnNumber: 1, phase: "beginning", step: "untap", priorityPlayerId: null,
    consecutivePasses: [], stack: [], awaitingResolutionId: null, priorityWindowClosed: false, status: "active"
  };
}

export type PassPriorityResult =
  | { state: GameState; outcome: "passed" }
  | { state: GameState; outcome: "step-advance" }
  | { state: GameState; outcome: "resolution-required"; stackItemId: string };

export function passPriority(state: GameState, playerId: PlayerId): PassPriorityResult {
  if (state.status !== "active") throw new EngineError("NOT_ACTIVE_GAME", "La partie n'est pas active.");
  if (state.awaitingResolutionId !== null) throw new EngineError("RESOLUTION_REQUIRED", "La résolution de la pile est en attente.");
  if (state.priorityPlayerId !== playerId) throw new EngineError("NOT_PRIORITY_PLAYER", "Ce joueur n'a pas la priorité.");
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur inconnu.");
  if (player.isEliminated) throw new EngineError("PLAYER_ELIMINATED", "Un joueur éliminé ne peut pas passer la priorité.");
  const alive = state.players.filter(p => !p.isEliminated).sort((a, b) => a.seat - b.seat);
  const nextPlayer = alive.find(p => p.seat > player.seat) ?? alive[0];
  if (!nextPlayer) throw new Error("Aucun joueur éligible.");
  const passes = [...state.consecutivePasses, playerId];
  if (!alive.every(p => passes.includes(p.id))) {
    return { state: { ...state, revision: state.revision + 1, priorityPlayerId: nextPlayer.id, consecutivePasses: passes }, outcome: "passed" };
  }
  if (state.stack.length > 0) {
    const top = state.stack[state.stack.length - 1];
    if (!top) throw new Error("Objet de pile introuvable.");
    return {
      state: { ...state, revision: state.revision + 1, priorityPlayerId: null, consecutivePasses: [], awaitingResolutionId: top.id, priorityWindowClosed: false },
      outcome: "resolution-required", stackItemId: top.id
    };
  }
  return { state: { ...state, revision: state.revision + 1, priorityPlayerId: null, consecutivePasses: [], priorityWindowClosed: true }, outcome: "step-advance" };
}

export function completeStackResolution(state: GameState, stackItemId: string): GameState {
  if (state.awaitingResolutionId === null) throw new EngineError("NO_PENDING_RESOLUTION", "Aucune résolution n'est en attente.");
  if (state.awaitingResolutionId !== stackItemId) throw new EngineError("STACK_ITEM_MISMATCH", "L'objet à résoudre ne correspond pas au sommet attendu.");
  const top = state.stack[state.stack.length - 1];
  if (!top || top.id !== stackItemId) throw new EngineError("STACK_ITEM_MISMATCH", "Le sommet de pile a changé.");
  return {
    ...state, revision: state.revision + 1, stack: state.stack.slice(0, -1),
    awaitingResolutionId: null, priorityPlayerId: state.activePlayerId ?? state.players.filter(p => !p.isEliminated).sort((a, b) => a.seat - b.seat).find(p => p.seat > state.activePlayerSeat)?.id ?? state.players.filter(p => !p.isEliminated).sort((a, b) => a.seat - b.seat)[0]?.id ?? null, consecutivePasses: [], priorityWindowClosed: false
  };
}


export function pushStackItem(state: GameState, item: import("./model.js").StackItem): GameState {
  if (state.status !== "active") throw new EngineError("NOT_ACTIVE_GAME", "La partie n'est pas active.");
  if (state.awaitingResolutionId !== null) throw new EngineError("RESOLUTION_REQUIRED", "La pile est en cours de résolution.");
  if (state.priorityPlayerId !== item.controller_id) throw new EngineError("NOT_PRIORITY_PLAYER", "Le contrôleur de l'objet doit avoir la priorité pour l'ajouter à la pile.");
  if (state.stack.some(existing => existing.id === item.id)) throw new EngineError("STACK_ITEM_MISMATCH", "Identifiant d'objet de pile déjà utilisé.");
  if (item.kind === "spell" && item.source_instance_id !== null) {
    const source = state.cards[item.source_instance_id];
    if (!source || source.zone !== "stack") throw new EngineError("STACK_ITEM_MISMATCH", "La carte du sort doit déjà être dans la zone de pile.");
  }
  const controller = state.players.find(p => p.id === item.controller_id);
  if (!controller || controller.isEliminated) throw new EngineError("PLAYER_ELIMINATED", "Le contrôleur n'est pas un joueur actif.");
  return {
    ...state, revision: state.revision + 1,
    stack: [...state.stack, item], consecutivePasses: [], priorityWindowClosed: false
  };
}

/** Resolves the top stack item through an injected card/effect handler, then grants priority. */
export function resolveStackItem(
  state: GameState,
  stackItemId: string,
  resolveEffect: (current: GameState, item: import("./model.js").StackItem) => GameState
): GameState {
  if (state.awaitingResolutionId !== stackItemId) throw new EngineError("STACK_ITEM_MISMATCH", "Cet objet n'attend pas sa résolution.");
  const top = state.stack[state.stack.length - 1];
  if (!top || top.id !== stackItemId) throw new EngineError("STACK_ITEM_MISMATCH", "L'objet demandé n'est pas au sommet de la pile.");
  const afterEffect = resolveEffect(state, top);
  return completeStackResolution(afterEffect, stackItemId);
}

export function advanceAfterAllPass(state: GameState): GameState {
  if (state.awaitingResolutionId !== null || state.stack.length > 0) throw new EngineError("RESOLUTION_REQUIRED", "La pile doit être vide avant de continuer.");
  if (!state.priorityWindowClosed) throw new EngineError("NOT_PRIORITY_PLAYER", "La fenêtre de priorité n'a pas été fermée par tous les joueurs.");
  return { ...nextTurnStep(state), priorityWindowClosed: false };
}
