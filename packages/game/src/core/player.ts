import type { BaseState } from './module'

export type PlayerId = string

export interface Player {
  readonly id: PlayerId
  readonly name: string
  readonly isBot: boolean
  readonly connected: boolean
}

/** The seat after `fromId`, wrapping around. Null if that seat is unknown. */
export function nextSeat(players: readonly Player[], fromId: PlayerId): PlayerId | null {
  const index = players.findIndex((player) => player.id === fromId)
  if (index === -1) return null
  return players[(index + 1) % players.length]?.id ?? null
}

/** How many cards each seat is holding — the only thing other players see. */
export function handCounts(state: BaseState): Record<PlayerId, number> {
  const counts: Record<PlayerId, number> = {}
  for (const player of state.players) counts[player.id] = (state.hands[player.id] ?? []).length
  return counts
}
