import { randomUUID, timingSafeEqual } from "node:crypto";
import type { PlayerSetup } from "@commander-pocket/game-engine";
import { GameRoom, type CardDefinitionResolver, type CardSpellSupport, type StackEffectResolver, type RoomCommand, type RoomCommandResult } from "./game-room.js";
import type { PregameSeedRecord } from "./pregame-coordinator.js";
import { hashSeatToken, type PersistedRoomRecord, type RoomPersistence } from "./room-persistence.js";

interface RoomEntry {
  room: GameRoom;
  tokenHashes: Map<string, string>;
  seedLog: PregameSeedRecord[];
}

export interface SeatCredential {
  playerId: string;
  token: string;
}

export class RoomRegistry {
  private readonly entries = new Map<string, RoomEntry>();
  private readonly restoredGameIds = new Set<string>();

  constructor(
    private readonly resolveStackEffect?: StackEffectResolver,
    private readonly resolveCard?: CardDefinitionResolver,
    private readonly supportsSpell?: CardSpellSupport,
    private readonly persistence?: RoomPersistence
  ) {
    for (const record of persistence?.loadAll() ?? []) {
      const room = GameRoom.restore(record.checkpoint, resolveStackEffect, resolveCard, supportsSpell);
      this.entries.set(record.gameId, {
        room,
        tokenHashes: new Map(Object.entries(record.seatTokenHashes)),
        seedLog: record.seedLog.map(seed => ({ ...seed }))
      });
      this.restoredGameIds.add(record.gameId);
    }
  }

  create(gameId: string, players: readonly PlayerSetup[]): { room: GameRoom; credentials: SeatCredential[] } {
    validateRoomSetup(gameId, players);
    if (this.entries.has(gameId)) throw new Error("ROOM_ALREADY_EXISTS");
    const room = new GameRoom(gameId, players, undefined, this.resolveStackEffect, this.resolveCard, this.supportsSpell);
    const credentials = players.map(player => ({ playerId: player.id, token: randomUUID() }));
    const entry: RoomEntry = {
      room,
      tokenHashes: new Map(credentials.map(credential => [credential.playerId, hashSeatToken(credential.token)])),
      seedLog: []
    };
    this.persist(entry);
    this.entries.set(gameId, entry);
    return { room, credentials };
  }

  get(gameId: string): GameRoom | undefined {
    return this.entries.get(gameId)?.room;
  }

  /** True when this room was loaded from disk and its pregame coordinator is not hydrated. */
  wasRestored(gameId: string): boolean {
    return this.restoredGameIds.has(gameId);
  }

  /** Apply and durably journal an accepted command before the caller acknowledges it. */
  apply(gameId: string, command: RoomCommand): RoomCommandResult {
    const entry = this.entries.get(gameId);
    if (!entry) return { accepted: false, revision: 0, code: "UNKNOWN_GAME" };
    const previousCheckpoint = entry.room.checkpoint;
    const result = entry.room.apply(command);
    if (!result.accepted || !this.persistence) return result;
    try {
      this.persist(entry);
      return result;
    } catch {
      entry.room = GameRoom.restore(previousCheckpoint, this.resolveStackEffect, this.resolveCard, this.supportsSpell);
      return { accepted: false, revision: entry.room.state.revision, code: "PERSISTENCE_FAILED" };
    }
  }

  /** Install and persist the authoritative post-pregame snapshot and server-only random seeds. */
  replaceStateFromPregame(gameId: string, state: import("@commander-pocket/game-engine").GameState, seedLog: readonly PregameSeedRecord[]): void {
    const entry = this.entries.get(gameId);
    if (!entry) throw new Error("UNKNOWN_GAME");
    const previousCheckpoint = entry.room.checkpoint;
    const previousSeeds = entry.seedLog;
    try {
      entry.room.replaceStateFromPregame(state);
      entry.seedLog = seedLog.map(seed => ({ ...seed }));
      this.persist(entry);
    } catch (error) {
      entry.room = GameRoom.restore(previousCheckpoint, this.resolveStackEffect, this.resolveCard, this.supportsSpell);
      entry.seedLog = previousSeeds;
      throw error;
    }
  }

  authenticate(gameId: string, playerId: string, token: string): GameRoom | null {
    const entry = this.entries.get(gameId);
    const expected = entry?.tokenHashes.get(playerId);
    if (!entry || !expected) return null;
    const actualBytes = Buffer.from(hashSeatToken(token), "hex");
    const expectedBytes = Buffer.from(expected, "hex");
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return null;
    return entry.room;
  }

  private persist(entry: RoomEntry): void {
    if (!this.persistence) return;
    const record: PersistedRoomRecord = {
      schemaVersion: 1,
      gameId: entry.room.id,
      checkpoint: entry.room.checkpoint,
      seatTokenHashes: Object.fromEntries(entry.tokenHashes),
      seedLog: entry.seedLog.map(seed => ({ ...seed }))
    };
    this.persistence.save(record);
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
