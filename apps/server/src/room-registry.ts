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
    validateRoomSetup(gameId, players);
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

function validateRoomSetup(gameId: string, players: readonly PlayerSetup[]): void {
  if (typeof gameId !== "string" || gameId.trim().length === 0) throw new Error("INVALID_GAME_ID");
  if (players.length !== 4) throw new Error("INVALID_PLAYER_COUNT");

  const playerIds = new Set<string>();
  const seats = new Set<number>();
  for (const player of players) {
    if (typeof player.id !== "string" || player.id.trim().length === 0 ||
        typeof player.name !== "string" || player.name.trim().length === 0) {
      throw new Error("INVALID_PLAYER");
    }
    if (playerIds.has(player.id)) throw new Error("DUPLICATE_PLAYER_ID");
    playerIds.add(player.id);

    if (!Number.isInteger(player.seat) || player.seat < 0 || player.seat > 3) throw new Error("INVALID_SEAT");
    if (seats.has(player.seat)) throw new Error("DUPLICATE_SEAT");
    seats.add(player.seat);
  }
  if (seats.size !== 4) throw new Error("INCOMPLETE_SEATS");
}
