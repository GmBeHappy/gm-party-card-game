import type { GameEvent } from '@cards/game'
import type { ErrorCode } from './protocol'
import type { RoomView } from './view'

export type ServerMessage =
  | {
      readonly type: 'joined'
      readonly payload: {
        readonly playerId: string
        readonly token: string
        readonly roomCode: string
      }
    }
  | {
      readonly type: 'state'
      readonly payload: { readonly view: RoomView; readonly events: readonly GameEvent[] }
    }
  | {
      readonly type: 'error'
      readonly payload: { readonly code: ErrorCode; readonly message: string }
    }
  | { readonly type: 'kicked'; readonly payload: { readonly reason: 'kicked' | 'room-closed' } }
  | { readonly type: 'pong'; readonly payload: { readonly ts: number } }

export type ServerMessageType = ServerMessage['type']
