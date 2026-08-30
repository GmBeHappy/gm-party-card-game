import { describe, expect, it } from 'vitest'
import { reachedTarget, roundScores } from '../../src/hearts/scoring'
import { cards } from '../helpers'

const SEATS = ['p1', 'p2', 'p3', 'p4']

/** All thirteen hearts plus the queen — the whole twenty-six. */
const ALL_PENALTIES = cards(
  '2H',
  '3H',
  '4H',
  '5H',
  '6H',
  '7H',
  '8H',
  '9H',
  '10H',
  '11H',
  '12H',
  '13H',
  '14H',
  '12S',
)

describe('round scores', () => {
  it('charges each seat what it took', () => {
    const result = roundScores(SEATS, {
      p1: cards('2H', '3H'),
      p2: cards('12S'),
      p3: [],
      p4: cards('4H'),
    })
    expect(result.points).toEqual({ p1: 2, p2: 13, p3: 0, p4: 1 })
    expect(result.moonShooter).toBeNull()
  })

  it('gives a seat that took nothing a zero rather than nothing at all', () => {
    const result = roundScores(SEATS, { p1: cards('2H') })
    expect(result.points).toEqual({ p1: 1, p2: 0, p3: 0, p4: 0 })
  })

  it('turns the table on a shot moon', () => {
    const result = roundScores(SEATS, { p1: ALL_PENALTIES, p2: [], p3: [], p4: [] })
    expect(result.points).toEqual({ p1: 0, p2: 26, p3: 26, p4: 26 })
    expect(result.moonShooter).toBe('p1')
  })

  it('is not a moon shot when one point got away', () => {
    const short = ALL_PENALTIES.filter((card) => card.id !== '2H')
    const result = roundScores(SEATS, { p1: short, p2: cards('2H'), p3: [], p4: [] })
    expect(result.points.p1).toBe(25)
    expect(result.points.p2).toBe(1)
    expect(result.moonShooter).toBeNull()
  })
})

describe('reaching the target', () => {
  it('ends the match at the target exactly', () => {
    expect(reachedTarget({ p1: 100, p2: 20 }, 100)).toBe(true)
  })

  it('ends the match past the target', () => {
    expect(reachedTarget({ p1: 113, p2: 20 }, 100)).toBe(true)
  })

  it('keeps playing below it', () => {
    expect(reachedTarget({ p1: 99, p2: 20 }, 100)).toBe(false)
  })
})
