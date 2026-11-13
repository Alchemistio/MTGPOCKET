import type { ScryfallCard } from "./scryfall.js";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class ScryfallApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown
  ) {
    super(message);
    this.name = "ScryfallApiError";
  }
}

export interface ScryfallSearchPage {
  data: ScryfallCard[];
  has_more: boolean;
  next_page?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isScryfallCard(value: unknown): value is ScryfallCard {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.layout === "string"
    && typeof value.cmc === "number"
    && typeof value.type_line === "string"
    && Array.isArray(value.colors)
    && Array.isArray(value.color_identity)
    && typeof value.set === "string"
    && typeof value.collector_number === "string"
    && isRecord(value.legalities);
}

export class ScryfallClient {
  constructor(
    private readonly fetcher: FetchLike = fetch,
    private readonly baseUrl = "https://api.scryfall.com"
  ) {}

  async getCardById(id: string, signal?: AbortSignal): Promise<ScryfallCard> {
    return this.requestCard(`/cards/${encodeURIComponent(id)}`, signal);
  }

  async getNamedCard(name: string, mode: "exact" | "fuzzy" = "exact", signal?: AbortSignal): Promise<ScryfallCard> {
    const params = new URLSearchParams({ [mode]: name });
    return this.requestCard(`/cards/named?${params.toString()}`, signal);
  }

  async searchCards(query: string, page = 1, signal?: AbortSignal): Promise<ScryfallSearchPage> {
    const params = new URLSearchParams({ q: query, page: String(page) });
    const response = await this.fetcher(`${this.baseUrl}/cards/search?${params.toString()}`, {
      headers: { accept: "application/json", "user-agent": "CommanderPocket/0.1.0" },
      ...(signal ? { signal } : {})
    });
    const body: unknown = await response.json();
    if (!response.ok) throw new ScryfallApiError("Scryfall search request failed.", response.status, body);
    if (!isRecord(body) || !Array.isArray(body.data) || typeof body.has_more !== "boolean") {
      throw new ScryfallApiError("Unexpected Scryfall search response.", response.status, body);
    }
    const data = body.data.filter(isScryfallCard);
    if (data.length !== body.data.length) throw new ScryfallApiError("Scryfall returned malformed card data.", response.status, body);
    return {
      data,
      has_more: body.has_more,
      ...(typeof body.next_page === "string" ? { next_page: body.next_page } : {})
    };
  }

  private async requestCard(path: string, signal?: AbortSignal): Promise<ScryfallCard> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      headers: { accept: "application/json", "user-agent": "CommanderPocket/0.1.0" },
      signal
    });
    const body: unknown = await response.json();
    if (!response.ok) throw new ScryfallApiError("Scryfall card request failed.", response.status, body);
    if (!isScryfallCard(body)) throw new ScryfallApiError("Unexpected Scryfall card response.", response.status, body);
    return body;
  }
}
