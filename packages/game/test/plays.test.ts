import { describe, expect, it } from 'vitest'
import {
  canBeat,
  classifyPlay,
  hasLegalPlay,
  isEightCut,
  isRevolutionPlay,
  legalPlays,
} from '../src/plays'
import { DEFAULT_SETTINGS, type Play, type RoomSettings } from '../src/types'
import { c, cards } from './helpers'

const S = DEFAULT_SETTINGS
const off = (patch: Partial<RoomSettings>): RoomSettings => ({ ...S, ...patch })

function play(...ids: string[]): Play {
  const result = classifyPlay(cards(...ids))
  if (!result.ok) throw new Error(`not a valid play: ${ids.join(',')} (${result.error})`)
  return result.play
}

describe('classifyPlay', () => {
  it('names each shape', () => {
    expect(play('3C').kind).toBe('single')
    expect(play('3C', '3D').kind).toBe('pair')
    expect(play('3C', '3D', '3H').kind).toBe('triple')
    expect(play('3C', '3D', '3H', '3S').kind).toBe('quad')
  })

  it('rejects an empty selection', () => {
    expect(classifyPlay([])).toEqual({ ok: false, error: 'empty' })
  })

  it('rejects mixed ranks', () => {
    expect(classifyPlay(cards('3C', '4D'))).toEqual({ ok: false, error: 'mixed-ranks' })
  })

  it('rejects duplicate cards', () => {
    expect(classifyPlay([c('3C'), c('3C')])).toEqual({ ok: false, error: 'duplicate-cards' })
  })

  it('rejects more than four cards', () => {
    const five = [c('3C'), c('3D'), c('3H'), c('3S'), c('4C')]
    expect(classifyPlay(five)).toEqual({ ok: false, error: 'too-many' })
  })
})

describe('canBeat — normal order', () => {
  it('lets any shape lead an open trick', () => {
    expect(canBeat(play('3C'), null, false)).toBe(true)
    expect(canBeat(play('3C', '3D'), null, false)).toBe(true)
  })

  it('requires a matching shape', () => {
    expect(canBeat(play('15C'), play('3C', '3D'), false)).toBe(false)
    expect(canBeat(play('15C', '15D'), play('3C'), false)).toBe(false)
  })

  it('requires a strictly higher rank', () => {
    expect(canBeat(play('4C'), play('3C'), false)).toBe(true)
    expect(canBeat(play('3H'), play('3C'), false)).toBe(false)
    expect(canBeat(play('3C'), play('4C'), false)).toBe(false)
  })

  it('ranks the 2 above the ace', () => {
    expect(canBeat(play('15C'), play('14C'), false)).toBe(true)
    expect(canBeat(play('14C'), play('15C'), false)).toBe(false)
  })

  it('compares pairs by rank, ignoring suit', () => {
    expect(canBeat(play('9C', '9D'), play('8H', '8S'), false)).toBe(true)
    expect(canBeat(play('8C', '8D'), play('8H', '8S'), false)).toBe(false)
  })
})

describe('canBeat — revolution', () => {
  it('inverts natural ranks', () => {
    expect(canBeat(play('3C'), play('15D'), true)).toBe(true)
    expect(canBeat(play('15C'), play('3D'), true)).toBe(false)
  })

  it('makes the 3 the strongest card and the 2 the weakest', () => {
    expect(canBeat(play('3C'), play('4D'), true)).toBe(true)
    expect(canBeat(play('15C'), play('14D'), true)).toBe(false)
  })

  it('inverts pairs as well as singles', () => {
    expect(canBeat(play('4C', '4D'), play('9H', '9S'), true)).toBe(true)
    expect(canBeat(play('9C', '9D'), play('4H', '4S'), true)).toBe(false)
  })
})

describe('eight cut', () => {
  it('fires on any shape containing an eight', () => {
    expect(isEightCut(play('8C'), S)).toBe(true)
    expect(isEightCut(play('8C', '8D'), S)).toBe(true)
    expect(isEightCut(play('8C', '8D', '8H', '8S'), S)).toBe(true)
  })

  it('does not fire on other ranks, or when disabled', () => {
    expect(isEightCut(play('9C'), S)).toBe(false)
    expect(isEightCut(play('8C'), off({ eightCut: false }))).toBe(false)
  })
})

describe('revolution trigger', () => {
  it('needs four of a kind', () => {
    expect(isRevolutionPlay(play('5C', '5D', '5H', '5S'), S)).toBe(true)
    expect(isRevolutionPlay(play('5C', '5D', '5H'), S)).toBe(false)
    expect(isRevolutionPlay(play('5C', '5D', '5H', '5S'), off({ revolution: false }))).toBe(false)
  })
})

describe('legalPlays', () => {
  it('offers every shape when leading', () => {
    const hand = cards('3C', '3D', '4H')
    const kinds = legalPlays(hand, null, false).map((p) => `${p.kind}:${p.rank}`)
    expect(kinds).toContain('single:3')
    expect(kinds).toContain('pair:3')
    expect(kinds).toContain('single:4')
  })

  it('offers only matching, higher shapes when following', () => {
    const hand = cards('3C', '3D', '5H', '5S', '15C')
    const options = legalPlays(hand, play('4C', '4D'), false)
    expect(options.map((p) => p.rank)).toEqual([5])
  })

  it('reports when a hand is stuck', () => {
    const hand = cards('3C', '3D')
    expect(hasLegalPlay(hand, play('15C'), false)).toBe(false)
    expect(hasLegalPlay(hand, play('15C', '15D'), false)).toBe(false)
  })

  it('inverts which plays are offered under revolution', () => {
    const hand = cards('4C', '14C')
    expect(legalPlays(hand, play('9H'), false).map((p) => p.rank)).toEqual([14])
    expect(legalPlays(hand, play('9H'), true).map((p) => p.rank)).toEqual([4])
  })
})
