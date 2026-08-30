import type { Card, CardRank } from '../core/card'
import type { BaseState } from '../core/module'
import type { PlayerId } from '../core/player'

/** Daifugō's own rank constants. The deck itself has no opinion about these. */
export const TWO_RANK = 2 as const
export const EIGHT_RANK = 8 as const
export const THREE_RANK = 3 as const

export type PlayKind = 'single' | 'pair' | 'triple' | 'quad'

export interface Play {
  readonly kind: PlayKind
  readonly count: number
  /** The rank every card in the play shares. */
  readonly rank: CardRank
  readonly cards: readonly Card[]
}

export type RoleName = 'president' | 'vicePresident' | 'citizen' | 'viceSlave' | 'slave'

export interface SlaveSettings {
  /** Any play containing an 8 clears the trick immediately. */
  readonly eightCut: boolean
  /** A four-of-a-kind inverts rank order for the rest of the round. */
  readonly revolution: boolean
  /** Seconds per turn; `null` disables the timer. */
  readonly turnSeconds: number | null
  /** Rounds in the match; `null` means endless (host ends it). */
  readonly totalRounds: number | null
}

export const DEFAULT_SLAVE_SETTINGS: SlaveSettings = {
  eightCut: true,
  revolution: true,
  turnSeconds: 30,
  totalRounds: 5,
}

export interface Trick {
  /** The play that must currently be beaten; `null` means the trick is open. */
  readonly current: Play | null
  /** Who played `current`. Also the player who leads if everyone passes. */
  readonly leader: PlayerId | null
  /** Players locked out of this trick after passing. */
  readonly passed: readonly PlayerId[]
}

export interface ExchangeTransfer {
  readonly from: PlayerId
  readonly to: PlayerId
  readonly count: number
  /** Cards moved; `null` until the giver has chosen (or been auto-resolved). */
  readonly cards: readonly Card[] | null
  /** Slaves have no choice — their strongest cards are taken automatically. */
  readonly forced: boolean
}

export interface ExchangeState {
  readonly transfers: readonly ExchangeTransfer[]
}

export interface SlaveState extends BaseState {
  readonly game: 'slave'
  readonly settings: SlaveSettings
  readonly trick: Trick
  readonly revolution: boolean
  /** Players who have emptied their hand this round, in finishing order. */
  readonly finishOrder: readonly PlayerId[]
  /** Roles carried from the previous round; drives the exchange phase. */
  readonly roles: Readonly<Record<PlayerId, RoleName>>
  readonly exchange: ExchangeState | null
}
