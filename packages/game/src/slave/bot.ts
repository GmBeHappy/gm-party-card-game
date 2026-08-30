import type { Action } from '../core/module'
import type { PlayerId } from '../core/player'
import { sortHand, strength } from './order'
import { legalPlays } from './plays'
import type { Play, SlaveState } from './types'

/** A 2 (or a 3 under revolution) is worth hoarding rather than spending. */
function isPremium(play: Play, revolution: boolean): boolean {
  const card = play.cards[0]
  if (card === undefined) return false
  return revolution ? card.rank === 3 : card.rank === 2
}

/** Cheapest first; among equals, shed more cards. */
function rank(plays: readonly Play[], revolution: boolean): Play[] {
  return [...plays].sort((a, b) => {
    const byStrength =
      (a.cards[0] === undefined ? 0 : strength(a.cards[0], revolution)) -
      (b.cards[0] === undefined ? 0 : strength(b.cards[0], revolution))
    if (byStrength !== 0) return byStrength
    return b.count - a.count
  })
}

/**
 * A deliberately simple opponent: play the weakest thing that works, hang on
 * to the top cards while the hand is still long, and always take a chance to
 * go out. Good enough to fill a seat and to drive the integration test.
 */
export function chooseBotAction(state: SlaveState, playerId: PlayerId): Action {
  const hand = state.hands[playerId] ?? []
  const options = rank(legalPlays(hand, state.trick.current, state.revolution), state.revolution)

  const best = options[0]
  if (best === undefined) return { type: 'pass', playerId }

  // Going out beats every other consideration.
  const finisher = options.find((play) => play.count === hand.length)
  if (finisher !== undefined) {
    return { type: 'play', playerId, cardIds: finisher.cards.map((card) => card.id) }
  }

  const following = state.trick.current !== null
  if (following && isPremium(best, state.revolution) && hand.length > 4) {
    return { type: 'pass', playerId }
  }

  return { type: 'play', playerId, cardIds: best.cards.map((card) => card.id) }
}

/** A bot president sends back its weakest cards. */
export function chooseBotExchange(state: SlaveState, playerId: PlayerId, count: number): Action {
  const hand = sortHand(state.hands[playerId] ?? [])
  return {
    type: 'exchangeChoose',
    playerId,
    cardIds: hand.slice(0, count).map((card) => card.id),
  }
}
