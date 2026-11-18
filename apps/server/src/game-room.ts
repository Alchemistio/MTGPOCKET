import {
  activateStackAbility, advanceAfterAllPass, advanceAutomaticStep, applyStateBasedActions, completeStackResolution, createGame, createZoneChangeReplacementSession, discardCards, EngineError, executeStackItemHandler, moveCardToZone, passPriority, processZoneChangeWithReplacements, pushStackItem, resumeZoneChangeWithReplacements, resolveCommanderReturnChoice, resolveStackItem, tapPermanentForMana,
  type GameState, type PendingZoneChangeChoice, type PlayerSetup, type StackItem, type ZoneChangeReplacementEffect, type ZoneChangeEvent
} from "@commander-pocket/game-engine";
import type { GameCommandEnvelope, GameEventEnvelope } from "@commander-pocket/protocol";
import type { CardDefinition } from "@commander-pocket/card-data";
import { basicLandManaOptions, basicStackHandlers, compileBasicActivatedAbility, createBasicPermanentEntryReplacements, createBasicPermanentEtbTrigger, isBasicActivatedAbilityPayload, isBasicEtbTriggerPayload, isBasicSpellPayload } from "./basic-spell-effects.js";

export type StackEffectResolver = (state: GameState, item: StackItem) => GameState;
export type CardDefinitionResolver = (cardId: string) => CardDefinition | undefined;
export type CardSpellSupport = (definition: CardDefinition) => boolean;
export type EntryReplacementResolver = (state: GameState, item: StackItem, definition: CardDefinition) => readonly ZoneChangeReplacementEffect[];

export type RoomCommand = GameCommandEnvelope<unknown>;

export type RoomCommandResult =
  | { accepted: true; revision: number; outcome: "passed" | "step-advanced" | "resolution-required" | "stack-resolved" | "decision-required" | "decision-resolved" | "spell-cast" | "mana-added" | "land-played" | "ability-activated" }
  | { accepted: false; revision: number; code: string };

type AcceptedRoomCommandResult = Extract<RoomCommandResult, { accepted: true }>;
export type PersistedRoomEvent = GameEventEnvelope<{
  engineVersion: 1;
  snapshotRevision: number;
  command: RoomCommand;
  result: AcceptedRoomCommandResult;
}>;

export interface GameRoomCheckpoint {
  schemaVersion: 1;
  engineVersion: 1;
  gameId: string;
  /** Authoritative state immediately before the first event in the journal. */
  snapshot: GameState;
  events: readonly PersistedRoomEvent[];
}

const GAME_ENGINE_VERSION = 1 as const;

export class GameRoom {
  private currentState: GameState;
  private replayBaseState: GameState;
  private readonly commandResults = new Map<string, RoomCommandResult>();
  private readonly events: PersistedRoomEvent[] = [];

  constructor(readonly id: string, players: readonly PlayerSetup[], initialState?: GameState, private readonly resolveStackEffect?: StackEffectResolver, private readonly resolveCard?: CardDefinitionResolver, private readonly supportsSpell?: CardSpellSupport, private readonly resolveEntryReplacements?: EntryReplacementResolver) {
    this.currentState = initialState ?? advanceAutomaticStep(createGame(id, players));
    this.replayBaseState = cloneGameState(this.currentState);
  }

  get state(): GameState {
    return this.currentState;
  }

  /** Returns a defensive copy of the accepted-command journal; it never exposes GameState snapshots. */
  get eventLog(): readonly PersistedRoomEvent[] {
    return this.events.map(event => ({
      ...event,
      payload: {
        ...event.payload,
        command: JSON.parse(JSON.stringify(event.payload.command)) as RoomCommand,
        result: { ...event.payload.result }
      }
    }));
  }

  /** A serializable checkpoint for server-side persistence; never send this to a client. */
  get checkpoint(): GameRoomCheckpoint {
    return {
      schemaVersion: 1,
      engineVersion: GAME_ENGINE_VERSION,
      gameId: this.id,
      snapshot: cloneGameState(this.replayBaseState),
      events: this.eventLog
    };
  }

