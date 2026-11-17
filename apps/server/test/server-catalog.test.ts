import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadServerPregameConfig, loadServerPregameConfigFromEnvironment } from "../src/server-catalog.js";

const roots: string[] = [];
const cardId = "11111111-1111-4111-8111-111111111111";
const oracleId = "22222222-2222-4222-8222-222222222222";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "commander-pocket-catalog-"));
  roots.push(root);
  const catalogPath = join(root, "catalog.json");
  const policyPath = join(root, "commander-policy.json");
  writeFileSync(catalogPath, JSON.stringify({
    schemaVersion: 1, source: "scryfall", sourceUpdatedAt: "2026-11-14",
    cards: [{
      id: cardId, oracle_id: oracleId, name: "Test Commander", layout: "normal",
      mana_cost: "{1}{U}", cmc: 2, type_line: "Legendary Creature — Wizard",
      oracle_text: "", colors: ["U"], color_identity: ["U"],
      legalities: { commander: "legal" }, set: "tst", collector_number: "1"
    }]
  }));
  writeFileSync(policyPath, JSON.stringify({
    schemaVersion: 1, version: "commander-policy-test-1", effectiveDate: "2026-11-14",
    bannedOracleIds: [], commanderEligibleOracleIds: [oracleId],
    compatibleCommanderPairs: [], multipleCopiesAllowedOracleIds: []
  }));
  return { catalogPath, policyPath };
}
function readPolicyText(path: string): string { return readFileSync(path, "utf8"); }
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("server catalog configuration", () => {
  it("loads a validated Scryfall snapshot and explicit versioned Commander policy", () => {
    const paths = fixture();
    const loaded = loadServerPregameConfig(paths.catalogPath, paths.policyPath);
    expect(loaded.catalogCardCount).toBe(1);
    expect(loaded.policyVersion).toBe("commander-policy-test-1");
    expect(loaded.cardIndex[cardId]?.providerId).toBe(cardId);
    expect(loaded.factory.create("test-game", [
      { id: "p1", name: "A", seat: 0 }, { id: "p2", name: "B", seat: 1 },
      { id: "p3", name: "C", seat: 2 }, { id: "p4", name: "D", seat: 3 }
    ])).toBeDefined();
  });
  it("fails closed when the policy is missing or unversioned", () => {
    const paths = fixture();
    writeFileSync(paths.policyPath, JSON.stringify({ schemaVersion: 1 }));
    expect(() => loadServerPregameConfig(paths.catalogPath, paths.policyPath))
      .toThrow("Invalid versioned Commander policy");
  });
  it("rejects a catalog with malformed card records", () => {
    const paths = fixture();
    writeFileSync(paths.catalogPath, JSON.stringify({
      schemaVersion: 1, source: "scryfall", sourceUpdatedAt: "2026-11-14", cards: [{}]
    }));
    expect(() => loadServerPregameConfig(paths.catalogPath, paths.policyPath))
      .toThrow("Invalid Scryfall card");
  });
  it("rejects impossible dates, duplicate policy IDs, and policy IDs absent from the catalog", () => {
    const paths = fixture();
    const original = JSON.parse(readPolicyText(paths.policyPath)) as Record<string, unknown>;
    const writePolicy = (policy: Record<string, unknown>) =>
      writeFileSync(paths.policyPath, JSON.stringify(policy));

    writePolicy({ ...original, effectiveDate: "2026-02-30" });
    expect(() => loadServerPregameConfig(paths.catalogPath, paths.policyPath))
      .toThrow("Invalid versioned Commander policy");

    writePolicy({ ...original, commanderEligibleOracleIds: [oracleId, oracleId] });
    expect(() => loadServerPregameConfig(paths.catalogPath, paths.policyPath))
      .toThrow("duplicate Oracle IDs");

    writePolicy({ ...original, bannedOracleIds: ["33333333-3333-4333-8333-333333333333"] });
    expect(() => loadServerPregameConfig(paths.catalogPath, paths.policyPath))
      .toThrow("missing from the Scryfall catalog");

    writePolicy({ ...original, bannedOracleIds: [oracleId], commanderEligibleOracleIds: [oracleId] });
    expect(() => loadServerPregameConfig(paths.catalogPath, paths.policyPath))
      .toThrow("both banned and commander-eligible");
  });
  it("rejects compatibility pairs unless both commanders are eligible and pairs are unique", () => {
    const paths = fixture();
    const policy = JSON.parse(readPolicyText(paths.policyPath)) as Record<string, unknown>;
    writeFileSync(paths.policyPath, JSON.stringify({
      ...policy,
      compatibleCommanderPairs: [[oracleId, "33333333-3333-4333-8333-333333333333"]]
    }));
    expect(() => loadServerPregameConfig(paths.catalogPath, paths.policyPath))
      .toThrow("invalid compatibility pair");
  });
  it("keeps pregame disabled when neither path is configured and rejects partial config", () => {
    expect(loadServerPregameConfigFromEnvironment({})).toBeUndefined();
    expect(() => loadServerPregameConfigFromEnvironment({
      CPOCKET_CARD_CATALOG_PATH: "/tmp/cards.json"
    })).toThrow("Both CPOCKET_CARD_CATALOG_PATH and CPOCKET_COMMANDER_POLICY_PATH are required");
  });
});
