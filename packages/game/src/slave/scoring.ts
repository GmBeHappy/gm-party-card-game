import type { PlayerId } from '../core/player'

/**
 * Points for a round: finishing first in an n-player game is worth n-1,
 * and the Slave scores nothing.
 */
export function roundPoints(finishOrder: readonly PlayerId[]): Record<PlayerId, number> {
  const n = finishOrder.length
  const points: Record<PlayerId, number> = {}
  finishOrder.forEach((id, index) => {
    points[id] = n - 1 - index
  })
  return points
}

export function addScores(
  scores: Readonly<Record<PlayerId, number>>,
  points: Readonly<Record<PlayerId, number>>,
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = { ...scores }
  for (const [id, value] of Object.entries(points)) {
    out[id] = (out[id] ?? 0) + value
  }
  return out
}

/** Final standings, highest score first; ties break on earliest seat order. */
export function standings(
  scores: Readonly<Record<PlayerId, number>>,
  seatOrder: readonly PlayerId[],
): { playerId: PlayerId; score: number }[] {
  return seatOrder
    .map((playerId) => ({ playerId, score: scores[playerId] ?? 0 }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return seatOrder.indexOf(a.playerId) - seatOrder.indexOf(b.playerId)
    })
}
