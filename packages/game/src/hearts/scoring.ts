import type { Card } from '../core/card'
import type { PlayerId } from '../core/player'
import { trickPoints } from './tricks'
import { MAX_ROUND_POINTS } from './types'

/**
 * Points for a round. Normally a seat scores what it took. Take all twenty-six
 * and the table pays instead: the shooter scores nothing and everyone else gets
 * the lot, which is the only reason anyone ever chases the queen.
 */
export function roundScores(
  seatOrder: readonly PlayerId[],
  taken: Readonly<Record<PlayerId, readonly Card[]>>,
): { points: Record<PlayerId, number>; moonShooter: PlayerId | null } {
  const raw: Record<PlayerId, number> = {}
  for (const id of seatOrder) raw[id] = trickPoints(taken[id] ?? [])

  const shooter = seatOrder.find((id) => raw[id] === MAX_ROUND_POINTS) ?? null
  if (shooter === null) return { points: raw, moonShooter: null }

  const points: Record<PlayerId, number> = {}
  for (const id of seatOrder) points[id] = id === shooter ? 0 : MAX_ROUND_POINTS
  return { points, moonShooter: shooter }
}

/** The match ends the moment anyone reaches the target. Lowest score wins. */
export function reachedTarget(scores: Readonly<Record<PlayerId, number>>, target: number): boolean {
  return Object.values(scores).some((score) => score >= target)
}
