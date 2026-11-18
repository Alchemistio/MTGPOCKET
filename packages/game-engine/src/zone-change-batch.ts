import { moveCardToZone } from "./cards.js";
import type { GameState, InstanceId, PlayerId, Zone } from "./model.js";
import { createZoneChangeEvent, type ZoneChangeCause, type ZoneChangeEvent } from "./zone-events.js";
export interface ZoneChangeRequest { instanceId: InstanceId; destination: Zone; destinationControllerId?: PlayerId; commanderReplacementChoice?: "command" | "destination"; entersTapped?: boolean; entersWithP1P1Counters?: number; }
export interface ZoneChangeBatchContext { eventGroupId: string; cause: ZoneChangeCause; }
export interface ZoneChangeBatchResult { state: GameState; events: readonly ZoneChangeEvent[]; }
export interface SingleZoneChangeContext { eventId: string; cause: ZoneChangeCause; replacementTrace?: readonly string[]; }
export interface SingleZoneChangeResult { state: GameState; event: ZoneChangeEvent | null; }
export function moveCardToZoneWithEvent(state: GameState, request: ZoneChangeRequest, context: SingleZoneChangeContext): SingleZoneChangeResult {
  if (!context.eventId.trim()) throw new Error("ZONE_CHANGE_EVENT_ID_REQUIRED");
  const before = state.cards[request.instanceId];
  if (!before) throw new Error("ZONE_CHANGE_INSTANCE_NOT_FOUND");
  let next = moveCardToZone(state, request.instanceId, request.destination, request.destinationControllerId, request.commanderReplacementChoice);
  if (next.cards[request.instanceId]?.zone === "battlefield" &&
      (request.entersTapped || (request.entersWithP1P1Counters ?? 0) > 0)) {
    const entered = next.cards[request.instanceId]!;
    const p1p1 = request.entersWithP1P1Counters ?? 0;
    if (!Number.isSafeInteger(p1p1) || p1p1 < 0) throw new Error("INVALID_ENTRY_COUNTER_MODIFIER");
    next = { ...next, cards: { ...next.cards, [request.instanceId]: {
      ...entered,
      is_tapped: request.entersTapped ? true : entered.is_tapped,
      counters: { ...entered.counters, p1p1: entered.counters.p1p1 + p1p1 }
    } } };
  }
  const after = next.cards[request.instanceId];
  if (!after) throw new Error("ZONE_CHANGE_INSTANCE_NOT_FOUND");
  return { state: next, event: createZoneChangeEvent(before, after, {
    eventId: context.eventId, cause: context.cause,
    ...(context.replacementTrace === undefined ? {} : { replacementTrace: context.replacementTrace })
  }) };
}
export function moveCardsToZoneSimultaneously(state: GameState, requests: readonly ZoneChangeRequest[], context: ZoneChangeBatchContext): ZoneChangeBatchResult {
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
  for (const request of requests) next = moveCardToZone(next, request.instanceId, request.destination, request.destinationControllerId, request.commanderReplacementChoice);
  const events: ZoneChangeEvent[] = [];
  for (const request of requests) {
    const before = beforeById.get(request.instanceId), after = next.cards[request.instanceId];
    if (!before || !after) throw new Error("ZONE_CHANGE_INSTANCE_NOT_FOUND");
    const event = createZoneChangeEvent(before, after, {
      eventId: context.eventGroupId + ":" + request.instanceId, simultaneousGroupId: context.eventGroupId, cause: context.cause
    });
    if (event) events.push(event);
  }
  return { state: next, events };
}
