export type PlayerId = string;
export type InstanceId = string;
export type Zone = "library" | "hand" | "battlefield" | "graveyard" | "exile" | "stack" | "command";
export type Phase = "beginning" | "precombat-main" | "combat" | "postcombat-main" | "ending";
export type Step = "untap" | "upkeep" | "draw" | "main-1" | "begin-combat" | "declare-attackers" | "declare-blockers" | "combat-damage" | "end-combat" | "main-2" | "end" | "cleanup";

export interface CounterSet {
  p1p1: number;
  m1m1: number;
  shield: number;
  custom: Readonly<Record<string, number>>;
}

export interface RuntimeCardState {
  instance_id: InstanceId;
  card_id: string;
  owner_id: PlayerId;
  controller_id: PlayerId;
  zone: Zone;
  is_tapped: boolean;
  counters: CounterSet;
  attached_to: InstanceId | null;
  damage_marked: number;
  is_commander: boolean;
  commanderReturnEligibleAtRevision: number | null;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  seat: number;
  life: number;
  maxHandSize: number;
  hand: InstanceId[];
  library: InstanceId[];
  graveyard: InstanceId[];
  exile: InstanceId[];
  battlefield: InstanceId[];
  command: InstanceId[];
  commanderCastCount: Readonly<Record<string, number>>;
  commanderDamageReceived: Readonly<Record<InstanceId, number>>;
  manaPool: Readonly<Record<string, number>>;
  landsPlayedThisTurn: number;
  isEliminated: boolean;
  attemptedEmptyLibraryDraw: boolean;
  mulliganCount: number;
  pendingBottomCount: number;
  hasKeptHand: boolean;
}

import type { ZoneChangeReplacementSession } from "./zone-change-replacements.js";

export interface StackItem {
  id: string;
  controller_id: PlayerId;
  source_instance_id: InstanceId | null;
  kind: "spell" | "activated-ability" | "triggered-ability" | "copy";
  payload: unknown;
}

/** Serializable candidate group for one controller's APNAP trigger-order choice. */
export interface PendingTriggerOrderGroup {
  controllerId: PlayerId;
  /** Candidate objects are retained as snapshots even if their sources later leave the battlefield. */
  candidateStackItems: readonly StackItem[];
  /** Order in which this controller puts its objects onto the stack (bottom to top). */
  orderedStackItemIds: readonly string[] | null;
}

/** Serializable, server-owned trigger batch awaiting per-controller ordering decisions. */
export interface PendingTriggerBatch {
  id: string;
  activePlayerId: PlayerId;
  createdAtRevision: number;
  /** Groups are in APNAP order; only groups with at least one candidate are present. */
  groups: readonly PendingTriggerOrderGroup[];
}

export interface PendingZoneChangeChoice {
  id: string;
  chooserPlayerId: PlayerId;
  stackItemId: string;
  sourceInstanceId: InstanceId;
  cardId: string;
  eventId: string;
  session: ZoneChangeReplacementSession;
  candidateEffectIds: readonly string[];
}

export interface GameState {
  id: string;
  revision: number;
  players: PlayerState[];
  cards: Readonly<Record<InstanceId, RuntimeCardState>>;
  activePlayerId: PlayerId | null;
  activePlayerSeat: number;
  result: { type: "win"; winnerId: PlayerId } | { type: "draw" } | null;
  deckSetupComplete: boolean;
  pendingDiscardPlayerId: PlayerId | null;
  pendingDiscardCount: number;
  pendingCommanderChoices: Array<{ instanceId: InstanceId; ownerId: PlayerId; fromZone: "graveyard" | "exile" }>;
  pendingZoneChangeChoice: PendingZoneChangeChoice | null;
  turnNumber: number;
  phase: Phase;
  step: Step;
  priorityPlayerId: PlayerId | null;
  consecutivePasses: PlayerId[];
  stack: StackItem[];
  awaitingResolutionId: string | null;
  priorityWindowClosed: boolean;
  status: "pregame" | "active" | "finished";
}

export type EngineErrorCode =
  | "INVALID_PLAYER_COUNT" | "DUPLICATE_PLAYER" | "UNKNOWN_PLAYER" | "PLAYER_ELIMINATED"
  | "NOT_ACTIVE_GAME" | "NOT_PRIORITY_PLAYER" | "RESOLUTION_REQUIRED" | "NO_PENDING_RESOLUTION"
  | "STACK_ITEM_MISMATCH" | "DUPLICATE_CARD_INSTANCE" | "INVALID_ZONE_MOVE" | "INVALID_DAMAGE"
  | "NOT_COMMANDER" | "INVALID_COMMANDER_CAST" | "COMMANDER_CHOICE_REQUIRED" | "INVALID_COMMANDER_CHOICE"
  | "INVALID_MANA_COLOR" | "NOT_CONTROLLER" | "PERMANENT_TAPPED"
  | "INVALID_ACTIVATED_ABILITY" | "UNSUPPORTED_MANA_COST" | "UNSUPPORTED_MANA_SYMBOL" | "INSUFFICIENT_MANA"
  | "INVALID_TRIGGER_BATCH" | "INVALID_TRIGGER_ORDER";

export class EngineError extends Error {
  constructor(public readonly code: EngineErrorCode, message: string) {
    super(message);
    this.name = "EngineError";
  }
}
