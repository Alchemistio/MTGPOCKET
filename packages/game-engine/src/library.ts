import { EngineError, type GameState, type PlayerId } from "./model.js";
import { moveCardToZone } from "./cards.js";

function seedToUint32(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher-Yates shuffle. The caller supplies and persists the seed. */
export function shuffleLibrary(state: GameState, playerId: PlayerId, seed: string): GameState {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur inconnu.");
  if (player.isEliminated) throw new EngineError("PLAYER_ELIMINATED", "Un joueur éliminé ne peut pas mélanger sa bibliothèque.");
  const library = [...player.library];
  const random = mulberry32(seedToUint32(seed));
  for (let i = library.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [library[i], library[j]] = [library[j]!, library[i]!];
  }
  return {
    ...state, revision: state.revision + 1,
    players: state.players.map(p => p.id === playerId ? { ...p, library } : p)
  };
}

export interface DrawResult {
  state: GameState;
  drawn: readonly string[];
  failedToDraw: boolean;
}

/** Draws from the end of the library array (the top of library in this model). */
export function drawCards(state: GameState, playerId: PlayerId, count: number): DrawResult {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Le nombre de cartes à piocher doit être un entier positif ou nul.");
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur inconnu.");
  if (player.isEliminated) throw new EngineError("PLAYER_ELIMINATED", "Un joueur éliminé ne peut pas piocher.");
  let next = state;
  const drawn: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const currentPlayer = next.players.find(p => p.id === playerId);
    const instanceId = currentPlayer?.library[currentPlayer.library.length - 1];
    if (!instanceId) break;
    next = moveCardToZone(next, instanceId, "hand");
    drawn.push(instanceId);
  }
  return { state: next, drawn, failedToDraw: drawn.length < count };
}
