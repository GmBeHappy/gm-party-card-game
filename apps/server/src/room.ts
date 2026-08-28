import {
  type Action,
  type ActionError,
  chooseBotAction,
  chooseBotExchange,
  createInitialState,
  createRng,
  type GameEvent,
  type GameState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type Player,
  type PlayerId,
  type RoomSettings,
  reduce,
  seatPlayers,
  setConnected,
} from '@slave/game'
import {
  buildRoomView,
  type ErrorCode,
  type MemberInfo,
  type RoomView,
  type ServerMessage,
  type SettingsPatch,
} from '@slave/shared'
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

const BOT_NAMES = ['Ada', 'Rin', 'Kai', 'Mei', 'Otto', 'Zara'] as const

export function createRoom(code: string, settings: RoomSettings): Room {
  const now = Date.now()
  return {
    code,
    hostId: null,
    members: [],
    state: createInitialState([], settings),
    createdAt: now,
    lastActivity: now,
    turnTimer: null,
    botTimer: null,
  }
}

// ------------------------------------------------------------------ members

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
  room.state = seatPlayers(room.state, seated(room).map(toPlayer))
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
      room.state = setConnected(room.state, existing.id, true)
      if (room.hostId === null) room.hostId = existing.id
      return { ok: true, value: existing }
    }
  }

  const inLobby = room.state.phase === 'lobby'
  if (inLobby && seated(room).length >= MAX_PLAYERS) return { ok: false, code: 'room-full' }
  if (!inLobby && room.members.length >= MAX_PLAYERS * 2) {
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

  room.state = setConnected(room.state, playerId, false)

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

  const current = room.state.settings
  const settings: RoomSettings = {
    eightCut: patch.eightCut ?? current.eightCut,
    revolution: patch.revolution ?? current.revolution,
    turnSeconds: patch.turnSeconds === undefined ? current.turnSeconds : patch.turnSeconds,
    totalRounds: patch.totalRounds === undefined ? current.totalRounds : patch.totalRounds,
  }

  room.state = { ...room.state, settings, version: room.state.version + 1 }
  return { ok: true, value: undefined }
}

export function addBot(room: Room, playerId: PlayerId): RoomResult {
  const host = requireHost(room, playerId)
  if (!host.ok) return host
  if (room.state.phase !== 'lobby') return { ok: false, code: 'wrong-phase' }
  if (seated(room).length >= MAX_PLAYERS) return { ok: false, code: 'room-full' }

  const used = new Set(room.members.map((member) => member.name))
  const name = BOT_NAMES.find((candidate) => !used.has(`Bot ${candidate}`)) ?? 'Bot'
  room.members.push({
    id: generatePlayerId(),
    name: uniqueName(room, `Bot ${name}`),
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
  if (players.length < MIN_PLAYERS) return { ok: false, code: 'not-enough-players' }
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
  room.state = createInitialState(seated(room).map(toPlayer), room.state.settings)
  return { ok: true, value: undefined }
}

/** Seat everyone who joined mid-match, up to the table limit. */
function promoteWaiting(room: Room): void {
  for (const member of waiting(room)) {
    if (seated(room).length >= MAX_PLAYERS) break
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

  const result = reduce(room.state, action, { now: Date.now(), rng: createRng(Date.now() >>> 0) })
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

  if (state.phase === 'exchange' && state.exchange !== null) {
    const pending = state.exchange.transfers.filter((transfer) => transfer.cards === null)
    const botTurn = pending.find((transfer) => findMember(room, transfer.from)?.isBot === true)
    if (botTurn !== undefined) {
      room.botTimer = setTimeout(
        () => run(chooseBotExchange(state, botTurn.from, botTurn.count)),
        timings.botDelayMs,
      )
      return
    }
    if (state.exchange.deadline !== null) {
      room.turnTimer = setTimeout(
        () => run({ type: 'timeout' }),
        Math.max(0, state.exchange.deadline - now),
      )
    }
    return
  }

  if (state.phase !== 'playing' || state.currentPlayer === null) return

  const member = findMember(room, state.currentPlayer)
  if (member?.isBot === true) {
    room.botTimer = setTimeout(
      () => run(chooseBotAction(room.state, member.id)),
      timings.botDelayMs,
    )
    return
  }

  const deadlines: number[] = []
  if (state.turnDeadline !== null) deadlines.push(state.turnDeadline)
  // An absent player resolves quickly, even in a room with the clock switched off.
  if (member !== undefined && !isConnected(member)) {
    deadlines.push(now + timings.disconnectedTurnMs)
  }
  if (deadlines.length === 0) return

  const at = Math.min(...deadlines)
  room.turnTimer = setTimeout(() => run({ type: 'timeout' }), Math.max(0, at - now))
}
