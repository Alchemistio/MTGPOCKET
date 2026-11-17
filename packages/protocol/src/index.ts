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

export type PregameClientMessage =
  | { type: "pregame-submit-deck"; deck: { commanderIds: string[]; cards: { cardId: string; quantity: number }[] } }
  | { type: "pregame-mulligan"; action: "keep" | "mulligan" }
  | { type: "pregame-bottom"; instanceIds: string[] }
  | { type: "pregame-start" };

export interface PregameServerMessage {
  type: "pregame-result";
  accepted: boolean;
  code?: string;
  result?: unknown;
  revision?: number;
  view?: unknown;
}

export type CommandRejectionCode =
  | "UNAUTHENTICATED" | "UNKNOWN_SEAT" | "STALE_REVISION"
  | "ILLEGAL_ACTION" | "DUPLICATE_COMMAND" | "GAME_FINISHED";
