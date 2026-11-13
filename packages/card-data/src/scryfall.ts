/** Minimal, forward-compatible subset of Scryfall's Card object. Unknown fields are retained. */
export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  artist?: string;
  image_uris?: Record<string, string>;
  [key: string]: unknown;
}

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  layout: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors: string[];
  color_identity: string[];
  legalities: Record<string, string>;
  card_faces?: ScryfallCardFace[];
  image_uris?: Record<string, string>;
  set: string;
  collector_number: string;
  released_at?: string;
  [key: string]: unknown;
}

/** Stable app-facing definition; raw provider payload is retained for traceability. */
export interface CardDefinition {
  provider: "scryfall";
  providerId: string;
  oracleId: string | null;
  name: string;
  layout: string;
  manaCost: string | null;
  manaValue: number;
  typeLine: string;
  oracleText: string;
  colors: readonly string[];
  colorIdentity: readonly string[];
  legalities: Readonly<Record<string, string>>;
  faces: readonly ScryfallCardFace[];
  raw: ScryfallCard;
}

export function normalizeScryfallCard(card: ScryfallCard): CardDefinition {
  return {
    provider: "scryfall",
    providerId: card.id,
    oracleId: card.oracle_id ?? null,
    name: card.name,
    layout: card.layout,
    manaCost: card.mana_cost ?? null,
    manaValue: card.cmc,
    typeLine: card.type_line,
    oracleText: card.oracle_text ?? "",
    colors: [...card.colors],
    colorIdentity: [...card.color_identity],
    legalities: { ...card.legalities },
    faces: card.card_faces ? [...card.card_faces] : [],
    raw: card
  };
}
