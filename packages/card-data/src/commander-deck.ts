import type { CardDefinition } from "./scryfall.js";

export interface DeckCardEntry {
  cardId: string;
  quantity: number;
}

export interface CommanderDeckList {
  commanderIds: readonly string[];
  cards: readonly DeckCardEntry[];
}

export type DeckIssueCode =
  | "DECK_SIZE" | "COMMANDER_COUNT" | "UNKNOWN_CARD" | "ILLEGAL_CARD"
  | "INVALID_QUANTITY" | "COMMANDER_NOT_IN_DECK" | "INVALID_COMMANDER"
  | "INCOMPATIBLE_COMMANDERS" | "DUPLICATE_CARD" | "COLOR_IDENTITY";

export interface DeckIssue {
  code: DeckIssueCode;
  cardId?: string;
  message: string;
}

export interface CommanderDeckValidationOptions {
  /** Eligibility must come from a versioned Commander rules/banlist registry. */
  isCommanderEligible: (card: CardDefinition) => boolean;
  /** Required when the list contains two commanders. */
  areCommandersCompatible?: (commanders: readonly CardDefinition[]) => boolean;
  /** Supports explicit singleton exceptions such as "a deck can have any number". */
  allowsMultipleCopies?: (card: CardDefinition) => boolean;
  /** Normalizes interchangeable English names under CR 201.3 when applicable. */
  deckNameKey?: (card: CardDefinition) => string;
  expectedCardCount?: number;
}

export interface CommanderDeckValidationResult {
  valid: boolean;
  cardCount: number;
  colorIdentity: readonly string[];
  issues: readonly DeckIssue[];
}

function allowsMultipleByDefault(card: CardDefinition): boolean {
  return card.typeLine.startsWith("Basic") && card.typeLine.includes("Land");
}

export function validateCommanderDeck(
  deck: CommanderDeckList,
  cardIndex: Readonly<Record<string, CardDefinition>>,
  options: CommanderDeckValidationOptions
): CommanderDeckValidationResult {
  const issues: DeckIssue[] = [];
  const expectedCount = options.expectedCardCount ?? 100;
  const cardCount = deck.cards.reduce((sum, entry) => sum + (Number.isSafeInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 0), 0);

  if (cardCount !== expectedCount) {
    issues.push({ code: "DECK_SIZE", message: `Le deck doit contenir exactement ${expectedCount} cartes ; ${cardCount} trouvées.` });
  }
  if (deck.commanderIds.length < 1 || deck.commanderIds.length > 2 || new Set(deck.commanderIds).size !== deck.commanderIds.length) {
    issues.push({ code: "COMMANDER_COUNT", message: "Un deck Commander doit déclarer un ou deux commandants distincts." });
  }

  const entriesById = new Map<string, number>();
  for (const entry of deck.cards) {
    if (!Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) {
      issues.push({ code: "INVALID_QUANTITY", cardId: entry.cardId, message: "La quantité doit être un entier strictement positif." });
      continue;
    }
    entriesById.set(entry.cardId, (entriesById.get(entry.cardId) ?? 0) + entry.quantity);
  }

  const resolvedEntries: Array<{ card: CardDefinition; quantity: number }> = [];
  for (const [cardId, quantity] of entriesById) {
    const card = cardIndex[cardId];
    if (!card) {
      issues.push({ code: "UNKNOWN_CARD", cardId, message: `Carte inconnue : ${cardId}.` });
      continue;
    }
    resolvedEntries.push({ card, quantity });
    if (card.legalities.commander !== "legal") {
      issues.push({ code: "ILLEGAL_CARD", cardId, message: `${card.name} n'est pas légale en Commander selon les données chargées.` });
    }
  }

  const commanders = deck.commanderIds.flatMap(id => {
    const card = cardIndex[id];
    if (!card) {
      issues.push({ code: "UNKNOWN_CARD", cardId: id, message: `Commandant inconnu : ${id}.` });
      return [];
    }
    if ((entriesById.get(id) ?? 0) !== 1) {
      issues.push({ code: "COMMANDER_NOT_IN_DECK", cardId: id, message: `Le commandant ${card.name} doit figurer exactement une fois dans les 100 cartes.` });
    }
    if (!options.isCommanderEligible(card)) {
      issues.push({ code: "INVALID_COMMANDER", cardId: id, message: `${card.name} n'est pas reconnu comme commandant éligible.` });
    }
    return [card];
  });

  if (commanders.length === 2 && !options.areCommandersCompatible?.(commanders)) {
    issues.push({ code: "INCOMPATIBLE_COMMANDERS", message: "Les deux commandants ne disposent pas d'une combinaison de partenaire autorisée." });
  }

  const deckIdentity = new Set(commanders.flatMap(card => card.colorIdentity));
  for (const { card } of resolvedEntries) {
    for (const color of card.colorIdentity) {
      if (!deckIdentity.has(color)) {
        issues.push({ code: "COLOR_IDENTITY", cardId: card.providerId, message: `${card.name} contient une couleur hors de l'identité du commandant.` });
        break;
      }
    }
  }

  return {
    valid: issues.length === 0,
    cardCount,
    colorIdentity: [...deckIdentity].sort(),
    issues
  };
}
