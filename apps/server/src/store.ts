import type { GameKind } from '@cards/game'
import { anyoneConnected, clearTimers, createRoom, type Room } from './room'

/**
 * Where live rooms live. In-memory today; the interface exists so a Redis or
 * SQLite implementation can be dropped in without touching the socket layer.
 */
export interface RoomStore {
  get(code: string): Room | undefined
  has(code: string): boolean
  create(code: string, game: GameKind): Room
  delete(code: string): void
  all(): Room[]
}

export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, Room>()

  get(code: string): Room | undefined {
    return this.rooms.get(code)
  }

  has(code: string): boolean {
    return this.rooms.has(code)
  }

  create(code: string, game: GameKind): Room {
    const room = createRoom(code, game)
    this.rooms.set(code, room)
    return room
  }

  delete(code: string): void {
    const room = this.rooms.get(code)
    if (room !== undefined) clearTimers(room)
    this.rooms.delete(code)
  }

  all(): Room[] {
    return [...this.rooms.values()]
  }
}

/** Drop rooms nobody has been connected to for a while. */
export function collectGarbage(store: RoomStore, ttlMs: number, now = Date.now()): string[] {
  const dropped: string[] = []
  for (const room of store.all()) {
    if (anyoneConnected(room)) continue
    if (now - room.lastActivity < ttlMs) continue
    store.delete(room.code)
    dropped.push(room.code)
  }
  return dropped
}