  /** Restores a room by validating and replaying its persisted, accepted-command journal. */
  static restore(
    checkpoint: GameRoomCheckpoint,
    resolveStackEffect?: StackEffectResolver,
    resolveCard?: CardDefinitionResolver,
    supportsSpell?: CardSpellSupport,
    resolveEntryReplacements?: EntryReplacementResolver
  ): GameRoom {
    if (!isRecord(checkpoint) || checkpoint.schemaVersion !== 1 ||
        checkpoint.engineVersion !== GAME_ENGINE_VERSION ||
        typeof checkpoint.gameId !== "string" || !isRecord(checkpoint.snapshot) ||
        checkpoint.gameId !== checkpoint.snapshot.id ||
        !Array.isArray(checkpoint.snapshot.players) || !Array.isArray(checkpoint.events)) {
      throw new Error("INVALID_ROOM_CHECKPOINT");
    }
    const snapshot = cloneGameState(checkpoint.snapshot);
    // Backward-compatible migration for persisted rooms created before land-play tracking.
    snapshot.pendingZoneChangeChoice ??= null;
    snapshot.players = snapshot.players.map(player => ({
      ...player, landsPlayedThisTurn: player.landsPlayedThisTurn ?? 0
    }));
    const players = snapshot.players.map(({ id, name, seat }) => ({ id, name, seat }));
    const room = new GameRoom(checkpoint.gameId, players, snapshot, resolveStackEffect, resolveCard, supportsSpell, resolveEntryReplacements);
    for (const rawEvent of checkpoint.events as readonly unknown[]) {
      if (!isRecord(rawEvent) || !isRecord(rawEvent.payload) ||
          !isRecord(rawEvent.payload.command) || !isRecord(rawEvent.payload.result)) {
        throw new Error("INVALID_ROOM_EVENT");
      }
      const event = rawEvent as unknown as PersistedRoomEvent;
      if (event.protocolVersion !== 1 || event.gameId !== checkpoint.gameId ||
          event.type !== "command-applied" || event.payload.engineVersion !== GAME_ENGINE_VERSION ||
          event.payload.snapshotRevision !== snapshot.revision ||
          event.payload.command.protocolVersion !== event.protocolVersion ||
          event.payload.command.gameId !== checkpoint.gameId ||
          event.eventId !== `${event.payload.command.playerId}:${event.payload.command.commandId}`) {
        throw new Error("UNSUPPORTED_EVENT_LOG_VERSION");
      }
      const result = room.apply(event.payload.command);
      if (!result.accepted || result.revision !== event.revision ||
          JSON.stringify(result) !== JSON.stringify(event.payload.result)) {
        throw new Error("EVENT_REPLAY_MISMATCH");
      }
    }
    return room;
  }

  /** Rebuilds the current state by replaying accepted commands from the authoritative start snapshot. */
  replay(): GameState {
    const base = cloneGameState(this.replayBaseState);
    const replayRoom = new GameRoom(this.id, base.players.map(({ id, name, seat }) => ({ id, name, seat })), base, this.resolveStackEffect, this.resolveCard, this.supportsSpell, this.resolveEntryReplacements);
    for (const event of this.events) {
      if (event.protocolVersion !== 1 || event.gameId !== this.id || event.type !== "command-applied" ||
          event.payload.engineVersion !== GAME_ENGINE_VERSION ||
          event.payload.snapshotRevision !== this.replayBaseState.revision ||
          event.payload.command.protocolVersion !== event.protocolVersion ||
          event.eventId !== `${event.payload.command.playerId}:${event.payload.command.commandId}`) {
        throw new Error("UNSUPPORTED_EVENT_LOG_VERSION");
      }
      const result = replayRoom.apply(event.payload.command);
      if (!result.accepted || result.revision !== event.revision ||
          JSON.stringify(result) !== JSON.stringify(event.payload.result)) {
        throw new Error("EVENT_REPLAY_MISMATCH");
      }
    }
    return replayRoom.state;
  }

  /** Installs the server-validated pregame state as the authoritative LAN room state. */
  replaceStateFromPregame(state: GameState): void {
    if (this.currentState.deckSetupComplete) throw new Error("GAME_ALREADY_STARTED");
    if (state.id !== this.id) throw new Error("GAME_ID_MISMATCH");
    if (state.status !== "active" || !state.deckSetupComplete ||
        state.phase !== "beginning" || state.step !== "upkeep" || state.priorityPlayerId === null) {
      throw new Error("PREGAME_STATE_NOT_READY");
    }
    if (state.revision <= this.currentState.revision) throw new Error("STALE_PREGAME_STATE");
    const currentPlayers = new Map(this.currentState.players.map(player => [player.id, player]));
    if (state.players.length !== currentPlayers.size || state.players.some(player => {
      const current = currentPlayers.get(player.id);
      return !current || current.name !== player.name || current.seat !== player.seat;
    })) {
      throw new Error("PREGAME_PLAYER_MISMATCH");
    }
    this.currentState = state;
    this.replayBaseState = cloneGameState(state);
    this.events.length = 0;
    this.commandResults.clear();
  }

