import { EngineError, type GameState, type PlayerId } from "./model.js";
import { createGame, type PlayerSetup } from "./game.js";
import { moveCardToZone } from "./cards.js";
import { drawCards, shuffleLibrary } from "./library.js";

export interface MulliganDecision {
  playerId: PlayerId;
  action: "mulligan" | "keep";
}

export function createPregameGame(id: string, players: readonly PlayerSetup[]): GameState {
  return { ...createGame(id, players), status: "pregame" };
}


export function placeCommandersInCommandZone(
  state: GameState,
  commandersByPlayer: Readonly<Record<PlayerId, readonly string[]>>
): GameState {
  if (state.status !== "pregame") throw new EngineError("NOT_ACTIVE_GAME", "Les commandants doivent être placés avant le début de la partie.");
  let next = state;
  const used = new Set<string>();
  for (const player of state.players) {
    const commanderIds = commandersByPlayer[player.id];
    if (!commanderIds || commanderIds.length < 1 || commanderIds.length > 2 ||
        new Set(commanderIds).size !== commanderIds.length) {
      throw new Error(`${player.name} doit désigner un ou deux commandants distincts.`);
    }
    for (const instanceId of commanderIds) {
      if (used.has(instanceId)) throw new Error("Une même carte ne peut pas être le commandant de plusieurs joueurs.");
      used.add(instanceId);
      const card = next.cards[instanceId];
      if (!card || card.owner_id !== player.id || card.zone !== "library") {
        throw new Error(`Le commandant ${instanceId} doit appartenir au joueur et être dans sa bibliothèque.`);
      }
      next = moveCardToZone(next, instanceId, "command");
      const moved = next.cards[instanceId];
      if (!moved) throw new Error("Commandant introuvable après déplacement.");
      next = {
        ...next, revision: next.revision + 1,
        cards: { ...next.cards, [instanceId]: { ...moved, is_commander: true } }
      };
    }
  }
  return next;
}

export function initializeOpeningHands(
  state: GameState,
  seeds: Readonly<Record<PlayerId, string>>,
  startingHandSize = 7
): GameState {
  if (state.status !== "pregame") throw new EngineError("NOT_ACTIVE_GAME", "La partie n'est pas en phase de préparation.");
  for (const player of state.players) {
    if (player.command.length < 1 || player.command.length > 2 || player.command.some(id => !state.cards[id]?.is_commander)) {
      throw new Error(`${player.name} doit avoir un ou deux commandants face visible en zone de commandement.`);
    }
  }
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
  if (player.pendingBottomCount !== 0) throw new Error("Le joueur doit d'abord choisir les cartes à remettre sous la bibliothèque.");
  const nextMulliganCount = player.mulliganCount + 1;
  if (nextMulliganCount > startingHandSize + 1) throw new Error("Le joueur ne peut plus prendre de mulligan.");

  let next = state;
  for (const cardId of [...player.hand]) next = moveCardToZone(next, cardId, "library");
  next = shuffleLibrary(next, playerId, seed);
  next = drawCards(next, playerId, startingHandSize).state;
  const pendingBottomCount = Math.max(0, nextMulliganCount - 1);
  return {
    ...next, revision: next.revision + 1,
    players: next.players.map(p => p.id === playerId
      ? { ...p, mulliganCount: nextMulliganCount, pendingBottomCount }
      : p)
  };
}

export function chooseMulliganBottomCards(
  state: GameState,
  playerId: PlayerId,
  cardIds: readonly string[]
): GameState {
  if (state.status !== "pregame") throw new EngineError("NOT_ACTIVE_GAME", "Le choix de mulligan est terminé.");
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur inconnu.");
  if (player.hasKeptHand) throw new Error("Ce joueur a déjà gardé sa main.");
  if (cardIds.length !== player.pendingBottomCount || new Set(cardIds).size !== cardIds.length ||
      cardIds.some(id => !player.hand.includes(id))) {
    throw new Error(`Il faut choisir exactement ${player.pendingBottomCount} carte(s) distincte(s) de la main.`);
  }
  const bottomSet = new Set(cardIds);
  const cards = { ...state.cards };
  for (const id of cardIds) {
    const card = cards[id];
    if (card) cards[id] = {
      ...card, zone: "library", controller_id: card.owner_id, is_tapped: false,
      attached_to: null, damage_marked: 0,
      counters: { p1p1: 0, m1m1: 0, shield: 0, custom: {} }
    };
  }
  return {
    ...state, revision: state.revision + 1, cards,
    players: state.players.map(p => p.id === playerId ? {
      ...p,
      hand: p.hand.filter(id => !bottomSet.has(id)),
      library: [...cardIds, ...p.library],
      pendingBottomCount: 0
    } : p)
  };
}

export function keepOpeningHand(state: GameState, playerId: PlayerId): GameState {
  if (state.status !== "pregame") throw new EngineError("NOT_ACTIVE_GAME", "La main d'ouverture ne peut être gardée qu'avant le début de la partie.");
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur inconnu.");
  if (player.hasKeptHand) throw new Error("Ce joueur a déjà gardé sa main.");
  if (player.pendingBottomCount !== 0) throw new Error("Le joueur doit remettre ses cartes sous la bibliothèque avant de garder.");
  return {
    ...state, revision: state.revision + 1,
    players: state.players.map(p => p.id === playerId ? { ...p, hasKeptHand: true } : p)
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
  if (waiting.some(p => p.pendingBottomCount > 0)) throw new Error("Tous les joueurs doivent terminer leur choix de cartes à remettre sous la bibliothèque avant la prochaine ronde.");
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
      next = keepOpeningHand(next, decision.playerId);
    } else {
      const seed = seeds[decision.playerId];
      if (!seed) throw new Error(`Graine de mulligan manquante pour ${decision.playerId}.`);
      next = performLondonMulligan(next, decision.playerId, seed, startingHandSize);
    }
  }
  return {
    state: next,
    readyToStart: next.players.every(p => p.hasKeptHand && p.pendingBottomCount === 0)
  };
}

export function startGame(state: GameState): GameState {
  if (state.status !== "pregame") throw new EngineError("NOT_ACTIVE_GAME", "La partie n'est pas en phase de préparation.");
  if (!state.players.every(p => p.hasKeptHand && p.pendingBottomCount === 0 && p.command.length >= 1 && p.command.length <= 2 && p.command.every(id => state.cards[id]?.is_commander))) {
    throw new Error("Tous les joueurs doivent avoir gardé leur main avant le début.");
  }
  return {
    ...state, revision: state.revision + 1, status: "active", turnNumber: 1,
    phase: "beginning", step: "untap", priorityPlayerId: null,
    consecutivePasses: [], priorityWindowClosed: false
  };
}
