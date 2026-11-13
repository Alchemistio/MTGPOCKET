import { EngineError, type GameState, type InstanceId, type PlayerId } from "./model.js";

export function getCommanderTax(state: GameState, commanderInstanceId: InstanceId): number {
  const commander = state.cards[commanderInstanceId];
  if (!commander?.is_commander) throw new EngineError("NOT_COMMANDER", "Cette carte n'est pas identifiée comme commandant.");
  const owner = state.players.find(p => p.id === commander.owner_id);
  if (!owner) throw new EngineError("UNKNOWN_PLAYER", "Propriétaire du commandant introuvable.");
  return (owner.commanderCastCount[commanderInstanceId] ?? 0) * 2;
}

/** Call only after the command-zone cast has been validated and committed. */
export function recordCommanderCast(state: GameState, commanderInstanceId: InstanceId, casterId: PlayerId): GameState {
  const commander = state.cards[commanderInstanceId];
  if (!commander?.is_commander) throw new EngineError("NOT_COMMANDER", "Cette carte n'est pas identifiée comme commandant.");
  if (commander.zone !== "command" || commander.owner_id !== casterId) {
    throw new EngineError("INVALID_COMMANDER_CAST", "Le commandant doit être lancé depuis la zone de commandement par son propriétaire.");
  }
  const player = state.players.find(p => p.id === casterId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur inconnu.");
  const commanderCastCount = { ...player.commanderCastCount, [commanderInstanceId]: (player.commanderCastCount[commanderInstanceId] ?? 0) + 1 };
  return {
    ...state, revision: state.revision + 1,
    players: state.players.map(p => p.id === casterId ? { ...p, commanderCastCount } : p)
  };
}

/** Records combat damage dealt by a commander; state-based loss is checked separately. */
export function recordCommanderCombatDamage(
  state: GameState,
  commanderInstanceId: InstanceId,
  damagedPlayerId: PlayerId,
  amount: number
): GameState {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new EngineError("INVALID_DAMAGE", "Les blessures doivent être un entier strictement positif.");
  const commander = state.cards[commanderInstanceId];
  if (!commander?.is_commander || commander.zone !== "battlefield") throw new EngineError("NOT_COMMANDER", "La source doit être un commandant sur le champ de bataille.");
  const player = state.players.find(p => p.id === damagedPlayerId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur blessé inconnu.");
  if (player.isEliminated) throw new EngineError("PLAYER_ELIMINATED", "Le joueur est déjà éliminé.");
  const commanderDamageReceived = {
    ...player.commanderDamageReceived,
    [commanderInstanceId]: (player.commanderDamageReceived[commanderInstanceId] ?? 0) + amount
  };
  return {
    ...state, revision: state.revision + 1,
    players: state.players.map(p => p.id === damagedPlayerId ? { ...p, commanderDamageReceived } : p)
  };
}

/** Applies the 21-combat-damage loss check after the damage event has fully resolved. */
export function applyCommanderDamageLosses(state: GameState): GameState {
  const players = state.players.map(p => {
    const lost = Object.values(p.commanderDamageReceived).some(total => total >= 21);
    return lost && !p.isEliminated ? { ...p, isEliminated: true } : p;
  });
  const aliveCount = players.filter(p => !p.isEliminated).length;
  return {
    ...state, revision: state.revision + 1, players,
    status: aliveCount <= 1 ? "finished" : state.status
  };
}
