import type { PlayerId } from './player'

export type Phase = 'lobby' | 'exchange' | 'playing' | 'roundEnd' | 'matchEnd'

export interface RoundResult {
  readonly round: number
  readonly finishOrder: readonly PlayerId[]
  readonly points: Readonly<Record<PlayerId, number>>
}
