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

  it('rejects a joker mixed with natural cards — no wildcards', () => {
    expect(classifyPlay(cards('JKR1', '3C'))).toEqual({ ok: false, error: 'joker-mixed' })
  })

  it('accepts two jokers as a pair', () => {
    expect(play('JKR1', 'JKR2').kind).toBe('pair')
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
    expect(canBeat(play('3C'), null, false, S)).toBe(true)
    expect(canBeat(play('3C', '3D'), null, false, S)).toBe(true)
  })

  it('requires a matching shape', () => {
    expect(canBeat(play('15C'), play('3C', '3D'), false, S)).toBe(false)
    expect(canBeat(play('15C', '15D'), play('3C'), false, S)).toBe(false)
  })

  it('requires a strictly higher rank', () => {
    expect(canBeat(play('4C'), play('3C'), false, S)).toBe(true)
    expect(canBeat(play('3H'), play('3C'), false, S)).toBe(false)
    expect(canBeat(play('3C'), play('4C'), false, S)).toBe(false)
  })

  it('ranks the 2 above the ace and the joker above the 2', () => {
    expect(canBeat(play('15C'), play('14C'), false, S)).toBe(true)
    expect(canBeat(play('JKR1'), play('15C'), false, S)).toBe(true)
  })
})

describe('canBeat — revolution', () => {
  it('inverts natural ranks', () => {
    expect(canBeat(play('3C'), play('15D'), true, S)).toBe(true)
    expect(canBeat(play('15C'), play('3D'), true, S)).toBe(false)
  })

  it('keeps the joker strongest in both directions', () => {
    expect(canBeat(play('JKR1'), play('3C'), true, S)).toBe(true)
    expect(canBeat(play('3C'), play('JKR1'), true, off({ spadeThreeBeatsJoker: false }))).toBe(
      false,
    )
  })
})

describe('spade three beats joker', () => {
  it('lets a lone ♠3 answer a lone joker', () => {
    expect(canBeat(play('3S'), play('JKR1'), false, S)).toBe(true)
    expect(canBeat(play('3S'), play('JKR1'), true, S)).toBe(true)
  })

  it('does not apply to other threes', () => {
    expect(canBeat(play('3H'), play('JKR1'), false, S)).toBe(false)
  })

  it('does not apply to a pair of jokers', () => {
    expect(canBeat(play('3S', '3H'), play('JKR1', 'JKR2'), false, S)).toBe(false)
  })

  it('is off when the room setting is off', () => {
    expect(canBeat(play('3S'), play('JKR1'), false, off({ spadeThreeBeatsJoker: false }))).toBe(
      false,
    )
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
    const kinds = legalPlays(hand, null, false, S).map((p) => `${p.kind}:${p.rank}`)
    expect(kinds).toContain('single:3')
    expect(kinds).toContain('pair:3')
    expect(kinds).toContain('single:4')
  })

  it('offers only matching, higher shapes when following', () => {
    const hand = cards('3C', '3D', '5H', '5S', '15C')
    const options = legalPlays(hand, play('4C', '4D'), false, S)
    expect(options.map((p) => p.rank)).toEqual([5])
  })

  it('reports when a hand is stuck', () => {
    const hand = cards('3C', '3D')
    expect(hasLegalPlay(hand, play('15C'), false, S)).toBe(false)
    expect(hasLegalPlay(hand, play('15C', '15D'), false, S)).toBe(false)
  })

  it('surfaces the ♠3 answer to a lone joker', () => {
    const options = legalPlays(cards('3S', '4C'), play('JKR1'), false, S)
    expect(options.map((p) => p.cards[0]?.id)).toEqual(['3S'])
  })
})
