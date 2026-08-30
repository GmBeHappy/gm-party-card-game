import {
  type Action,
  type ActionError,
  applySettingsIn,
  botActionFor,
  createRng,
  createStateFor,
  GAME_META,
  type GameEvent,
  type GameKind,
  type GameState,
  type Player,
  type PlayerId,
  reduceGame,
  seatPlayersIn,
  setConnectedIn,
  waitingOnIn,
} from '@cards/game'
import {
  buildRoomView,
  type ErrorCode,
  heartsSettingsPatchSchema,
  type MemberInfo,
  type RoomView,
  type ServerMessage,
  type SettingsPatch,
  slaveSettingsPatchSchema,
} from '@cards/shared'

/**
 * A settings patch arrives loosely typed and is re-parsed here with the active
 * game's strict schema, so one game's key can never land in another's room.
 */
const SETTINGS_SCHEMAS = {
  slave: slaveSettingsPatchSchema,
  hearts: heartsSettingsPatchSchema,
} as const

import { generatePlayerId } from './codes'
import { timings } from './config'

export interface Socket {
  send(data: string): void
  close(): void
}

export interface Member {
  id: PlayerId
  name: string
  isBot: boolean
  ready: boolean
  /** False for someone who arrived mid-match and is queued for the next round. */
  seated: boolean
  sockets: Set<Socket>
  lastSeen: number
}

export interface Room {
  code: string
  hostId: PlayerId | null
  members: Member[]
  state: GameState
  createdAt: number
  lastActivity: number
  turnTimer: ReturnType<typeof setTimeout> | null
  botTimer: ReturnType<typeof setTimeout> | null
}

export type RoomResult<T = undefined> = { ok: true; value: T } | { ok: false; code: ErrorCode }

const BOT_NAMES = ['หมี', 'แมว', 'กระต่าย', 'หมา', 'นก', 'ปลา'] as const

export function createRoom(code: string, game: GameKind): Room {
  const now = Date.now()
  return {
    code,
    hostId: null,
    members: [],
    state: createStateFor(game, []),
    createdAt: now,
    lastActivity: now,
    turnTimer: null,
    botTimer: null,
  }
}

// ------------------------------------------------------------------ members

/** The seat limit of whichever game this room is currently set to. */
export const maxSeats = (room: Room): number => GAME_META[room.state.game].maxPlayers

export const seated = (room: Room): Member[] => room.members.filter((m) => m.seated)
export const waiting = (room: Room): Member[] => room.members.filter((m) => !m.seated)
export const findMember = (room: Room, id: PlayerId): Member | undefined =>
  room.members.find((member) => member.id === id)

export function isConnected(member: Member): boolean {
  return member.isBot || member.sockets.size > 0
}

export function anyoneConnected(room: Room): boolean {
  return room.members.some((member) => !member.isBot && member.sockets.size > 0)
}

function toInfo(member: Member): MemberInfo {
  return {
    id: member.id,
    name: member.name,
    isBot: member.isBot,
    connected: isConnected(member),
    ready: member.ready,
  }
}

function toPlayer(member: Member): Player {
  return {
    id: member.id,
    name: member.name,
    isBot: member.isBot,
    connected: isConnected(member),
  }
}

/** Push the seat list into the game state. Safe only between rounds. */
function syncPlayers(room: Room): void {
  room.state = seatPlayersIn(room.state, seated(room).map(toPlayer))
}

