import { EngineError, type GameState, type InstanceId, type PlayerId, type StackItem } from "./model.js";
import { appendStackObject, validateStackObjectForPush } from "./stack-engine.js";

export interface ActivateStackAbilityRequest {
  controllerId: PlayerId;
  sourceInstanceId: InstanceId;
  /** Empty string means no mana cost. Only generic and WUBRGC symbols are supported. */
  manaCost: string;
  /** Whether the source permanent is part of the activation cost. */
  tapSource: boolean;
  stackItem: StackItem;
}

/**
 * Pays the currently supported activation costs and puts the ability on the stack
 * as one atomic state transition. Mana abilities that resolve without the stack
 * must use their dedicated immediate-effect path instead.
 */
export function activateStackAbility(state: GameState, request: ActivateStackAbilityRequest): GameState {
  const { controllerId, sourceInstanceId, manaCost, tapSource, stackItem } = request;
  if (stackItem.kind !== "activated-ability" ||
      stackItem.controller_id !== controllerId ||
      stackItem.source_instance_id !== sourceInstanceId) {
    throw new EngineError("INVALID_ACTIVATED_ABILITY", "L'objet de pile ne correspond pas à la capacité activée annoncée.");
  }

  // Validate all stack invariants before preparing any cost payment.
  validateStackObjectForPush(state, stackItem);

  const source = state.cards[sourceInstanceId];
  if (!source || source.zone !== "battlefield") {
    throw new EngineError("INVALID_ZONE_MOVE", "La source de capacité doit être sur le champ de bataille.");
  }
  if (source.controller_id !== controllerId) {
    throw new EngineError("NOT_CONTROLLER", "Seul le contrôleur de la source peut activer cette capacité.");
  }
  if (tapSource && source.is_tapped) {
    throw new EngineError("PERMANENT_TAPPED", "La source est déjà engagée.");
  }

  const requirements = parseActivationManaCost(manaCost);
  const player = state.players.find(candidate => candidate.id === controllerId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur inconnu.");

  const pool = { ...player.manaPool };
  for (const [symbol, amount] of Object.entries(requirements.colored)) {
    if ((pool[symbol] ?? 0) < amount) {
      throw new EngineError("INSUFFICIENT_MANA", "Réserve de mana insuffisante.");
    }
    pool[symbol] = (pool[symbol] ?? 0) - amount;
  }

  let genericRemaining = requirements.generic;
  for (const symbol of Object.keys(pool).sort()) {
    if (genericRemaining === 0) break;
    const spent = Math.min(genericRemaining, pool[symbol] ?? 0);
    pool[symbol] = (pool[symbol] ?? 0) - spent;
    genericRemaining -= spent;
  }
  if (genericRemaining > 0) {
    throw new EngineError("INSUFFICIENT_MANA", "Réserve de mana insuffisante.");
  }

  const prepared: GameState = {
    ...state,
    players: state.players.map(candidate => candidate.id === controllerId
      ? { ...candidate, manaPool: pool }
      : candidate),
    cards: tapSource
      ? { ...state.cards, [sourceInstanceId]: { ...source, is_tapped: true } }
      : state.cards
  };

  // appendStackObject increments revision once: costs + stack insertion are atomic.
  return appendStackObject(prepared, stackItem);
}

function parseActivationManaCost(manaCost: string): {
  colored: Record<string, number>;
  generic: number;
} {
  const symbols = manaCost.match(/\{[^{}]+\}/g) ?? [];
  if (symbols.join("") !== manaCost) {
    throw new EngineError("UNSUPPORTED_MANA_COST", "Coût de mana d'activation non pris en charge.");
  }

  const colored: Record<string, number> = {};
  let generic = 0;
  for (const token of symbols) {
    const symbol = token.slice(1, -1);
    if (/^\d+$/.test(symbol)) {
      const amount = Number(symbol);
      if (!Number.isSafeInteger(amount)) {
        throw new EngineError("UNSUPPORTED_MANA_COST", "Montant de mana générique invalide.");
      }
      generic += amount;
      if (!Number.isSafeInteger(generic)) {
        throw new EngineError("UNSUPPORTED_MANA_COST", "Coût de mana générique trop élevé.");
      }
    } else if (/^[WUBRGC]$/.test(symbol)) {
      colored[symbol] = (colored[symbol] ?? 0) + 1;
    } else {
      throw new EngineError("UNSUPPORTED_MANA_SYMBOL", "Symbole de mana d'activation non pris en charge.");
    }
  }
  return { colored, generic };
}
