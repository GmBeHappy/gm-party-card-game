import { describe, expect, it } from 'vitest'
import {
  applyTransfer,
  buildTransfers,
  pendingTransfers,
  strongestCards,
  weakestCards,
} from '../src/slave/exchange'
import { assignRoles } from '../src/slave/roles'
import { cards, ids } from './helpers'

describe('card picking', () => {
  it('takes the strongest cards from a slave, twos first', () => {
    const hand = cards('3C', '15D', '14S', '9H')
    expect(ids(strongestCards(hand, 2))).toEqual(['15D', '14S'])
  })

  it('auto-sends the weakest cards for a stalled president', () => {
    const hand = cards('3C', '15D', '14S', '9H')
    expect(ids(weakestCards(hand, 2))).toEqual(['3C', '9H'])
  })
})

describe('buildTransfers', () => {
  it('pairs president with slave and pre-resolves the forced side', () => {
    const roles = assignRoles(['a', 'b', 'c'])
    const transfers = buildTransfers(roles, {
      a: cards('4C', '5C'),
      b: cards('6C', '7C'),
      c: cards('3C', '15D', '14S'),
    })
    expect(transfers).toHaveLength(2)

    const fromSlave = transfers.find((t) => t.from === 'c')
    expect(fromSlave?.forced).toBe(true)
    expect(fromSlave?.count).toBe(2)
    expect(ids(fromSlave?.cards ?? [])).toEqual(['15D', '14S'])

    const fromPresident = transfers.find((t) => t.from === 'a')
    expect(fromPresident?.forced).toBe(false)
    expect(fromPresident?.cards).toBeNull()
  })

  it('adds a one-card vice exchange at four players', () => {
    const roles = assignRoles(['a', 'b', 'c', 'd'])
    const transfers = buildTransfers(roles, {
      a: cards('4C'),
      b: cards('5C'),
      c: cards('6C'),
      d: cards('7C'),
    })
    expect(transfers).toHaveLength(4)
    const vice = transfers.find((t) => t.from === 'c' && t.to === 'b')
    expect(vice?.count).toBe(1)
    expect(vice?.forced).toBe(true)
  })

  it('leaves citizens out of the exchange entirely', () => {
    const roles = assignRoles(['a', 'b', 'c', 'd', 'e'])
    const transfers = buildTransfers(roles, {
      a: cards('4C'),
      b: cards('5C'),
      c: cards('6C'),
      d: cards('7C'),
      e: cards('8C'),
    })
    expect(transfers.some((t) => t.from === 'c' || t.to === 'c')).toBe(false)
  })
})

describe('applyTransfer', () => {
  it('moves cards between hands without duplicating them', () => {
    const hands = { a: cards('4C', '5C'), b: cards('9C') }
    const next = applyTransfer(hands, {
      from: 'a',
      to: 'b',
      count: 1,
      cards: cards('5C'),
      forced: false,
    })
    expect(ids(next.a ?? [])).toEqual(['4C'])
    expect(ids(next.b ?? [])).toEqual(['5C', '9C'])
  })
})

describe('pendingTransfers', () => {
  it('lists only the unchosen ones', () => {
    const roles = assignRoles(['a', 'b', 'c'])
    const transfers = buildTransfers(roles, {
      a: cards('4C', '5C'),
      b: cards('6C'),
      c: cards('7C', '8C'),
    })
    expect(pendingTransfers(transfers).map((t) => t.from)).toEqual(['a'])
  })
})
