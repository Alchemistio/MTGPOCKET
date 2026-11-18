import type { GameState, InstanceId, PlayerId, Zone } from "./model.js";
import type { ZoneChangeReplacementSession } from "./zone-change-replacements.js";

/**
 * Normalized, face-specific characteristics supplied by the card-data layer.
 * This is deliberately data-only: it does not parse Oracle text or apply layers.
 */
export interface PermanentCharacteristics {
  readonly name: string;
  readonly faceIndex: number | null;
  readonly supertypes: readonly string[];
  readonly cardTypes: readonly string[];
  readonly subtypes: readonly string[];
  readonly colors: readonly string[];
  readonly colorIdentity: readonly string[];
  readonly manaCost: string | null;
  readonly manaValue: number;
  readonly power: string | null;
  readonly toughness: string | null;
  readonly loyalty: string | null;
  readonly defense: string | null;
  readonly oracleText: string;
}

export interface BattlefieldCharacteristicsInput {
  readonly instanceId: InstanceId;
  readonly characteristics: PermanentCharacteristics;
}

export interface EnteringPermanentCharacteristicsContext {
  /** Revision guard: this context is invalid after any game-state mutation. */
  readonly stateRevision: number;
  readonly entrant: {
    readonly instanceId: InstanceId;
    readonly controllerId: PlayerId;
    readonly fromZone: Zone;
    readonly characteristics: PermanentCharacteristics;
    /** Entry replacements already selected for this proposed event. */
    readonly entersTapped: boolean;
    readonly entersWithP1P1Counters: number;
  };
  /** Current battlefield, excluding the entrant, in player/seat order. */
  readonly existingBattlefield: readonly {
    readonly instanceId: InstanceId;
    readonly controllerId: PlayerId;
    readonly characteristics: PermanentCharacteristics;
  }[];
}

/**
 * Builds the explicit input boundary for a CR 614.12 "as it would enter" evaluation.
 * Callers must supply face-specific characteristics for the entrant and every
 * current battlefield permanent. This function validates and snapshots inputs;
 * it intentionally does not claim to evaluate continuous-effect layers.
 */
export function createEnteringPermanentCharacteristicsContext(
  state: GameState,
  session: ZoneChangeReplacementSession,
  entrantCharacteristics: PermanentCharacteristics,
  battlefieldInputs: readonly BattlefieldCharacteristicsInput[]
): EnteringPermanentCharacteristicsContext {
  if (state.revision !== session.stateRevision) {
    throw new Error("STALE_ZONE_CHANGE_REPLACEMENT_SESSION");
  }
  const proposal = session.proposal;
  if (proposal.toZone !== "battlefield") {
    throw new Error("ENTERING_CHARACTERISTICS_REQUIRE_BATTLEFIELD_DESTINATION");
  }
  const entrant = state.cards[proposal.instanceId];
  if (!entrant || entrant.zone !== proposal.fromZone) {
    throw new Error("ENTERING_CHARACTERISTICS_ENTRANT_MISMATCH");
  }
  if (!Number.isSafeInteger(proposal.entersWithP1P1Counters ?? 0) ||
      (proposal.entersWithP1P1Counters ?? 0) < 0) {
    throw new Error("INVALID_ENTRY_COUNTER_MODIFIER");
  }

  const expectedIds = state.players.flatMap(player => player.battlefield);
  const inputsById = new Map<InstanceId, PermanentCharacteristics>();
  for (const input of battlefieldInputs) {
    if (inputsById.has(input.instanceId)) {
      throw new Error("DUPLICATE_BATTLEFIELD_CHARACTERISTICS_INPUT");
    }
    const current = state.cards[input.instanceId];
    if (!current || current.zone !== "battlefield") {
      throw new Error("UNKNOWN_BATTLEFIELD_CHARACTERISTICS_SOURCE");
    }
    inputsById.set(input.instanceId, cloneCharacteristics(input.characteristics));
  }
  if (inputsById.size !== expectedIds.length || expectedIds.some(id => !inputsById.has(id))) {
    throw new Error("INCOMPLETE_BATTLEFIELD_CHARACTERISTICS_INPUT");
  }

  return {
    stateRevision: state.revision,
    entrant: {
      instanceId: proposal.instanceId,
      controllerId: proposal.destinationControllerId ?? entrant.controller_id,
      fromZone: proposal.fromZone,
      characteristics: cloneCharacteristics(entrantCharacteristics),
      entersTapped: proposal.entersTapped ?? false,
      entersWithP1P1Counters: proposal.entersWithP1P1Counters ?? 0
    },
    existingBattlefield: expectedIds.map(instanceId => {
      const permanent = state.cards[instanceId]!;
      return {
        instanceId,
        controllerId: permanent.controller_id,
        characteristics: inputsById.get(instanceId)!
      };
    })
  };
}

function cloneCharacteristics(value: PermanentCharacteristics): PermanentCharacteristics {
  return {
    ...value,
    supertypes: [...value.supertypes],
    cardTypes: [...value.cardTypes],
    subtypes: [...value.subtypes],
    colors: [...value.colors],
    colorIdentity: [...value.colorIdentity]
  };
}
