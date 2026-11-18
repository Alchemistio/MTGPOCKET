import type { GameState, StackItem } from "./model.js";
import { EngineError } from "./model.js";
import { getStackTop } from "./stack-engine.js";

export type StackPayloadDecodeResult<Payload> =
  | { ok: true; value: Payload }
  | { ok: false; reason: string };

/** A handler owns payload interpretation and effect semantics, never stack lifecycle. */
export interface StackItemHandler<Payload> {
  decode(payload: unknown): StackPayloadDecodeResult<Payload>;
  resolve(state: GameState, item: StackItem, payload: Payload): GameState;
}

export type StackHandlerRegistry<
  Payloads extends Record<StackItem["kind"], unknown>
> = Partial<{
  [Kind in StackItem["kind"]]: StackItemHandler<Payloads[Kind]>;
}>;

export type StackHandlerExecutionResult =
  | { status: "resolved"; state: GameState }
  | { status: "handler-unavailable"; kind: StackItem["kind"] }
  | { status: "invalid-payload"; kind: StackItem["kind"]; reason: string };

/**
 * Decodes and executes the currently resolving top item.
 * A failed lookup/decode is a no-op: the caller retains the locked stack item
 * and can surface an explicit unsupported/choice state without losing it.
 * Successful handlers must return a new immutable GameState.
 */
export function executeStackItemHandler<
  Payloads extends Record<StackItem["kind"], unknown>
>(
  state: GameState,
  stackItemId: string,
  registry: StackHandlerRegistry<Payloads>
): StackHandlerExecutionResult {
  if (state.awaitingResolutionId !== stackItemId) {
    throw new EngineError("STACK_ITEM_MISMATCH", "Cet objet n'attend pas sa résolution.");
  }
  const top = getStackTop(state);
  if (!top || top.id !== stackItemId) {
    throw new EngineError("STACK_ITEM_MISMATCH", "L'objet demandé n'est pas au sommet de la pile.");
  }

  // The mapped registry preserves per-kind payload types for registration.
  // At dispatch time the discriminant selects the matching decoder/handler.
  const handler = registry[top.kind] as StackItemHandler<unknown> | undefined;
  if (!handler) return { status: "handler-unavailable", kind: top.kind };

  const decoded = handler.decode(top.payload);
  if (!decoded.ok) {
    return { status: "invalid-payload", kind: top.kind, reason: decoded.reason };
  }

  return {
    status: "resolved",
    state: handler.resolve(state, top, decoded.value)
  };
}
