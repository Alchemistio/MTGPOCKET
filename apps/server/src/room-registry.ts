import { randomUUID, timingSafeEqual } from "node:crypto";
import type { PlayerSetup } from "@commander-pocket/game-engine";
import { GameRoom } from "./game-room.js";

interface RoomEntry {
  room: GameRoom;
  tokens: Map<string, string>;
}

export interface SeatCredential {
  playerId: string;
  token: string;
}

export class RoomRegistry {
  private readonly entries = new Map<string, RoomEntry>();

  create(gameId: string, players: readonly PlayerSetup[]): { room: GameRoom; credentials: SeatCredential[] } {
    if (this.entries.has(gameId)) throw new Error("ROOM_ALREADY_EXISTS");
    const room = new GameRoom(gameId, players);
    const tokens = new Map(players.map(player => [player.id, randomUUID()]));
    this.entries.set(gameId, { room, tokens });
    return {
      room,
      credentials: [...tokens.entries()].map(([playerId, token]) => ({ playerId, token }))
    };
  }

  get(gameId: string): GameRoom | undefined {
    return this.entries.get(gameId)?.room;
  }

  authenticate(gameId: string, playerId: string, token: string): GameRoom | null {
    const entry = this.entries.get(gameId);
    const expected = entry?.tokens.get(playerId);
    if (!entry || !expected) return null;
    const actualBytes = Buffer.from(token);
    const expectedBytes = Buffer.from(expected);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
    return entry.room;
  }
}
