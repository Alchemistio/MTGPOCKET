import { ScryfallClient, ScryfallRepository } from "@commander-pocket/card-data";
import { SQLiteCardCacheStore } from "./sqlite-card-cache.js";

export async function createMobileCardRepository(): Promise<ScryfallRepository> {
  const store = new SQLiteCardCacheStore();
  await store.ready();
  return new ScryfallRepository(
    new ScryfallClient(),
    6 * 60 * 60 * 1000,
    Date.now,
    15 * 60 * 1000,
    store
  );
}
