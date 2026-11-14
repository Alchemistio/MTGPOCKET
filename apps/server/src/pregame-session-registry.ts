import type { PlayerSetup } from "@commander-pocket/game-engine";
import type { CommanderDeckList } from "@commander-pocket/card-data";
import { PregameCoordinator } from "./pregame-coordinator.js";
import { RoomRegistry } from "./room-registry.js";
import { toPlayerView, type GameView } from "./player-view.js";

export interface AuthenticatedPregameResult<T> {
  accepted: true;
  result: T;
  view: GameView;
}

export interface PregameCoordinatorFactory {
  create(gameId: string, players: readonly PlayerSetup[]): PregameCoordinator;
}

/**
 * Authenticated adapter between seat credentials and the server-owned
 * pregame coordinator. Every returned view is projected for its requesting seat.
 */
export class PregameSessionRegistry {
  private readonly sessions = new Map<string, PregameCoordinator>();

  constructor(
    private readonly rooms: RoomRegistry,
    private readonly factory: PregameCoordinatorFactory
  ) {}

  submitDeck(gameId: string, playerId: string, token: string, deck: CommanderDeckList):
    AuthenticatedPregameResult<ReturnType<PregameCoordinator["submitDeck"]>> | { accepted: false; code: string } {
    try {
      const session = this.getAuthorizedSession(gameId, playerId, token);
      if (!session) return { accepted: false, code: "UNAUTHENTICATED" };
      const result = session.submitDeck(playerId, deck);
      return { accepted: true, result, view: toPlayerView(session.state, playerId) };
    } catch (error) {
      return { accepted: false, code: error instanceof Error ? error.message : "PREGAME_ERROR" };
    }
  }

  declareMulligan(gameId: string, playerId: string, token: string, action: "keep" | "mulligan"):
    AuthenticatedPregameResult<ReturnType<PregameCoordinator["declareMulligan"]>> | { accepted: false; code: string } {
    const session = this.getAuthorizedSession(gameId, playerId, token);
    if (!session) return { accepted: false, code: "UNAUTHENTICATED" };
    try {
      const result = session.declareMulligan(playerId, action);
      return { accepted: true, result, view: toPlayerView(session.state, playerId) };
    } catch (error) {
      return { accepted: false, code: error instanceof Error ? error.message : "PREGAME_ERROR" };
    }
  }

  chooseBottomCards(gameId: string, playerId: string, token: string, instanceIds: readonly string[]):
    AuthenticatedPregameResult<ReturnType<PregameCoordinator["chooseBottomCards"]>> | { accepted: false; code: string } {
    const session = this.getAuthorizedSession(gameId, playerId, token);
    if (!session) return { accepted: false, code: "UNAUTHENTICATED" };
    try {
      const result = session.chooseBottomCards(playerId, instanceIds);
      return { accepted: true, result, view: toPlayerView(session.state, playerId) };
    } catch (error) {
      return { accepted: false, code: error instanceof Error ? error.message : "PREGAME_ERROR" };
    }
  }

  start(gameId: string, playerId: string, token: string):
    { accepted: true; revision: number; view: GameView } | { accepted: false; code: string } {
    const session = this.getAuthorizedSession(gameId, playerId, token);
    if (!session) return { accepted: false, code: "UNAUTHENTICATED" };
    try {
      const state = session.start();
      return { accepted: true, revision: state.revision, view: toPlayerView(state, playerId) };
    } catch (error) {
      return { accepted: false, code: error instanceof Error ? error.message : "PREGAME_ERROR" };
    }
  }

  private getAuthorizedSession(gameId: string, playerId: string, token: string): PregameCoordinator | null {
    const room = this.rooms.authenticate(gameId, playerId, token);
    if (!room) return null;
    let session = this.sessions.get(gameId);
    if (!session) {
      const players = room.state.players.map(player => ({
        id: player.id, name: player.name, seat: player.seat
      }));
      session = this.factory.create(gameId, players);
      this.sessions.set(gameId, session);
    }
    return session;
  }
}
