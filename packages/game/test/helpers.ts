import { createDeck } from '../src/cards'
import { createInitialState } from '../src/engine'
import { createRng } from '../src/rng'
import {
  type Card,
  DEFAULT_SETTINGS,
  type GameState,
  type Player,
  type PlayerId,
  type RoomSettings,
} from '../src/types'

const DECK = createDeck()

/** Look a card up by id: `c('3S')`, `c('10H')`, `c('15D')` (the 2 of diamonds). */
export function c(id: string): Card {
  const card = DECK.find((card) => card.id === id)
  if (card === undefined) throw new Error(`no such card: ${id}`)
  return card
}

export function cards(...ids: string[]): Card[] {
  return ids.map(c)
}

export function ids(list: readonly Card[]): string[] {
  return list.map((card) => card.id)
}

export function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    isBot: false,
    connected: true,
  }))
}

export const ctx = (now = 1_000) => ({ now, rng: createRng(42) })

/** A state parked in `playing` with hands dictated by the test. */
export function playingState(
  hands: Record<PlayerId, Card[]>,
  overrides: Partial<GameState> = {},
  settings: RoomSettings = DEFAULT_SETTINGS,
): GameState {
  const players = Object.keys(hands).map((id) => ({
    id,
    name: id,
    isBot: false,
    connected: true,
  }))
  const base = createInitialState(players, settings)
  const first = players[0]
  return {
    ...base,
    phase: 'playing',
    round: 1,
    hands,
    currentPlayer: first?.id ?? null,
    ...overrides,
  }
}
