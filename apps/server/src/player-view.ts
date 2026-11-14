import type { GameState, RuntimeCardState } from "@commander-pocket/game-engine";
import type { CardDefinition } from "@commander-pocket/card-data";

export interface HandCardView {
  instanceId: string;
  cardId: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  oracleText: string;
  layout: string;
  isCommander: boolean;
  isSupportedSpell: boolean;
}

export interface PlayerGameView {
  id: string;
  name: string;
  seat: number;
  life: number;
  maxHandSize: number;
  handCount: number;
  hand: readonly string[];
  handCards: readonly HandCardView[];
  hasKeptHand: boolean;
  pendingBottomCount: number;
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
  status: GameState["status"];
  spellCastingAvailable: boolean;
  activePlayerId: string | null;
  activePlayerSeat: number;
  result: GameState["result"];
  turnNumber: number;
  phase: GameState["phase"];
  step: GameState["step"];
  priorityPlayerId: string | null;
  stack: GameState["stack"];
  awaitingResolutionId: string | null;
  pendingDiscardPlayerId: string | null;
  pendingDiscardCount: number;
  pendingCommanderChoiceCount: number;
  pendingCommanderChoices: readonly { instanceId: string; fromZone: "graveyard" | "exile" }[];
  players: readonly PlayerGameView[];
  visibleCards: Readonly<Record<string, RuntimeCardState>>;
}

/** Hides opponents' hand identities and every library's card order/content. */
export function toPlayerView(state: GameState, viewerId: string, resolveCard?: (cardId: string) => CardDefinition | undefined, spellCastingAvailable = false, supportsSpell?: (definition: CardDefinition) => boolean): GameView {
  const viewer = state.players.find(player => player.id === viewerId);
  if (!viewer) throw new Error("UNKNOWN_VIEWER");
  const players = state.players.map(player => ({
    id: player.id,
    name: player.name,
    seat: player.seat,
    life: player.life,
    maxHandSize: player.maxHandSize,
    handCount: player.hand.length,
    hand: player.id === viewerId ? [...player.hand] : [],
    handCards: player.id === viewerId ? player.hand.flatMap(instanceId => {
      const runtimeCard = state.cards[instanceId];
      if (!runtimeCard) return [];
      const definition = resolveCard?.(runtimeCard.card_id);
      const layout = definition?.layout ?? "unknown";
      const manaCost = definition?.manaCost ?? null;
      const typeLine = definition?.typeLine ?? "";
      const oracleText = definition?.oracleText ?? "";
      const symbols = manaCost?.match(/\{[^{}]+\}/g) ?? [];
      const simpleManaCost = manaCost !== null && symbols.join("") === manaCost &&
        symbols.every(symbol => /^\{(?:\d+|[WUBRGC])\}$/.test(symbol));
      const isSupportedSpell = Boolean(definition && !runtimeCard.is_commander && layout === "normal" &&
        (/\bInstant\b/.test(typeLine) || /\bSorcery\b/.test(typeLine)) &&
        !/\btarget\b/i.test(oracleText) && simpleManaCost && (!supportsSpell || supportsSpell(definition)));
      return [{
        instanceId, cardId: runtimeCard.card_id, name: definition?.name ?? runtimeCard.card_id,
        manaCost, typeLine, oracleText, layout, isCommander: runtimeCard.is_commander, isSupportedSpell
      }];
    }) : [],
    hasKeptHand: player.hasKeptHand,
    pendingBottomCount: player.pendingBottomCount,
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
    id: state.id, revision: state.revision, status: state.status, spellCastingAvailable: spellCastingAvailable && Boolean(resolveCard), activePlayerId: state.activePlayerId,
    activePlayerSeat: state.activePlayerSeat, result: state.result,
    turnNumber: state.turnNumber, phase: state.phase, step: state.step,
    priorityPlayerId: state.priorityPlayerId, stack: [...state.stack],
    awaitingResolutionId: state.awaitingResolutionId,
    pendingDiscardPlayerId: state.pendingDiscardPlayerId,
    pendingDiscardCount: state.pendingDiscardCount,
    pendingCommanderChoiceCount: state.pendingCommanderChoices.length,
    pendingCommanderChoices: state.pendingCommanderChoices.filter(choice => choice.ownerId === viewerId).map(({ instanceId, fromZone }) => ({ instanceId, fromZone })),
    players, visibleCards
  };
}
