import {
  advanceAfterAllPass, advanceAutomaticStep, createGame, EngineError, passPriority,
  type GameState, type PlayerSetup
} from "@commander-pocket/game-engine";
import type { GameCommandEnvelope } from "@commander-pocket/protocol";

export type RoomCommand = GameCommandEnvelope<unknown>;

export type RoomCommandResult =
  | { accepted: true; revision: number; outcome: "passed" | "step-advanced" | "resolution-required" }
  | { accepted: false; revision: number; code: string };

export class GameRoom {
  private currentState: GameState;
  private readonly commandResults = new Map<string, RoomCommandResult>();

  constructor(readonly id: string, players: readonly PlayerSetup[]) {
    this.currentState = advanceAutomaticStep(createGame(id, players));
  }

  get state(): GameState {
    return this.currentState;
  }

  apply(command: RoomCommand): RoomCommandResult {
    const previous = this.commandResults.get(command.commandId);
    if (previous) return previous;
    if (command.protocolVersion !== 1) return this.reject(command.commandId, "UNSUPPORTED_PROTOCOL");
    if (command.gameId !== this.id) return this.reject(command.commandId, "UNKNOWN_GAME");
    if (command.expectedRevision !== this.currentState.revision) return this.reject(command.commandId, "STALE_REVISION");
    if (command.type !== "pass-priority") return this.reject(command.commandId, "UNSUPPORTED_COMMAND");

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
      this.commandResults.set(command.commandId, accepted);
      return accepted;
    } catch (error) {
      const code = error instanceof EngineError ? error.code : "ENGINE_ERROR";
      return this.reject(command.commandId, code);
    }
  }

  private reject(commandId: string, code: string): RoomCommandResult {
    const rejected: RoomCommandResult = { accepted: false, revision: this.currentState.revision, code };
    this.commandResults.set(commandId, rejected);
    return rejected;
  }
}
