import { EngineError, type GameState, type InstanceId, type PlayerId, type RuntimeCardState, type Zone } from "./model.js";

export interface CardInstanceSetup {
  instance_id: InstanceId;
  card_id: string;
  owner_id: PlayerId;
  zone: Exclude<Zone, "stack">;
  controller_id?: PlayerId;
  is_commander?: boolean;
}

const EMPTY_COUNTERS = { p1p1: 0, m1m1: 0, shield: 0, custom: {} } as const;

export function addCardInstance(state: GameState, setup: CardInstanceSetup): GameState {
  if (state.cards[setup.instance_id]) throw new EngineError("DUPLICATE_CARD_INSTANCE", "Cette instance de carte existe déjà.");
  const owner = state.players.find(p => p.id === setup.owner_id);
  if (!owner) throw new EngineError("UNKNOWN_PLAYER", "Propriétaire de carte inconnu.");
  const controllerId = setup.controller_id ?? setup.owner_id;
  const controller = state.players.find(p => p.id === controllerId);
  if (!controller) throw new EngineError("UNKNOWN_PLAYER", "Contrôleur de carte inconnu.");
  if (setup.zone === "battlefield" && controller.isEliminated) throw new EngineError("PLAYER_ELIMINATED", "Un joueur éliminé ne peut pas contrôler un permanent.");
  const card: RuntimeCardState = {
    instance_id: setup.instance_id, card_id: setup.card_id, owner_id: setup.owner_id,
    controller_id: setup.zone === "battlefield" ? controllerId : setup.owner_id,
    zone: setup.zone, is_tapped: false, counters: { ...EMPTY_COUNTERS },
    attached_to: null, damage_marked: 0, is_commander: setup.is_commander ?? false
  };
  const cards = { ...state.cards, [card.instance_id]: card };
  const destinationId = setup.zone === "battlefield" ? controllerId : owner.id;
  const players = state.players.map(p => p.id !== destinationId ? p : {
    ...p, [setup.zone]: [...p[setup.zone], card.instance_id]
  });
  return { ...state, revision: state.revision + 1, cards, players };
}

export function moveCardToZone(
  state: GameState,
  instanceId: InstanceId,
  destination: Zone,
  destinationControllerId?: PlayerId
): GameState {
  const card = state.cards[instanceId];
  if (!card) throw new EngineError("INVALID_ZONE_MOVE", "Instance de carte inconnue.");
  const controllerId = destination === "battlefield" || destination === "stack"
    ? destinationControllerId ?? card.controller_id
    : card.owner_id;
  const destinationPlayer = state.players.find(p => p.id === controllerId);
  if (!destinationPlayer) throw new EngineError("UNKNOWN_PLAYER", "Contrôleur de destination inconnu.");
  if (destination === "battlefield" && destinationPlayer.isEliminated) throw new EngineError("PLAYER_ELIMINATED", "Un joueur éliminé ne peut pas recevoir le contrôle d'un permanent.");

  const players = state.players.map(p => {
    const next: typeof p = {
      ...p,
      hand: p.hand.filter(id => id !== instanceId),
      library: p.library.filter(id => id !== instanceId),
      graveyard: p.graveyard.filter(id => id !== instanceId),
      exile: p.exile.filter(id => id !== instanceId),
      battlefield: p.battlefield.filter(id => id !== instanceId),
      command: p.command.filter(id => id !== instanceId)
    };
    if (p.id !== controllerId || destination === "stack") return next;
    if (destination === "hand" || destination === "library" || destination === "graveyard" ||
        destination === "exile" || destination === "battlefield" || destination === "command") {
      return { ...next, [destination]: [...next[destination], instanceId] };
    }
    return next;
  });
  const cards = Object.fromEntries(Object.entries(state.cards).map(([id, existing]) => [
    id, existing.attached_to === instanceId ? { ...existing, attached_to: null } : existing
  ]));
  const moved: RuntimeCardState = {
    ...card, zone: destination, controller_id: controllerId,
    is_tapped: false, counters: { ...EMPTY_COUNTERS }, attached_to: null, damage_marked: 0
  };
  return { ...state, revision: state.revision + 1, cards: { ...cards, [instanceId]: moved }, players };
}
