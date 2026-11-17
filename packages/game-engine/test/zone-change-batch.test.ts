import { describe, expect, it } from "vitest";
import { addCardInstance, createGame, moveCardToZoneWithEvent, moveCardsToZoneSimultaneously } from "../src/index.js";

const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];

describe("simultaneous zone-change batches", () => {
  it("uses one pre-event snapshot and a shared group for all committed moves", () => {
    let state = createGame("simultaneous-zone-change", players);
    state = addCardInstance(state, {
      instance_id: "a", card_id: "card-a", owner_id: "p1", zone: "hand"
    });
    state = addCardInstance(state, {
      instance_id: "b", card_id: "card-b", owner_id: "p2", zone: "graveyard"
    });

    const result = moveCardsToZoneSimultaneously(state, [
      { instanceId: "a", destination: "battlefield", destinationControllerId: "p1" },
      { instanceId: "b", destination: "battlefield", destinationControllerId: "p2" }
    ], { eventGroupId: "resolve:mass-reanimate:1", cause: "effect" });

    expect(result.events).toHaveLength(2);
    expect(result.events.map(event => event.eventId)).toEqual([
      "resolve:mass-reanimate:1:a", "resolve:mass-reanimate:1:b"
    ]);
    expect(result.events.every(event => event.simultaneousGroupId === "resolve:mass-reanimate:1")).toBe(true);
    expect(result.events.map(event => event.fromZone)).toEqual(["hand", "graveyard"]);
    expect(result.events.map(event => event.toZone)).toEqual(["battlefield", "battlefield"]);
    expect(result.state.players.find(player => player.id === "p1")?.battlefield).toContain("a");
    expect(result.state.players.find(player => player.id === "p2")?.battlefield).toContain("b");
    expect(state.cards.a?.zone).toBe("hand");
    expect(state.cards.b?.zone).toBe("graveyard");
  });

  it("omits no-op moves and rejects duplicate instances atomically", () => {
    let state = createGame("simultaneous-zone-change-validation", players);
    state = addCardInstance(state, {
      instance_id: "a", card_id: "card-a", owner_id: "p1", zone: "hand"
    });

    const noOp = moveCardsToZoneSimultaneously(state, [
      { instanceId: "a", destination: "hand" }
    ], { eventGroupId: "noop:1", cause: "effect" });
    expect(noOp.state).toBe(state);
    expect(noOp.events).toHaveLength(0);

    expect(() => moveCardsToZoneSimultaneously(state, [
      { instanceId: "a", destination: "battlefield" },
      { instanceId: "a", destination: "graveyard" }
    ], { eventGroupId: "invalid:1", cause: "effect" })).toThrow("DUPLICATE_INSTANCE_IN_ZONE_CHANGE_BATCH");
    expect(state.cards.a?.zone).toBe("hand");
  });
});

describe("single zone-change processor", () => {
  it("returns the committed event alongside the new state", () => {
    let state = createGame("single-zone-change", players);
    state = addCardInstance(state, {
      instance_id: "single", card_id: "single-card", owner_id: "p1", zone: "hand"
    });
    const result = moveCardToZoneWithEvent(state, {
      instanceId: "single", destination: "battlefield", destinationControllerId: "p2"
    }, {
      eventId: "cast:single:enter",
      cause: "spell-resolution"
    });

    expect(result.state.cards.single?.zone).toBe("battlefield");
    expect(result.event).toMatchObject({
      eventId: "cast:single:enter",
      fromZone: "hand",
      toZone: "battlefield",
      ownerId: "p1",
      controllerBefore: "p1",
      controllerAfter: "p2",
      cause: "spell-resolution"
    });
    expect(state.cards.single?.zone).toBe("hand");
  });
});
