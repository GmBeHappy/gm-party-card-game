import { describe, expect, it } from 'vitest'
import { applyPasses, passDirection, passTarget } from '../../src/hearts/passing'
import { cards, ids, makePlayers } from '../helpers'

describe('pass direction', () => {
  it('runs left, right, across, none', () => {
    expect(passDirection(1)).toBe('left')
    expect(passDirection(2)).toBe('right')
    expect(passDirection(3)).toBe('across')
    expect(passDirection(4)).toBe('none')
  })

  it('repeats the cycle from round five', () => {
    expect(passDirection(5)).toBe('left')
    expect(passDirection(8)).toBe('none')
    expect(passDirection(9)).toBe('left')
  })
})

describe('pass target', () => {
  const players = makePlayers(4)

  it('passes left to the next seat, wrapping', () => {
    expect(passTarget(players, 'p1', 'left')).toBe('p2')
    expect(passTarget(players, 'p4', 'left')).toBe('p1')
  })

  it('passes right to the previous seat, wrapping', () => {
    expect(passTarget(players, 'p1', 'right')).toBe('p4')
    expect(passTarget(players, 'p2', 'right')).toBe('p1')
  })

  it('passes across to the opposite seat', () => {
    expect(passTarget(players, 'p1', 'across')).toBe('p3')
    expect(passTarget(players, 'p3', 'across')).toBe('p1')
  })

  it('returns null for a seat that is not at the table', () => {
    expect(passTarget(players, 'nobody', 'left')).toBeNull()
  })
})

describe('applying a pass', () => {
  const players = makePlayers(4)
  const hands = () => ({
    p1: cards('2C', '3C', '4C', '5C'),
    p2: cards('2D', '3D', '4D', '5D'),
    p3: cards('2H', '3H', '4H', '5H'),
    p4: cards('2S', '3S', '4S', '5S'),
  })
  const selections = () => ({
    p1: cards('2C', '3C', '4C'),
    p2: cards('2D', '3D', '4D'),
    p3: cards('2H', '3H', '4H'),
    p4: cards('2S', '3S', '4S'),
  })

  it('moves each seat its three cards and reports what arrived', () => {
    const result = applyPasses(players, hands(), {
      direction: 'left',
      selections: selections(),
    })

    expect(ids(result.hands.p2 ?? [])).toEqual(['2C', '3C', '4C', '5D'])
    expect(ids(result.received.p2 ?? [])).toEqual(['2C', '3C', '4C'])
    expect(ids(result.hands.p1 ?? [])).toEqual(['5C', '2S', '3S', '4S'])
  })

  it('keeps every hand the size it started', () => {
    const result = applyPasses(players, hands(), {
      direction: 'across',
      selections: selections(),
    })
    for (const player of players) expect(result.hands[player.id]).toHaveLength(4)
  })
})
