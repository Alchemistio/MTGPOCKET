import { randomUUID } from "node:crypto";
import {
  addCardInstance, advanceAutomaticStep, chooseMulliganBottomCards, createPregameGame, initializeOpeningHands,
  placeCommandersInCommandZone, resolveMulliganRound, startGame,
  type GameState, type PlayerSetup
} from "@commander-pocket/game-engine";
import {
  validateCommanderDeck,
  type CommanderDeckList, type CommanderDeckValidationOptions, type DeckIssue
} from "@commander-pocket/card-data";
import type { CardDefinition } from "@commander-pocket/card-data";

export type DeckSubmissionResult =
  | { accepted: true; allDecksSubmitted: boolean; revision: number }
  | { accepted: false; code: "UNKNOWN_PLAYER" | "DUPLICATE_SUBMISSION" | "INVALID_DECK"; issues?: readonly DeckIssue[] };

export interface PregameSeedRecord {
  sequence: number;
  purpose: "opening-hand" | "mulligan";
  playerId: string;
  seed: string;
}

export interface PregameCoordinatorCheckpoint {
  schemaVersion: 1;
  gameId: string;
  players: readonly PlayerSetup[];
  state: GameState;
  submittedDecks: readonly { playerId: string; deck: CommanderDeckList }[];
  mulliganDeclarations: readonly { playerId: string; action: "keep" | "mulligan" }[];
  generatedSeeds: readonly PregameSeedRecord[];
}

export interface MulliganProgress {
  roundResolved: boolean;
  readyToStart: boolean;
  pendingBottomByPlayer: Readonly<Record<string, number>>;
}

/**
 * Server-authoritative four-seat setup. The caller supplies a versioned card
 * catalog and Commander eligibility policy; client-provided card text is never trusted.
 */
export class PregameCoordinator {
  private currentState: GameState;
  private readonly submittedDecks = new Map<string, CommanderDeckList>();
  private readonly mulliganDeclarations = new Map<string, "keep" | "mulligan">();
  private readonly generatedSeeds: PregameSeedRecord[] = [];

  constructor(
    gameId: string,
    private readonly players: readonly PlayerSetup[],
    private readonly cardIndex: Readonly<Record<string, CardDefinition>>,
    private readonly validationOptions: CommanderDeckValidationOptions,
    private readonly seedFactory: () => string = randomUUID
  ) {
    this.currentState = createPregameGame(gameId, players);
  }

  get state(): GameState {
    return this.currentState;
  }

  /** A defensive, serializable snapshot of every pregame decision and its RNG material. */
  get checkpoint(): PregameCoordinatorCheckpoint {
    return clone({
      schemaVersion: 1,
      gameId: this.currentState.id,
      players: this.players,
      state: this.currentState,
      submittedDecks: [...this.submittedDecks].map(([playerId, deck]) => ({ playerId, deck })),
      mulliganDeclarations: [...this.mulliganDeclarations].map(([playerId, action]) => ({ playerId, action })),
      generatedSeeds: this.generatedSeeds
    });
  }

