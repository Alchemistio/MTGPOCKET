import { ScryfallClient } from "./client.js";
import { normalizeScryfallCard, type CardDefinition } from "./scryfall.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CardCacheStore {
  get(key: string): Promise<{ value: unknown; expiresAt: number } | null>;
  set(key: string, value: unknown, expiresAt: number): Promise<void>;
  clear(): Promise<void>;
}

export interface CardSearchPage {
  data: CardDefinition[];
  has_more: boolean;
  next_page?: string;
}

/** TTL cache with request coalescing and optional durable storage. */
export class ScryfallRepository {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly client = new ScryfallClient(),
    private readonly ttlMs = 6 * 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
    private readonly searchTtlMs = 15 * 60 * 1000,
    private readonly store?: CardCacheStore
  ) {}

  async getCardById(id: string): Promise<CardDefinition> {
    const card = await this.cached(`card:id:${id}`, async () =>
      normalizeScryfallCard(await this.client.getCardById(id))
    );
    this.rememberCard(card);
    return card;
  }

  async getNamedCard(name: string, mode: "exact" | "fuzzy" = "exact"): Promise<CardDefinition> {
    const card = await this.cached(`card:name:${mode}:${name.toLocaleLowerCase("en-US")}`, async () =>
      normalizeScryfallCard(await this.client.getNamedCard(name, mode))
    );
    this.rememberCard(card);
    return card;
  }

  async searchCards(query: string, page = 1): Promise<CardSearchPage> {
    const result = await this.cached(`search:${query}:${page}`, async () => {
      const response = await this.client.searchCards(query, page);
      return {
        data: response.data.map(normalizeScryfallCard),
        has_more: response.has_more,
        ...(response.next_page ? { next_page: response.next_page } : {})
      };
    }, this.searchTtlMs);
    for (const card of result.data) this.rememberCard(card);
    return result;
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  async clearAll(): Promise<void> {
    this.invalidateAll();
    await this.store?.clear();
  }

  private rememberCard(card: CardDefinition): void {
    const entry = { value: card, expiresAt: this.now() + this.ttlMs };
    this.cache.set(`card:id:${card.providerId}`, entry);
    this.cache.set(`card:name:exact:${card.name.toLocaleLowerCase("en-US")}`, entry);
  }

  private async cached<T>(key: string, load: () => Promise<T>, ttlMs = this.ttlMs): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value as T;
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const request = (async () => {
      if (this.store) {
        try {
          const persisted = await this.store.get(key);
          if (persisted && persisted.expiresAt > this.now()) {
            this.cache.set(key, { value: persisted.value, expiresAt: persisted.expiresAt });
            return persisted.value as T;
          }
        } catch {
          // A cache failure must not make public card lookup unavailable.
        }
      }
      const value = await load();
      const expiresAt = this.now() + ttlMs;
      this.cache.set(key, { value, expiresAt });
      if (this.store) {
        try {
          await this.store.set(key, value, expiresAt);
        } catch {
          // The in-memory result remains usable if durable storage is unavailable.
        }
      }
      return value;
    })().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, request);
    return request;
  }
}
