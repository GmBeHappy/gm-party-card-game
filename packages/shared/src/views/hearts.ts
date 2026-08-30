import {
  type Card,
  cardPoints,
  type HeartsSettings,
  type HeartsState,
  PASS_COUNT,
  type PassDirection,
  type PlayerId,
  passTarget,
  pendingPassers,
  type Suit,
} from '@cards/game'

export interface PassingView {
  readonly direction: PassDirection
  /** How many cards the viewer still owes, or null once they have chosen. */
  readonly give: number | null
  /** Who this viewer is passing to. */
  readonly targetId: PlayerId | null
  /** Seats the table is still waiting on. */
  readonly waitingOn: readonly PlayerId[]
  /** What the viewer already chose, so a reconnect shows their own picks back. */
  readonly chosen: readonly Card[]
}

export interface HeartsTable {
  readonly game: 'hearts'
  readonly settings: HeartsSettings
  readonly trick: {
    /** In play order, so the table can lay them out as they landed. */
    readonly plays: readonly { readonly seatId: PlayerId; readonly card: Card }[]
    readonly leadSuit: Suit | null
  }
  readonly heartsBroken: boolean
  /** 1 through 13. */
  readonly trickNumber: number
  /** Points each seat has taken this round — public, as they are at a real table. */
  readonly takenPoints: Readonly<Record<PlayerId, number>>
  /** What the viewer was passed this round. Empty on a no-pass round. */
  readonly received: readonly Card[]
  readonly passing: PassingView | null
}

export function buildHeartsTable(state: HeartsState, viewerId: PlayerId | null): HeartsTable {
  const takenPoints: Record<PlayerId, number> = {}
  for (const player of state.players) {
    takenPoints[player.id] = (state.taken[player.id] ?? []).reduce(
      (total, card) => total + cardPoints(card),
      0,
    )
  }

  return {
    game: 'hearts',
    settings: state.settings,
    trick: {
      plays: state.trick.plays.map((play) => ({ seatId: play.playerId, card: play.card })),
      leadSuit: state.trick.leadSuit,
    },
    heartsBroken: state.heartsBroken,
    trickNumber: state.trickNumber,
    takenPoints,
    received: viewerId === null ? [] : (state.received[viewerId] ?? []),
    passing: buildPassingView(state, viewerId),
  }
}

function buildPassingView(state: HeartsState, viewerId: PlayerId | null): PassingView | null {
  const passing = state.passing
  if (passing === null) return null

  const chosen = viewerId === null ? null : (passing.selections[viewerId] ?? null)
  return {
    direction: passing.direction,
    give: chosen === null ? PASS_COUNT : null,
    targetId: viewerId === null ? null : passTarget(state.players, viewerId, passing.direction),
    waitingOn: pendingPassers(state),
    chosen: chosen ?? [],
  }
}
