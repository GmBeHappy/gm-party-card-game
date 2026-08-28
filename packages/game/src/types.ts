/** Suits, ordered weakest → strongest for tie-breaking within a rank. */
export type Suit = 'C' | 'D' | 'H' | 'S'

export const SUITS: readonly Suit[] = ['C', 'D', 'H', 'S'] as const

/**
 * Numeric card ranks. 3 is the weakest natural card, 15 is the `2`,
 * and 16 is the Joker. Using numbers keeps comparison arithmetic trivial.
 */
export type CardRank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16

export const JOKER_RANK = 16 as const
export const TWO_RANK = 15 as const
export const EIGHT_RANK = 8 as const
export const THREE_RANK = 3 as const

/** Ranks that appear on a physical suited card, weakest first. */
export const NATURAL_RANKS: readonly CardRank[] = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
] as const

export interface Card {
  /** Stable identity, unique within a deck: `3S`, `10H`, `JKR1`. */
  readonly id: string
  readonly rank: CardRank
  /** `null` only for Jokers. */
  readonly suit: Suit | null
}

export type PlayKind = 'single' | 'pair' | 'triple' | 'quad'

export interface Play {
  readonly kind: PlayKind
  readonly count: number
  /** The rank every card in the play shares. */
  readonly rank: CardRank
  readonly cards: readonly Card[]
}

export type PlayerId = string

export type RoleName = 'president' | 'vicePresident' | 'citizen' | 'viceSlave' | 'slave'

export interface RoomSettings {
  /** Any play containing an 8 clears the trick immediately. */
  readonly eightCut: boolean
  /** A four-of-a-kind inverts rank order for the rest of the round. */
  readonly revolution: boolean
  /** A lone ♠3 defeats a lone Joker. */
  readonly spadeThreeBeatsJoker: boolean
  /** Seconds per turn; `null` disables the timer. */
  readonly turnSeconds: number | null
  /** Rounds in the match; `null` means endless (host ends it). */
  readonly totalRounds: number | null
}

export const DEFAULT_SETTINGS: RoomSettings = {
  eightCut: true,
  revolution: true,
  spadeThreeBeatsJoker: true,
  turnSeconds: 30,
  totalRounds: 5,
}

export interface Player {
  readonly id: PlayerId
  readonly name: string
  readonly isBot: boolean
  readonly connected: boolean
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
  readonly deadline: number | null
}

export interface RoundResult {
  readonly round: number
  readonly finishOrder: readonly PlayerId[]
  readonly points: Readonly<Record<PlayerId, number>>
}

export type Phase = 'lobby' | 'exchange' | 'playing' | 'roundEnd' | 'matchEnd'

export interface GameState {
  readonly phase: Phase
  readonly settings: RoomSettings
  /** Seat order. Turn order follows this array, wrapping around. */
  readonly players: readonly Player[]
  readonly round: number
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>
  readonly trick: Trick
  readonly revolution: boolean
  readonly currentPlayer: PlayerId | null
  /** Players who have emptied their hand this round, in finishing order. */
  readonly finishOrder: readonly PlayerId[]
  /** Roles carried from the previous round; drives the exchange phase. */
  readonly roles: Readonly<Record<PlayerId, RoleName>>
  readonly scores: Readonly<Record<PlayerId, number>>
  readonly exchange: ExchangeState | null
  readonly history: readonly RoundResult[]
  /** Epoch ms after which the current turn auto-resolves; `null` if untimed. */
  readonly turnDeadline: number | null
  readonly version: number
}
