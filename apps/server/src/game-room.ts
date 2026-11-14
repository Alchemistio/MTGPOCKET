import {
  advanceAfterAllPass, advanceAutomaticStep, createGame, EngineError, moveCardToZone, passPriority, pushStackItem, resolveCommanderReturnChoice, resolveStackItem,
  type GameState, type PlayerSetup, type StackItem
} from "@commander-pocket/game-engine";
import type { GameCommandEnvelope, GameEventEnvelope } from "@commander-pocket/protocol";
import type { CardDefinition } from "@commander-pocket/card-data";

export type StackEffectResolver = (state: GameState, item: StackItem) => GameState;
export type CardDefinitionResolver = (cardId: string) => CardDefinition | undefined;

export type RoomCommand = GameCommandEnvelope<unknown>;

export type RoomCommandResult =
  | { accepted: true; revision: number; outcome: "passed" | "step-advanced" | "resolution-required" | "stack-resolved" | "decision-resolved" | "spell-cast" }
  | { accepted: false; revision: number; code: string };

type AcceptedRoomCommandResult = Extract<RoomCommandResult, { accepted: true }>;
type RoomEvent = GameEventEnvelope<{
  engineVersion: 1;
  snapshotRevision: number;
  command: RoomCommand;
  result: AcceptedRoomCommandResult;
}>;

const GAME_ENGINE_VERSION = 1 as const;

export class GameRoom {
  private currentState: GameState;
  private replayBaseState: GameState;
  private readonly commandResults = new Map<string, RoomCommandResult>();
  private readonly events: RoomEvent[] = [];

  constructor(readonly id: string, players: readonly PlayerSetup[], initialState?: GameState, private readonly resolveStackEffect?: StackEffectResolver, private readonly resolveCard?: CardDefinitionResolver) {
    this.currentState = initialState ?? advanceAutomaticStep(createGame(id, players));
    this.replayBaseState = cloneGameState(this.currentState);
  }

  get state(): GameState {
    return this.currentState;
  }

  /** Returns a defensive copy of the accepted-command journal; it never exposes GameState snapshots. */
  get eventLog(): readonly RoomEvent[] {
    return this.events.map(event => ({
      ...event,
      payload: {
        ...event.payload,
        command: JSON.parse(JSON.stringify(event.payload.command)) as RoomCommand,
        result: { ...event.payload.result }
      }
    }));
  }

  /** Rebuilds the current state by replaying accepted commands from the authoritative start snapshot. */
  replay(): GameState {
    const base = cloneGameState(this.replayBaseState);
    const replayRoom = new GameRoom(this.id, base.players.map(({ id, name, seat }) => ({ id, name, seat })), base, this.resolveStackEffect, this.resolveCard);
    for (const event of this.events) {
      if (event.protocolVersion !== 1 || event.payload.engineVersion !== GAME_ENGINE_VERSION ||
          event.payload.snapshotRevision !== this.replayBaseState.revision ||
          event.payload.command.protocolVersion !== event.protocolVersion) {
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
    if (command.type === "cast-spell") return this.castSpell(command, cacheKey);
    if (command.type !== "pass-priority") return this.reject(cacheKey, "UNSUPPORTED_COMMAND");

    try {
      const result = passPriority(this.currentState, command.playerId);
      let nextState = result.state;
      let outcome: "passed" | "step-advanced" | "resolution-required" | "stack-resolved";
      if (result.outcome === "step-advance") {
        nextState = advanceAfterAllPass(nextState);
        outcome = "step-advanced";
      } else if (result.outcome === "resolution-required") {
        if (this.resolveStackEffect) {
          nextState = resolveStackItem(nextState, result.stackItemId, (state, item) => {
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
    if (definition.layout !== "normal") return this.reject(cacheKey, "UNSUPPORTED_CARD_LAYOUT");
    const isInstant = /\bInstant\b/.test(definition.typeLine);
    const isSorcery = /\bSorcery\b/.test(definition.typeLine);
    if (!isInstant && !isSorcery) return this.reject(cacheKey, "UNSUPPORTED_SPELL_TYPE");
    if (/\btarget\b/i.test(definition.oracleText)) return this.reject(cacheKey, "TARGET_SELECTION_NOT_SUPPORTED");
    if (isSorcery && (this.currentState.activePlayerId !== command.playerId ||
        (this.currentState.phase !== "precombat-main" && this.currentState.phase !== "postcombat-main") ||
        this.currentState.stack.length > 0 || this.currentState.awaitingResolutionId !== null)) {
      return this.reject(cacheKey, "SORCERY_TIMING");
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
          typeLine: definition.typeLine, oracleText: definition.oracleText, manaCost: definition.manaCost
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
