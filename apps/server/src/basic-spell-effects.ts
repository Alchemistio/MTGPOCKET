import type { CardDefinition } from "@commander-pocket/card-data";
import { changeLife, drawCards, type GameState, type StackItem } from "@commander-pocket/game-engine";

function hasSimpleManaCost(manaCost: string | null): boolean {
  if (manaCost === null) return false;
  const symbols = manaCost.match(/\{[^{}]+\}/g) ?? [];
  return symbols.join("") === manaCost && symbols.every(symbol => /^\{(?:\d+|[WUBRGC])\}$/.test(symbol));
}

/** Deliberately narrow support list: unknown Oracle text must never resolve as a no-op. */
export function supportsBasicSpell(definition: CardDefinition): boolean {
  if (definition.layout !== "normal") return false;
  if (!/\b(?:Instant|Sorcery)\b/.test(definition.typeLine)) return false;
  if (!hasSimpleManaCost(definition.manaCost)) return false;
  const text = definition.oracleText.trim();
  return /^Draw (?:a|two|three) cards\.$/.test(text) || /^You gain \d+ life\.$/.test(text);
}

/** Resolves only exact, targetless Oracle-text patterns covered by this first rules slice. */
export function resolveBasicSpellEffect(state: GameState, item: StackItem): GameState {
  if (item.kind !== "spell") throw new Error("UNSUPPORTED_STACK_ITEM");
  if (typeof item.payload !== "object" || item.payload === null || Array.isArray(item.payload)) {
    throw new Error("INVALID_SPELL_PAYLOAD");
  }
  const payload = item.payload as Record<string, unknown>;
  const text = typeof payload.oracleText === "string" ? payload.oracleText.trim() : "";
  const drawMatch = /^Draw (a|two|three) cards\.$/.exec(text);
  if (drawMatch) {
    const count = drawMatch[1] === "a" ? 1 : drawMatch[1] === "two" ? 2 : 3;
    return drawCards(state, item.controller_id, count).state;
  }
  const lifeMatch = /^You gain (\d+) life\.$/.exec(text);
  if (lifeMatch) return changeLife(state, item.controller_id, Number(lifeMatch[1]));
  throw new Error("UNSUPPORTED_SPELL_EFFECT");
}
