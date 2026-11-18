import type { RuntimeCardState, Zone } from "./model.js";
export type ZoneChangeCause = "spell-resolution" | "land-play" | "effect" | "state-based-action" | "commander-replacement" | "unknown";
export interface ZoneChangeEventContext {
  eventId: string;
  cause: ZoneChangeCause;
  simultaneousGroupId?: string | null;
  replacementTrace?: readonly string[];
}
export interface ZoneChangeEvent {
  eventId: string;
  simultaneousGroupId: string | null;
  instanceBefore: RuntimeCardState;
  instanceAfter: RuntimeCardState;
  fromZone: Zone;
  toZone: Zone;
  ownerId: string;
  controllerBefore: string;
  controllerAfter: string;
  cause: ZoneChangeCause;
  replacementTrace: readonly string[];
  lastKnownInfo: RuntimeCardState;
}
export function createZoneChangeEvent(before: RuntimeCardState, after: RuntimeCardState, context: ZoneChangeEventContext): ZoneChangeEvent | null {
  if (context.eventId.trim().length === 0) throw new Error("ZONE_CHANGE_EVENT_ID_REQUIRED");
  if (before.instance_id !== after.instance_id || before.card_id !== after.card_id || before.owner_id !== after.owner_id) {
    throw new Error("ZONE_CHANGE_INSTANCE_MISMATCH");
  }
  if (before.zone === after.zone) return null;
  return {
    eventId: context.eventId, simultaneousGroupId: context.simultaneousGroupId ?? null,
    instanceBefore: snapshotCard(before), instanceAfter: snapshotCard(after),
    fromZone: before.zone, toZone: after.zone, ownerId: before.owner_id,
    controllerBefore: before.controller_id, controllerAfter: after.controller_id,
    cause: context.cause, replacementTrace: [...(context.replacementTrace ?? [])],
    lastKnownInfo: snapshotCard(before)
  };
}
function snapshotCard(card: RuntimeCardState): RuntimeCardState {
  return { ...card, counters: { ...card.counters, custom: { ...card.counters.custom } } };
}