  apply(command: RoomCommand): RoomCommandResult {
    const cacheKey = `${command.playerId}:${command.commandId}`;
    const previous = this.commandResults.get(cacheKey);
    if (previous) return previous;
    if (command.protocolVersion !== 1) return this.reject(cacheKey, "UNSUPPORTED_PROTOCOL");
    if (command.gameId !== this.id) return this.reject(cacheKey, "UNKNOWN_GAME");
    if (command.expectedRevision !== this.currentState.revision) return this.reject(cacheKey, "STALE_REVISION");
    if (command.type === "resolve-commander-return") {
      const payload = command.payload;
      if (!isRecord(payload) || typeof payload.instanceId !== "string" ||
          (payload.choice !== "command" && payload.choice !== "stay")) {
        return this.reject(cacheKey, "INVALID_COMMANDER_CHOICE");
      }
      const pending = this.currentState.pendingCommanderChoices.find(item => item.instanceId === payload.instanceId);
      if (!pending || pending.ownerId !== command.playerId) {
        return this.reject(cacheKey, "NOT_COMMANDER_OWNER");
      }
      try {
        this.currentState = resolveCommanderReturnChoice(this.currentState, payload.instanceId, payload.choice);
        const accepted: AcceptedRoomCommandResult = { accepted: true, revision: this.currentState.revision, outcome: "decision-resolved" };
        this.commandResults.set(cacheKey, accepted);
        this.recordEvent(command, accepted);
        return accepted;
      } catch (error) {
        const code = error instanceof EngineError ? error.code : "ENGINE_ERROR";
        return this.reject(cacheKey, code);
      }
    }
    if (command.type === "resolve-zone-change-replacement") return this.resolveZoneChangeReplacement(command, cacheKey);
    if (command.type === "cast-spell") return this.castSpell(command, cacheKey);
    if (command.type === "play-land") return this.playLand(command, cacheKey);
    if (command.type === "discard-cards") return this.discardPendingCards(command, cacheKey);
    if (command.type === "tap-for-mana") return this.tapForMana(command, cacheKey);
    if (command.type === "activate-ability") return this.activateAbility(command, cacheKey);
    if (command.type !== "pass-priority") return this.reject(cacheKey, "UNSUPPORTED_COMMAND");

    try {
      const result = passPriority(this.currentState, command.playerId);
      let nextState = result.state;
      let outcome: "passed" | "step-advanced" | "resolution-required" | "stack-resolved";
      if (result.outcome === "step-advance") {
        nextState = advanceAfterAllPass(nextState);
        if (nextState.step === "cleanup" && nextState.pendingDiscardCount === 0) {
          nextState = advanceAutomaticStep(nextState);
          nextState = advanceAutomaticStep(nextState);
        }
        outcome = "step-advanced";
      } else if (result.outcome === "resolution-required") {
        const resolvingTop = nextState.stack[nextState.stack.length - 1];
        const payload = resolvingTop && isRecord(resolvingTop.payload) ? resolvingTop.payload : {};
        const isPermanentSpell = resolvingTop?.kind === "spell" && payload.permanent === true &&
          resolvingTop.source_instance_id !== null;
        const hasBuiltInActivatedResolver = resolvingTop?.id === result.stackItemId &&
          resolvingTop.kind === "activated-ability" && isBasicActivatedAbilityPayload(resolvingTop.payload);
        if (isPermanentSpell && resolvingTop) {
          const resolution = this.resolvePermanentSpellEntry(nextState, resolvingTop);
          nextState = resolution.state;
          outcome = resolution.outcome;
        } else if (this.resolveStackEffect || hasBuiltInActivatedResolver) {
          nextState = resolveStackItem(nextState, result.stackItemId, (state, item) => {
            if (item.kind === "spell" && isBasicSpellPayload(item.payload)) {
              const handled = executeStackItemHandler(state, item.id, basicStackHandlers);
              if (handled.status === "resolved") {
                const resolved = handled.state;
                if (item.source_instance_id && resolved.cards[item.source_instance_id]?.zone === "stack") {
                  return moveCardToZone(resolved, item.source_instance_id, "graveyard");
                }
                return resolved;
              }
              if (handled.status === "invalid-payload") throw new Error("INVALID_BASIC_SPELL_PAYLOAD");
            }
            if (item.kind === "triggered-ability" && isBasicEtbTriggerPayload(item.payload)) {
              const handled = executeStackItemHandler(state, item.id, basicStackHandlers);
              if (handled.status === "resolved") return handled.state;
              if (handled.status === "invalid-payload") throw new Error("INVALID_BASIC_ETB_TRIGGER_PAYLOAD");
            }
            if (item.kind === "activated-ability" && isBasicActivatedAbilityPayload(item.payload)) {
              const handled = executeStackItemHandler(state, item.id, basicStackHandlers);
              if (handled.status === "resolved") return handled.state;
              if (handled.status === "invalid-payload") throw new Error("INVALID_BASIC_ACTIVATED_ABILITY_PAYLOAD");
            }
            const resolved = this.resolveStackEffect!(state, item);
            if (item.kind === "spell" && item.source_instance_id &&
                resolved.cards[item.source_instance_id]?.zone === "stack") {
              return moveCardToZone(resolved, item.source_instance_id, "graveyard");
            }
            return resolved;
          });
          outcome = "stack-resolved";
        } else {
          outcome = "resolution-required";
        }
      } else {
        outcome = "passed";
      }
      this.currentState = nextState;
      const accepted: AcceptedRoomCommandResult = { accepted: true, revision: nextState.revision, outcome };
      this.commandResults.set(cacheKey, accepted);
      this.recordEvent(command, accepted);
      return accepted;
    } catch (error) {
      const code = error instanceof EngineError ? error.code : "ENGINE_ERROR";
      return this.reject(cacheKey, code);
    }
  }

