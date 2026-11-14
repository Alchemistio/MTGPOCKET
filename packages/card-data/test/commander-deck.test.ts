import { describe, expect, it } from "vitest";
import { validateCommanderDeck, type CardDefinition } from "../src/index.js";

function card(providerId: string, name: string, colorIdentity: string[], typeLine: string, oracleId = providerId): CardDefinition {
  return {
    provider: "scryfall", providerId, oracleId, name, layout: "normal",
    manaCost: null, manaValue: 0, typeLine, oracleText: "",
    colors: colorIdentity, colorIdentity, legalities: { commander: "legal" },
    faces: [], raw: {
      id: providerId, oracle_id: oracleId, name, layout: "normal", cmc: 0,
      type_line: typeLine, colors: colorIdentity, color_identity: colorIdentity,
      legalities: { commander: "legal" }, set: "tst", collector_number: "1"
    }
  };
}

const commander = card("cmd", "Blue Commander", ["U"], "Legendary Creature — Wizard");
const island = card("island", "Island", ["U"], "Basic Land — Island");
const index = { cmd: commander, island };

describe("Commander deck validation", () => {
  it("accepts 100 cards with singleton basics and a verified commander", () => {
    const result = validateCommanderDeck({
      commanderIds: ["cmd"],
      cards: [{ cardId: "cmd", quantity: 1 }, { cardId: "island", quantity: 99 }]
    }, index, { isCommanderEligible: () => true });
    expect(result.valid).toBe(true);
    expect(result.cardCount).toBe(100);
    expect(result.colorIdentity).toEqual(["U"]);
  });

  it("rejects duplicate nonbasic cards and cards outside commander identity", () => {
    const white = card("white", "White Spell", ["W"], "Instant");
    const spell = card("spell", "Blue Spell", ["U"], "Instant", "spell-oracle");
    const result = validateCommanderDeck({
      commanderIds: ["cmd"],
      cards: [
        { cardId: "cmd", quantity: 1 },
        { cardId: "spell", quantity: 2 },
        { cardId: "white", quantity: 1 },
        { cardId: "island", quantity: 96 }
      ]
    }, { ...index, white, spell }, { isCommanderEligible: () => true });
    expect(result.issues.some(issue => issue.code === "DUPLICATE_CARD")).toBe(true);
    expect(result.issues.some(issue => issue.code === "COLOR_IDENTITY")).toBe(true);
  });

  it("requires an explicit eligibility decision for the commander", () => {
    const result = validateCommanderDeck({
      commanderIds: ["cmd"],
      cards: [{ cardId: "cmd", quantity: 1 }, { cardId: "island", quantity: 99 }]
    }, index, { isCommanderEligible: () => false });
    expect(result.issues.some(issue => issue.code === "INVALID_COMMANDER")).toBe(true);
  });
});
