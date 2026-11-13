import { describe, expect, it } from "vitest";
import { ScryfallClient, type FetchLike } from "../src/client.js";
import { ScryfallRepository } from "../src/repository.js";

const sampleCard = {
  id: "cache-card", oracle_id: "oracle-cache", name: "Cached Card", layout: "normal", cmc: 2,
  type_line: "Creature — Wizard", colors: ["U"], color_identity: ["U"],
  legalities: { commander: "legal" }, set: "tst", collector_number: "1"
};

describe("ScryfallRepository", () => {
  it("coalesces concurrent requests and caches normalized cards until expiry", async () => {
    let now = 1_000;
    const requests: string[] = [];
    const fakeFetch: FetchLike = async input => {
      requests.push(String(input));
      return new Response(JSON.stringify(sampleCard), { status: 200 });
    };
    const client = new ScryfallClient(fakeFetch, "https://scryfall.test", 0);
    const repository = new ScryfallRepository(client, 500, () => now);
    const [first, second] = await Promise.all([
      repository.getCardById("cache-card"),
      repository.getCardById("cache-card")
    ]);
    expect(first).toEqual(second);
    expect(first.oracleId).toBe("oracle-cache");
    expect(requests).toHaveLength(1);
    await repository.getCardById("cache-card");
    expect(requests).toHaveLength(1);
    now += 501;
    await repository.getCardById("cache-card");
    expect(requests).toHaveLength(2);
  });
});
