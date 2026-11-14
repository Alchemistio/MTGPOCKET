import { describe, expect, it } from "vitest";
import { normalizeScryfallCard } from "../src/scryfall.js";
import { ScryfallClient, type FetchLike } from "../src/client.js";

const sampleCard = {
  id: "abc-123", name: "Example Transform", layout: "transform", cmc: 3,
  type_line: "Creature — Human", colors: ["U"], color_identity: ["U"],
  legalities: { commander: "legal" }, set: "tst", collector_number: "1",
  card_faces: [
    { name: "Front", mana_cost: "{2}{U}", type_line: "Creature — Human", oracle_text: "Front face" },
    { name: "Back", type_line: "Creature — Spirit", oracle_text: "Back face" }
  ]
};

describe("Scryfall normalization", () => {
  it("preserves layout and both faces", () => {
    const card = normalizeScryfallCard(sampleCard);
    expect(card.layout).toBe("transform");
    expect(card.faces).toHaveLength(2);
    expect(card.faces[1]?.name).toBe("Back");
  });
});

describe("ScryfallClient", () => {
  it("fetches a card by exact name and validates the response", async () => {
    const requests: string[] = [];
    const fakeFetch: FetchLike = async input => {
      requests.push(String(input));
      return new Response(JSON.stringify(sampleCard), { status: 200 });
    };
    const client = new ScryfallClient(fakeFetch);
    const card = await client.getNamedCard("Example Transform");
    expect(card.id).toBe("abc-123");
    expect(requests[0]).toContain("/cards/named?exact=Example+Transform");
  });

  it("surfaces provider errors with the HTTP status", async () => {
    const fakeFetch: FetchLike = async () => new Response(JSON.stringify({ details: "not found" }), { status: 404 });
    const client = new ScryfallClient(fakeFetch);
    await expect(client.getCardById("missing")).rejects.toMatchObject({ status: 404 });
  });
});
