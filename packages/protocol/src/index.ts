export interface GameCommandEnvelope<TPayload = unknown> {
  protocolVersion: 1;
  gameId: string;
  commandId: string;
  playerId: string;
  expectedRevision: number;
  type: string;
  payload: TPayload;
}

export interface GameEventEnvelope<TPayload = unknown> {
  protocolVersion: 1;
  gameId: string;
  revision: number;
  eventId: string;
  type: string;
  payload: TPayload;
}

export type CommandRejectionCode =
  | "UNAUTHENTICATED" | "UNKNOWN_SEAT" | "STALE_REVISION"
  | "ILLEGAL_ACTION" | "DUPLICATE_COMMAND" | "GAME_FINISHED";