  /** Restore only a checkpoint belonging to this exact room and seat configuration. */
  restoreCheckpoint(checkpoint: PregameCoordinatorCheckpoint): void {
    if (!isValidCheckpoint(checkpoint) || checkpoint.gameId !== this.currentState.id ||
        checkpoint.state.id !== this.currentState.id || checkpoint.state.status !== "pregame" ||
        !samePlayers(checkpoint.players, this.players) || !samePlayers(checkpoint.state.players, this.players)) {
      throw new Error("INVALID_PREGAME_CHECKPOINT");
    }
    const playerIds = new Set(this.players.map(player => player.id));
    if (checkpoint.state.deckSetupComplete ||
        checkpoint.submittedDecks.some(item => !item || !playerIds.has(item.playerId) ||
          !validateCommanderDeck(item.deck, this.cardIndex, this.validationOptions).valid) ||
        new Set(checkpoint.submittedDecks.map(item => item.playerId)).size !== checkpoint.submittedDecks.length ||
        checkpoint.mulliganDeclarations.some(item => !item || !playerIds.has(item.playerId) ||
          (item.action !== "keep" && item.action !== "mulligan")) ||
        new Set(checkpoint.mulliganDeclarations.map(item => item.playerId)).size !== checkpoint.mulliganDeclarations.length ||
        checkpoint.generatedSeeds.some((item, index) => !item || item.sequence !== index ||
          !playerIds.has(item.playerId) || (item.purpose !== "opening-hand" && item.purpose !== "mulligan") ||
          typeof item.seed !== "string" || item.seed.trim().length === 0)) {
      throw new Error("INVALID_PREGAME_CHECKPOINT");
    }
    const restored = clone(checkpoint);
    this.currentState = restored.state;
    this.submittedDecks.clear();
    for (const item of restored.submittedDecks) this.submittedDecks.set(item.playerId, item.deck);
    this.mulliganDeclarations.clear();
    for (const item of restored.mulliganDeclarations) this.mulliganDeclarations.set(item.playerId, item.action);
    this.generatedSeeds.splice(0, this.generatedSeeds.length, ...restored.generatedSeeds);
  }

  /** Server-only deterministic replay material; never included in player views. */
  get seedLog(): readonly PregameSeedRecord[] {
    return this.generatedSeeds.map(record => ({ ...record }));
  }

  private createSeeds(purpose: PregameSeedRecord["purpose"], playerIds: readonly string[]) {
    const records = playerIds.map((playerId, index): PregameSeedRecord => ({
      sequence: this.generatedSeeds.length + index,
      purpose,
      playerId,
      seed: this.seedFactory()
    }));
    if (records.some(record => record.seed.trim().length === 0)) {
      throw new Error("INVALID_RANDOM_SEED");
    }
    return {
      records,
      seeds: Object.fromEntries(records.map(record => [record.playerId, record.seed]))
    };
  }

  submitDeck(playerId: string, deck: CommanderDeckList): DeckSubmissionResult {
    if (!this.players.some(player => player.id === playerId)) {
      return { accepted: false, code: "UNKNOWN_PLAYER" };
    }
    if (this.submittedDecks.has(playerId) || this.currentState.deckSetupComplete) {
      return { accepted: false, code: "DUPLICATE_SUBMISSION" };
    }

    const validation = validateCommanderDeck(deck, this.cardIndex, this.validationOptions);
    if (!validation.valid) {
      return { accepted: false, code: "INVALID_DECK", issues: validation.issues };
    }

    // Build against a local copy so a failed final setup cannot partially mutate the room.
    let next = this.currentState;
    const quantities = new Map<string, number>();
    for (const entry of deck.cards) quantities.set(entry.cardId, (quantities.get(entry.cardId) ?? 0) + entry.quantity);
    for (const [cardId, quantity] of quantities) {
      const definition = this.cardIndex[cardId];
      if (!definition) return { accepted: false, code: "INVALID_DECK", issues: [{ code: "UNKNOWN_CARD", cardId, message: "Carte absente du catalogue serveur." }] };
      for (let copy = 0; copy < quantity; copy += 1) {
        next = addCardInstance(next, {
          instance_id: `${playerId}:${cardId}:${copy}`, card_id: definition.providerId, owner_id: playerId, zone: "library"
        });
      }
    }

    const nextDecks = new Map(this.submittedDecks);
    nextDecks.set(playerId, deck);
    if (nextDecks.size === this.players.length) {
      const commandersByPlayer: Record<string, string[]> = {};
      for (const player of this.players) {
        const submitted = nextDecks.get(player.id);
        if (!submitted) throw new Error("MISSING_PLAYER_DECK");
        commandersByPlayer[player.id] = submitted.commanderIds.map(cardId => {
          const instance = submitted.cards.some(entry => entry.cardId === cardId && entry.quantity > 0)
            ? `${player.id}:${cardId}:0`
            : undefined;
          if (!instance) throw new Error("COMMANDER_INSTANCE_MISSING");
          return instance;
        });
      }
      next = placeCommandersInCommandZone(next, commandersByPlayer);
      const generated = this.createSeeds("opening-hand", this.players.map(player => player.id));
      next = initializeOpeningHands(next, generated.seeds);
      this.generatedSeeds.push(...generated.records);
    }

    this.currentState = next;
    this.submittedDecks.set(playerId, clone(deck));
    return { accepted: true, allDecksSubmitted: nextDecks.size === this.players.length, revision: next.revision };
  }

