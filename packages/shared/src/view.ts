import {
  type Card,
  canPass,
  type GameState,
  handCounts,
  type Phase,
  type PlayerId,
  playableCardIds,
  type RoleName,
  type RoomSettings,
  type RoundResult,
  standings,
} from '@cards/game'

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
  readonly role: RoleName | null
  /** 1-based finishing position this round, or null if still playing. */
  readonly finishedPlace: number | null
  readonly passed: boolean
  readonly isCurrent: boolean
}

export interface ExchangeView {
  readonly deadline: number | null
  /** Players the table is still waiting on. */
  readonly waitingOn: readonly PlayerId[]
  /** How many cards the viewer must choose, or null if they have nothing to do. */
  readonly give: number | null
  /** Cards handed to the viewer by their counterpart. */
  readonly received: readonly Card[]
  /** Cards taken from the viewer without their say. */
  readonly surrendered: readonly Card[]
}

export interface YouView {
  readonly id: PlayerId
  readonly hand: readonly Card[]
  /** Card ids that can legally be part of a play right now. */
  readonly playable: readonly string[]
  readonly canPass: boolean
  readonly isHost: boolean
  readonly role: RoleName | null
  readonly score: number
}

export interface TrickView {
  readonly cards: readonly Card[] | null
  readonly count: number | null
  readonly leaderId: PlayerId | null
}

export interface RoomView {
  readonly code: string
  readonly hostId: PlayerId | null
  readonly phase: Phase
  readonly settings: RoomSettings
  readonly round: number
  readonly revolution: boolean
  readonly seats: readonly SeatView[]
  /** The viewer's private slice. Null for a connection with no seat. */
  readonly you: YouView | null
  readonly trick: TrickView
  readonly currentPlayerId: PlayerId | null
  readonly turnDeadline: number | null
  readonly exchange: ExchangeView | null
  /** People who arrived mid-match and are queued for the next round. */
  readonly waiting: readonly { readonly id: PlayerId; readonly name: string }[]
  readonly youAreWaiting: boolean
  readonly history: readonly RoundResult[]
  readonly standings: readonly { playerId: PlayerId; score: number }[]
  readonly version: number
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

  const seats: SeatView[] = members.map((member) => {
    const place = state.finishOrder.indexOf(member.id)
    return {
      id: member.id,
      name: member.name,
      isBot: member.isBot,
      connected: member.connected,
      ready: member.ready,
      isHost: member.id === hostId,
      handCount: counts[member.id] ?? 0,
      score: state.scores[member.id] ?? 0,
      role: state.roles[member.id] ?? null,
      finishedPlace: place === -1 ? null : place + 1,
      passed: state.trick.passed.includes(member.id),
      isCurrent: state.currentPlayer === member.id,
    }
  })

  const you: YouView | null =
    viewerId === null
      ? null
      : {
          id: viewerId,
          hand: state.hands[viewerId] ?? [],
          playable: [...playableCardIds(state, viewerId)],
          canPass: canPass(state, viewerId),
          isHost: viewerId === hostId,
          role: state.roles[viewerId] ?? null,
          score: state.scores[viewerId] ?? 0,
        }

  return {
    code,
    hostId,
    phase: state.phase,
    settings: state.settings,
    round: state.round,
    revolution: state.revolution,
    seats,
    you,
    trick: {
      cards: state.trick.current?.cards ?? null,
      count: state.trick.current?.count ?? null,
      leaderId: state.trick.leader,
    },
    currentPlayerId: state.currentPlayer,
    turnDeadline: state.turnDeadline,
    exchange: buildExchangeView(state, viewerId),
    waiting: waiting.map((member) => ({ id: member.id, name: member.name })),
    youAreWaiting: viewerId !== null && waiting.some((member) => member.id === viewerId),
    history: state.history,
    standings: standings(
      state.scores,
      members.map((member) => member.id),
    ),
    version: state.version,
  }
}

function buildExchangeView(state: GameState, viewerId: PlayerId | null): ExchangeView | null {
  const exchange = state.exchange
  if (exchange === null) return null

  const pending = exchange.transfers.filter((transfer) => transfer.cards === null)
  const mine = viewerId === null ? undefined : pending.find((t) => t.from === viewerId)

  const received: Card[] = []
  const surrendered: Card[] = []
  if (viewerId !== null) {
    for (const transfer of exchange.transfers) {
      if (transfer.cards === null) continue
      if (transfer.to === viewerId) received.push(...transfer.cards)
      if (transfer.from === viewerId && transfer.forced) surrendered.push(...transfer.cards)
    }
  }

  return {
    deadline: exchange.deadline,
    waitingOn: pending.map((transfer) => transfer.from),
    give: mine?.count ?? null,
    received,
    surrendered,
  }
}
