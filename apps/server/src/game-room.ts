import {
  advanceAfterAllPass, advanceAutomaticStep, createGame, EngineError, passPriority, resolveCommanderReturnChoice,
  type GameState, type PlayerSetup
} from "@commander-pocket/game-engine";
import type { GameCommandEnvelope } from "@commander-pocket/protocol";

export type RoomCommand = GameCommandEnvelope<unknown>;

export type RoomCommandResult =
  | { accepted: true; revision: number; outcome: "passed" | "step-advanced" | "resolution-required" | "decision-resolved" }
  | { accepted: false; revision: number; code: string };

export class GameRoom {
  private currentState: GameState;
  private readonly commandResults = new Map<string, RoomCommandResult>();

  constructor(readonly id: string, players: readonly PlayerSetup[], initialState?: GameState) {
    this.currentState = initialState ?? advanceAutomaticStep(createGame(id, players));
  }

  get state(): GameState {
    return this.currentState;
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
      return accepted;
    } catch (error) {
      const code = error instanceof EngineError ? error.code : "ENGINE_ERROR";
      return this.reject(cacheKey, code);
    }
  }

  private reject(cacheKey: string, code: string): RoomCommandResult {
    const rejected: RoomCommandResult = { accepted: false, revision: this.currentState.revision, code };
    this.commandResults.set(cacheKey, rejected);
    return rejected;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