  private entryReplacementEffects(state: GameState, item: StackItem, definition: CardDefinition): readonly ZoneChangeReplacementEffect[] {
    return [
      ...createBasicPermanentEntryReplacements(definition, item.controller_id),
      ...(this.resolveEntryReplacements?.(state, item, definition) ?? [])
    ];
  }

  private resolvePermanentSpellEntry(
    state: GameState,
    item: StackItem
  ): { state: GameState; outcome: "stack-resolved" | "decision-required" } {
    if (!item.source_instance_id || !isRecord(item.payload) || typeof item.payload.cardId !== "string") {
      throw new Error("INVALID_PERMANENT_SPELL_SOURCE");
    }
    const definition = this.resolveCard?.(item.payload.cardId);
    if (!definition || definition.providerId !== item.payload.cardId) throw new Error("CARD_NOT_FOUND");
    const eventId = "zone-change:" + item.id;
    const transition = processZoneChangeWithReplacements(state, {
      instanceId: item.source_instance_id,
      destination: "battlefield",
      destinationControllerId: item.controller_id
    }, this.entryReplacementEffects(state, item, definition), {
      eventId, cause: "spell-resolution"
    });
    if (transition.status === "choice-required") {
      const pending: PendingZoneChangeChoice = {
        id: "zone-change-choice:" + item.id + ":" + state.revision,
        chooserPlayerId: item.controller_id,
        stackItemId: item.id,
        sourceInstanceId: item.source_instance_id,
        cardId: definition.providerId,
        eventId,
        session: transition.session,
        candidateEffectIds: transition.candidates.map(candidate => candidate.id)
      };
      return { state: { ...state, pendingZoneChangeChoice: pending }, outcome: "decision-required" };
    }
    let nextState = transition.status === "committed" ? transition.state : state;
    nextState = applyStateBasedActions(completeStackResolution({
      ...nextState, pendingZoneChangeChoice: null
    }, item.id));
    if (transition.status === "committed" && transition.event?.toZone === "battlefield" &&
        this.supportsSpell?.(definition)) {
      const trigger = createBasicPermanentEtbTrigger(
        item.source_instance_id, item.controller_id, definition, nextState.revision, transition.event.eventId
      );
      if (trigger) nextState = pushStackItem(nextState, trigger);
    }
    return { state: nextState, outcome: "stack-resolved" };
  }

