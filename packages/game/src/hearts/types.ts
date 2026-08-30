import type { Card, Suit } from '../core/card'
import type { BaseState } from '../core/module'
import type { PlayerId } from '../core/player'

/** Hearts is a four-handed game and this table does not adapt it. */
export const HEARTS_PLAYERS = 4
export const CARDS_EACH = 13
export const PASS_COUNT = 3
export const PASS_SECONDS = 30
/** Thirteen hearts and the queen of spades. */
export const MAX_ROUND_POINTS = 26

export const QUEEN_OF_SPADES = '12S'
export const TWO_OF_CLUBS = '2C'

export type PassDirection = 'left' | 'right' | 'across' | 'none'

export interface HeartsSettings {
  /** Seconds per turn; `null` disables the timer. */
  readonly turnSeconds: number | null
  /** The match ends the moment anyone reaches this. */
  readonly targetScore: number
}

export const DEFAULT_HEARTS_SETTINGS: HeartsSettings = {
  turnSeconds: 30,
  targetScore: 100,
}

export interface PassingState {
  readonly direction: Exclude<PassDirection, 'none'>
  /** Null for a seat that has not chosen yet. */
  readonly selections: Readonly<Record<PlayerId, readonly Card[] | null>>
}

export interface HeartsTrick {
  /** In play order, so the table can lay them out as they landed. */
  readonly plays: readonly { readonly playerId: PlayerId; readonly card: Card }[]
  readonly leadSuit: Suit | null
}

/*
 * `Omit<BaseState, 'game'>` rather than `BaseState`, because GameKind is still
 * only 'slave' until the module is registered. Task 13 widens GameKind and this
 * goes back to plain `extends BaseState` — keeping every switch in the repo
 * exhaustive in the meantime.
 */
export interface HeartsState extends Omit<BaseState, 'game'> {
  readonly game: 'hearts'
  readonly settings: HeartsSettings
  /** Non-null only during the passing phase. */
  readonly passing: PassingState | null
  readonly trick: HeartsTrick
  readonly heartsBroken: boolean
  /** 1 through 13. The first trick has extra rules, so it has to be counted. */
  readonly trickNumber: number
  /** Point-bearing cards captured this round, per seat. Plain cards are dropped. */
  readonly taken: Readonly<Record<PlayerId, readonly Card[]>>
  /** What each seat was passed this round, so the table can show it. */
  readonly received: Readonly<Record<PlayerId, readonly Card[]>>
}
