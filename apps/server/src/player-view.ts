import type { GameState, RuntimeCardState } from "@commander-pocket/game-engine";

export interface PlayerGameView {
  id: string;
  name: string;
  seat: number;
  life: number;
  handCount: number;
  hand: readonly string[];
  libraryCount: number;
  graveyard: readonly string[];
  exile: readonly string[];
  battlefield: readonly string[];
  command: readonly string[];
  commanderCastCount: Readonly<Record<string, number>>;
  commanderDamageReceived: Readonly<Record<string, number>>;
  manaPool: Readonly<Record<string, number>>;
  isEliminated: boolean;
}

export interface GameView {
  id: string;
  revision: number;
  activePlayerId: string | null;
  activePlayerSeat: number;
  result: GameState["result"];
  turnNumber: number;
  phase: GameState["phase"];
  step: GameState["step"];
  priorityPlayerId: string | null;
  stack: GameState["stack"];
  awaitingResolutionId: string | null;
  players: readonly PlayerGameView[];
  visibleCards: Readonly<Record<string, RuntimeCardState>>;
}

/** Hides opponents' hand identities and every library's card order/content. */
export function toPlayerView(state: GameState, viewerId: string): GameView {
  const viewer = state.players.find(player => player.id === viewerId);
  if (!viewer) throw new Error("UNKNOWN_VIEWER");
  const players = state.players.map(player => ({
    id: player.id,
    name: player.name,
    seat: player.seat,
    life: player.life,
    handCount: player.hand.length,
    hand: player.id === viewerId ? [...player.hand] : [],
    libraryCount: player.library.length,
    graveyard: [...player.graveyard],
    exile: [...player.exile],
    battlefield: [...player.battlefield],
    command: [...player.command],
    commanderCastCount: { ...player.commanderCastCount },
    commanderDamageReceived: { ...player.commanderDamageReceived },
    manaPool: { ...player.manaPool },
    isEliminated: player.isEliminated
  }));
  const visibleIds = new Set<string>();
  for (const player of state.players) {
    for (const id of [...player.battlefield, ...player.graveyard, ...player.exile, ...player.command]) visibleIds.add(id);
    if (player.id === viewerId) for (const id of player.hand) visibleIds.add(id);
  }
  for (const item of state.stack) if (item.source_instance_id) visibleIds.add(item.source_instance_id);
  const visibleCards = Object.fromEntries(
    [...visibleIds].flatMap(id => state.cards[id] ? [[id, state.cards[id] as RuntimeCardState]] : [])
  );
  return {
    id: state.id, revision: state.revision, activePlayerId: state.activePlayerId,
    activePlayerSeat: state.activePlayerSeat, result: state.result,
    turnNumber: state.turnNumber, phase: state.phase, step: state.step,
    priorityPlayerId: state.priorityPlayerId, stack: [...state.stack],
    awaitingResolutionId: state.awaitingResolutionId, players, visibleCards
  };
}