  private resolveZoneChangeReplacement(command: RoomCommand, cacheKey: string): RoomCommandResult {
    const pending = this.currentState.pendingZoneChangeChoice;
    if (!pending || pending.chooserPlayerId !== command.playerId) {
      return this.reject(cacheKey, "NOT_PENDING_ZONE_CHANGE_CHOOSER");
    }
    if (!isRecord(command.payload) || command.payload.pendingId !== pending.id ||
        typeof command.payload.effectId !== "string") {
      return this.reject(cacheKey, "INVALID_ZONE_CHANGE_REPLACEMENT_CHOICE");
    }
    const effectId = command.payload.effectId;
    if (!pending.candidateEffectIds.includes(effectId)) {
      return this.reject(cacheKey, "INVALID_ZONE_CHANGE_REPLACEMENT_CHOICE");
    }
    const top = this.currentState.stack[this.currentState.stack.length - 1];
    if (!top || top.id !== pending.stackItemId || this.currentState.awaitingResolutionId !== pending.stackItemId) {
      return this.reject(cacheKey, "PENDING_RESOLUTION_MISMATCH");
    }
    const definition = this.resolveCard?.(pending.cardId);
    if (!definition || definition.providerId !== pending.cardId) return this.reject(cacheKey, "CARD_NOT_FOUND");
    try {
      const transition = resumeZoneChangeWithReplacements(
        this.currentState,
        pending.session,
        this.entryReplacementEffects(this.currentState, top, definition),
        { eventId: pending.eventId, cause: "spell-resolution" },
        effectId
      );
      if (transition.status === "choice-required") {
        const revision = this.currentState.revision + 1;
        const nextPending: PendingZoneChangeChoice = {
          ...pending,
          session: { ...transition.session, stateRevision: revision },
          candidateEffectIds: transition.candidates.map(candidate => candidate.id)
        };
        this.currentState = { ...this.currentState, revision, pendingZoneChangeChoice: nextPending };
        const accepted: AcceptedRoomCommandResult = {
          accepted: true, revision, outcome: "decision-required"
        };
        this.commandResults.set(cacheKey, accepted);
        this.recordEvent(command, accepted);
        return accepted;
      }
      let nextState = transition.status === "committed" ? transition.state : this.currentState;
      nextState = applyStateBasedActions(completeStackResolution({
        ...nextState, pendingZoneChangeChoice: null
      }, pending.stackItemId));
      if (transition.status === "committed" && transition.event?.toZone === "battlefield" &&
          this.supportsSpell?.(definition)) {
        const trigger = createBasicPermanentEtbTrigger(
          pending.sourceInstanceId, top.controller_id, definition, nextState.revision, transition.event.eventId
        );
        if (trigger) nextState = pushStackItem(nextState, trigger);
      }
      this.currentState = nextState;
      const accepted: AcceptedRoomCommandResult = {
        accepted: true, revision: nextState.revision, outcome: "decision-resolved"
      };
      this.commandResults.set(cacheKey, accepted);
      this.recordEvent(command, accepted);
      return accepted;
    } catch (error) {
      const code = error instanceof EngineError ? error.code : "ENGINE_ERROR";
      return this.reject(cacheKey, code);
    }
  }

  private playLand(command: RoomCommand, cacheKey: string): RoomCommandResult {
    if (!this.resolveCard) return this.reject(cacheKey, "CARD_CATALOG_NOT_CONFIGURED");
    if (this.currentState.status !== "active" || !this.currentState.deckSetupComplete) {
      return this.reject(cacheKey, "GAME_NOT_STARTED");
    }
    if (this.currentState.priorityPlayerId !== command.playerId) return this.reject(cacheKey, "NOT_PRIORITY_PLAYER");
    if (this.currentState.activePlayerId !== command.playerId ||
        (this.currentState.phase !== "precombat-main" && this.currentState.phase !== "postcombat-main") ||
        this.currentState.stack.length > 0 || this.currentState.awaitingResolutionId !== null) {
      return this.reject(cacheKey, "LAND_TIMING");
    }
    if (!isRecord(command.payload) || typeof command.payload.instanceId !== "string") {
      return this.reject(cacheKey, "INVALID_LAND_PAYLOAD");
    }
    const instanceId = command.payload.instanceId;
    const card = this.currentState.cards[instanceId];
    const player = this.currentState.players.find(item => item.id === command.playerId);
    if (!player || !card || card.zone !== "hand" || card.owner_id !== command.playerId ||
        !player.hand.includes(instanceId) || card.is_commander) {
      return this.reject(cacheKey, "LAND_NOT_PLAYABLE_FROM_HAND");
    }
    if (player.landsPlayedThisTurn >= 1) return this.reject(cacheKey, "LAND_PLAY_LIMIT");
    const definition = this.resolveCard(card.card_id);
    if (!definition || definition.providerId !== card.card_id) return this.reject(cacheKey, "CARD_NOT_FOUND");
    if (definition.layout !== "normal") return this.reject(cacheKey, "LAND_LAYOUT_NOT_SUPPORTED");
    if (definition.manaCost !== null && definition.manaCost !== "") return this.reject(cacheKey, "LAND_HAS_MANA_COST");
    if (basicLandManaOptions(definition).length === 0) return this.reject(cacheKey, "LAND_NOT_SUPPORTED");

    try {
      const moved = moveCardToZone(this.currentState, instanceId, "battlefield", command.playerId);
      const nextState: GameState = {
        ...moved,
        players: moved.players.map(item => item.id === command.playerId
          ? { ...item, landsPlayedThisTurn: item.landsPlayedThisTurn + 1 }
          : item)
      };
      this.currentState = nextState;
      const accepted: AcceptedRoomCommandResult = {
        accepted: true, revision: nextState.revision, outcome: "land-played"
      };
      this.commandResults.set(cacheKey, accepted);
      this.recordEvent(command, accepted);
      return accepted;
    } catch (error) {
      const code = error instanceof EngineError ? error.code : "ENGINE_ERROR";
      return this.reject(cacheKey, code);
    }
  }

