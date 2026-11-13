import { EngineError, type GameState, type PlayerId, type RuntimeCardState } from "./model.js";

export function changeLife(state: GameState, playerId: PlayerId, delta: number): GameState {
  if (!Number.isSafeInteger(delta)) throw new Error("La variation de vie doit être un entier.");
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "Joueur inconnu.");
  if (player.isEliminated) throw new EngineError("PLAYER_ELIMINATED", "Un joueur éliminé ne peut pas changer de total de vie.");
  if (delta === 0) return state;
  return {
    ...state, revision: state.revision + 1,
    players: state.players.map(p => p.id === playerId ? { ...p, life: p.life + delta } : p)
  };
}

function nextLivingPlayerAfterSeat(players: GameState["players"], seat: number) {
  const alive = players.filter(p => !p.isEliminated).sort((a, b) => a.seat - b.seat);
  return alive.find(p => p.seat > seat) ?? alive[0] ?? null;
}

/** Implements the player-leaves cleanup relevant to CR 800.4a and 800.4j. */
function eliminatePlayers(state: GameState, leavingIds: ReadonlySet<PlayerId>): GameState {
  const leavingPlayers = state.players.filter(p => leavingIds.has(p.id));
  const leavingSeats = new Map<PlayerId, number>(leavingPlayers.map(p => [p.id, p.seat] as const));
  const removedCardIds = new Set<string>();
  const exileByOwner = new Map<PlayerId, string[]>();

  for (const card of Object.values(state.cards)) {
    if (leavingIds.has(card.owner_id)) removedCardIds.add(card.instance_id);
    else if (leavingIds.has(card.controller_id) && (card.zone === "battlefield" || card.zone === "stack")) {
      const owned = exileByOwner.get(card.owner_id) ?? [];
      owned.push(card.instance_id);
      exileByOwner.set(card.owner_id, owned);
    }
  }

  const exiledIds = new Set([...exileByOwner.values()].flat());
  const cards: Record<string, RuntimeCardState> = {};
  for (const card of Object.values(state.cards)) {
    if (removedCardIds.has(card.instance_id)) continue;
    if (exiledIds.has(card.instance_id)) {
      cards[card.instance_id] = {
        ...card, zone: "exile", controller_id: card.owner_id, is_tapped: false,
        counters: { p1p1: 0, m1m1: 0, shield: 0, custom: {} },
        attached_to: null, damage_marked: 0
      };
    } else {
      cards[card.instance_id] = card.attached_to && (removedCardIds.has(card.attached_to) || exiledIds.has(card.attached_to))
        ? { ...card, attached_to: null }
        : card;
    }
  }

  const players = state.players.map(player => {
    if (leavingIds.has(player.id)) {
      return {
        ...player, isEliminated: true, hand: [], library: [], graveyard: [],
        exile: [], battlefield: [], command: [], manaPool: {}
      };
    }
    const withoutDeparted = (ids: string[]) => ids.filter(id => !removedCardIds.has(id) && !exiledIds.has(id));
    return {
      ...player,
      hand: withoutDeparted(player.hand),
      library: withoutDeparted(player.library),
      graveyard: withoutDeparted(player.graveyard),
      exile: [...withoutDeparted(player.exile), ...(exileByOwner.get(player.id) ?? [])],
      battlefield: withoutDeparted(player.battlefield),
      command: withoutDeparted(player.command)
    };
  });

  const alive = players.filter(p => !p.isEliminated);
  const priorityLeaves = state.priorityPlayerId !== null && leavingIds.has(state.priorityPlayerId);
  const oldPrioritySeat = state.priorityPlayerId === null ? undefined : leavingSeats.get(state.priorityPlayerId);
  const nextPriority = priorityLeaves && oldPrioritySeat !== undefined
    ? nextLivingPlayerAfterSeat(players, oldPrioritySeat)?.id ?? null
    : state.priorityPlayerId;
  const result = alive.length === 0
    ? { type: "draw" as const }
    : alive.length === 1
      ? { type: "win" as const, winnerId: alive[0]!.id }
      : null;

  return {
    ...state,
    revision: state.revision + 1,
    players,
    cards,
    stack: state.stack.filter(item =>
      !leavingIds.has(item.controller_id) &&
      !(item.source_instance_id && (removedCardIds.has(item.source_instance_id) || exiledIds.has(item.source_instance_id)))
    ),
    activePlayerId: state.activePlayerId !== null && leavingIds.has(state.activePlayerId) ? null : state.activePlayerId,
    priorityPlayerId: result ? null : nextPriority,
    consecutivePasses: state.consecutivePasses.filter(id => !leavingIds.has(id)),
    awaitingResolutionId: null,
    priorityWindowClosed: false,
    status: result ? "finished" : state.status,
    result
  };
}

/** Checks the supported multiplayer loss-based state actions at a priority checkpoint. */
export function applyStateBasedActions(state: GameState): GameState {
  if (state.status !== "active") return state;
  const leaving = new Set(state.players.filter(player =>
    !player.isEliminated && (
      player.life <= 0 ||
      player.attemptedEmptyLibraryDraw ||
      Object.values(player.commanderDamageReceived).some(total => total >= 21)
    )
  ).map(player => player.id));
  if (leaving.size === 0) return state;
  return eliminatePlayers(state, leaving);
}
