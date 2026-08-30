import {
  type Card,
  canPass,
  type ExchangeTransfer,
  type PlayerId,
  type RoleName,
  type SlaveState,
} from '@cards/game'

export interface ExchangeView {
  /** Players the table is still waiting on. */
  readonly waitingOn: readonly PlayerId[]
  /** How many cards the viewer must choose, or null if they have nothing to do. */
  readonly give: number | null
  /** Cards handed to the viewer by their counterpart. */
  readonly received: readonly Card[]
  /** Cards taken from the viewer without their say. */
  readonly surrendered: readonly Card[]
}

export interface SlaveTable {
  readonly game: 'slave'
  readonly trick: {
    readonly cards: readonly Card[] | null
    readonly count: number | null
    readonly leaderId: PlayerId | null
  }
  readonly revolution: boolean
  readonly canPass: boolean
  readonly roles: Readonly<Record<PlayerId, RoleName>>
  /** Finishing order this round, earliest first. */
  readonly finishOrder: readonly PlayerId[]
  readonly passedIds: readonly PlayerId[]
  readonly exchange: ExchangeView | null
}

export function buildSlaveTable(state: SlaveState, viewerId: PlayerId | null): SlaveTable {
  return {
    game: 'slave',
    trick: {
      cards: state.trick.current?.cards ?? null,
      count: state.trick.current?.count ?? null,
      leaderId: state.trick.leader,
    },
    revolution: state.revolution,
    canPass: viewerId !== null && canPass(state, viewerId),
    roles: state.roles,
    finishOrder: state.finishOrder,
    passedIds: state.trick.passed,
    exchange: buildExchangeView(state, viewerId),
  }
}

function buildExchangeView(state: SlaveState, viewerId: PlayerId | null): ExchangeView | null {
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
    waitingOn: pending.map((transfer: ExchangeTransfer) => transfer.from),
    give: mine?.count ?? null,
    received,
    surrendered,
  }
}
