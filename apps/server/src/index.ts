import { cors } from '@elysiajs/cors'
import { DEFAULT_SETTINGS, type GameEvent, MAX_PLAYERS } from '@slave/game'
import { clientMessageSchema, ERROR_MESSAGES, type ErrorCode, roomCodeSchema } from '@slave/shared'
import { Elysia } from 'elysia'
import { generateRoomCode } from './codes'
import { GC_INTERVAL_MS, PORT, ROOM_TTL_MS } from './config'
import {
  addBot,
  broadcast,
  detach,
  dispatch,
  join,
  type RoomResult,
  rematch,
  removeSeat,
  type Socket,
  scheduleTimers,
  seated,
  send,
  setReady,
  shuffleSeats,
  startMatch,
  updateSettings,
  viewFor,
} from './room'
import { collectGarbage, MemoryRoomStore } from './store'
import { signToken, verifyToken } from './tokens'

const store = new MemoryRoomStore()

interface Connection {
  socket: Socket
  roomCode: string | null
  playerId: string | null
}

const connections = new Map<string, Connection>()

function fail(socket: Socket, code: ErrorCode): void {
  send(socket, { type: 'error', payload: { code, message: ERROR_MESSAGES[code] } })
}

/** Broadcast the new state and re-arm the room's clocks. */
function settle(code: string, events: readonly GameEvent[] = []): void {
  const room = store.get(code)
  if (room === undefined) return
  broadcast(room, events)
  scheduleTimers(room, (later) => {
    const live = store.get(code)
    if (live !== undefined) broadcast(live, later)
  })
}

const app = new Elysia()
  .use(cors({ origin: true }))
  .get('/health', () => ({ ok: true, service: 'slave-card-game', rooms: store.all().length }))

  .post('/rooms', () => {
    const code = generateRoomCode((candidate) => store.has(candidate))
    store.create(code, DEFAULT_SETTINGS)
    return { code }
  })

  // Powers the inline errors on the join form, before any socket is opened.
  .get('/rooms/:code', ({ params, status }) => {
    const parsed = roomCodeSchema.safeParse(params.code)
    if (!parsed.success) return status(404, { exists: false, reason: 'room-not-found' as const })

    const room = store.get(parsed.data)
    if (room === undefined) return status(404, { exists: false, reason: 'room-not-found' as const })

    const players = seated(room)
    const inLobby = room.state.phase === 'lobby'
    return {
      exists: true,
      code: room.code,
      phase: room.state.phase,
      players: players.length,
      maxPlayers: MAX_PLAYERS,
      canJoin: inLobby && players.length < MAX_PLAYERS,
      reason: inLobby
        ? players.length >= MAX_PLAYERS
          ? ('room-full' as const)
          : null
        : ('match-in-progress' as const),
    }
  })

  .ws('/ws', {
    open(ws) {
      connections.set(ws.id, {
        socket: { send: (data) => ws.send(data), close: () => ws.close() },
        roomCode: null,
        playerId: null,
      })
    },

    message(ws, raw) {
      const connection = connections.get(ws.id)
      if (connection === undefined) return

      const parsed = clientMessageSchema.safeParse(typeof raw === 'string' ? safeJson(raw) : raw)
      if (!parsed.success) return fail(connection.socket, 'bad-message')
      handle(connection, parsed.data)
    },

    close(ws) {
      const connection = connections.get(ws.id)
      connections.delete(ws.id)
      if (connection?.roomCode == null || connection.playerId == null) return

      const room = store.get(connection.roomCode)
      if (room === undefined) return
      detach(room, connection.playerId, connection.socket)
      settle(room.code)
    },
  })

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function handle(
  connection: Connection,
  message: ReturnType<typeof clientMessageSchema.parse>,
): void {
  if (message.type === 'join') {
    handleJoin(connection, message.payload)
    return
  }

  if (message.type === 'ping') {
    send(connection.socket, { type: 'pong', payload: { ts: Date.now() } })
    return
  }

  const { roomCode, playerId } = connection
  if (roomCode === null || playerId === null) {
    fail(connection.socket, 'not-seated')
    return
  }
  const room = store.get(roomCode)
  if (room === undefined) {
    fail(connection.socket, 'room-not-found')
    return
  }

  /** Broadcast on success, report a machine-readable code on failure. */
  const resolve = (result: RoomResult<readonly GameEvent[] | undefined>): void => {
    if (!result.ok) {
      fail(connection.socket, result.code)
      return
    }
    settle(roomCode, Array.isArray(result.value) ? result.value : [])
  }

  const hostOnly = (run: () => RoomResult<readonly GameEvent[]>): void => {
    if (room.hostId !== playerId) {
      fail(connection.socket, 'not-host')
      return
    }
    resolve(run())
  }

  switch (message.type) {
    case 'ready':
      resolve(setReady(room, playerId, message.payload.ready))
      return
    case 'settings':
      resolve(updateSettings(room, playerId, message.payload))
      return
    case 'addBot':
      resolve(addBot(room, playerId))
      return
    case 'removeSeat':
      resolve(removeSeat(room, playerId, message.payload.playerId))
      return
    case 'shuffleSeats':
      resolve(shuffleSeats(room, playerId))
      return
    case 'start':
      resolve(startMatch(room, playerId))
      return
    case 'play':
      resolve(dispatch(room, { type: 'play', playerId, cardIds: message.payload.cardIds }))
      return
    case 'pass':
      resolve(dispatch(room, { type: 'pass', playerId }))
      return
    case 'exchange':
      resolve(
        dispatch(room, { type: 'exchangeChoose', playerId, cardIds: message.payload.cardIds }),
      )
      return
    case 'nextRound':
      hostOnly(() => dispatch(room, { type: 'nextRound' }))
      return
    case 'endMatch':
      hostOnly(() => dispatch(room, { type: 'endMatch' }))
      return
    case 'rematch':
      resolve(rematch(room, playerId))
      return
    case 'leave':
      detach(room, playerId, connection.socket)
      connection.roomCode = null
      connection.playerId = null
      settle(roomCode)
      return
  }
}

function handleJoin(
  connection: Connection,
  payload: { roomCode: string; name: string; token?: string | null },
): void {
  const { roomCode, name, token } = payload
  const room = store.get(roomCode)
  if (room === undefined) {
    fail(connection.socket, 'room-not-found')
    return
  }

  const playerId = token == null ? null : verifyToken(token, roomCode)
  const result = join(room, { name, playerId, socket: connection.socket })
  if (!result.ok) {
    fail(connection.socket, result.code)
    return
  }

  connection.roomCode = roomCode
  connection.playerId = result.value.id
  send(connection.socket, {
    type: 'joined',
    payload: { playerId: result.value.id, token: signToken(result.value.id, roomCode), roomCode },
  })
  settle(roomCode)
}

setInterval(() => {
  const dropped = collectGarbage(store, ROOM_TTL_MS)
  if (dropped.length > 0) console.log(`[server] collected idle rooms: ${dropped.join(', ')}`)
}, GC_INTERVAL_MS)

app.listen(PORT)
console.log(`[server] listening on http://localhost:${app.server?.port}`)

export { app, store, viewFor }
