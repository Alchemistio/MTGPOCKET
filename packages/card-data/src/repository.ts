import { ScryfallClient } from "./client.js";
import { normalizeScryfallCard, type CardDefinition } from "./scryfall.js";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CardSearchPage {
  data: CardDefinition[];
  has_more: boolean;
  next_page?: string;
}

/** In-memory TTL cache with in-flight request coalescing; persistence belongs to the mobile adapter. */
export class ScryfallRepository {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly client = new ScryfallClient(),
    private readonly ttlMs = 6 * 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
    private readonly searchTtlMs = 15 * 60 * 1000
  ) {}

  async getCardById(id: string): Promise<CardDefinition> {
    return this.cached(`card:id:${id}`, async () => {
      const card = normalizeScryfallCard(await this.client.getCardById(id));
      this.rememberCard(card);
      return card;
    });
  }

  async getNamedCard(name: string, mode: "exact" | "fuzzy" = "exact"): Promise<CardDefinition> {
    return this.cached(`card:name:${mode}:${name.toLocaleLowerCase("en-US")}`, async () => {
      const card = normalizeScryfallCard(await this.client.getNamedCard(name, mode));
      this.rememberCard(card);
      return card;
    });
  }

  async searchCards(query: string, page = 1): Promise<CardSearchPage> {
    return this.cached(`search:${query}:${page}`, async () => {
      const result = await this.client.searchCards(query, page);
      return {
        data: result.data.map(raw => {
          const card = normalizeScryfallCard(raw);
          this.rememberCard(card);
          return card;
        }),
        has_more: result.has_more,
        ...(result.next_page ? { next_page: result.next_page } : {})
      };
    }, this.searchTtlMs);
  }

  private rememberCard(card: CardDefinition): void {
    const entry = { value: card, expiresAt: this.now() + this.ttlMs };
    this.cache.set(`card:id:${card.providerId}`, entry);
    this.cache.set(`card:name:exact:${card.name.toLocaleLowerCase("en-US")}`, entry);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  private async cached<T>(key: string, load: () => Promise<T>, ttlMs = this.ttlMs): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value as T;
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;
    const request = load().then(value => {
      this.cache.set(key, { value, expiresAt: this.now() + ttlMs });
      return value;
    }).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, request);
    return request;
  }
}
