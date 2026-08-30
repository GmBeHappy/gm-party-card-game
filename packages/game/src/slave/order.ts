import { type Card, SUITS } from '../core/card'

/** Effective strength under the current revolution state. */
export function strength(card: Card, revolution: boolean): number {
  return revolution ? -card.rank : card.rank
}

/** Sort by play strength, then by suit, so hands render in a stable order. */
export function sortHand(cards: readonly Card[], revolution = false): Card[] {
  return [...cards].sort((a, b) => {
    const diff = strength(a, revolution) - strength(b, revolution)
    if (diff !== 0) return diff
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
  })
}
