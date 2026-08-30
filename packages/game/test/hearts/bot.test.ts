import { describe, expect, it } from 'vitest'
import { chooseHeartsAction } from '../../src/hearts/bot'
import { c, cards } from '../helpers'
import { heartsPlayingState } from './helpers'

function playedIds(action: ReturnType<typeof chooseHeartsAction>): readonly string[] {
  if (action === null || action.type !== 'play') throw new Error('expected a play')
  return action.cardIds
}

describe('the hearts bot passing', () => {
  it('gets rid of the queen of spades and the high spades first', () => {
    const state = heartsPlayingState(
      { p1: cards('12S', '14S', '13S', '2C', '3C', '4C'), p2: [], p3: [], p4: [] },
      {
        phase: 'exchange',
        currentPlayer: null,
        passing: {
          direction: 'left',
          selections: { p1: null, p2: null, p3: null, p4: null },
        },
      },
    )
    const action = chooseHeartsAction(state, 'p1')
    expect(action?.type).toBe('exchangeChoose')
    if (action?.type !== 'exchangeChoose') return
    expect([...action.cardIds].sort()).toEqual(['12S', '13S', '14S'].sort())
  })

  it('offers nothing to a seat that has already passed', () => {
    const state = heartsPlayingState(
      { p1: cards('12S', '14S', '13S'), p2: [], p3: [], p4: [] },
      {
        phase: 'exchange',
        currentPlayer: null,
        passing: {
          direction: 'left',
          selections: { p1: cards('12S', '14S', '13S'), p2: null, p3: null, p4: null },
        },
      },
    )
    expect(chooseHeartsAction(state, 'p1')).toBeNull()
  })
})

describe('the hearts bot playing', () => {
  it('leads its lowest card', () => {
    const state = heartsPlayingState({ p1: cards('9D', '3D', '13C'), p2: [], p3: [], p4: [] })
    expect(playedIds(chooseHeartsAction(state, 'p1'))).toEqual(['3D'])
  })

  it('ducks under the current winner when it can', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('3C', '9C', '14C'), p3: [], p4: [] },
      {
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('10C') }], leadSuit: 'C' },
      },
    )
    // The highest card that still loses — it sheds weight without taking the trick.
    expect(playedIds(chooseHeartsAction(state, 'p2'))).toEqual(['9C'])
  })

  it('plays its lowest card when it cannot avoid winning', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('11C', '14C'), p3: [], p4: [] },
      {
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('10C') }], leadSuit: 'C' },
      },
    )
    expect(playedIds(chooseHeartsAction(state, 'p2'))).toEqual(['11C'])
  })

  it('dumps the queen of spades the moment it is void', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('12S', '14H', '2D'), p3: [], p4: [] },
      {
        heartsBroken: true,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('10C') }], leadSuit: 'C' },
      },
    )
    expect(playedIds(chooseHeartsAction(state, 'p2'))).toEqual(['12S'])
  })

  it('dumps its highest heart when void and holding no queen', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('14H', '3H', '2D'), p3: [], p4: [] },
      {
        heartsBroken: true,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('10C') }], leadSuit: 'C' },
      },
    )
    expect(playedIds(chooseHeartsAction(state, 'p2'))).toEqual(['14H'])
  })

  it('respects the first trick, where none of that is allowed', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('12S', '14H', '2D'), p3: [], p4: [] },
      {
        trickNumber: 1,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('2C') }], leadSuit: 'C' },
      },
    )
    expect(playedIds(chooseHeartsAction(state, 'p2'))).toEqual(['2D'])
  })

  it('offers nothing when it is not this seat to act', () => {
    const state = heartsPlayingState({ p1: cards('2C'), p2: cards('3C'), p3: [], p4: [] })
    expect(chooseHeartsAction(state, 'p2')).toBeNull()
  })
})
