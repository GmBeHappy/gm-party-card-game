import { describe, expect, it } from 'vitest'
import { sortHand } from '../src/cards'
import {
  type ActionResult,
  canPass,
  createInitialState,
  type GameState,
  handCounts,
  playableCardIds,
  reduce,
} from '../src/index'
import { DEFAULT_SETTINGS } from '../src/types'
import { cards, ctx, ids, makePlayers, playingState } from './helpers'

function unwrap(result: ActionResult): GameState {
  if (!result.ok) throw new Error(`action failed: ${result.error}`)
  return result.state
}

function events(result: ActionResult): string[] {
  if (!result.ok) throw new Error(`action failed: ${result.error}`)
  return result.events.map((event) => event.type)
}

describe('starting a match', () => {
  it('refuses to start below three players', () => {
    const state = createInitialState(makePlayers(2))
    expect(reduce(state, { type: 'startMatch' }, ctx())).toEqual({
      ok: false,
      error: 'not-enough-players',
    })
  })

  it('deals the whole deck and opens play', () => {
    const state = unwrap(reduce(createInitialState(makePlayers(4)), { type: 'startMatch' }, ctx()))
    expect(state.phase).toBe('playing')
    expect(state.round).toBe(1)
    expect(Object.values(state.hands).flat()).toHaveLength(54)
    expect(Object.values(handCounts(state))).toEqual([14, 14, 13, 13])
  })

  it('gives the first lead to whoever holds the three of diamonds', () => {
    const state = unwrap(reduce(createInitialState(makePlayers(4)), { type: 'startMatch' }, ctx()))
    const holder = state.currentPlayer
    expect(holder).not.toBeNull()
    expect((state.hands[holder as string] ?? []).some((card) => card.id === '3D')).toBe(true)
  })

  it('sets a turn deadline from the room settings', () => {
    const state = unwrap(
      reduce(createInitialState(makePlayers(3)), { type: 'startMatch' }, ctx(5_000)),
    )
    expect(state.turnDeadline).toBe(5_000 + 30_000)
  })

  it('leaves the deadline null when the timer is off', () => {
    const untimed = createInitialState(makePlayers(3), {
      ...DEFAULT_SETTINGS,
      turnSeconds: null,
    })
    const state = unwrap(reduce(untimed, { type: 'startMatch' }, ctx()))
    expect(state.turnDeadline).toBeNull()
  })
})

