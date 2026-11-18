import { EngineError, type GameState, type StackItem } from "./model.js";

/**
 * One atomic 704 state-based-action event. Trigger snapshots are reported by
 * the rules adapter while it applies that event; this runner never guesses
 * which cards or abilities should trigger.
 */
export interface StateBasedActionPassResult {
  readonly state: GameState;
  readonly performed: boolean;
  /** Triggers whose triggering condition is not another ability triggering on the stack. */
  readonly ordinaryTriggers: readonly StackItem[];
  /** Triggers whose triggering condition is another ability triggering on the stack. */
  readonly stackTriggers: readonly StackItem[];
}

export interface StateBasedActionCheckpointResult {
  readonly state: GameState;
  readonly ordinaryTriggers: readonly StackItem[];
  readonly stackTriggers: readonly StackItem[];
  /** Number of atomic SBA events actually performed. */
  readonly passes: number;
}

export type StateBasedActionPass = (state: GameState) => StateBasedActionPassResult;

/**
 * Repeats atomic SBA events until the adapter reports that none were performed.
 *
 * The two trigger classes remain separate for CR 603.3b's two APNAP placement
 * passes. No triggers are put on the stack and priority is never granted here.
 * The adapter must be deterministic and side-effect-free; all mutations are
 * represented by returned GameState snapshots.
 */
export function runStateBasedActionCheckpoint(
  initialState: GameState,
  applyOnePass: StateBasedActionPass,
  maxPasses = 256
): StateBasedActionCheckpointResult {
  if (!Number.isSafeInteger(maxPasses) || maxPasses < 1) {
    throw new EngineError("INVALID_SBA_CHECKPOINT", "La limite de passes SBA doit être un entier positif.");
  }

  let state = initialState;
  let passes = 0;
  const ordinaryTriggers: StackItem[] = [];
  const stackTriggers: StackItem[] = [];
  const seenTriggerIds = new Set<string>();

  const collect = (items: readonly StackItem[], target: StackItem[]) => {
    for (const item of items) {
      if (item.kind !== "triggered-ability" || !item.id.trim() || seenTriggerIds.has(item.id)) {
        throw new EngineError("INVALID_SBA_CHECKPOINT", "Le checkpoint contient un trigger invalide ou dupliqué.");
      }
      seenTriggerIds.add(item.id);
      target.push({ ...item });
    }
  };

  while (passes < maxPasses) {
    const result = applyOnePass(state);
    if (!result || !Array.isArray(result.ordinaryTriggers) || !Array.isArray(result.stackTriggers)) {
      throw new EngineError("INVALID_SBA_CHECKPOINT", "Résultat de passe SBA invalide.");
    }

    if (!result.performed) {
      if (result.state !== state || result.ordinaryTriggers.length > 0 || result.stackTriggers.length > 0) {
        throw new EngineError("INVALID_SBA_CHECKPOINT", "Une passe SBA stable ne peut ni modifier l'état ni produire de trigger.");
      }
      return {
        state,
        ordinaryTriggers,
        stackTriggers,
        passes
      };
    }

    if (result.state === state || result.state.id !== state.id || result.state.revision <= state.revision) {
      throw new EngineError("INVALID_SBA_CHECKPOINT", "Une passe SBA effectuée doit produire un nouvel état de partie et une révision croissante.");
    }

    collect(result.ordinaryTriggers, ordinaryTriggers);
    collect(result.stackTriggers, stackTriggers);
    state = result.state;
    passes += 1;
  }

  throw new EngineError("INVALID_SBA_CHECKPOINT", "Le checkpoint SBA a dépassé sa limite de sécurité sans se stabiliser.");
}
