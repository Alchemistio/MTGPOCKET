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
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  seat: number;
  life: number;
  hand: InstanceId[];
  library: InstanceId[];
  graveyard: InstanceId[];
  exile: InstanceId[];
  battlefield: InstanceId[];
  command: InstanceId[];
  commanderCastCount: Readonly<Record<string, number>>;
  commanderDamageReceived: Readonly<Record<InstanceId, number>>;
  manaPool: Readonly<Record<string, number>>;
  isEliminated: boolean;
  attemptedEmptyLibraryDraw: boolean;
}

export interface StackItem {
  id: string;
  controller_id: PlayerId;
  source_instance_id: InstanceId | null;
  kind: "spell" | "activated-ability" | "triggered-ability" | "copy";
  payload: unknown;
}

export interface GameState {
  id: string;
  revision: number;
  players: PlayerState[];
  cards: Readonly<Record<InstanceId, RuntimeCardState>>;
  activePlayerId: PlayerId | null;
  activePlayerSeat: number;
  result: { type: "win"; winnerId: PlayerId } | { type: "draw" } | null;
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

export type EngineErrorCode = "INVALID_PLAYER_COUNT" | "DUPLICATE_PLAYER" | "UNKNOWN_PLAYER" | "PLAYER_ELIMINATED" | "NOT_ACTIVE_GAME" | "NOT_PRIORITY_PLAYER" | "RESOLUTION_REQUIRED" | "NO_PENDING_RESOLUTION" | "STACK_ITEM_MISMATCH" | "DUPLICATE_CARD_INSTANCE" | "INVALID_ZONE_MOVE" | "INVALID_DAMAGE" | "NOT_COMMANDER" | "INVALID_COMMANDER_CAST";
export class EngineError extends Error {
  constructor(public readonly code: EngineErrorCode, message: string) {
    super(message);
    this.name = "EngineError";
  }
}
