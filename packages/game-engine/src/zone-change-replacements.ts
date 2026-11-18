import type { GameState, InstanceId, PlayerId, RuntimeCardState, Zone } from "./model.js";
import { moveCardToZoneWithEvent, type SingleZoneChangeContext, type SingleZoneChangeResult } from "./zone-change-batch.js";

export type ZoneChangeReplacementKind = "self" | "control" | "copy" | "face-down" | "general";
const KIND_ORDER: readonly ZoneChangeReplacementKind[] = ["self", "control", "copy", "face-down", "general"];

export interface ZoneChangeProposal {
  readonly instanceId: InstanceId;
  readonly fromZone: Zone;
  readonly toZone: Zone;
  readonly destinationControllerId?: PlayerId;
  readonly entersTapped?: boolean;
  readonly entersWithP1P1Counters?: number;
  readonly lastKnownInfo: RuntimeCardState;
}
export interface ZoneChangeReplacementEffect {
  readonly id: string;
  readonly kind: ZoneChangeReplacementKind;
  readonly controllerId: PlayerId;
  applies(proposal: ZoneChangeProposal, state: GameState): boolean;
  replace(proposal: ZoneChangeProposal, state: GameState): ZoneChangeProposal | null;
}
export interface ZoneChangeReplacementSession {
  readonly stateRevision: number;
  readonly proposal: ZoneChangeProposal;
  readonly appliedEffectIds: readonly string[];
  readonly replacementTrace: readonly string[];
}
export type ZoneChangeReplacementEvaluation =
  | { status: "choice-required"; session: ZoneChangeReplacementSession; candidates: readonly ZoneChangeReplacementEffect[] }
  | { status: "ready"; session: ZoneChangeReplacementSession }
  | { status: "prevented"; session: ZoneChangeReplacementSession; preventedBy: string };
export interface CommitReplacedZoneChangeContext extends SingleZoneChangeContext {
  commanderReplacementChoice?: "command" | "destination";
}
export type CommitReplacedZoneChangeResult =
  | { status: "prevented"; state: GameState; event: null; replacementTrace: readonly string[] }
  | { status: "committed"; state: GameState; event: SingleZoneChangeResult["event"]; replacementTrace: readonly string[] };

export function createZoneChangeReplacementSession(
  state: GameState, instanceId: InstanceId, toZone: Zone, destinationControllerId?: PlayerId
): ZoneChangeReplacementSession {
  const card = state.cards[instanceId];
  if (!card) throw new Error("ZONE_CHANGE_INSTANCE_NOT_FOUND");
  return {
    stateRevision: state.revision,
    proposal: {
      instanceId, fromZone: card.zone, toZone,
      ...(destinationControllerId === undefined ? {} : { destinationControllerId }),
      lastKnownInfo: snapshotCard(card)
    },
    appliedEffectIds: [], replacementTrace: []
  };
}

/** CR 616.1 category order; every application is followed by a fresh applicability pass. */
export function evaluateZoneChangeReplacements(
  state: GameState, session: ZoneChangeReplacementSession,
  effects: readonly ZoneChangeReplacementEffect[], selectedEffectId?: string
): ZoneChangeReplacementEvaluation {
  if (state.revision !== session.stateRevision) throw new Error("STALE_ZONE_CHANGE_REPLACEMENT_SESSION");
  const ids = effects.map(effect => effect.id);
  if (ids.some(id => id.trim().length === 0) || new Set(ids).size !== ids.length) {
    throw new Error("INVALID_OR_DUPLICATE_ZONE_CHANGE_REPLACEMENT_ID");
  }
  let current = session;
  let selection = selectedEffectId;
  while (true) {
    const applied = new Set(current.appliedEffectIds);
    const applicable = effects.filter(effect => !applied.has(effect.id) && effect.applies(current.proposal, state));
    const firstKind = KIND_ORDER.find(kind => applicable.some(effect => effect.kind === kind));
    const candidates = firstKind ? applicable.filter(effect => effect.kind === firstKind) : [];
    if (candidates.length === 0) {
      if (selection !== undefined) throw new Error("ZONE_CHANGE_REPLACEMENT_CHOICE_NOT_AVAILABLE");
      return { status: "ready", session: current };
    }
    let chosen: ZoneChangeReplacementEffect;
    if (candidates.length === 1) {
      chosen = candidates[0]!;
      if (selection !== undefined && selection !== chosen.id) throw new Error("INVALID_ZONE_CHANGE_REPLACEMENT_CHOICE");
    } else {
      if (selection === undefined) return { status: "choice-required", session: current, candidates };
      const match = candidates.find(effect => effect.id === selection);
      if (!match) throw new Error("INVALID_ZONE_CHANGE_REPLACEMENT_CHOICE");
      chosen = match;
    }
    selection = undefined;
    const nextProposal = chosen.replace(current.proposal, state);
    const appliedEffectIds = [...current.appliedEffectIds, chosen.id];
    const replacementTrace = [...current.replacementTrace, chosen.id];
    if (nextProposal === null) {
      return { status: "prevented", session: { ...current, appliedEffectIds, replacementTrace }, preventedBy: chosen.id };
    }
    if (nextProposal.instanceId !== current.proposal.instanceId || nextProposal.fromZone !== current.proposal.fromZone) {
      throw new Error("ZONE_CHANGE_REPLACEMENT_CHANGED_EVENT_IDENTITY");
    }
    current = { ...current, proposal: nextProposal, appliedEffectIds, replacementTrace };
  }
}

