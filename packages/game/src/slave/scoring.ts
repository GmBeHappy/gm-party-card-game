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
