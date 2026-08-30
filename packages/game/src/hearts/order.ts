import type { Card, Suit } from '../core/card'

/**
 * Clubs, diamonds, spades, hearts — black, red, black, red. Alternating the
 * colours stops two suits from bleeding into one another in a fanned hand,
 * which matters here because deciding whether you are void is the whole game.
 */
const SUIT_ORDER: readonly Suit[] = ['C', 'D', 'S', 'H'] as const

/** Grouped by suit, ascending within each — the way a Hearts hand is held. */
export function sortHand(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const bySuit = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit)
    if (bySuit !== 0) return bySuit
    return a.rank - b.rank
  })
}

/** The n highest cards by rank, ignoring suit. What an idle seat passes away. */
export function highestCards(hand: readonly Card[], n: number): Card[] {
  return [...hand].sort((a, b) => b.rank - a.rank).slice(0, n)
}
