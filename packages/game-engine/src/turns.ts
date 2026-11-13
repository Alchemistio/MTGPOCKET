import { EngineError, type GameState, type Phase, type Step } from "./model.js";

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
  if (next) return {
    ...state, revision: state.revision + 1, phase: next.phase, step: next.step,
    priorityPlayerId: next.grantsPriority ? (state.activePlayerId ?? nextLivingPlayerAfterSeat(state, state.activePlayerSeat)?.id ?? null) : null, consecutivePasses: [], priorityWindowClosed: false
  };
  const alive = state.players.filter(p => !p.isEliminated).sort((a, b) => a.seat - b.seat);
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
  if (state.priorityPlayerId !== null || state.priorityWindowClosed || state.stack.length > 0 || state.awaitingResolutionId !== null) {
    throw new EngineError("RESOLUTION_REQUIRED", "La partie n'est pas dans une étape automatique libre.");
  }
  if (state.step !== "untap" && state.step !== "cleanup") {
    throw new EngineError("NOT_PRIORITY_PLAYER", "Cette étape ne peut pas avancer automatiquement.");
  }
  return nextTurnStep(state);
}