/** Only a ready proposal may commit; prevented events emit no ZoneChangeEvent. */
export function commitReplacedZoneChange(
  state: GameState, evaluation: ZoneChangeReplacementEvaluation, context: CommitReplacedZoneChangeContext
): CommitReplacedZoneChangeResult {
  if (evaluation.status === "choice-required") throw new Error("ZONE_CHANGE_REPLACEMENT_CHOICE_REQUIRED");
  if (state.revision !== evaluation.session.stateRevision) throw new Error("STALE_ZONE_CHANGE_REPLACEMENT_SESSION");
  if (evaluation.status === "prevented") {
    return { status: "prevented", state, event: null, replacementTrace: evaluation.session.replacementTrace };
  }
  const proposal = evaluation.session.proposal;
  const result = moveCardToZoneWithEvent(state, {
    instanceId: proposal.instanceId, destination: proposal.toZone,
    ...(proposal.destinationControllerId === undefined ? {} : { destinationControllerId: proposal.destinationControllerId }),
    ...(context.commanderReplacementChoice === undefined ? {} : { commanderReplacementChoice: context.commanderReplacementChoice }),
    ...(proposal.entersTapped === undefined ? {} : { entersTapped: proposal.entersTapped }),
    ...(proposal.entersWithP1P1Counters === undefined ? {} : { entersWithP1P1Counters: proposal.entersWithP1P1Counters })
  }, {
    eventId: context.eventId, cause: context.cause, replacementTrace: evaluation.session.replacementTrace
  });
  return { status: "committed", state: result.state, event: result.event, replacementTrace: evaluation.session.replacementTrace };
}
function snapshotCard(card: RuntimeCardState): RuntimeCardState {
  return { ...card, counters: { ...card.counters, custom: { ...card.counters.custom } } };
}

export type ZoneChangePipelineResult =
  | { status: "choice-required"; state: GameState; session: ZoneChangeReplacementSession; candidates: readonly ZoneChangeReplacementEffect[] }
  | CommitReplacedZoneChangeResult;

/**
 * End-to-end single-event entry point: propose -> evaluate replacements -> commit.
 * A choice-required result is deliberately non-mutating and can be resumed by the caller.
 */
/**
 * Resumes an existing proposal after a player has selected one applicable replacement.
 * The caller must retain the returned session when another choice is required.
 */
export function resumeZoneChangeWithReplacements(
  state: GameState,
  session: ZoneChangeReplacementSession,
  effects: readonly ZoneChangeReplacementEffect[],
  context: CommitReplacedZoneChangeContext,
  selectedEffectId?: string
): ZoneChangePipelineResult {
  const evaluation = evaluateZoneChangeReplacements(state, session, effects, selectedEffectId);
  if (evaluation.status === "choice-required") {
    return { status: "choice-required", state, session: evaluation.session, candidates: evaluation.candidates };
  }
  return commitReplacedZoneChange(state, evaluation, context);
}

/**
 * End-to-end single-event entry point: propose -> evaluate replacements -> commit.
 * A choice-required result is deliberately non-mutating and can be resumed by the caller.
 */
export function processZoneChangeWithReplacements(
  state: GameState,
  request: { instanceId: InstanceId; destination: Zone; destinationControllerId?: PlayerId },
  effects: readonly ZoneChangeReplacementEffect[],
  context: CommitReplacedZoneChangeContext,
  selectedEffectId?: string
): ZoneChangePipelineResult {
  const session = createZoneChangeReplacementSession(
    state, request.instanceId, request.destination, request.destinationControllerId
  );
  return resumeZoneChangeWithReplacements(state, session, effects, context, selectedEffectId);
}