describe('playing a turn', () => {
  const base = () =>
    playingState({
      p1: cards('4C', '4D', '9H'),
      p2: cards('5C', '5D', '10H'),
      p3: cards('6C', '6D', '11H'),
    })

  it('rejects a play from the wrong player', () => {
    expect(reduce(base(), { type: 'play', playerId: 'p2', cardIds: ['5C'] }, ctx())).toEqual({
      ok: false,
      error: 'not-your-turn',
    })
  })

  it('rejects cards the player does not hold', () => {
    expect(reduce(base(), { type: 'play', playerId: 'p1', cardIds: ['5C'] }, ctx())).toEqual({
      ok: false,
      error: 'card-not-in-hand',
    })
  })

  it('rejects an illegal shape', () => {
    expect(reduce(base(), { type: 'play', playerId: 'p1', cardIds: ['4C', '9H'] }, ctx())).toEqual({
      ok: false,
      error: 'invalid-play',
    })
  })

  it('rejects a play that cannot beat the trick', () => {
    const state = unwrap(reduce(base(), { type: 'play', playerId: 'p1', cardIds: ['9H'] }, ctx()))
    expect(reduce(state, { type: 'play', playerId: 'p2', cardIds: ['5C'] }, ctx())).toEqual({
      ok: false,
      error: 'cannot-beat',
    })
  })

  it('removes the cards, sets the trick, and advances the turn', () => {
    const state = unwrap(reduce(base(), { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx()))
    expect(ids(state.hands.p1 ?? [])).toEqual(['4D', '9H'])
    expect(state.trick.current?.rank).toBe(4)
    expect(state.trick.leader).toBe('p1')
    expect(state.currentPlayer).toBe('p2')
  })

  it('bumps the version on every accepted action', () => {
    const before = base()
    const after = unwrap(reduce(before, { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx()))
    expect(after.version).toBeGreaterThan(before.version)
  })
})

describe('passing', () => {
  const base = () =>
    playingState({
      p1: cards('4C', '9H'),
      p2: cards('5C', '10H'),
      p3: cards('6C', '11H'),
    })

  it('is illegal when leading an open trick', () => {
    expect(reduce(base(), { type: 'pass', playerId: 'p1' }, ctx())).toEqual({
      ok: false,
      error: 'cannot-pass',
    })
    expect(canPass(base(), 'p1')).toBe(false)
  })

  it('locks the passer out for the rest of the trick', () => {
    let state = unwrap(reduce(base(), { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx()))
    state = unwrap(reduce(state, { type: 'pass', playerId: 'p2' }, ctx()))
    expect(state.trick.passed).toEqual(['p2'])
    expect(state.currentPlayer).toBe('p3')
  })

  it('clears the trick and returns the lead once everyone else has passed', () => {
    let state = unwrap(reduce(base(), { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx()))
    state = unwrap(reduce(state, { type: 'pass', playerId: 'p2' }, ctx()))
    const result = reduce(state, { type: 'pass', playerId: 'p3' }, ctx())
    expect(events(result)).toContain('trickCleared')

    const cleared = unwrap(result)
    expect(cleared.trick.current).toBeNull()
    expect(cleared.trick.passed).toEqual([])
    expect(cleared.currentPlayer).toBe('p1')
  })

  it('skips players who already passed when the trick continues', () => {
    let state = unwrap(
      reduce(
        playingState({
          p1: cards('4C', '9H'),
          p2: cards('5C', '10H'),
          p3: cards('6C', '11H'),
          p4: cards('7C', '12H'),
        }),
        { type: 'play', playerId: 'p1', cardIds: ['4C'] },
        ctx(),
      ),
    )
    state = unwrap(reduce(state, { type: 'pass', playerId: 'p2' }, ctx()))
    state = unwrap(reduce(state, { type: 'play', playerId: 'p3', cardIds: ['6C'] }, ctx()))
    expect(state.currentPlayer).toBe('p4')
    state = unwrap(reduce(state, { type: 'pass', playerId: 'p4' }, ctx()))
    // p2 is out, so the lead comes back to p1 — not to p2.
    expect(state.currentPlayer).toBe('p1')
  })
})

describe('eight cut', () => {
  it('ends the trick immediately and hands the lead back to the cutter', () => {
    const state = playingState({
      p1: cards('8C', '9H'),
      p2: cards('15C', '10H'),
      p3: cards('6C', '11H'),
    })
    const result = reduce(state, { type: 'play', playerId: 'p1', cardIds: ['8C'] }, ctx())
    expect(events(result)).toContain('eightCut')

    const next = unwrap(result)
    expect(next.trick.current).toBeNull()
    expect(next.currentPlayer).toBe('p1')
  })

  it('still cuts while a revolution is running', () => {
    const state = playingState(
      { p1: cards('8C', '9H'), p2: cards('3C', '10H'), p3: cards('6C', '11H') },
      { revolution: true },
    )
    const next = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['8C'] }, ctx()))
    expect(next.trick.current).toBeNull()
    expect(next.currentPlayer).toBe('p1')
  })

  it('does not cut when the room has the rule switched off', () => {
    const state = playingState(
      { p1: cards('8C', '9H'), p2: cards('15C', '10H'), p3: cards('6C', '11H') },
      {},
      { ...DEFAULT_SETTINGS, eightCut: false },
    )
    const next = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['8C'] }, ctx()))
    expect(next.trick.current?.rank).toBe(8)
    expect(next.currentPlayer).toBe('p2')
  })
})

describe('revolution', () => {
  const quadState = () =>
    playingState({
      p1: cards('5C', '5D', '5H', '5S'),
      p2: cards('6C', '6D', '6H', '6S', '10H'),
      p3: cards('7C', '11H'),
    })

  it('flips the rank order on a four of a kind', () => {
    const result = reduce(
      quadState(),
      { type: 'play', playerId: 'p1', cardIds: ['5C', '5D', '5H', '5S'] },
      ctx(),
    )
    expect(events(result)).toContain('revolution')
    expect(unwrap(result).revolution).toBe(true)
  })

  it('flips back on a second four of a kind', () => {
    let state = unwrap(
      reduce(
        quadState(),
        { type: 'play', playerId: 'p1', cardIds: ['5C', '5D', '5H', '5S'] },
        ctx(),
      ),
    )
    expect(state.revolution).toBe(true)
    // Under revolution a quad of 6s is weaker than 5s, so the trick has to clear first.
    state = unwrap(reduce(state, { type: 'pass', playerId: 'p2' }, ctx()))
    state = unwrap(reduce(state, { type: 'pass', playerId: 'p3' }, ctx()))
    expect(state.trick.current).toBeNull()
    expect(state.currentPlayer).toBe('p2')
    state = unwrap(
      reduce(state, { type: 'play', playerId: 'p2', cardIds: ['6C', '6D', '6H', '6S'] }, ctx()),
    )
    expect(state.revolution).toBe(false)
  })

  it('changes which cards are legal to play', () => {
    const state = playingState(
      {
        p1: cards('9H', '15C'),
        p2: cards('4C', '14C'),
        p3: cards('7C', '11H'),
      },
      { revolution: true, trick: { current: null, leader: null, passed: [] } },
    )
    const after = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['9H'] }, ctx()))
    // Ranks are inverted: the 4 now beats the 9, and the ace no longer does.
    expect(playableCardIds(after, 'p2')).toEqual(new Set(['4C']))
  })
})

