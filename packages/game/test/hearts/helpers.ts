import type { Card } from '../../src/core/card'
import type { PlayerId } from '../../src/core/player'
import { DEFAULT_HEARTS_SETTINGS, type HeartsState } from '../../src/hearts/types'
import { makePlayers } from '../helpers'

/**
 * A four-handed Hearts state parked mid-round with hands the test dictates.
 *
 * `trickNumber` defaults to 2, because most tests want the ordinary rules —
 * the first trick's extra restrictions are opt-in via an override.
 */
export function heartsPlayingState(
  hands: Record<PlayerId, Card[]>,
  overrides: Partial<HeartsState> = {},
): HeartsState {
  const players = makePlayers(4)
  const seatIds = players.map((player) => player.id)
  return {
    game: 'hearts',
    phase: 'playing',
    settings: DEFAULT_HEARTS_SETTINGS,
    players,
    round: 1,
    hands,
    scores: Object.fromEntries(seatIds.map((id) => [id, 0])),
    currentPlayer: seatIds[0] ?? null,
    turnDeadline: null,
    phaseDeadline: null,
    history: [],
    version: 0,
    passing: null,
    trick: { plays: [], leadSuit: null },
    heartsBroken: false,
    trickNumber: 2,
    taken: Object.fromEntries(seatIds.map((id) => [id, []])),
    received: Object.fromEntries(seatIds.map((id) => [id, []])),
    ...overrides,
  }
}
