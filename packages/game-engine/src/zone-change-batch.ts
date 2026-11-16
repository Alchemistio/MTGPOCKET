import { moveCardToZone } from "./cards.js";
import type { GameState, InstanceId, PlayerId, Zone } from "./model.js";
import { createZoneChangeEvent, type ZoneChangeCause, type ZoneChangeEvent } from "./zone-events.js";

export interface ZoneChangeRequest {
  instanceId: InstanceId;
  destination: Zone;
  destinationControllerId?: PlayerId;
  commanderReplacementChoice?: "command" | "destination";
}

export interface ZoneChangeBatchContext {
  /** Stable ID for this logical event group (for replay and diagnostics). */
  eventGroupId: string;
  cause: ZoneChangeCause;
}

export interface ZoneChangeBatchResult {
  state: GameState;
  events: readonly ZoneChangeEvent[];
}

/**
 * Commits a group of independent zone moves as one logical simultaneous event.
 *
 * All before-snapshots are captured from the same pre-event state. The reducer
 * then applies the moves without exposing intermediate states to callers, and
 * emits one event per actual transition with a shared simultaneousGroupId.
 *
 * This is an event-batching primitive, not yet a complete replacement-effect
 * engine. Replacement choices must be resolved before calling this function.
 */
export function moveCardsToZoneSimultaneously(
  state: GameState,
  requests: readonly ZoneChangeRequest[],
  context: ZoneChangeBatchContext
): ZoneChangeBatchResult {
  if (!context.eventGroupId.trim()) throw new Error("ZONE_CHANGE_GROUP_ID_REQUIRED");
  const ids = requests.map(request => request.instanceId);
  if (new Set(ids).size !== ids.length) throw new Error("DUPLICATE_INSTANCE_IN_ZONE_CHANGE_BATCH");

  const beforeById = new Map<InstanceId, GameState["cards"][string]>();
  for (const request of requests) {
    const before = state.cards[request.instanceId];
    if (!before) throw new Error("ZONE_CHANGE_INSTANCE_NOT_FOUND");
    beforeById.set(request.instanceId, before);
  }

  let next = state;
  for (const request of requests) {
    next = moveCardToZone(
      next,
      request.instanceId,
      request.destination,
      request.destinationControllerId,
      request.commanderReplacementChoice
    );
  }

  const events: ZoneChangeEvent[] = [];
  for (const request of requests) {
    const before = beforeById.get(request.instanceId);
    const after = next.cards[request.instanceId];
    if (!before || !after) throw new Error("ZONE_CHANGE_INSTANCE_NOT_FOUND");
    const event = createZoneChangeEvent(before, after, {
      eventId: context.eventGroupId + ":" + request.instanceId,
      simultaneousGroupId: context.eventGroupId,
      cause: context.cause
    });
    if (event) events.push(event);
  }

  return { state: next, events };
}
