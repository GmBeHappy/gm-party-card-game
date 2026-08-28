import { describe, expect, it } from 'vitest'
import { createDeck, deal, isSpadeThree, shuffle, sortHand, strength } from '../src/cards'
import { createRng } from '../src/rng'
import { c, ids } from './helpers'

describe('deck', () => {
  it('holds 54 cards with unique ids', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(54)
    expect(new Set(deck.map((card) => card.id)).size).toBe(54)
  })

  it('contains exactly two jokers and four of every natural rank', () => {
    const deck = createDeck()
    expect(deck.filter((card) => card.rank === 16)).toHaveLength(2)
    expect(deck.filter((card) => card.rank === 3)).toHaveLength(4)
    expect(deck.filter((card) => card.rank === 15)).toHaveLength(4)
  })
})

describe('shuffle', () => {
  it('is a permutation, not a mutation', () => {
    const deck = createDeck()
    const shuffled = shuffle(deck, createRng(1))
    expect(shuffled).toHaveLength(54)
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
    expect(hands.flat()).toHaveLength(54)
  })

  it('keeps hand sizes within one card of each other', () => {
    for (const count of [3, 4, 5, 6]) {
      const sizes = deal(createDeck(), count).map((hand) => hand.length)
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
    }
  })

  it('gives the remainder to the earliest seats', () => {
    const sizes = deal(createDeck(), 4).map((hand) => hand.length)
    expect(sizes).toEqual([14, 14, 13, 13])
  })
})

describe('strength', () => {
  it('ranks 3 lowest, 2 highest, joker above everything', () => {
    expect(strength(c('3C'), false)).toBeLessThan(strength(c('4C'), false))
    expect(strength(c('14C'), false)).toBeLessThan(strength(c('15C'), false))
    expect(strength(c('15C'), false)).toBeLessThan(strength(c('JKR1'), false))
  })

  it('inverts natural ranks under revolution but never the joker', () => {
    expect(strength(c('3C'), true)).toBeGreaterThan(strength(c('15C'), true))
    expect(strength(c('JKR1'), true)).toBeGreaterThan(strength(c('3C'), true))
  })
})

describe('sortHand', () => {
  it('orders weakest first and is stable across suits', () => {
    const sorted = sortHand([c('15S'), c('3D'), c('JKR1'), c('3C'), c('11H')])
    expect(ids(sorted)).toEqual(['3C', '3D', '11H', '15S', 'JKR1'])
  })

  it('reverses natural order under revolution, joker still last', () => {
    const sorted = sortHand([c('3C'), c('15S'), c('JKR1')], true)
    expect(ids(sorted)).toEqual(['15S', '3C', 'JKR1'])
  })
})

describe('isSpadeThree', () => {
  it('identifies only the three of spades', () => {
    expect(isSpadeThree(c('3S'))).toBe(true)
    expect(isSpadeThree(c('3H'))).toBe(false)
    expect(isSpadeThree(c('4S'))).toBe(false)
  })
})
