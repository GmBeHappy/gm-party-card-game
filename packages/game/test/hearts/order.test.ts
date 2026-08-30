import { describe, expect, it } from 'vitest'
import { nextSeat } from '../../src/core/player'
import { highestCards, sortHand } from '../../src/hearts/order'
import { cards, ids, makePlayers } from '../helpers'

describe('hearts hand order', () => {
  it('groups by suit in alternating colours, ascending within a suit', () => {
    const hand = cards('14H', '2C', '12S', '5D', '3C', '7H')
    expect(ids(sortHand(hand))).toEqual(['2C', '3C', '5D', '12S', '7H', '14H'])
  })

  it('takes the highest cards regardless of suit', () => {
    const hand = cards('2C', '14H', '12S', '5D', '13C')
    expect(ids(highestCards(hand, 3))).toEqual(['14H', '13C', '12S'])
  })

  it('takes the whole hand when asked for more than it holds', () => {
    expect(highestCards(cards('2C', '3C'), 3)).toHaveLength(2)
  })
})

describe('seat order', () => {
  it('wraps around to the first seat', () => {
    const players = makePlayers(4)
    expect(nextSeat(players, 'p1')).toBe('p2')
    expect(nextSeat(players, 'p4')).toBe('p1')
  })

  it('returns null for a seat that is not at the table', () => {
    expect(nextSeat(makePlayers(4), 'nobody')).toBeNull()
  })
})
