import {
  type Card,
  GAME_META,
  type GameKind,
  type GameState,
  handCounts,
  type Phase,
  type PlayerId,
  playableFor,
  type RoundResult,
  standings,
} from '@cards/game'
import { buildHeartsTable, type HeartsTable } from './views/hearts'
import { buildSlaveTable, type SlaveTable } from './views/slave'

/** Everything specific to the game being played. */
export type TableView = SlaveTable | HeartsTable

export interface MemberInfo {
  readonly id: PlayerId
  readonly name: string
  readonly isBot: boolean
  readonly connected: boolean
  readonly ready: boolean
}

export interface SeatView {
  readonly id: PlayerId
  readonly name: string
  readonly isBot: boolean
  readonly connected: boolean
  readonly ready: boolean
  readonly isHost: boolean
  readonly handCount: number
  readonly score: number
  readonly isCurrent: boolean
}

export interface YouView {
  readonly id: PlayerId
  readonly hand: readonly Card[]
  /** Card ids that can legally be part of a play right now. */
  readonly playable: readonly string[]
  readonly isHost: boolean
  readonly score: number
}

export interface RoomView {
  readonly code: string
  readonly hostId: PlayerId | null
  readonly game: GameKind
  readonly phase: Phase
  readonly round: number
  readonly seats: readonly SeatView[]
  /** The viewer's private slice. Null for a connection with no seat. */
  readonly you: YouView | null
  readonly currentPlayerId: PlayerId | null
  readonly turnDeadline: number | null
  /** Deadline for a simultaneous phase — a tribute or a pass. */
  readonly phaseDeadline: number | null
  /** People who arrived mid-match and are queued for the next round. */
  readonly waiting: readonly { readonly id: PlayerId; readonly name: string }[]
  readonly youAreWaiting: boolean
  readonly history: readonly RoundResult[]
  readonly standings: readonly { playerId: PlayerId; score: number }[]
  readonly version: number
  readonly table: TableView
}

export interface BuildViewInput {
  readonly code: string
  readonly hostId: PlayerId | null
  readonly members: readonly MemberInfo[]
  readonly state: GameState
  readonly viewerId: PlayerId | null
  readonly waiting?: readonly MemberInfo[]
}

/**
 * Project the authoritative game state down to what one player is allowed to
 * see. Everyone else's hand collapses to a count — the only place a cheat
 * could read cards is the wire, so it never goes on the wire.
 */
export function buildRoomView(input: BuildViewInput): RoomView {
  const { code, hostId, members, state, viewerId } = input
  const waiting = input.waiting ?? []
  const counts = handCounts(state)

  const seats: SeatView[] = members.map((member) => ({
    id: member.id,
    name: member.name,
    isBot: member.isBot,
    connected: member.connected,
    ready: member.ready,
    isHost: member.id === hostId,
    handCount: counts[member.id] ?? 0,
    score: state.scores[member.id] ?? 0,
    isCurrent: state.currentPlayer === member.id,
  }))

  const you: YouView | null =
    viewerId === null
      ? null
      : {
          id: viewerId,
          hand: state.hands[viewerId] ?? [],
          playable: playableFor(state, viewerId),
          isHost: viewerId === hostId,
          score: state.scores[viewerId] ?? 0,
        }

  const table: TableView =
    state.game === 'slave' ? buildSlaveTable(state, viewerId) : buildHeartsTable(state, viewerId)

  return {
    code,
    hostId,
    game: state.game,
    phase: state.phase,
    round: state.round,
    seats,
    you,
    currentPlayerId: state.currentPlayer,
    turnDeadline: state.turnDeadline,
    phaseDeadline: state.phaseDeadline,
    waiting: waiting.map((member) => ({ id: member.id, name: member.name })),
    youAreWaiting: viewerId !== null && waiting.some((member) => member.id === viewerId),
    history: state.history,
    standings: standings(
      state.scores,
      members.map((member) => member.id),
      GAME_META[state.game].scoreDirection,
    ),
    version: state.version,
    table,
  }
}
