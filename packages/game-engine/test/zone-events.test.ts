import { describe, expect, it } from "vitest";
import { addCardInstance, createGame, createZoneChangeEvent, moveCardToZone } from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

describe("ZoneChangeEvent", () => {
  it("captures committed zones, ownership, controller transition and last known information", () => {
    const withCard = addCardInstance(createGame("zone-event", players), {
      instance_id: "permanent-1", card_id: "fixture-card", owner_id: "p1", zone: "hand"
    });
    const before = withCard.cards["permanent-1"];
    expect(before).toBeDefined();
    if (!before) throw new Error("MISSING_FIXTURE_CARD");

    const moved = moveCardToZone(withCard, "permanent-1", "battlefield", "p2");
    const after = moved.cards["permanent-1"];
    expect(after).toBeDefined();
    if (!after) throw new Error("MISSING_MOVED_CARD");

    const event = createZoneChangeEvent(before, after, {
      eventId: "zone-event-1",
      simultaneousGroupId: "simultaneous-1",
      cause: "effect"
    });

    expect(event).toMatchObject({
      eventId: "zone-event-1",
      simultaneousGroupId: "simultaneous-1",
      fromZone: "hand",
      toZone: "battlefield",
      ownerId: "p1",
      controllerBefore: "p1",
      controllerAfter: "p2",
      cause: "effect",
      replacementTrace: [],
      instanceBefore: { zone: "hand", controller_id: "p1" },
      instanceAfter: { zone: "battlefield", controller_id: "p2" },
      lastKnownInfo: { zone: "hand", controller_id: "p1" }
    });
    expect(event?.lastKnownInfo).not.toBe(before);
    expect(moved.cards["permanent-1"]?.controller_id).toBe("p2");
  });

  it("does not create an event when no zone transition occurred", () => {
    const withCard = addCardInstance(createGame("zone-noop", players), {
      instance_id: "card-in-hand", card_id: "fixture-card", owner_id: "p1", zone: "hand"
    });
    const before = withCard.cards["card-in-hand"];
    expect(before).toBeDefined();
    if (!before) throw new Error("MISSING_FIXTURE_CARD");

    const unchanged = moveCardToZone(withCard, "card-in-hand", "hand");
    const after = unchanged.cards["card-in-hand"];
    expect(after).toBeDefined();
    if (!after) throw new Error("MISSING_UNCHANGED_CARD");

    expect(createZoneChangeEvent(before, after, {
      eventId: "zone-event-noop",
      cause: "effect"
    })).toBeNull();
    expect(unchanged).toBe(withCard);
  });

  it("rejects snapshots that do not describe the same physical card instance", () => {
    const withCard = addCardInstance(createGame("zone-mismatch", players), {
      instance_id: "card-1", card_id: "fixture-card", owner_id: "p1", zone: "hand"
    });
    const before = withCard.cards["card-1"];
    expect(before).toBeDefined();
    if (!before) throw new Error("MISSING_FIXTURE_CARD");

    expect(() => createZoneChangeEvent(before, {
      ...before, card_id: "different-card", zone: "battlefield"
    }, {
      eventId: "zone-event-mismatch",
      cause: "effect"
    })).toThrow("ZONE_CHANGE_INSTANCE_MISMATCH");
  });
});
