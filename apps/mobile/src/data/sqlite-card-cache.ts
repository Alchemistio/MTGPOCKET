import * as SQLite from "expo-sqlite";
import type { CardCacheStore } from "@commander-pocket/card-data";

interface CacheRow {
  value_json: string;
  expires_at: number;
}

export class SQLiteCardCacheStore implements CardCacheStore {
  private readonly database: Promise<SQLite.SQLiteDatabase>;

  constructor(databaseName = "commander-pocket.db") {
    this.database = SQLite.openDatabaseAsync(databaseName).then(async db => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS card_cache (
          cache_key TEXT PRIMARY KEY NOT NULL,
          value_json TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_card_cache_expiry ON card_cache(expires_at);
      `);
      return db;
    });
  }

  async get(key: string): Promise<{ value: unknown; expiresAt: number } | null> {
    const db = await this.database;
    const row = await db.getFirstAsync<CacheRow>(
      "SELECT value_json, expires_at FROM card_cache WHERE cache_key = ?",
      key
    );
    if (!row) return null;
    if (row.expires_at <= Date.now()) {
      await db.runAsync("DELETE FROM card_cache WHERE cache_key = ?", key);
      return null;
    }
    try {
      return { value: JSON.parse(row.value_json) as unknown, expiresAt: row.expires_at };
    } catch {
      await db.runAsync("DELETE FROM card_cache WHERE cache_key = ?", key);
      return null;
    }
  }

  async set(key: string, value: unknown, expiresAt: number): Promise<void> {
    const db = await this.database;
    await db.runAsync(
      "INSERT OR REPLACE INTO card_cache(cache_key, value_json, expires_at, updated_at) VALUES(?, ?, ?, ?)",
      key, JSON.stringify(value), expiresAt, Date.now()
    );
  }

  async clear(): Promise<void> {
    const db = await this.database;
    await db.runAsync("DELETE FROM card_cache");
  }

  async ready(): Promise<void> {
    await this.database;
  }
}