  private activateAbility(command: RoomCommand, cacheKey: string): RoomCommandResult {
    if (!this.resolveCard) return this.reject(cacheKey, "CARD_CATALOG_NOT_CONFIGURED");
    if (this.currentState.status !== "active" || !this.currentState.deckSetupComplete) {
      return this.reject(cacheKey, "GAME_NOT_STARTED");
    }
    if (this.currentState.priorityPlayerId !== command.playerId) return this.reject(cacheKey, "NOT_PRIORITY_PLAYER");
    if (!isRecord(command.payload) || typeof command.payload.instanceId !== "string" ||
        !Number.isSafeInteger(command.payload.abilityIndex) || (command.payload.abilityIndex as number) < 0) {
      return this.reject(cacheKey, "INVALID_ACTIVATED_ABILITY_PAYLOAD");
    }

    const instanceId = command.payload.instanceId;
    const card = this.currentState.cards[instanceId];
    if (!card || card.zone !== "battlefield" || card.controller_id !== command.playerId) {
      return this.reject(cacheKey, "ABILITY_SOURCE_NOT_CONTROLLED");
    }
    const definition = this.resolveCard(card.card_id);
    if (!definition || definition.providerId !== card.card_id) return this.reject(cacheKey, "CARD_NOT_FOUND");
    if (definition.layout !== "normal" || !/\b(?:Artifact|Enchantment|Land|Creature)\b/.test(definition.typeLine)) {
      return this.reject(cacheKey, "ACTIVATED_ABILITY_SOURCE_NOT_SUPPORTED");
    }

    const compiled = compileBasicActivatedAbility(definition, command.payload.abilityIndex as number);
    if (!compiled) return this.reject(cacheKey, "UNSUPPORTED_ACTIVATED_ABILITY");
    // CR 602.5a needs control-since-turn and haste tracking. Until those state
    // facts exist, do not allow this first compiler slice to tap creatures.
    if (compiled.tapSource && /\bCreature\b/.test(definition.typeLine)) {
      return this.reject(cacheKey, "CREATURE_TAP_ABILITY_UNSUPPORTED");
    }

    try {
      const nextState = activateStackAbility(this.currentState, {
        controllerId: command.playerId,
        sourceInstanceId: instanceId,
        manaCost: compiled.manaCost,
        tapSource: compiled.tapSource,
        stackItem: {
          id: "activated:" + command.playerId + ":" + command.commandId,
          controller_id: command.playerId,
          source_instance_id: instanceId,
          kind: "activated-ability",
          payload: compiled.payload
        }
      });
      this.currentState = nextState;
      const accepted: AcceptedRoomCommandResult = {
        accepted: true, revision: nextState.revision, outcome: "ability-activated"
      };
      this.commandResults.set(cacheKey, accepted);
      this.recordEvent(command, accepted);
      return accepted;
    } catch (error) {
      const code = error instanceof EngineError ? error.code : "ENGINE_ERROR";
      return this.reject(cacheKey, code);
    }
  }

