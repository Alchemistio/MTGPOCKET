import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GameRoom } from "../src/game-room.js";
import { JsonFileRoomPersistence, hashSeatToken, type PersistedRoomRecord } from "../src/room-persistence.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture(directory: string): { store: JsonFileRoomPersistence; record: PersistedRoomRecord } {
  const room = new GameRoom("persisted-room", players);
  room.apply({
    protocolVersion: 1, gameId: "persisted-room", commandId: "pass-1",
    playerId: "p1", expectedRevision: room.state.revision,
    type: "pass-priority", payload: {}
  });
  const token = "private-seat-token-p1";
  return {
    store: new JsonFileRoomPersistence(directory),
    record: {
      schemaVersion: 1,
      gameId: "persisted-room",
      checkpoint: room.checkpoint,
      seatTokenHashes: {
        p1: hashSeatToken(token), p2: hashSeatToken("token-p2"),
        p3: hashSeatToken("token-p3"), p4: hashSeatToken("token-p4")
      },
      seedLog: [{ sequence: 0, purpose: "opening-hand", playerId: "p1", seed: "server-only-seed" }]
    }
  };
}

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "commander-pocket-room-"));
  directories.push(directory);
  return directory;
}

describe("JsonFileRoomPersistence", () => {
  it("round-trips a versioned room record without writing raw seat tokens", () => {
    const directory = temporaryDirectory();
    const { store, record } = fixture(directory);
    store.save(record);

    expect(store.loadAll()).toEqual([record]);
    const files = readdirSync(directory);
    expect(files).toHaveLength(1);
    const persistedText = readFileSync(join(directory, files[0]!), "utf8");
    expect(persistedText).not.toContain("private-seat-token-p1");
    expect(persistedText).toContain("server-only-seed");
    expect(statSync(join(directory, files[0]!)).mode & 0o777).toBe(0o600);
  });

  it("atomically replaces an existing checkpoint and supports deletion", () => {
    const directory = temporaryDirectory();
    const { store, record } = fixture(directory);
    store.save(record);
    const updated = {
      ...record,
      seedLog: [...record.seedLog, { sequence: 1, purpose: "mulligan" as const, playerId: "p2", seed: "second-seed" }]
    };
    store.save(updated);
    expect(store.loadAll()).toEqual([updated]);
    expect(readdirSync(directory).filter(name => name.endsWith(".tmp"))).toHaveLength(0);
    store.delete(record.gameId);
    expect(store.loadAll()).toEqual([]);
  });

  it("fails closed on malformed JSON and invalid credential or seed records", () => {
    const directory = temporaryDirectory();
    const { store, record } = fixture(directory);
    store.save(record);
    const filename = readdirSync(directory)[0]!;
    writeFileSync(join(directory, filename), "{not-json", "utf8");
    expect(() => store.loadAll()).toThrow("ROOM_PERSISTENCE_INVALID_JSON");

    expect(() => store.save({
      ...record,
      seatTokenHashes: { ...record.seatTokenHashes, p1: "raw-token" }
    })).toThrow("ROOM_PERSISTENCE_INVALID_CREDENTIALS");
    expect(() => store.save({
      ...record,
      seedLog: [{ sequence: 0, purpose: "mulligan", playerId: "unknown", seed: "seed" }]
    })).toThrow("ROOM_PERSISTENCE_INVALID_SEED_LOG");
  });
});
