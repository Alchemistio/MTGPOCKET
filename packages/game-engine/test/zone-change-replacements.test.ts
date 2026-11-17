import { describe, expect, it } from "vitest";
import { addCardInstance, commitReplacedZoneChange, createGame, createZoneChangeReplacementSession, evaluateZoneChangeReplacements, type ZoneChangeReplacementEffect } from "../src/index.js";
const players = [
  { id: "p1", name: "Alice", seat: 0 }, { id: "p2", name: "Bob", seat: 1 },
  { id: "p3", name: "Chloé", seat: 2 }, { id: "p4", name: "David", seat: 3 }
];
function fixture() { return addCardInstance(createGame("replacement-pipeline", players), { instance_id: "entrant", card_id: "fixture-card", owner_id: "p1", zone: "hand" }); }
function effect(id: string, kind: ZoneChangeReplacementEffect["kind"], replace: ZoneChangeReplacementEffect["replace"], applies: ZoneChangeReplacementEffect["applies"] = () => true): ZoneChangeReplacementEffect {
  return { id, kind, controllerId: "p1", applies, replace };
}
describe("zone-change replacement pipeline", () => {
  it("orders replacement categories and re-evaluates after each application", () => {
    const state = fixture(), order: string[] = [];
    const effects = [
      effect("general", "general", proposal => { order.push("general"); return { ...proposal, toZone: "exile" }; }),
      effect("self", "self", proposal => { order.push("self"); return { ...proposal, toZone: "battlefield" }; }),
      effect("control", "control", proposal => { order.push("control"); return { ...proposal, destinationControllerId: "p2" }; }, proposal => proposal.toZone === "battlefield")
    ];
    const result = evaluateZoneChangeReplacements(state, createZoneChangeReplacementSession(state, "entrant", "graveyard"), effects);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("EXPECTED_READY");
    expect(order).toEqual(["self", "control", "general"]);
    expect(result.session.proposal.toZone).toBe("exile");
    expect(result.session.proposal.destinationControllerId).toBe("p2");
    expect(result.session.replacementTrace).toEqual(["self", "control", "general"]);
  });
  it("pauses for a choice among effects in the first applicable category", () => {
    const state = fixture(), effects = [
      effect("general", "general", proposal => ({ ...proposal, toZone: "exile" })),
      effect("copy-a", "copy", proposal => ({ ...proposal, toZone: "battlefield" })),
      effect("copy-b", "copy", proposal => ({ ...proposal, toZone: "graveyard" }))
    ];
    const pending = evaluateZoneChangeReplacements(state, createZoneChangeReplacementSession(state, "entrant", "hand"), effects);
    expect(pending.status).toBe("choice-required");
    if (pending.status !== "choice-required") throw new Error("EXPECTED_CHOICE");
    expect(pending.candidates.map(candidate => candidate.id)).toEqual(["copy-a", "copy-b"]);
    const resumed = evaluateZoneChangeReplacements(state, pending.session, effects, "copy-a");
    expect(resumed.status).toBe("ready");
    if (resumed.status !== "ready") throw new Error("EXPECTED_READY");
    expect(resumed.session.proposal.toZone).toBe("exile");
    expect(resumed.session.replacementTrace).toEqual(["copy-a", "copy-b", "general"]);
  });
  it("applies each replacement at most once to one proposed event", () => {
    const state = fixture(), once = effect("once", "general", proposal => ({ ...proposal, toZone: "graveyard" }));
    const result = evaluateZoneChangeReplacements(state, createZoneChangeReplacementSession(state, "entrant", "battlefield"), [once]);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("EXPECTED_READY");
    expect(result.session.replacementTrace).toEqual(["once"]);
  });
  it("prevents the event without committing or emitting a zone event", () => {
    const state = fixture(), prevent = effect("prevent", "general", () => null);
    const evaluated = evaluateZoneChangeReplacements(state, createZoneChangeReplacementSession(state, "entrant", "battlefield"), [prevent]);
    expect(evaluated.status).toBe("prevented");
    const result = commitReplacedZoneChange(state, evaluated, { eventId: "prevented-entry", cause: "effect" });
    expect(result.status).toBe("prevented");
    expect(result.state).toBe(state);
    expect(result.event).toBeNull();
    expect(state.cards.entrant?.zone).toBe("hand");
  });
  it("commits the modified destination and records the replacement trace", () => {
    const state = fixture(), redirect = effect("redirect", "general", proposal => ({ ...proposal, toZone: "exile" }));
    const evaluated = evaluateZoneChangeReplacements(state, createZoneChangeReplacementSession(state, "entrant", "battlefield"), [redirect]);
    const result = commitReplacedZoneChange(state, evaluated, { eventId: "redirected-entry", cause: "effect" });
    expect(result.status).toBe("committed");
    expect(result.state.cards.entrant?.zone).toBe("exile");
    expect(result.event).toMatchObject({ fromZone: "hand", toZone: "exile", replacementTrace: ["redirect"] });
  });
  it("rejects stale choice sessions and stale commits after any state mutation", () => {
    const state = fixture();
    const competing = [
      effect("copy-a", "copy", proposal => ({ ...proposal, toZone: "battlefield" })),
      effect("copy-b", "copy", proposal => ({ ...proposal, toZone: "graveyard" }))
    ];
    const pending = evaluateZoneChangeReplacements(
      state, createZoneChangeReplacementSession(state, "entrant", "hand"), competing
    );
    if (pending.status !== "choice-required") throw new Error("EXPECTED_CHOICE");
    const changed = addCardInstance(state, {
      instance_id: "unrelated", card_id: "other-card", owner_id: "p2", zone: "hand"
    });
    expect(() => evaluateZoneChangeReplacements(changed, pending.session, competing, "copy-a"))
      .toThrow("STALE_ZONE_CHANGE_REPLACEMENT_SESSION");

    const ready = evaluateZoneChangeReplacements(
      state, createZoneChangeReplacementSession(state, "entrant", "battlefield"), []
    );
    expect(() => commitReplacedZoneChange(changed, ready, {
      eventId: "stale-commit", cause: "effect"
    })).toThrow("STALE_ZONE_CHANGE_REPLACEMENT_SESSION");
  });
  it("rejects a replacement that changes event identity or origin", () => {
    const state = fixture(), invalid = effect("invalid", "general", proposal => ({ ...proposal, instanceId: "other" }));
    expect(() => evaluateZoneChangeReplacements(state, createZoneChangeReplacementSession(state, "entrant", "battlefield"), [invalid])).toThrow("ZONE_CHANGE_REPLACEMENT_CHANGED_EVENT_IDENTITY");
  });
});