  private tapForMana(command: RoomCommand, cacheKey: string): RoomCommandResult {
    if (!this.resolveCard) return this.reject(cacheKey, "CARD_CATALOG_NOT_CONFIGURED");
    if (this.currentState.status !== "active" || !this.currentState.deckSetupComplete) return this.reject(cacheKey, "GAME_NOT_STARTED");
    if (this.currentState.priorityPlayerId !== command.playerId) return this.reject(cacheKey, "NOT_PRIORITY_PLAYER");
    if (!isRecord(command.payload) || typeof command.payload.instanceId !== "string" ||
        typeof command.payload.color !== "string") return this.reject(cacheKey, "INVALID_MANA_PAYLOAD");
    const card = this.currentState.cards[command.payload.instanceId];
    if (!card || card.zone !== "battlefield" || card.controller_id !== command.playerId) {
      return this.reject(cacheKey, "MANA_SOURCE_NOT_CONTROLLED");
    }
    const definition = this.resolveCard(card.card_id);
    if (!definition || definition.providerId !== card.card_id) return this.reject(cacheKey, "CARD_NOT_FOUND");
    if (!basicLandManaOptions(definition).includes(command.payload.color)) return this.reject(cacheKey, "MANA_SOURCE_NOT_SUPPORTED");
    try {
      const nextState = tapPermanentForMana(this.currentState, command.playerId, command.payload.instanceId, command.payload.color);
      this.currentState = nextState;
      const accepted: AcceptedRoomCommandResult = { accepted: true, revision: nextState.revision, outcome: "mana-added" };
      this.commandResults.set(cacheKey, accepted);
      this.recordEvent(command, accepted);
      return accepted;
    } catch (error) {
      const code = error instanceof EngineError ? error.code : "ENGINE_ERROR";
      return this.reject(cacheKey, code);
    }
  }

  private discardPendingCards(command: RoomCommand, cacheKey: string): RoomCommandResult {
    if (!isRecord(command.payload) || !Array.isArray(command.payload.instanceIds) ||
        !command.payload.instanceIds.every(item => typeof item === "string" && item.length > 0)) {
      return this.reject(cacheKey, "INVALID_DISCARD_PAYLOAD");
    }
    if (this.currentState.pendingDiscardPlayerId !== command.playerId) {
      return this.reject(cacheKey, "NOT_PENDING_DISCARD_PLAYER");
    }
    try {
      let nextState = discardCards(this.currentState, command.playerId, command.payload.instanceIds as string[]);
      if (nextState.step === "cleanup" && nextState.pendingDiscardCount === 0) {
        nextState = advanceAutomaticStep(nextState);
        nextState = advanceAutomaticStep(nextState);
      }
      this.currentState = nextState;
      const accepted: AcceptedRoomCommandResult = { accepted: true, revision: nextState.revision, outcome: "decision-resolved" };
      this.commandResults.set(cacheKey, accepted);
      this.recordEvent(command, accepted);
      return accepted;
    } catch (error) {
      const code = error instanceof EngineError ? error.code : "INVALID_DISCARD";
      return this.reject(cacheKey, code);
    }
  }

  private castSpell(command: RoomCommand, cacheKey: string): RoomCommandResult {
    if (!this.resolveCard) return this.reject(cacheKey, "CARD_CATALOG_NOT_CONFIGURED");
    if (!this.resolveStackEffect) return this.reject(cacheKey, "SPELL_RESOLVER_NOT_CONFIGURED");
    if (this.currentState.status !== "active" || !this.currentState.deckSetupComplete) {
      return this.reject(cacheKey, "GAME_NOT_STARTED");
    }
    if (this.currentState.priorityPlayerId !== command.playerId) return this.reject(cacheKey, "NOT_PRIORITY_PLAYER");
    if (!isRecord(command.payload) || typeof command.payload.instanceId !== "string") {
      return this.reject(cacheKey, "INVALID_SPELL_PAYLOAD");
    }
    const instanceId = command.payload.instanceId;
    const card = this.currentState.cards[instanceId];
    const player = this.currentState.players.find(item => item.id === command.playerId);
    if (!player || !card || card.zone !== "hand" || card.owner_id !== command.playerId ||
        !player.hand.includes(instanceId) || card.is_commander) {
      return this.reject(cacheKey, "CARD_NOT_CASTABLE_FROM_HAND");
    }
    const definition = this.resolveCard(card.card_id);
    if (!definition || definition.providerId !== card.card_id) return this.reject(cacheKey, "CARD_NOT_FOUND");
    const supportedByHandler = this.supportsSpell?.(definition) ?? false;
    if (this.supportsSpell && !supportedByHandler) return this.reject(cacheKey, "UNSUPPORTED_SPELL_EFFECT");
    if (definition.layout !== "normal") return this.reject(cacheKey, "UNSUPPORTED_CARD_LAYOUT");
    const isInstant = /\bInstant\b/.test(definition.typeLine);
    const isSorcery = /\bSorcery\b/.test(definition.typeLine);
    const isPermanent = !isInstant && !isSorcery &&
      /\b(?:Creature|Artifact|Enchantment)\b/.test(definition.typeLine);
    if (!isInstant && !isSorcery && !isPermanent) return this.reject(cacheKey, "UNSUPPORTED_SPELL_TYPE");
    if (/\btarget\b/i.test(definition.oracleText)) return this.reject(cacheKey, "TARGET_SELECTION_NOT_SUPPORTED");
    if (isPermanent && definition.oracleText.trim().length > 0 && !supportedByHandler) {
      return this.reject(cacheKey, "UNSUPPORTED_PERMANENT_ABILITIES");
    }
    if ((isSorcery || isPermanent) && (this.currentState.activePlayerId !== command.playerId ||
        (this.currentState.phase !== "precombat-main" && this.currentState.phase !== "postcombat-main") ||
        this.currentState.stack.length > 0 || this.currentState.awaitingResolutionId !== null)) {
      return this.reject(cacheKey, isPermanent ? "PERMANENT_TIMING" : "SORCERY_TIMING");
    }
    const payment = paySimpleManaCost(this.currentState, command.playerId, definition.manaCost);
    if (!payment.ok) return this.reject(cacheKey, payment.code);
    try {
      let nextState = moveCardToZone(payment.state, instanceId, "stack", command.playerId);
      nextState = pushStackItem(nextState, {
        id: "spell:" + command.playerId + ":" + command.commandId,
        controller_id: command.playerId,
        source_instance_id: instanceId,
        kind: "spell",
        payload: {
          cardId: definition.providerId, oracleId: definition.oracleId, name: definition.name,
          typeLine: definition.typeLine, oracleText: definition.oracleText, manaCost: definition.manaCost,
          permanent: isPermanent
        }
      });
      this.currentState = nextState;
      const accepted: AcceptedRoomCommandResult = { accepted: true, revision: nextState.revision, outcome: "spell-cast" };
      this.commandResults.set(cacheKey, accepted);
      this.recordEvent(command, accepted);
      return accepted;
    } catch (error) {
      const code = error instanceof EngineError ? error.code : "ENGINE_ERROR";
      return this.reject(cacheKey, code);
    }
  }

