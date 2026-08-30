import type { Card } from '../core/card'
import type { Player, PlayerId } from '../core/player'
import { sortHand } from './order'
import type { PassDirection, PassingState } from './types'

const CYCLE: readonly PassDirection[] = ['left', 'right', 'across', 'none'] as const

/** Round 1 passes left, 2 right, 3 across, 4 nothing, and then it repeats. */
export function passDirection(round: number): PassDirection {
  return CYCLE[(round - 1) % CYCLE.length] ?? 'none'
}

/**
 * Who a seat passes to. Seat order runs clockwise, so "left" is the next seat
 * and "across" is two along — which at a four-handed table is the seat opposite.
 */
export function passTarget(
  players: readonly Player[],
  from: PlayerId,
  direction: Exclude<PassDirection, 'none'>,
): PlayerId | null {
  const index = players.findIndex((player) => player.id === from)
  if (index === -1) return null
  const step = direction === 'left' ? 1 : direction === 'right' ? -1 : 2
  const n = players.length
  return players[(index + step + n) % n]?.id ?? null
}

/**
 * Move every chosen set to its target at once. Each seat gives three and gets
 * three, so this is a permutation — nobody is ever briefly holding ten or
 * sixteen cards, which is why it is one function and not a loop of transfers.
 */
export function applyPasses(
  players: readonly Player[],
  hands: Readonly<Record<PlayerId, readonly Card[]>>,
  passing: PassingState,
): {
  hands: Record<PlayerId, readonly Card[]>
  received: Record<PlayerId, readonly Card[]>
} {
  const received: Record<PlayerId, Card[]> = {}
  for (const player of players) received[player.id] = []

  for (const player of players) {
    const chosen = passing.selections[player.id] ?? []
    const target = passTarget(players, player.id, passing.direction)
    if (target === null) continue
    received[target]?.push(...chosen)
  }

  const next: Record<PlayerId, readonly Card[]> = {}
  for (const player of players) {
    const gone = new Set((passing.selections[player.id] ?? []).map((card) => card.id))
    const kept = (hands[player.id] ?? []).filter((card) => !gone.has(card.id))
    next[player.id] = sortHand([...kept, ...(received[player.id] ?? [])])
  }

  return { hands: next, received }
}
