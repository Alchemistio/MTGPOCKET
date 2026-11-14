import {
  advanceAfterAllPass, advanceAutomaticStep, createGame, EngineError, passPriority, resolveCommanderReturnChoice,
  type GameState, type PlayerSetup
} from "@commander-pocket/game-engine";
import type { GameCommandEnvelope, GameEventEnvelope } from "@commander-pocket/protocol";

export type RoomCommand = GameCommandEnvelope<unknown>;

export type RoomCommandResult =
  | { accepted: true; revision: number; outcome: "passed" | "step-advanced" | "resolution-required" | "decision-resolved" }
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

  constructor(readonly id: string, players: readonly PlayerSetup[], initialState?: GameState) {
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
    const replayRoom = new GameRoom(this.id, base.players.map(({ id, name, seat }) => ({ id, name, seat })), base);
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
        const accepted: RoomCommandResult = { accepted: true, revision: this.currentState.revision, outcome: "decision-resolved" };
        this.commandResults.set(cacheKey, accepted);
        this.recordEvent(command, accepted);
        return accepted;
      } catch (error) {
        const code = error instanceof EngineError ? error.code : "ENGINE_ERROR";
        return this.reject(cacheKey, code);
      }
    }
    if (command.type !== "pass-priority") return this.reject(cacheKey, "UNSUPPORTED_COMMAND");

    try {
      const result = passPriority(this.currentState, command.playerId);
      let nextState = result.state;
      let outcome: "passed" | "step-advanced" | "resolution-required";
      if (result.outcome === "step-advance") {
        nextState = advanceAfterAllPass(nextState);
        outcome = "step-advanced";
      } else if (result.outcome === "resolution-required") {
        outcome = "resolution-required";
      } else {
        outcome = "passed";
      }
      this.currentState = nextState;
      const accepted: RoomCommandResult = { accepted: true, revision: nextState.revision, outcome };
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

function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