describe('finishing and round end', () => {
  const endgame = () =>
    playingState({
      p1: cards('4C'),
      p2: cards('5C'),
      p3: cards('6C', '7C'),
    })

  it('records a player who empties their hand', () => {
    const result = reduce(endgame(), { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx())
    expect(events(result)).toContain('playerFinished')
    expect(unwrap(result).finishOrder).toEqual(['p1'])
  })

  it('ends the round when only one player still holds cards', () => {
    let state = unwrap(reduce(endgame(), { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx()))
    const result = reduce(state, { type: 'play', playerId: 'p2', cardIds: ['5C'] }, ctx())
    expect(events(result)).toContain('roundEnded')

    state = unwrap(result)
    expect(state.phase).toBe('roundEnd')
    expect(state.finishOrder).toEqual(['p1', 'p2', 'p3'])
    expect(state.roles).toEqual({ p1: 'president', p2: 'citizen', p3: 'slave' })
    expect(state.scores).toEqual({ p1: 2, p2: 1, p3: 0 })
    expect(state.history).toHaveLength(1)
    expect(state.currentPlayer).toBeNull()
  })

  it('ends the match instead when the last round finishes', () => {
    const single = playingState(
      { p1: cards('4C'), p2: cards('5C'), p3: cards('6C', '7C') },
      {},
      { ...DEFAULT_SETTINGS, totalRounds: 1 },
    )
    let state = unwrap(reduce(single, { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx()))
    const result = reduce(state, { type: 'play', playerId: 'p2', cardIds: ['5C'] }, ctx())
    expect(events(result)).toContain('matchEnded')
    state = unwrap(result)
    expect(state.phase).toBe('matchEnd')
  })

  it('keeps playing an endless match past the round count', () => {
    const endless = playingState(
      { p1: cards('4C'), p2: cards('5C'), p3: cards('6C', '7C') },
      { round: 9 },
      { ...DEFAULT_SETTINGS, totalRounds: null },
    )
    let state = unwrap(reduce(endless, { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx()))
    state = unwrap(reduce(state, { type: 'play', playerId: 'p2', cardIds: ['5C'] }, ctx()))
    expect(state.phase).toBe('roundEnd')
  })
})

describe('the exchange phase', () => {
  function toRoundTwo() {
    let state = playingState({ p1: cards('4C'), p2: cards('5C'), p3: cards('6C', '7C') })
    state = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx()))
    state = unwrap(reduce(state, { type: 'play', playerId: 'p2', cardIds: ['5C'] }, ctx()))
    return unwrap(reduce(state, { type: 'nextRound' }, ctx()))
  }

  it('opens round two in the exchange phase, not in play', () => {
    const state = toRoundTwo()
    expect(state.phase).toBe('exchange')
    expect(state.round).toBe(2)
    expect(state.exchange?.deadline).toBe(1_000 + 30_000)
  })

  it('has already taken the slave’s two best cards', () => {
    const state = toRoundTwo()
    const fromSlave = state.exchange?.transfers.find((t) => t.from === 'p3')
    expect(fromSlave?.forced).toBe(true)
    expect(fromSlave?.cards).toHaveLength(2)
    // The slave is two cards down; the president is two cards up.
    expect((state.hands.p3 ?? []).length).toBe(16)
    expect((state.hands.p1 ?? []).length).toBe(20)
  })

  it('waits for the president to choose', () => {
    const state = toRoundTwo()
    const pending = state.exchange?.transfers.filter((t) => t.cards === null) ?? []
    expect(pending.map((t) => t.from)).toEqual(['p1'])
  })

  it('rejects the wrong number of cards', () => {
    const state = toRoundTwo()
    const hand = state.hands.p1 ?? []
    expect(
      reduce(
        state,
        { type: 'exchangeChoose', playerId: 'p1', cardIds: [hand[0]?.id ?? ''] },
        ctx(),
      ),
    ).toEqual({ ok: false, error: 'wrong-card-count' })
  })

  it('rejects a choice from someone with nothing to give', () => {
    const state = toRoundTwo()
    expect(
      reduce(state, { type: 'exchangeChoose', playerId: 'p2', cardIds: ['3C', '4C'] }, ctx()),
    ).toEqual({ ok: false, error: 'no-pending-exchange' })
  })

  it('starts play with the slave leading once the president has chosen', () => {
    const state = toRoundTwo()
    const give = (state.hands.p1 ?? []).slice(0, 2).map((card) => card.id)
    const result = reduce(state, { type: 'exchangeChoose', playerId: 'p1', cardIds: give }, ctx())
    expect(events(result)).toContain('exchangeResolved')

    const next = unwrap(result)
    expect(next.phase).toBe('playing')
    expect(next.currentPlayer).toBe('p3')
    expect(next.exchange).toBeNull()
    expect(Object.values(handCounts(next))).toEqual([18, 18, 18])
    expect((next.hands.p3 ?? []).map((card) => card.id)).toEqual(expect.arrayContaining(give))
  })

  it('auto-sends the president’s weakest cards when the timer runs out', () => {
    const state = toRoundTwo()
    const weakest = sortHand(state.hands.p1 ?? [])
      .slice(0, 2)
      .map((card) => card.id)
    const next = unwrap(reduce(state, { type: 'timeout' }, ctx()))
    expect(next.phase).toBe('playing')
    expect((next.hands.p3 ?? []).map((card) => card.id)).toEqual(expect.arrayContaining(weakest))
  })

  it('resets the revolution flag for the new round', () => {
    let state = playingState(
      { p1: cards('4C'), p2: cards('3C'), p3: cards('6C', '7C') },
      { revolution: true },
    )
    state = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx()))
    state = unwrap(reduce(state, { type: 'play', playerId: 'p2', cardIds: ['3C'] }, ctx()))
    state = unwrap(reduce(state, { type: 'nextRound' }, ctx()))
    expect(state.revolution).toBe(false)
  })
})

