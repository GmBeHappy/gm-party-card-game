import type { PlayerId } from './player'

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

/**
 * Standings, best first. Daifugō wants the highest score at the top and Hearts
 * the lowest, so the direction is the caller's. Ties break on seat order either
 * way, which keeps the board stable between renders.
 */
export function standings(
  scores: Readonly<Record<PlayerId, number>>,
  seatOrder: readonly PlayerId[],
  direction: 'high' | 'low' = 'high',
): { playerId: PlayerId; score: number }[] {
  return seatOrder
    .map((playerId) => ({ playerId, score: scores[playerId] ?? 0 }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return direction === 'high' ? b.score - a.score : a.score - b.score
      }
      return seatOrder.indexOf(a.playerId) - seatOrder.indexOf(b.playerId)
    })
}
