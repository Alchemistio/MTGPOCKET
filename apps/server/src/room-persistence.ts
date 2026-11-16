import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync,
  renameSync, rmSync, unlinkSync, writeFileSync
} from "node:fs";
import { join } from "node:path";
import type { GameRoomCheckpoint } from "./game-room.js";
import type { PregameSeedRecord } from "./pregame-coordinator.js";

export interface PersistedRoomRecord {
  schemaVersion: 1;
  gameId: string;
  checkpoint: GameRoomCheckpoint;
  /** SHA-256 hashes only: raw seat bearer tokens are never written to disk. */
  seatTokenHashes: Readonly<Record<string, string>>;
  /** Server-only shuffle/mulligan replay material; never project this to a player. */
  seedLog: readonly PregameSeedRecord[];
}

export interface RoomPersistence {
  loadAll(): PersistedRoomRecord[];
  save(record: PersistedRoomRecord): void;
  delete(gameId: string): void;
}

/**
 * Atomic, versioned JSON persistence for authoritative rooms.
 *
 * The directory and files are private by default (0700/0600). The file contains
 * hidden GameState data, so it must remain server-side and must never be served
 * through the HTTP or WebSocket APIs.
 */
export class JsonFileRoomPersistence implements RoomPersistence {
  constructor(private readonly directory: string) {}

  loadAll(): PersistedRoomRecord[] {
    if (!existsSync(this.directory)) return [];
    const records: PersistedRoomRecord[] = [];
    for (const entry of readdirSync(this.directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const path = join(this.directory, entry.name);
      const record = parseRecord(readFileSync(path, "utf8"));
      if (entry.name !== fileNameFor(record.gameId)) throw new Error("ROOM_PERSISTENCE_FILENAME_MISMATCH");
      records.push(record);
    }
    const ids = new Set<string>();
    for (const record of records) {
      if (ids.has(record.gameId)) throw new Error("DUPLICATE_PERSISTED_GAME_ID");
      ids.add(record.gameId);
    }
    return records;
  }

  save(record: PersistedRoomRecord): void {
    validateRecord(record);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    chmodSync(this.directory, 0o700);
    const target = join(this.directory, fileNameFor(record.gameId));
    const temporary = target + "." + randomUUID() + ".tmp";
    const descriptor = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(descriptor, JSON.stringify(record), "utf8");
      fsyncSync(descriptor);
    } catch (error) {
      closeSync(descriptor);
      rmSync(temporary, { force: true });
      throw error;
    }
    closeSync(descriptor);
    try {
      renameSync(temporary, target);
      // Persist the directory entry as well as the file contents on POSIX.
      const directoryDescriptor = openSync(this.directory, "r");
      try { fsyncSync(directoryDescriptor); } finally { closeSync(directoryDescriptor); }
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  }

  delete(gameId: string): void {
    const target = join(this.directory, fileNameFor(gameId));
    if (existsSync(target)) unlinkSync(target);
  }
}

export function hashSeatToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function fileNameFor(gameId: string): string {
  return createHash("sha256").update(gameId, "utf8").digest("hex") + ".json";
}

function parseRecord(source: string): PersistedRoomRecord {
  let value: unknown;
  try { value = JSON.parse(source) as unknown; }
  catch { throw new Error("ROOM_PERSISTENCE_INVALID_JSON"); }
  validateRecord(value);
  return JSON.parse(JSON.stringify(value)) as PersistedRoomRecord;
}

function validateRecord(value: unknown): asserts value is PersistedRoomRecord {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.gameId !== "string" ||
      value.gameId.trim().length === 0 || !isRecord(value.checkpoint) ||
      value.checkpoint.schemaVersion !== 1 || value.checkpoint.gameId !== value.gameId ||
      !isRecord(value.checkpoint.snapshot) || value.checkpoint.snapshot.id !== value.gameId ||
      !Array.isArray(value.checkpoint.events) || !isRecord(value.seatTokenHashes) ||
      !Array.isArray(value.seedLog)) {
    throw new Error("ROOM_PERSISTENCE_INVALID_RECORD");
  }

  const playerIds = new Set<string>();
  const players = value.checkpoint.snapshot.players;
  if (!Array.isArray(players) || players.length !== 4) throw new Error("ROOM_PERSISTENCE_INVALID_PLAYERS");
  for (const player of players) {
    if (!isRecord(player) || typeof player.id !== "string" || playerIds.has(player.id)) {
      throw new Error("ROOM_PERSISTENCE_INVALID_PLAYERS");
    }
    playerIds.add(player.id);
  }

  const hashes = value.seatTokenHashes;
  const hashIds = Object.keys(hashes);
  if (hashIds.length !== playerIds.size || hashIds.some(id =>
      !playerIds.has(id) || typeof hashes[id] !== "string" || !/^[a-f0-9]{64}$/.test(hashes[id] as string))) {
    throw new Error("ROOM_PERSISTENCE_INVALID_CREDENTIALS");
  }

  const sequences = new Set<number>();
  for (const seed of value.seedLog) {
    if (!isRecord(seed) || !Number.isInteger(seed.sequence) || (seed.sequence as number) < 0 ||
        sequences.has(seed.sequence as number) ||
        (seed.purpose !== "opening-hand" && seed.purpose !== "mulligan") ||
        typeof seed.playerId !== "string" || !playerIds.has(seed.playerId) ||
        typeof seed.seed !== "string" || seed.seed.trim().length === 0) {
      throw new Error("ROOM_PERSISTENCE_INVALID_SEED_LOG");
    }
    sequences.add(seed.sequence as number);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
