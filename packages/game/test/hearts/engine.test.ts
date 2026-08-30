import { describe, expect, it } from 'vitest'
import type { ActionResult } from '../../src/core/module'
import { createInitialState, legalCardIds, reduce, startRound } from '../../src/hearts/engine'
import { DEFAULT_HEARTS_SETTINGS, type HeartsState } from '../../src/hearts/types'
import { c, cards, ctx, ids, makePlayers } from '../helpers'
import { heartsPlayingState } from './helpers'

function unwrap(result: ActionResult<HeartsState>): HeartsState {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`)
  return result.state
}

const lobby = () => createInitialState(makePlayers(4), DEFAULT_HEARTS_SETTINGS)

describe('starting a match', () => {
  it('refuses a table that is not exactly four', () => {
    const three = createInitialState(makePlayers(3), DEFAULT_HEARTS_SETTINGS)
    const result = reduce(three, { type: 'startMatch' }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('not-enough-players')
  })

  it('deals thirteen cards each and opens the passing phase', () => {
    const state = unwrap(reduce(lobby(), { type: 'startMatch' }, ctx()))
    expect(state.phase).toBe('exchange')
    expect(state.passing?.direction).toBe('left')
    for (const player of state.players) expect(state.hands[player.id]).toHaveLength(13)
    expect(state.phaseDeadline).not.toBeNull()
  })

  it('skips passing on round four and leads with the two of clubs', () => {
    const state = unwrap(startRound(lobby(), 4, ctx()))
    expect(state.phase).toBe('playing')
    expect(state.passing).toBeNull()
    const leader = state.currentPlayer
    expect(leader).not.toBeNull()
    expect(state.hands[leader ?? '']?.some((card) => card.id === '2C')).toBe(true)
    expect([...legalCardIds(state, leader ?? '')]).toEqual(['2C'])
  })
})

describe('the passing phase', () => {
  it('waits for all four seats, then deals the pass and starts play', () => {
    let state = unwrap(reduce(lobby(), { type: 'startMatch' }, ctx()))
    for (const player of state.players) {
      expect(state.phase).toBe('exchange')
      const chosen = (state.hands[player.id] ?? []).slice(0, 3).map((card) => card.id)
      state = unwrap(
        reduce(state, { type: 'exchangeChoose', playerId: player.id, cardIds: chosen }, ctx()),
      )
    }
    expect(state.phase).toBe('playing')
    for (const player of state.players) {
      expect(state.hands[player.id]).toHaveLength(13)
      expect(state.received[player.id]).toHaveLength(3)
    }
  })

  it('refuses a pass that is not three cards', () => {
    const state = unwrap(reduce(lobby(), { type: 'startMatch' }, ctx()))
    const id = state.players[0]?.id ?? ''
    const chosen = (state.hands[id] ?? []).slice(0, 2).map((card) => card.id)
    const result = reduce(state, { type: 'exchangeChoose', playerId: id, cardIds: chosen }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('wrong-card-count')
  })

  it('refuses a second pass from the same seat', () => {
    let state = unwrap(reduce(lobby(), { type: 'startMatch' }, ctx()))
    const id = state.players[0]?.id ?? ''
    const chosen = (state.hands[id] ?? []).slice(0, 3).map((card) => card.id)
    state = unwrap(reduce(state, { type: 'exchangeChoose', playerId: id, cardIds: chosen }, ctx()))
    const again = reduce(state, { type: 'exchangeChoose', playerId: id, cardIds: chosen }, ctx())
    expect(again.ok).toBe(false)
    if (again.ok) return
    expect(again.error).toBe('no-pending-exchange')
  })

  it('passes the three highest cards for anyone still dithering at the deadline', () => {
    const state = unwrap(reduce(lobby(), { type: 'startMatch' }, ctx()))
    const timed = unwrap(reduce(state, { type: 'timeout' }, ctx()))
    expect(timed.phase).toBe('playing')
    for (const player of timed.players) expect(timed.hands[player.id]).toHaveLength(13)
  })
})

describe('playing a trick', () => {
  it('refuses a card that does not follow the led suit', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('3C', '5H'), p3: [], p4: [] },
      { currentPlayer: 'p2', trick: { plays: [{ playerId: 'p1', card: c('7C') }], leadSuit: 'C' } },
    )
    const result = reduce(state, { type: 'play', playerId: 'p2', cardIds: ['5H'] }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('must-follow-suit')
  })

  it('refuses a heart led before they are broken', () => {
    const state = heartsPlayingState({ p1: cards('5H', '9D'), p2: [], p3: [], p4: [] })
    const result = reduce(state, { type: 'play', playerId: 'p1', cardIds: ['5H'] }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('hearts-not-broken')
  })

  it('refuses a point card on the first trick', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('12S', '9D'), p3: [], p4: [] },
      {
        trickNumber: 1,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('2C') }], leadSuit: 'C' },
      },
    )
    const result = reduce(state, { type: 'play', playerId: 'p2', cardIds: ['12S'] }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('no-points-first-trick')
  })

  it('refuses more than one card', () => {
    const state = heartsPlayingState({ p1: cards('9D', '10D'), p2: [], p3: [], p4: [] })
    const result = reduce(state, { type: 'play', playerId: 'p1', cardIds: ['9D', '10D'] }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('wrong-card-count')
  })

  it('refuses the Daifugo pass outright', () => {
    const state = heartsPlayingState({ p1: cards('9D'), p2: [], p3: [], p4: [] })
    const result = reduce(state, { type: 'pass', playerId: 'p1' }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('wrong-game')
  })

  it('breaks hearts when one is discarded, and says so', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('5H'), p3: [], p4: [] },
      { currentPlayer: 'p2', trick: { plays: [{ playerId: 'p1', card: c('7C') }], leadSuit: 'C' } },
    )
    const result = reduce(state, { type: 'play', playerId: 'p2', cardIds: ['5H'] }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.heartsBroken).toBe(true)
    expect(result.events.some((event) => event.type === 'heartsBroken')).toBe(true)
  })

  it('awards the trick to the highest card of the led suit and gives them the lead', () => {
    let state = heartsPlayingState({
      p1: cards('7C', '2D'),
      p2: cards('13C', '3D'),
      p3: cards('3C', '4D'),
      p4: cards('5H', '5D'),
    })
    state = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['7C'] }, ctx()))
    state = unwrap(reduce(state, { type: 'play', playerId: 'p2', cardIds: ['13C'] }, ctx()))
    state = unwrap(reduce(state, { type: 'play', playerId: 'p3', cardIds: ['3C'] }, ctx()))
    const result = reduce(state, { type: 'play', playerId: 'p4', cardIds: ['5H'] }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.state.currentPlayer).toBe('p2')
    expect(ids(result.state.taken.p2 ?? [])).toEqual(['5H'])
    expect(result.state.trick.plays).toEqual([])
    expect(result.state.trickNumber).toBe(3)
    expect(result.events.some((e) => e.type === 'trickTaken' && e.points === 1)).toBe(true)
  })

  it('plays the lowest legal card when a turn times out', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('9C', '3C', '5H'), p3: [], p4: [] },
      { currentPlayer: 'p2', trick: { plays: [{ playerId: 'p1', card: c('7C') }], leadSuit: 'C' } },
    )
    const next = unwrap(reduce(state, { type: 'timeout' }, ctx()))
    expect(next.trick.plays.at(-1)?.card.id).toBe('3C')
  })
})

describe('finishing a round', () => {
  const lastTrick = (overrides = {}) =>
    heartsPlayingState(
      { p1: cards('7C'), p2: cards('13C'), p3: cards('3C'), p4: cards('5H') },
      { trickNumber: 13, heartsBroken: true, ...overrides },
    )

  const playItOut = (state: HeartsState): HeartsState => {
    let next = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['7C'] }, ctx()))
    next = unwrap(reduce(next, { type: 'play', playerId: 'p2', cardIds: ['13C'] }, ctx()))
    next = unwrap(reduce(next, { type: 'play', playerId: 'p3', cardIds: ['3C'] }, ctx()))
    return unwrap(reduce(next, { type: 'play', playerId: 'p4', cardIds: ['5H'] }, ctx()))
  }

  it('scores the round and moves to roundEnd on the last trick', () => {
    const next = playItOut(lastTrick())
    expect(next.phase).toBe('roundEnd')
    expect(next.scores.p2).toBe(1)
    expect(next.history).toHaveLength(1)
    expect(next.currentPlayer).toBeNull()
  })

  it('ends the match once someone reaches the target', () => {
    const next = playItOut(lastTrick({ settings: { turnSeconds: 30, targetScore: 1 } }))
    expect(next.phase).toBe('matchEnd')
  })
})
