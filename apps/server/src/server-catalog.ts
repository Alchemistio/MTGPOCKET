import { readFileSync } from "node:fs";
import type { PlayerSetup } from "@commander-pocket/game-engine";
import { normalizeScryfallCard, type CardDefinition, type ScryfallCard } from "@commander-pocket/card-data";
import { PregameCoordinator } from "./pregame-coordinator.js";
import type { PregameCoordinatorFactory } from "./pregame-session-registry.js";
interface CatalogSnapshot { schemaVersion: 1; source: "scryfall"; sourceUpdatedAt: string; cards: ScryfallCard[]; }
interface CommanderPolicySnapshot {
  schemaVersion: 1; version: string; effectiveDate: string; bannedOracleIds: string[];
  commanderEligibleOracleIds: string[]; compatibleCommanderPairs: string[][];
  multipleCopiesAllowedOracleIds: string[]; deckNameKeyByOracleId?: Record<string, string>;
}
export interface LoadedServerPregameConfig { factory: PregameCoordinatorFactory; catalogCardCount: number; policyVersion: string; }
export function loadServerPregameConfig(catalogPath: string, policyPath: string): LoadedServerPregameConfig {
  const catalog = parseCatalog(readJson(catalogPath), catalogPath);
  const catalogOracleIds = new Set(catalog.cards.flatMap(card =>
    typeof card.oracle_id === "string" ? [card.oracle_id] : []
  ));
  const policy = parsePolicy(readJson(policyPath), policyPath, catalogOracleIds);
  const banned = new Set(policy.bannedOracleIds), eligible = new Set(policy.commanderEligibleOracleIds);
  const multipleCopies = new Set(policy.multipleCopiesAllowedOracleIds);
  const compatiblePairs = new Set(policy.compatibleCommanderPairs.map(pairKey));
  const cardIndex: Record<string, CardDefinition> = Object.create(null) as Record<string, CardDefinition>;
  for (const raw of catalog.cards) {
    if (cardIndex[raw.id]) throw new Error("Duplicate Scryfall card id: " + raw.id);
    const normalized = normalizeScryfallCard(raw), legalities = { ...normalized.legalities };
    if (normalized.oracleId && banned.has(normalized.oracleId)) legalities.commander = "banned";
    cardIndex[normalized.providerId] = { ...normalized, legalities };
  }
  const factory: PregameCoordinatorFactory = {
    create(gameId: string, players: readonly PlayerSetup[]) {
      return new PregameCoordinator(gameId, players, cardIndex, {
        isCommanderEligible: card => card.oracleId !== null && eligible.has(card.oracleId),
        areCommandersCompatible: commanders => {
          if (commanders.length !== 2) return false;
          const ids = commanders.map(card => card.oracleId);
          return ids[0] != null && ids[1] != null && compatiblePairs.has(pairKey(ids as [string, string]));
        },
        allowsMultipleCopies: card =>
          (card.typeLine.startsWith("Basic") && card.typeLine.includes("Land")) ||
          (card.oracleId !== null && multipleCopies.has(card.oracleId)),
        deckNameKey: card => card.oracleId
          ? policy.deckNameKeyByOracleId?.[card.oracleId] ?? card.name.toLocaleLowerCase("en-US")
          : card.name.toLocaleLowerCase("en-US")
      });
    }
  };
  return { factory, catalogCardCount: catalog.cards.length, policyVersion: policy.version };
}
export function loadServerPregameConfigFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env
): LoadedServerPregameConfig | undefined {
  const catalogPath = environment.CPOCKET_CARD_CATALOG_PATH?.trim();
  const policyPath = environment.CPOCKET_COMMANDER_POLICY_PATH?.trim();
  if (!catalogPath && !policyPath) return undefined;
  if (!catalogPath || !policyPath) throw new Error("Both CPOCKET_CARD_CATALOG_PATH and CPOCKET_COMMANDER_POLICY_PATH are required.");
  return loadServerPregameConfig(catalogPath, policyPath);
}
function readJson(path: string): unknown {
  let source: string;
  try { source = readFileSync(path, "utf8"); } catch { throw new Error("Unable to read server data file: " + path); }
  try { return JSON.parse(source) as unknown; } catch { throw new Error("Invalid JSON in server data file: " + path); }
}
function parseCatalog(value: unknown, path: string): CatalogSnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.source !== "scryfall" ||
      !isIsoDate(value.sourceUpdatedAt) || !Array.isArray(value.cards) || value.cards.length === 0) {
    throw new Error("Invalid Scryfall catalog snapshot: " + path);
  }
  const cards = value.cards.map((item, index) => {
    if (!isScryfallCard(item)) throw new Error("Invalid Scryfall card at index " + index + " in " + path);
    return item;
  });
  return { schemaVersion: 1, source: "scryfall", sourceUpdatedAt: value.sourceUpdatedAt, cards };
}
function parsePolicy(value: unknown, path: string, catalogOracleIds: ReadonlySet<string>): CommanderPolicySnapshot {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.version !== "string" ||
      value.version.trim().length === 0 || !isIsoDate(value.effectiveDate) ||
      !isStringArray(value.bannedOracleIds) || !isStringArray(value.commanderEligibleOracleIds) ||
      !isStringArray(value.multipleCopiesAllowedOracleIds) || !Array.isArray(value.compatibleCommanderPairs) ||
      !value.compatibleCommanderPairs.every(pair => Array.isArray(pair) && pair.length === 2 && isStringArray(pair)) ||
      (value.deckNameKeyByOracleId !== undefined && !isStringRecord(value.deckNameKeyByOracleId))) {
    throw new Error("Invalid versioned Commander policy: " + path);
  }
  const bannedIds = value.bannedOracleIds as string[];
  const eligibleIds = value.commanderEligibleOracleIds as string[];
  const multipleCopyIds = value.multipleCopiesAllowedOracleIds as string[];
  const ids = [...bannedIds, ...eligibleIds, ...multipleCopyIds];
  if (ids.some(id => !isUuidLike(id))) throw new Error("Commander policy contains an invalid Oracle ID: " + path);
  if (!hasUniqueValues(bannedIds) || !hasUniqueValues(eligibleIds) || !hasUniqueValues(multipleCopyIds)) {
    throw new Error("Commander policy contains duplicate Oracle IDs: " + path);
  }
  if (bannedIds.some(id => eligibleIds.includes(id))) {
    throw new Error("Commander policy marks an Oracle ID as both banned and commander-eligible: " + path);
  }
  if (ids.some(id => !catalogOracleIds.has(id))) {
    throw new Error("Commander policy references an Oracle ID missing from the Scryfall catalog: " + path);
  }
  const pairs = value.compatibleCommanderPairs as string[][];
  const pairKeys = pairs.map(pairKey);
  if (pairs.some(pair => pair.some(id => !isUuidLike(id)) || pair[0] === pair[1] ||
      pair.some(id => !eligibleIds.includes(id))) || !hasUniqueValues(pairKeys)) {
    throw new Error("Commander policy contains an invalid compatibility pair: " + path);
  }
  if (value.deckNameKeyByOracleId !== undefined) {
    const nameKeys = value.deckNameKeyByOracleId as Record<string, string>;
    if (Object.entries(nameKeys).some(([id, key]) =>
      !isUuidLike(id) || !catalogOracleIds.has(id) || key.trim().length === 0
    )) throw new Error("Commander policy contains an invalid deck name key: " + path);
  }
  return value as unknown as CommanderPolicySnapshot;
}
function isScryfallCard(value: unknown): value is ScryfallCard {
  if (!isRecord(value)) return false;
  const oracleId = value.oracle_id;
  return typeof value.id === "string" && isUuidLike(value.id) &&
    (oracleId === undefined || oracleId === null || (typeof oracleId === "string" && isUuidLike(oracleId))) &&
    typeof value.name === "string" && value.name.length > 0 && typeof value.layout === "string" &&
    typeof value.cmc === "number" && Number.isFinite(value.cmc) && typeof value.type_line === "string" &&
    isStringArray(value.colors) && isStringArray(value.color_identity) && isStringRecord(value.legalities) &&
    typeof value.set === "string" && typeof value.collector_number === "string" &&
    (value.mana_cost === undefined || typeof value.mana_cost === "string") &&
    (value.oracle_text === undefined || typeof value.oracle_text === "string") &&
    (value.card_faces === undefined || Array.isArray(value.card_faces));
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string" && item.length > 0);
}
function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}
function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(item => typeof item === "string");
}
function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}
function pairKey(pair: readonly string[]): string { return [...pair].sort().join(":"); }
