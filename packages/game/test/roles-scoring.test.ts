import { describe, expect, it } from 'vitest'
import { addScores, standings } from '../src/core/scoring'
import { assignRoles, findByRole } from '../src/slave/roles'
import { roundPoints } from '../src/slave/scoring'

describe('assignRoles', () => {
  it('gives three players president, citizen, slave', () => {
    expect(assignRoles(['a', 'b', 'c'])).toEqual({
      a: 'president',
      b: 'citizen',
      c: 'slave',
    })
  })

  it('adds the vice pair at four players, leaving no citizens', () => {
    expect(assignRoles(['a', 'b', 'c', 'd'])).toEqual({
      a: 'president',
      b: 'vicePresident',
      c: 'viceSlave',
      d: 'slave',
    })
  })

  it('puts citizens in the middle at five and six players', () => {
    expect(assignRoles(['a', 'b', 'c', 'd', 'e']).c).toBe('citizen')
    const six = assignRoles(['a', 'b', 'c', 'd', 'e', 'f'])
    expect([six.c, six.d]).toEqual(['citizen', 'citizen'])
    expect(six.e).toBe('viceSlave')
    expect(six.f).toBe('slave')
  })
})

describe('findByRole', () => {
  it('locates a role holder, or reports none', () => {
    const roles = assignRoles(['a', 'b', 'c'])
    expect(findByRole(roles, 'slave')).toBe('c')
    expect(findByRole(roles, 'vicePresident')).toBeNull()
  })
})

describe('scoring', () => {
  it('awards playerCount - position, so the slave scores nothing', () => {
    expect(roundPoints(['a', 'b', 'c', 'd'])).toEqual({ a: 3, b: 2, c: 1, d: 0 })
  })

  it('accumulates across rounds', () => {
    const first = addScores({}, roundPoints(['a', 'b', 'c']))
    const second = addScores(first, roundPoints(['c', 'b', 'a']))
    expect(second).toEqual({ a: 2, b: 2, c: 2 })
  })

  it('ranks standings highest first, breaking ties on seat order', () => {
    const table = standings({ a: 2, b: 5, c: 2 }, ['a', 'b', 'c'])
    expect(table.map((row) => row.playerId)).toEqual(['b', 'a', 'c'])
  })
})
