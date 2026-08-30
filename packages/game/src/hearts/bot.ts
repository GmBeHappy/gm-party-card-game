import type { Card, Suit } from '../core/card'
import type { Action } from '../core/module'
import type { PlayerId } from '../core/player'
import { pendingPassers } from './engine'
import { legalCards } from './tricks'
import { type HeartsState, PASS_COUNT, QUEEN_OF_SPADES } from './types'

/**
 * How badly a bot wants a card gone. The queen is the whole game, and the ace
 * and king of spades are the two cards that catch her, so they go with her.
 * After that, big hearts, then simply big cards.
 */
function passDanger(card: Card): number {
  if (card.id === QUEEN_OF_SPADES) return 100
  if (card.suit === 'S' && card.rank > 12) return 90 + card.rank
  if (card.suit === 'H') return 40 + card.rank
  return card.rank
}

/** The rank currently taking the trick. */
function highestOfSuit(state: HeartsState, suit: Suit): number {
  let best = 0
  for (const play of state.trick.plays) {
    if (play.card.suit !== suit) continue
    if (play.card.rank > best) best = play.card.rank
  }
  return best
}

/**
 * A deliberately simple opponent that nonetheless plays the two moves that
 * matter: it ducks under the trick when it can, and it throws its worst card
 * away the moment it is void. Good enough to fill a seat and to keep a human
 * honest about the queen.
 */
export function chooseHeartsAction(state: HeartsState, playerId: PlayerId): Action | null {
  if (state.phase === 'exchange') {
    if (!pendingPassers(state).includes(playerId)) return null
    const hand = state.hands[playerId] ?? []
    const worst = [...hand].sort((a, b) => passDanger(b) - passDanger(a)).slice(0, PASS_COUNT)
    return { type: 'exchangeChoose', playerId, cardIds: worst.map((card) => card.id) }
  }

  if (state.phase !== 'playing' || state.currentPlayer !== playerId) return null

  const legal = [...legalCards(state, playerId)].sort((a, b) => a.rank - b.rank)
  const cheapest = legal[0]
  if (cheapest === undefined) return null

  const play = (card: Card): Action => ({ type: 'play', playerId, cardIds: [card.id] })

  // Leading: the cheapest card keeps the lead cheap.
  const leadSuit = state.trick.leadSuit
  if (leadSuit === null) return play(cheapest)

  const following = legal.filter((card) => card.suit === leadSuit)
  if (following.length > 0) {
    const toBeat = highestOfSuit(state, leadSuit)
    // The biggest card that still loses: shed weight without taking the trick.
    const duck = following.filter((card) => card.rank < toBeat).at(-1)
    return play(duck ?? following[0] ?? cheapest)
  }

  // Void, and free to throw anything legal — so throw the most expensive thing.
  const queen = legal.find((card) => card.id === QUEEN_OF_SPADES)
  if (queen !== undefined) return play(queen)

  const worstHeart = legal.filter((card) => card.suit === 'H').at(-1)
  if (worstHeart !== undefined) return play(worstHeart)

  return play(legal.at(-1) ?? cheapest)
}
