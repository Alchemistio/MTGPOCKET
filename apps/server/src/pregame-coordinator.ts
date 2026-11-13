import { randomUUID } from "node:crypto";
import {
  addCardInstance, chooseMulliganBottomCards, createPregameGame, initializeOpeningHands,
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
    const instancesByCard = new Map<string, string[]>();
    for (const entry of deck.cards) {
      const definition = this.cardIndex[entry.cardId];
      if (!definition) return { accepted: false, code: "INVALID_DECK", issues: [{ code: "UNKNOWN_CARD", cardId: entry.cardId, message: "Carte absente du catalogue serveur." }] };
      const ids: string[] = [];
      for (let copy = 0; copy < entry.quantity; copy += 1) {
        const instanceId = `${playerId}:${entry.cardId}:${copy}`;
        next = addCardInstance(next, {
          instance_id: instanceId, card_id: definition.providerId, owner_id: playerId, zone: "library"
        });
        ids.push(instanceId);
      }
      instancesByCard.set(entry.cardId, ids);
    }

    const nextDecks = new Map(this.submittedDecks);
    nextDecks.set(playerId, deck);
    if (nextDecks.size === this.players.length) {
      const commandersByPlayer: Record<string, string[]> = {};
      for (const player of this.players) {
        const submitted = nextDecks.get(player.id);
        if (!submitted) throw new Error("MISSING_PLAYER_DECK");
        const playerInstances = new Map<string, string[]>();
        for (const entry of submitted.cards) {
          playerInstances.set(entry.cardId, Array.from({ length: entry.quantity }, (_, copy) => `${player.id}:${entry.cardId}:${copy}`));
        }
        commandersByPlayer[player.id] = submitted.commanderIds.map(cardId => {
          const instance = playerInstances.get(cardId)?.[0];
          if (!instance) throw new Error("COMMANDER_INSTANCE_MISSING");
          return instance;
        });
      }
      next = placeCommandersInCommandZone(next, commandersByPlayer);
      const seeds = Object.fromEntries(this.players.map(player => [player.id, this.seedFactory()]));
      next = initializeOpeningHands(next, seeds);
    }

    this.currentState = next;
    this.submittedDecks.set(playerId, deck);
    return { accepted: true, allDecksSubmitted: nextDecks.size === this.players.length, revision: next.revision };
  }

  declareMulligan(playerId: string, action: "keep" | "mulligan"): MulliganProgress {
    if (!this.currentState.deckSetupComplete) throw new Error("DECKS_NOT_READY");
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
    const seeds = Object.fromEntries(decisions
      .filter(decision => decision.action === "mulligan")
      .map(decision => [decision.playerId, this.seedFactory()]));
    const result = resolveMulliganRound(this.currentState, decisions, seeds);
    this.currentState = result.state;
    this.mulliganDeclarations.clear();
    return this.progress(true);
  }

  chooseBottomCards(playerId: string, instanceIds: readonly string[]): MulliganProgress {
    this.currentState = chooseMulliganBottomCards(this.currentState, playerId, instanceIds);
    return this.progress(false);
  }

  start(): GameState {
    this.currentState = startGame(this.currentState);
    return this.currentState;
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
