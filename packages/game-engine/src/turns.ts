import { EngineError, type GameState, type Phase, type Step } from "./model.js";
import { drawCards } from "./library.js";
import { applyStateBasedActions } from "./players.js";

function nextLivingPlayerAfterSeat(state: GameState, seat: number) {
  const alive = state.players.filter(p => !p.isEliminated).sort((a, b) => a.seat - b.seat);
  return alive.find(p => p.seat > seat) ?? alive[0] ?? null;
}

export const TURN_SEQUENCE: ReadonlyArray<{ phase: Phase; step: Step; grantsPriority: boolean }> = [
  { phase: "beginning", step: "untap", grantsPriority: false },
  { phase: "beginning", step: "upkeep", grantsPriority: true },
  { phase: "beginning", step: "draw", grantsPriority: true },
  { phase: "precombat-main", step: "main-1", grantsPriority: true },
  { phase: "combat", step: "begin-combat", grantsPriority: true },
  { phase: "combat", step: "declare-attackers", grantsPriority: true },
  { phase: "combat", step: "declare-blockers", grantsPriority: true },
  { phase: "combat", step: "combat-damage", grantsPriority: true },
  { phase: "combat", step: "end-combat", grantsPriority: true },
  { phase: "postcombat-main", step: "main-2", grantsPriority: true },
  { phase: "ending", step: "end", grantsPriority: true },
  { phase: "ending", step: "cleanup", grantsPriority: false }
];

export function nextTurnStep(state: GameState): GameState {
  if (state.status !== "active") throw new EngineError("NOT_ACTIVE_GAME", "La partie n'est pas active.");
  if (state.awaitingResolutionId !== null) throw new EngineError("RESOLUTION_REQUIRED", "La pile doit être résolue avant de continuer.");
  const index = TURN_SEQUENCE.findIndex(x => x.phase === state.phase && x.step === state.step);
  if (index < 0) throw new Error("État de tour incohérent.");
  const next = TURN_SEQUENCE[index + 1];
  if (next) {
    let nextState: GameState = {
      ...state,
      revision: state.revision + 1,
      phase: next.phase,
      step: next.step,
      priorityPlayerId: next.grantsPriority ? (state.activePlayerId ?? nextLivingPlayerAfterSeat(state, state.activePlayerSeat)?.id ?? null) : null,
      consecutivePasses: [],
      priorityWindowClosed: false,
      players: state.players.map(player => ({ ...player, manaPool: {} }))
    };
    if (next.step === "draw" && nextState.deckSetupComplete && nextState.activePlayerId !== null) {
      nextState = drawCards(nextState, nextState.activePlayerId, 1).state;
      nextState = applyStateBasedActions(nextState);
    }
    if (next.step === "cleanup") {
      const cards = Object.fromEntries(Object.entries(nextState.cards).map(([id, card]) => [
        id, card.zone === "battlefield" ? { ...card, damage_marked: 0 } : card
      ]));
      const active = nextState.activePlayerId === null ? undefined : nextState.players.find(p => p.id === nextState.activePlayerId);
      const pendingDiscardCount = active ? Math.max(0, active.hand.length - active.maxHandSize) : 0;
      nextState = {
        ...nextState, revision: nextState.revision + 1, cards,
        pendingDiscardPlayerId: pendingDiscardCount > 0 ? active?.id ?? null : null,
        pendingDiscardCount
      };
    }
    return nextState;
  }
  const nextPlayer = nextLivingPlayerAfterSeat(state, state.activePlayerSeat);
  if (!nextPlayer) throw new Error("Aucun joueur actif.");
  return {
    ...state, revision: state.revision + 1, activePlayerId: nextPlayer.id, activePlayerSeat: nextPlayer.seat,
    turnNumber: state.turnNumber + 1, phase: "beginning", step: "untap",
    priorityPlayerId: null, consecutivePasses: [], priorityWindowClosed: false
  };
}

export function beginPriorityWindow(state: GameState): GameState {
  if (state.status !== "active") throw new EngineError("NOT_ACTIVE_GAME", "La partie n'est pas active.");
  return { ...state, revision: state.revision + 1, priorityPlayerId: state.activePlayerId ?? nextLivingPlayerAfterSeat(state, state.activePlayerSeat)?.id ?? null, consecutivePasses: [], priorityWindowClosed: false };
}

/** Advances only the rules-defined no-priority steps (currently untap and cleanup). */
export function advanceAutomaticStep(state: GameState): GameState {
  if (state.status !== "active") throw new EngineError("NOT_ACTIVE_GAME", "La partie n'est pas active.");
  if (state.priorityPlayerId !== null || state.priorityWindowClosed || state.stack.length > 0 || state.awaitingResolutionId !== null || state.pendingDiscardCount > 0) {
    throw new EngineError("RESOLUTION_REQUIRED", "La partie n'est pas dans une étape automatique libre.");
  }
  if (state.step !== "untap" && state.step !== "cleanup") {
    throw new EngineError("NOT_PRIORITY_PLAYER", "Cette étape ne peut pas avancer automatiquement.");
  }
  let current = state;
  if (state.step === "untap" && state.deckSetupComplete && state.activePlayerId !== null) {
    const active = state.players.find(player => player.id === state.activePlayerId);
    const cards = { ...state.cards };
    for (const instanceId of active?.battlefield ?? []) {
      const card = cards[instanceId];
      if (card && card.controller_id === state.activePlayerId) cards[instanceId] = { ...card, is_tapped: false };
    }
    current = { ...state, revision: state.revision + 1, cards };
  }
  return nextTurnStep(current);
}
