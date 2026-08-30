import type { Card } from '../core/card'
import type { PlayerId } from '../core/player'
import { sortHand, strength } from './order'
import { findByRole } from './roles'
import type { ExchangeTransfer, RoleName } from './types'

/** How many cards each role pair swaps. */
const PAIRS: readonly {
  giver: RoleName
  receiver: RoleName
  count: number
}[] = [
  { giver: 'slave', receiver: 'president', count: 2 },
  { giver: 'president', receiver: 'slave', count: 2 },
  { giver: 'viceSlave', receiver: 'vicePresident', count: 1 },
  { giver: 'vicePresident', receiver: 'viceSlave', count: 1 },
]

/** Slaves surrender their best cards; they get no say. */
const FORCED_GIVERS: readonly RoleName[] = ['slave', 'viceSlave']

/** The n strongest cards in a hand, under normal (non-revolution) order. */
export function strongestCards(hand: readonly Card[], n: number): Card[] {
  return [...hand].sort((a, b) => strength(b, false) - strength(a, false)).slice(0, n)
}

/** The n weakest cards — what a President auto-sends when their timer runs out. */
export function weakestCards(hand: readonly Card[], n: number): Card[] {
  return sortHand(hand).slice(0, n)
}

/**
 * Build the exchange for a round. Forced transfers (from the Slave side) are
 * resolved up front so the President can see what they received before
 * choosing what to send back.
 */
export function buildTransfers(
  roles: Readonly<Record<PlayerId, RoleName>>,
  hands: Readonly<Record<PlayerId, readonly Card[]>>,
): ExchangeTransfer[] {
  const transfers: ExchangeTransfer[] = []
  for (const pair of PAIRS) {
    const from = findByRole(roles, pair.giver)
    const to = findByRole(roles, pair.receiver)
    if (from === null || to === null) continue

    const forced = FORCED_GIVERS.includes(pair.giver)
    const hand = hands[from] ?? []
    transfers.push({
      from,
      to,
      count: pair.count,
      cards: forced ? strongestCards(hand, pair.count) : null,
      forced,
    })
  }
  return transfers
}

/** Move a set of cards from one hand to another. Returns new hands. */
export function applyTransfer(
  hands: Readonly<Record<PlayerId, readonly Card[]>>,
  transfer: ExchangeTransfer,
): Record<PlayerId, readonly Card[]> {
  const cards = transfer.cards ?? []
  const ids = new Set(cards.map((c) => c.id))
  const fromHand = (hands[transfer.from] ?? []).filter((c) => !ids.has(c.id))
  const toHand = [...(hands[transfer.to] ?? []), ...cards]
  return { ...hands, [transfer.from]: fromHand, [transfer.to]: sortHand(toHand) }
}

export function pendingTransfers(transfers: readonly ExchangeTransfer[]): ExchangeTransfer[] {
  return transfers.filter((t) => t.cards === null)
}
