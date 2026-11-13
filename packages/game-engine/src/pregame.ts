import { EngineError, type GameState, type PlayerId } from "./model.js";
import { createGame, type PlayerSetup } from "./game.js";
import { moveCardToZone } from "./cards.js";
import { drawCards, shuffleLibrary } from "./library.js";

export interface MulliganDecision {
  playerId: PlayerId;
  action: "mulligan" | "keep";
  /** Cards to put on the bottom, in the order chosen by the player. */
  bottomCardIds?: readonly string[];
}

export function createPregameGame(id: string, players: readonly PlayerSetup[]): GameState {
  return { ...createGame(id, players), status: "pregame" };
}

export function initializeOpeningHands(
  state: GameState,
  seeds: Readonly<Record<PlayerId, string>>,
  startingHandSize = 7
): GameState {
  if (state.status !== "pregame") throw new EngineError("NOT_ACTIVE_GAME", "La partie n'est pas en phase de préparation.");
  let next = state;
  for (const player of [...state.players].sort((a, b) => a.seat - b.seat)) {
    const seed = seeds[player.id];
    if (!seed) throw new Error(`Graine de mélange manquante pour ${player.id}.`);
    next = shuffleLibrary(next, player.id, seed);
    next = drawCards(next, player.id, startingHandSize).state;
  }
  return next;
}

export function performLondonMulligan(
  state: GameState,
  playerId: PlayerId,
  seed: string,
  startingHandSize = 7
): GameState {
  if (state.status !== "pregame") throw new EngineError("NOT_ACTIVE_GAME", "Le mulligan n'est possible qu'avant le début de la partie.");
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur inconnu.");
  if (player.hasKeptHand) throw new Error("Ce joueur a déjà gardé sa main.");
  if (player.mulliganCount >= startingHandSize + 1) throw new Error("Le joueur ne peut plus prendre de mulligan.");
  let next = state;
  for (const cardId of [...player.hand]) next = moveCardToZone(next, cardId, "library");
  next = shuffleLibrary(next, playerId, seed);
  next = drawCards(next, playerId, startingHandSize).state;
  return {
    ...next, revision: next.revision + 1,
    players: next.players.map(p => p.id === playerId ? { ...p, mulliganCount: p.mulliganCount + 1 } : p)
  };
}

export function keepOpeningHand(
  state: GameState,
  playerId: PlayerId,
  bottomCardIds: readonly string[] = []
): GameState {
  if (state.status !== "pregame") throw new EngineError("NOT_ACTIVE_GAME", "La main d'ouverture ne peut être gardée qu'avant le début de la partie.");
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur inconnu.");
  if (player.hasKeptHand) throw new Error("Ce joueur a déjà gardé sa main.");
  const requiredBottomCount = Math.max(0, player.mulliganCount - 1);
  if (bottomCardIds.length !== requiredBottomCount || new Set(bottomCardIds).size !== bottomCardIds.length) {
    throw new Error(`Il faut remettre exactement ${requiredBottomCount} carte(s) sous la bibliothèque.`);
  }
  if (bottomCardIds.some(id => !player.hand.includes(id))) throw new Error("Une carte choisie ne se trouve pas dans la main.");
  const bottomSet = new Set(bottomCardIds);
  const hand = player.hand.filter(id => !bottomSet.has(id));
  const library = [...bottomCardIds, ...player.library];
  const cards = { ...state.cards };
  for (const id of bottomCardIds) {
    const card = cards[id];
    if (card) cards[id] = { ...card, zone: "library", controller_id: card.owner_id, is_tapped: false, attached_to: null, damage_marked: 0, counters: { p1p1: 0, m1m1: 0, shield: 0, custom: {} } };
  }
  return {
    ...state, revision: state.revision + 1, cards,
    players: state.players.map(p => p.id === playerId ? { ...p, hand, library, hasKeptHand: true } : p)
  };
}

/** Processes a complete round of simultaneous keep/mulligan declarations. */
export function resolveMulliganRound(
  state: GameState,
  decisions: readonly MulliganDecision[],
  seeds: Readonly<Record<PlayerId, string>>,
  startingHandSize = 7
): { state: GameState; readyToStart: boolean } {
  if (state.status !== "pregame") throw new EngineError("NOT_ACTIVE_GAME", "La phase de mulligan est terminée.");
  const waiting = state.players.filter(p => !p.hasKeptHand);
  if (decisions.length !== waiting.length || new Set(decisions.map(d => d.playerId)).size !== decisions.length ||
      waiting.some(p => !decisions.some(d => d.playerId === p.id))) {
    throw new Error("Chaque joueur qui n'a pas encore gardé sa main doit déclarer simultanément keep ou mulligan.");
  }
  let next = state;
  const ordered = [...decisions].sort((a, b) =>
    (state.players.find(p => p.id === a.playerId)?.seat ?? 99) - (state.players.find(p => p.id === b.playerId)?.seat ?? 99)
  );
  for (const decision of ordered) {
    if (decision.action === "keep") {
      next = keepOpeningHand(next, decision.playerId, decision.bottomCardIds ?? []);
    } else {
      const seed = seeds[decision.playerId];
      if (!seed) throw new Error(`Graine de mulligan manquante pour ${decision.playerId}.`);
      next = performLondonMulligan(next, decision.playerId, seed, startingHandSize);
    }
  }
  return { state: next, readyToStart: next.players.every(p => p.hasKeptHand) };
}

export function startGame(state: GameState): GameState {
  if (state.status !== "pregame") throw new EngineError("NOT_ACTIVE_GAME", "La partie n'est pas en phase de préparation.");
  if (!state.players.every(p => p.hasKeptHand)) throw new Error("Tous les joueurs doivent avoir gardé leur main avant le début.");
  return {
    ...state, revision: state.revision + 1, status: "active", turnNumber: 1,
    phase: "beginning", step: "untap", priorityPlayerId: null,
    consecutivePasses: [], priorityWindowClosed: false
  };
}
