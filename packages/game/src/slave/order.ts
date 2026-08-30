import { type Card, type CardRank, SUITS } from '../core/card'

/**
 * Daifugō's ladder: 3 < 4 < … < K < A < 2. The deck is ordered 2 low, so the
 * 2 is lifted above the ace here and nowhere else.
 */
export function daifugoOrder(rank: CardRank): number {
  return rank === 2 ? 15 : rank
}

/** Effective strength under the current revolution state. */
export function strength(card: Card, revolution: boolean): number {
  const order = daifugoOrder(card.rank)
  return revolution ? -order : order
}

/** Sort by play strength, then by suit, so hands render in a stable order. */
export function sortHand(cards: readonly Card[], revolution = false): Card[] {
  return [...cards].sort((a, b) => {
    const diff = strength(a, revolution) - strength(b, revolution)
    if (diff !== 0) return diff
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
  })
}
