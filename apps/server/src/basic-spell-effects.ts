import type { CardDefinition } from "@commander-pocket/card-data";
import { changeLife, drawCards, type GameState, type StackItem } from "@commander-pocket/game-engine";

function hasSimpleManaCost(manaCost: string | null): boolean {
  if (manaCost === null) return false;
  const symbols = manaCost.match(/\{[^{}]+\}/g) ?? [];
  return symbols.join("") === manaCost && symbols.every(symbol => /^\{(?:\d+|[WUBRGC])\}$/.test(symbol));
}

/** One deliberately narrow, targetless ETB template; this is not general Oracle parsing. */
function isExactEtbDrawOne(definition: CardDefinition): boolean {
  return definition.oracleText.trim() ===
    `When ${definition.name} enters the battlefield, draw a card.`;
}

/** Supported permanent definitions: vanilla or the exact self-referential ETB draw template. */
export function supportsBasicPermanent(definition: CardDefinition): boolean {
  if (definition.layout !== "normal" || !hasSimpleManaCost(definition.manaCost) ||
      !/\b(?:Creature|Artifact|Enchantment)\b/.test(definition.typeLine)) return false;
  return definition.oracleText.trim().length === 0 || isExactEtbDrawOne(definition);
}

/** Deliberately narrow support list: unknown Oracle text must never resolve as a no-op. */
export function supportsBasicSpell(definition: CardDefinition): boolean {
  if (definition.layout !== "normal" || !hasSimpleManaCost(definition.manaCost)) return false;
  const text = definition.oracleText.trim();
  if (/\b(?:Instant|Sorcery)\b/.test(definition.typeLine)) {
    return /^Draw (?:a|two|three) cards\.$/.test(text) || /^You gain \d+ life\.$/.test(text);
  }
  return supportsBasicPermanent(definition);
}

/** Creates the server-known stack object for the first supported ETB ability. */
export function createBasicPermanentEtbTrigger(
  instanceId: string,
  controllerId: string,
  definition: CardDefinition,
  revision: number
): StackItem | null {
  if (!supportsBasicPermanent(definition) || !isExactEtbDrawOne(definition)) return null;
  return {
    id: `trigger:etb:${instanceId}:${revision}`,
    controller_id: controllerId,
    source_instance_id: instanceId,
    kind: "triggered-ability",
    payload: { effect: "etb-draw-one", sourceName: definition.name }
  };
}

export function basicLandManaOptions(definition: CardDefinition): string[] {
  if (!/\bBasic\b.*\bLand\b/.test(definition.typeLine)) return [];
  const colors: string[] = [];
  if (/\bPlains\b/.test(definition.typeLine)) colors.push("W");
  if (/\bIsland\b/.test(definition.typeLine)) colors.push("U");
  if (/\bSwamp\b/.test(definition.typeLine)) colors.push("B");
  if (/\bMountain\b/.test(definition.typeLine)) colors.push("R");
  if (/\bForest\b/.test(definition.typeLine)) colors.push("G");
  if (colors.length > 0) return colors;
  return /^\{T\}: Add \{C\}\.$/.test(definition.oracleText.trim()) ? ["C"] : [];
}

/** Resolves only explicit server-authored effects covered by this first rules slice. */
export function resolveBasicSpellEffect(state: GameState, item: StackItem): GameState {
  if (typeof item.payload !== "object" || item.payload === null || Array.isArray(item.payload)) {
    throw new Error("INVALID_SPELL_PAYLOAD");
  }
  const payload = item.payload as Record<string, unknown>;
  if (item.kind === "triggered-ability") {
    if (payload.effect === "etb-draw-one" && typeof payload.sourceName === "string") {
      return drawCards(state, item.controller_id, 1).state;
    }
    throw new Error("UNSUPPORTED_TRIGGERED_ABILITY");
  }
  if (item.kind !== "spell") throw new Error("UNSUPPORTED_STACK_ITEM");
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
