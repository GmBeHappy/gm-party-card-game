import { describe, expect, it } from 'vitest'
import {
  cardPoints,
  isPenalty,
  legalCards,
  trickPoints,
  trickWinner,
} from '../../src/hearts/tricks'
import { c, cards, ids } from '../helpers'
import { heartsPlayingState } from './helpers'

describe('penalty cards', () => {
  it('scores a heart at one and the queen of spades at thirteen', () => {
    expect(cardPoints(c('7H'))).toBe(1)
    expect(cardPoints(c('12S'))).toBe(13)
    expect(cardPoints(c('12H'))).toBe(1)
    expect(cardPoints(c('13S'))).toBe(0)
    expect(cardPoints(c('2C'))).toBe(0)
  })

  it('knows which cards hurt', () => {
    expect(isPenalty(c('2H'))).toBe(true)
    expect(isPenalty(c('12S'))).toBe(true)
    expect(isPenalty(c('14S'))).toBe(false)
  })

  it('adds a whole trick up', () => {
    expect(trickPoints(cards('2H', '3H', '12S', '4C'))).toBe(15)
    expect(trickPoints(cards('2C', '3C', '4C', '5C'))).toBe(0)
  })
})

describe('legal cards', () => {
  it('forces the two of clubs on the opening lead', () => {
    const state = heartsPlayingState(
      { p1: cards('2C', '5H', '12S', '9D'), p2: [], p3: [], p4: [] },
      { trickNumber: 1 },
    )
    expect(ids(legalCards(state, 'p1'))).toEqual(['2C'])
  })

  it('makes you follow the led suit when you can', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('3C', '9C', '5H', '12S'), p3: [], p4: [] },
      {
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('7C') }], leadSuit: 'C' },
      },
    )
    expect(ids(legalCards(state, 'p2'))).toEqual(['3C', '9C'])
  })

  it('opens the whole hand when you are void in the led suit', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('5H', '12S', '9D'), p3: [], p4: [] },
      {
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('7C') }], leadSuit: 'C' },
      },
    )
    expect(ids(legalCards(state, 'p2'))).toEqual(['5H', '12S', '9D'])
  })

  it('will not let you lead a heart before they are broken', () => {
    const state = heartsPlayingState({ p1: cards('5H', '9D', '12S'), p2: [], p3: [], p4: [] })
    expect(ids(legalCards(state, 'p1'))).toEqual(['9D', '12S'])
  })

  it('lets you lead a heart once they are broken', () => {
    const state = heartsPlayingState(
      { p1: cards('5H', '9D'), p2: [], p3: [], p4: [] },
      { heartsBroken: true },
    )
    expect(ids(legalCards(state, 'p1'))).toEqual(['5H', '9D'])
  })

  it('lets a hand of nothing but hearts lead one anyway', () => {
    const state = heartsPlayingState({ p1: cards('5H', '9H'), p2: [], p3: [], p4: [] })
    expect(ids(legalCards(state, 'p1'))).toEqual(['5H', '9H'])
  })

  it('keeps point cards off the first trick', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('5H', '12S', '9D'), p3: [], p4: [] },
      {
        trickNumber: 1,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('2C') }], leadSuit: 'C' },
      },
    )
    expect(ids(legalCards(state, 'p2'))).toEqual(['9D'])
  })

  it('allows a point card on the first trick when the hand holds nothing else', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('5H', '12S'), p3: [], p4: [] },
      {
        trickNumber: 1,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('2C') }], leadSuit: 'C' },
      },
    )
    expect(ids(legalCards(state, 'p2'))).toEqual(['5H', '12S'])
  })

  it('offers nothing to a seat whose turn it is not', () => {
    const state = heartsPlayingState({ p1: cards('2C'), p2: cards('3C'), p3: [], p4: [] })
    expect(legalCards(state, 'p2')).toEqual([])
  })
})

describe('taking a trick', () => {
  it('gives it to the highest card of the led suit', () => {
    expect(
      trickWinner({
        leadSuit: 'C',
        plays: [
          { playerId: 'p1', card: c('7C') },
          { playerId: 'p2', card: c('13C') },
          { playerId: 'p3', card: c('3C') },
          { playerId: 'p4', card: c('14S') },
        ],
      }),
    ).toBe('p2')
  })

  it('ignores a higher card of another suit', () => {
    expect(
      trickWinner({
        leadSuit: 'D',
        plays: [
          { playerId: 'p1', card: c('4D') },
          { playerId: 'p2', card: c('14H') },
          { playerId: 'p3', card: c('14S') },
          { playerId: 'p4', card: c('14C') },
        ],
      }),
    ).toBe('p1')
  })

  it('has no winner before anything is led', () => {
    expect(trickWinner({ leadSuit: null, plays: [] })).toBeNull()
  })
})
