import { describe, expect, it } from 'vitest'
import { createDeck, deal, shuffle, sortHand, strength } from '../src/cards'
import { createRng } from '../src/rng'
import { c, ids } from './helpers'

describe('deck', () => {
  it('holds 52 cards with unique ids', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map((card) => card.id)).size).toBe(52)
  })

  it('contains four of every rank across thirteen ranks', () => {
    const deck = createDeck()
    expect(new Set(deck.map((card) => card.rank)).size).toBe(13)
    for (const rank of [3, 8, 14, 15]) {
      expect(deck.filter((card) => card.rank === rank)).toHaveLength(4)
    }
  })

  it('has no jokers — every card is suited', () => {
    const deck = createDeck()
    expect(new Set(deck.map((card) => card.suit)).size).toBe(4)
    expect(deck.filter((card) => card.id.startsWith('JKR'))).toHaveLength(0)
  })
})

describe('shuffle', () => {
  it('is a permutation, not a mutation', () => {
    const deck = createDeck()
    const shuffled = shuffle(deck, createRng(1))
    expect(shuffled).toHaveLength(52)
    expect(new Set(shuffled.map((card) => card.id))).toEqual(new Set(deck.map((card) => card.id)))
    expect(deck[0]?.id).toBe('3C')
  })

  it('is deterministic for a given seed', () => {
    const a = shuffle(createDeck(), createRng(7))
    const b = shuffle(createDeck(), createRng(7))
    expect(ids(a)).toEqual(ids(b))
  })
})

describe('deal', () => {
  it('deals every card out', () => {
    const hands = deal(createDeck(), 4)
    expect(hands.flat()).toHaveLength(52)
  })

  it('keeps hand sizes within one card of each other', () => {
    for (const count of [3, 4, 5, 6]) {
      const sizes = deal(createDeck(), count).map((hand) => hand.length)
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    }
  })

  it('splits evenly at four players', () => {
    expect(deal(createDeck(), 4).map((hand) => hand.length)).toEqual([13, 13, 13, 13])
  })

  it('gives the remainder to the earliest seats', () => {
    expect(deal(createDeck(), 5).map((hand) => hand.length)).toEqual([11, 11, 10, 10, 10])
    expect(deal(createDeck(), 3).map((hand) => hand.length)).toEqual([18, 17, 17])
  })
})

describe('strength', () => {
  it('ranks 3 lowest and the 2 highest', () => {
    expect(strength(c('3C'), false)).toBeLessThan(strength(c('4C'), false))
    expect(strength(c('13C'), false)).toBeLessThan(strength(c('14C'), false))
    expect(strength(c('14C'), false)).toBeLessThan(strength(c('15C'), false))
  })

  it('inverts the order under revolution', () => {
    expect(strength(c('3C'), true)).toBeGreaterThan(strength(c('15C'), true))
    expect(strength(c('15C'), true)).toBeLessThan(strength(c('14C'), true))
  })
})

describe('sortHand', () => {
  it('orders weakest first and is stable across suits', () => {
    const sorted = sortHand([c('15S'), c('3D'), c('3C'), c('11H')])
    expect(ids(sorted)).toEqual(['3C', '3D', '11H', '15S'])
  })

  it('reverses the order under revolution', () => {
    const sorted = sortHand([c('3C'), c('15S'), c('9D')], true)
    expect(ids(sorted)).toEqual(['15S', '9D', '3C'])
  })
})