/** Names are unique per room, so seats are never ambiguous at a glance. */
function uniqueName(room: Room, wanted: string): string {
  const taken = new Set(room.members.map((member) => member.name.toLowerCase()))
  if (!taken.has(wanted.toLowerCase())) return wanted
  for (let n = 2; n < 50; n++) {
    const candidate = `${wanted} ${n}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return `${wanted} ${Date.now() % 1000}`
}

// -------------------------------------------------------------------- views

export function viewFor(room: Room, viewerId: PlayerId | null): RoomView {
  return buildRoomView({
    code: room.code,
    hostId: room.hostId,
    members: seated(room).map(toInfo),
    waiting: waiting(room).map(toInfo),
    state: room.state,
    viewerId,
  })
}

export function send(socket: Socket, message: ServerMessage): void {
  socket.send(JSON.stringify(message))
}

export function broadcast(room: Room, events: readonly GameEvent[] = []): void {
  for (const member of room.members) {
    if (member.sockets.size === 0) continue
    const message: ServerMessage = {
      type: 'state',
      payload: { view: viewFor(room, member.id), events },
    }
    const encoded = JSON.stringify(message)
    for (const socket of member.sockets) socket.send(encoded)
  }
}

// --------------------------------------------------------------------- join

export interface JoinInput {
  name: string
  playerId: PlayerId | null
  socket: Socket
}

export function join(room: Room, input: JoinInput): RoomResult<Member> {
  room.lastActivity = Date.now()

  // A verified token always reclaims its own seat, whatever the phase.
  if (input.playerId !== null) {
    const existing = findMember(room, input.playerId)
    if (existing !== undefined) {
      existing.sockets.add(input.socket)
      existing.lastSeen = Date.now()
      room.state = setConnectedIn(room.state, existing.id, true)
      if (room.hostId === null) room.hostId = existing.id
      return { ok: true, value: existing }
    }
  }

  const inLobby = room.state.phase === 'lobby'
  if (inLobby && seated(room).length >= maxSeats(room)) return { ok: false, code: 'room-full' }
  if (!inLobby && room.members.length >= maxSeats(room) * 2) {
    return { ok: false, code: 'room-full' }
  }

  const member: Member = {
    id: generatePlayerId(),
    name: uniqueName(room, input.name),
    isBot: false,
    ready: false,
    // Mid-match arrivals wait in the lobby and are seated next round.
    seated: inLobby,
    sockets: new Set([input.socket]),
    lastSeen: Date.now(),
  }
  room.members.push(member)
  if (room.hostId === null) room.hostId = member.id
  if (inLobby) syncPlayers(room)
  return { ok: true, value: member }
}

export function detach(room: Room, playerId: PlayerId, socket: Socket): void {
  const member = findMember(room, playerId)
  if (member === undefined) return
  member.sockets.delete(socket)
  member.lastSeen = Date.now()
  room.lastActivity = Date.now()
  if (member.sockets.size > 0) return

  room.state = setConnectedIn(room.state, playerId, false)

  // A seat is never forfeited mid-match, but the host role moves on.
  if (room.hostId === playerId) migrateHost(room)

  // Someone who never got seated just disappears.
  if (!member.seated) {
    room.members = room.members.filter((m) => m.id !== playerId)
  } else if (room.state.phase === 'lobby') {
    room.members = room.members.filter((m) => m.id !== playerId)
    syncPlayers(room)
  }
}

function migrateHost(room: Room): void {
  const candidate = room.members.find((member) => !member.isBot && member.sockets.size > 0)
  room.hostId = candidate?.id ?? null
}

// ------------------------------------------------------------- host actions

function requireHost(room: Room, playerId: PlayerId): RoomResult {
  if (room.hostId !== playerId) return { ok: false, code: 'not-host' }
  return { ok: true, value: undefined }
}

export function setReady(room: Room, playerId: PlayerId, ready: boolean): RoomResult {
  const member = findMember(room, playerId)
  if (member === undefined) return { ok: false, code: 'not-seated' }
  if (room.state.phase !== 'lobby') return { ok: false, code: 'wrong-phase' }
  member.ready = ready
  room.state = { ...room.state, version: room.state.version + 1 }
  return { ok: true, value: undefined }
}

export function updateSettings(room: Room, playerId: PlayerId, patch: SettingsPatch): RoomResult {
  const host = requireHost(room, playerId)
  if (!host.ok) return host
  if (room.state.phase !== 'lobby') return { ok: false, code: 'wrong-phase' }

  const parsed = SETTINGS_SCHEMAS[room.state.game].safeParse(patch)
  if (!parsed.success) return { ok: false, code: 'invalid-settings' }

  room.state = applySettingsIn(room.state, parsed.data)
  return { ok: true, value: undefined }
}

/**
 * Swap the room's game in the lobby. Settings reset to the new game's defaults,
 * and any seat past its limit becomes a waiting player rather than being kicked
 * — nobody gets ejected because the host changed their mind.
 */
export function setGame(room: Room, playerId: PlayerId, game: GameKind): RoomResult {
  const host = requireHost(room, playerId)
  if (!host.ok) return host
  if (room.state.phase !== 'lobby') return { ok: false, code: 'wrong-phase' }
  const limit = GAME_META[game].maxPlayers
  if (room.state.game === game) return { ok: true, value: undefined }

  for (const member of seated(room).slice(limit)) {
    member.seated = false
    member.ready = false
  }

  room.state = createStateFor(game, seated(room).map(toPlayer), room.state.version + 1)
  return { ok: true, value: undefined }
}

export function addBot(room: Room, playerId: PlayerId): RoomResult {
  const host = requireHost(room, playerId)
  if (!host.ok) return host
  if (room.state.phase !== 'lobby') return { ok: false, code: 'wrong-phase' }
  if (seated(room).length >= maxSeats(room)) return { ok: false, code: 'room-full' }

  const used = new Set(room.members.map((member) => member.name))
  const name = BOT_NAMES.find((candidate) => !used.has(`บอท${candidate}`)) ?? 'บอท'
  room.members.push({
    id: generatePlayerId(),
    name: uniqueName(room, `บอท${name}`),
    isBot: true,
    ready: true,
    seated: true,
    sockets: new Set(),
    lastSeen: Date.now(),
  })
  syncPlayers(room)
  return { ok: true, value: undefined }
}

export function removeSeat(room: Room, playerId: PlayerId, targetId: PlayerId): RoomResult {
  const host = requireHost(room, playerId)
  if (!host.ok) return host
  if (room.state.phase !== 'lobby') return { ok: false, code: 'wrong-phase' }

  const target = findMember(room, targetId)
  if (target === undefined) return { ok: false, code: 'not-seated' }
  for (const socket of target.sockets) {
    send(socket, { type: 'kicked', payload: { reason: 'kicked' } })
    socket.close()
  }
  room.members = room.members.filter((member) => member.id !== targetId)
  if (room.hostId === targetId) migrateHost(room)
  syncPlayers(room)
  return { ok: true, value: undefined }
}

export function shuffleSeats(room: Room, playerId: PlayerId): RoomResult {
  const host = requireHost(room, playerId)
  if (!host.ok) return host
  if (room.state.phase !== 'lobby') return { ok: false, code: 'wrong-phase' }

  const rng = createRng(Date.now() >>> 0)
  const list = [...room.members]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = list[i]
    const b = list[j]
    if (a === undefined || b === undefined) continue
    list[i] = b
    list[j] = a
  }
  room.members = list
  syncPlayers(room)
  return { ok: true, value: undefined }
}

export function startMatch(room: Room, playerId: PlayerId): RoomResult<readonly GameEvent[]> {
  const host = requireHost(room, playerId)
  if (!host.ok) return host

  const players = seated(room)
  if (players.length < GAME_META[room.state.game].minPlayers) {
    return { ok: false, code: 'not-enough-players' }
  }
  const humansReady = players.every((member) => member.isBot || member.ready)
  if (!humansReady) return { ok: false, code: 'wrong-phase' }

  syncPlayers(room)
  return dispatch(room, { type: 'startMatch' })
}

/** Back to the lobby with the same room code and the same people. */
export function rematch(room: Room, playerId: PlayerId): RoomResult {
  const host = requireHost(room, playerId)
  if (!host.ok) return host
  if (room.state.phase !== 'matchEnd') return { ok: false, code: 'wrong-phase' }

  promoteWaiting(room)
  for (const member of room.members) member.ready = member.isBot
  room.state = createStateFor(room.state.game, seated(room).map(toPlayer), room.state.version + 1)
  return { ok: true, value: undefined }
}

/** Seat everyone who joined mid-match, up to the table limit. */
function promoteWaiting(room: Room): void {
  for (const member of waiting(room)) {
    if (seated(room).length >= maxSeats(room)) break
    member.seated = true
    member.ready = true
  }
  syncPlayers(room)
}

// ----------------------------------------------------------------- dispatch

const ENGINE_ERRORS: ReadonlySet<string> = new Set<ActionError>([
  'wrong-phase',
  'not-your-turn',
  'unknown-player',
  'card-not-in-hand',
  'invalid-play',
  'cannot-beat',
  'cannot-pass',
  'no-pending-exchange',
  'wrong-card-count',
  'not-enough-players',
])

export function dispatch(room: Room, action: Action): RoomResult<readonly GameEvent[]> {
  if (action.type === 'nextRound') promoteWaiting(room)

  const result = reduceGame(room.state, action, {
    now: Date.now(),
    rng: createRng(Date.now() >>> 0),
  })
  if (!result.ok) {
    const code = ENGINE_ERRORS.has(result.error) ? (result.error as ErrorCode) : 'internal'
    return { ok: false, code }
  }

  room.state = result.state
  room.lastActivity = Date.now()
  return { ok: true, value: result.events }
}

// ------------------------------------------------------------------- timers

export function clearTimers(room: Room): void {
  if (room.turnTimer !== null) clearTimeout(room.turnTimer)
  if (room.botTimer !== null) clearTimeout(room.botTimer)
  room.turnTimer = null
  room.botTimer = null
}

/**
 * Re-arm the clocks after every state change: the turn/exchange deadline, a
 * short fuse for a seat whose player is away, and the bot's thinking pause.
 */
export function scheduleTimers(room: Room, onChange: (events: readonly GameEvent[]) => void): void {
  clearTimers(room)
  const state = room.state
  const now = Date.now()

  const run = (action: Action) => {
    const result = dispatch(room, action)
    if (result.ok) onChange(result.value)
    scheduleTimers(room, onChange)
  }

  // A simultaneous phase — a tribute, a pass. Bots answer first, then the
  // whole phase times out for whoever is left.
  const pending = waitingOnIn(state)
  if (pending.length > 0) {
    const botSeat = pending.find((id) => findMember(room, id)?.isBot === true)
    if (botSeat !== undefined) {
      const action = botActionFor(state, botSeat)
      if (action !== null) {
        room.botTimer = setTimeout(() => run(action), timings.botDelayMs)
        return
      }
    }
    if (state.phaseDeadline !== null) {
      room.turnTimer = setTimeout(
        () => run({ type: 'timeout' }),
        Math.max(0, state.phaseDeadline - now),
      )
    }
    return
  }

  if (state.phase !== 'playing' || state.currentPlayer === null) return

  const member = findMember(room, state.currentPlayer)
  if (member?.isBot === true) {
    const action = botActionFor(state, member.id)
    if (action !== null) {
      room.botTimer = setTimeout(() => run(action), timings.botDelayMs)
      return
    }
  }

  const deadlines: number[] = []
  if (state.turnDeadline !== null) deadlines.push(state.turnDeadline)
  // An absent player resolves quickly, even in a room with the clock switched off.
  if (member !== undefined && !isConnected(member)) {
    deadlines.push(now + timings.disconnectedTurnMs)
  }
  if (deadlines.length === 0) return

  room.turnTimer = setTimeout(
    () => run({ type: 'timeout' }),
    Math.max(0, Math.min(...deadlines) - now),
  )
}
