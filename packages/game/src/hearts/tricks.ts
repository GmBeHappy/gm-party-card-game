import type { Card } from '../core/card'
import type { PlayerId } from '../core/player'
import { type HeartsState, type HeartsTrick, QUEEN_OF_SPADES, TWO_OF_CLUBS } from './types'

/** Hearts are a point each; the queen of spades is thirteen on her own. */
export function cardPoints(card: Card): number {
  if (card.id === QUEEN_OF_SPADES) return 13
  return card.suit === 'H' ? 1 : 0
}

export function isPenalty(card: Card): boolean {
  return cardPoints(card) > 0
}

export function trickPoints(cards: readonly Card[]): number {
  return cards.reduce((total, card) => total + cardPoints(card), 0)
}

/**
 * Every card this seat may legally play right now.
 *
 * The filters run in the order the rules do: the opening lead is forced,
 * following suit overrides everything else, hearts stay locked until one has
 * been discarded, and the first trick sheds no blood unless there is no choice.
 * Each rule has an escape hatch for a hand that cannot obey it, which is why
 * every branch checks for an empty result before committing to it.
 */
export function legalCards(state: HeartsState, playerId: PlayerId): Card[] {
  if (state.phase !== 'playing' || state.currentPlayer !== playerId) return []
  const hand = state.hands[playerId] ?? []
  if (hand.length === 0) return []

  const leading = state.trick.plays.length === 0

  // The first lead of a round is the two of clubs and nothing else.
  if (leading && state.trickNumber === 1) {
    return hand.filter((card) => card.id === TWO_OF_CLUBS)
  }

  let candidates: Card[]
  if (state.trick.leadSuit !== null) {
    const inSuit = hand.filter((card) => card.suit === state.trick.leadSuit)
    candidates = inSuit.length > 0 ? inSuit : [...hand]
  } else if (!state.heartsBroken) {
    const offHearts = hand.filter((card) => card.suit !== 'H')
    // A hand of nothing but hearts has to lead one.
    candidates = offHearts.length > 0 ? offHearts : [...hand]
  } else {
    candidates = [...hand]
  }

  if (state.trickNumber === 1) {
    const safe = candidates.filter((card) => !isPenalty(card))
    if (safe.length > 0) return safe
  }
  return candidates
}

/** The highest card of the led suit takes the trick. Nothing else can. */
export function trickWinner(trick: HeartsTrick): PlayerId | null {
  if (trick.leadSuit === null) return null
  let best: { playerId: PlayerId; card: Card } | null = null
  for (const play of trick.plays) {
    if (play.card.suit !== trick.leadSuit) continue
    if (best === null || play.card.rank > best.card.rank) best = play
  }
  return best?.playerId ?? null
}