describe('turn timeouts', () => {
  it('passes for a player who is following a trick', () => {
    let state = playingState({
      p1: cards('4C', '9H'),
      p2: cards('5C', '10H'),
      p3: cards('6C', '11H'),
    })
    state = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx()))
    const result = reduce(state, { type: 'timeout' }, ctx())
    expect(events(result)).toContain('passed')
    expect(unwrap(result).trick.passed).toEqual(['p2'])
  })

  it('sheds the lowest card for a player who has to lead', () => {
    const state = playingState({
      p1: cards('9H', '4C', '15D'),
      p2: cards('5C', '10H'),
      p3: cards('6C', '11H'),
    })
    const next = unwrap(reduce(state, { type: 'timeout' }, ctx()))
    expect(next.trick.current?.cards[0]?.id).toBe('4C')
    expect(next.currentPlayer).toBe('p2')
  })

  it('never strands a match behind an absent player', () => {
    let state = playingState({
      p1: cards('4C', '9H'),
      p2: cards('5C', '10H'),
      p3: cards('6C', '11H'),
    })
    for (let i = 0; i < 12 && state.phase === 'playing'; i++) {
      state = unwrap(reduce(state, { type: 'timeout' }, ctx()))
    }
    expect(state.phase).toBe('roundEnd')
  })
})

describe('phase guards', () => {
  it('refuses play actions outside the playing phase', () => {
    const lobby = createInitialState(makePlayers(3))
    expect(reduce(lobby, { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx())).toEqual({
      ok: false,
      error: 'wrong-phase',
    })
    expect(reduce(lobby, { type: 'nextRound' }, ctx())).toEqual({ ok: false, error: 'wrong-phase' })
  })

  it('refuses to start a match twice', () => {
    const state = unwrap(reduce(createInitialState(makePlayers(3)), { type: 'startMatch' }, ctx()))
    expect(reduce(state, { type: 'startMatch' }, ctx())).toEqual({
      ok: false,
      error: 'wrong-phase',
    })
  })

  it('lets the host end a running match', () => {
    const state = unwrap(reduce(createInitialState(makePlayers(3)), { type: 'startMatch' }, ctx()))
    expect(unwrap(reduce(state, { type: 'endMatch' }, ctx())).phase).toBe('matchEnd')
  })
})

describe('client-facing queries', () => {
  it('only marks cards playable on your own turn', () => {
    const state = playingState({
      p1: cards('4C', '9H'),
      p2: cards('5C', '10H'),
      p3: cards('6C', '11H'),
    })
    expect(playableCardIds(state, 'p1')).toEqual(new Set(['4C', '9H']))
    expect(playableCardIds(state, 'p2')).toEqual(new Set())
  })

  it('marks nothing playable when the hand cannot answer', () => {
    let state = playingState({
      p1: cards('15C', '9H'),
      p2: cards('5C', '10H'),
      p3: cards('6C', '11H'),
    })
    state = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['15C'] }, ctx()))
    expect(playableCardIds(state, 'p2')).toEqual(new Set())
    expect(canPass(state, 'p2')).toBe(true)
  })
})