  declareMulligan(playerId: string, action: "keep" | "mulligan"): MulliganProgress {
    if (this.submittedDecks.size !== this.players.length) throw new Error("DECKS_NOT_READY");
    const player = this.currentState.players.find(item => item.id === playerId);
    if (!player) throw new Error("UNKNOWN_PLAYER");
    if (player.hasKeptHand || player.pendingBottomCount > 0) throw new Error("PLAYER_NOT_READY_TO_DECLARE");
    if (this.mulliganDeclarations.has(playerId)) throw new Error("DUPLICATE_MULLIGAN_DECLARATION");

    this.mulliganDeclarations.set(playerId, action);
    const waiting = this.currentState.players.filter(item => !item.hasKeptHand);
    if (waiting.some(item => !this.mulliganDeclarations.has(item.id))) {
      return this.progress(false);
    }

    const decisions = waiting.map(item => ({
      playerId: item.id,
      action: this.mulliganDeclarations.get(item.id) as "keep" | "mulligan"
    }));
    const mulliganPlayerIds = decisions
      .filter(decision => decision.action === "mulligan")
      .map(decision => decision.playerId);
    const generated = this.createSeeds("mulligan", mulliganPlayerIds);
    const result = resolveMulliganRound(this.currentState, decisions, generated.seeds);
    this.currentState = result.state;
    this.generatedSeeds.push(...generated.records);
    this.mulliganDeclarations.clear();
    return this.progress(true);
  }

  chooseBottomCards(playerId: string, instanceIds: readonly string[]): MulliganProgress {
    this.currentState = chooseMulliganBottomCards(this.currentState, playerId, instanceIds);
    return this.progress(false);
  }

  start(): GameState {
    this.currentState = advanceAutomaticStep(startGame(this.currentState));
    return this.currentState;
  }

  /** Rolls back only the state transition when durable room persistence fails. */
  restoreStateAfterFailedStart(state: GameState): void {
    if (state.id !== this.currentState.id || state.status !== "pregame") {
      throw new Error("INVALID_PREGAME_ROLLBACK");
    }
    this.currentState = state;
  }

  private progress(roundResolved: boolean): MulliganProgress {
    return {
      roundResolved,
      readyToStart: this.currentState.players.every(player => player.hasKeptHand && player.pendingBottomCount === 0),
      pendingBottomByPlayer: Object.fromEntries(this.currentState.players
        .filter(player => player.pendingBottomCount > 0)
        .map(player => [player.id, player.pendingBottomCount]))
    };
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function samePlayers(left: readonly PlayerSetup[], right: readonly PlayerSetup[]): boolean {
  return left.length === right.length && left.every((player, index) => {
    const other = right[index];
    return other !== undefined && player.id === other.id && player.name === other.name && player.seat === other.seat;
  });
}

function isValidCheckpoint(value: unknown): value is PregameCoordinatorCheckpoint {
  if (typeof value !== "object" || value === null) return false;
  const checkpoint = value as Partial<PregameCoordinatorCheckpoint>;
  return checkpoint.schemaVersion === 1 && typeof checkpoint.gameId === "string" &&
    Array.isArray(checkpoint.players) && typeof checkpoint.state === "object" && checkpoint.state !== null &&
    Array.isArray(checkpoint.submittedDecks) && Array.isArray(checkpoint.mulliganDeclarations) &&
    Array.isArray(checkpoint.generatedSeeds);
}
