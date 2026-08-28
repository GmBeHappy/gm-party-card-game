import type { Rng } from './rng'
import { type Card, type CardRank, JOKER_RANK, NATURAL_RANKS, SUITS, type Suit } from './types'

const RANK_LABELS: Readonly<Record<number, string>> = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
  15: '2',
  16: 'JOKER',
}

export function rankLabel(rank: CardRank): string {
  return RANK_LABELS[rank] ?? String(rank)
}

export function isJoker(card: Card): boolean {
  return card.rank === JOKER_RANK
}

export function cardLabel(card: Card): string {
  return isJoker(card) ? 'JOKER' : `${rankLabel(card.rank)}${card.suit}`
}

/** A fresh 54-card deck: 52 suited cards plus two Jokers, in canonical order. */
export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const rank of NATURAL_RANKS) {
    for (const suit of SUITS) {
      deck.push({ id: `${rank}${suit}`, rank, suit })
    }
  }
  deck.push({ id: 'JKR1', rank: JOKER_RANK, suit: null })
  deck.push({ id: 'JKR2', rank: JOKER_RANK, suit: null })
  return deck
}

/** Fisher–Yates against the supplied RNG. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i]
    const b = out[j]
    if (a === undefined || b === undefined) continue
    out[i] = b
    out[j] = a
  }
  return out
}

/**
 * Deal the whole deck as evenly as possible. The remainder goes one card at a
 * time to the earliest seats, so hand sizes differ by at most one.
 */
export function deal(deck: readonly Card[], playerCount: number): Card[][] {
  if (playerCount < 1) throw new Error('playerCount must be at least 1')
  const hands: Card[][] = Array.from({ length: playerCount }, () => [])
  deck.forEach((card, index) => {
    hands[index % playerCount]?.push(card)
  })
  return hands
}

/**
 * Effective strength under the current revolution state. The Joker sits above
 * every natural rank in both directions — revolution never demotes it.
 */
export function strength(card: Card, revolution: boolean): number {
  if (isJoker(card)) return 100
  return revolution ? -card.rank : card.rank
}

/** Sort by play strength, then by suit, so hands render in a stable order. */
export function sortHand(cards: readonly Card[], revolution = false): Card[] {
  return [...cards].sort((a, b) => {
    const diff = strength(a, revolution) - strength(b, revolution)
    if (diff !== 0) return diff
    return SUITS.indexOf(a.suit as Suit) - SUITS.indexOf(b.suit as Suit)
  })
}

export function isSpadeThree(card: Card): boolean {
  return card.rank === 3 && card.suit === 'S'
}