  private recordEvent(command: RoomCommand, result: AcceptedRoomCommandResult): void {
    const commandCopy = JSON.parse(JSON.stringify(command)) as RoomCommand;
    this.events.push({
      protocolVersion: 1,
      gameId: this.id,
      revision: result.revision,
      eventId: `${command.playerId}:${command.commandId}`,
      type: "command-applied",
      payload: {
        engineVersion: GAME_ENGINE_VERSION,
        snapshotRevision: this.replayBaseState.revision,
        command: commandCopy,
        result: { ...result }
      }
    });
  }

  private reject(cacheKey: string, code: string): RoomCommandResult {
    const rejected: RoomCommandResult = { accepted: false, revision: this.currentState.revision, code };
    this.commandResults.set(cacheKey, rejected);
    return rejected;
  }
}


type ManaPayment = { ok: true; state: GameState } | { ok: false; code: string };

function paySimpleManaCost(state: GameState, playerId: string, manaCost: string | null): ManaPayment {
  if (manaCost === null) return { ok: false, code: "UNSUPPORTED_MANA_COST" };
  const symbols = manaCost.match(/\{[^{}]+\}/g) ?? [];
  if (symbols.join("") !== manaCost) return { ok: false, code: "UNSUPPORTED_MANA_COST" };
  const colored: Record<string, number> = {};
  let generic = 0;
  for (const token of symbols) {
    const symbol = token.slice(1, -1);
    if (/^\d+$/.test(symbol)) generic += Number(symbol);
    else if (/^[WUBRGC]$/.test(symbol)) colored[symbol] = (colored[symbol] ?? 0) + 1;
    else return { ok: false, code: "UNSUPPORTED_MANA_SYMBOL" };
  }
  const player = state.players.find(item => item.id === playerId);
  if (!player) return { ok: false, code: "UNKNOWN_PLAYER" };
  const pool: Record<string, number> = { ...player.manaPool };
  for (const [color, amount] of Object.entries(colored)) {
    if ((pool[color] ?? 0) < amount) return { ok: false, code: "INSUFFICIENT_MANA" };
    pool[color] = (pool[color] ?? 0) - amount;
  }
  for (const color of Object.keys(pool).sort()) {
    if (generic === 0) break;
    const spent = Math.min(generic, pool[color] ?? 0);
    pool[color] = (pool[color] ?? 0) - spent;
    generic -= spent;
  }
  if (generic > 0) return { ok: false, code: "INSUFFICIENT_MANA" };
  return {
    ok: true,
    state: {
      ...state,
      revision: state.revision + 1,
      players: state.players.map(item => item.id === playerId ? { ...item, manaPool: pool } : item)
    }
  };
}

function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
