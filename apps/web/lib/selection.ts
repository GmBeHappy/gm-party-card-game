import type { Card } from '@slave/game'

/**
 * Selection rules for the hand. A play is always cards of one rank, so
 * choosing a different rank replaces the selection rather than erroring, and
 * when the trick demands N cards, tapping one auto-fills the rest of the set.
 */
export function toggleSelection(
  hand: readonly Card[],
  selected: readonly string[],
  cardId: string,
  requiredCount: number | null,
): string[] {
  const card = hand.find((item) => item.id === cardId)
  if (card === undefined) return [...selected]

  if (selected.includes(cardId)) return selected.filter((id) => id !== cardId)

  const sameRank = hand.filter((item) => item.rank === card.rank)
  const kept = selected.filter((id) => sameRank.some((item) => item.id === id))

  if (requiredCount === null) return [...kept, cardId]

  // Following a trick: fill out the required shape from the same rank.
  const next = [...kept, cardId]
  for (const item of sameRank) {
    if (next.length >= requiredCount) break
    if (!next.includes(item.id)) next.push(item.id)
  }
  return next.slice(0, requiredCount)
}

export function isSubmittable(
  hand: readonly Card[],
  selected: readonly string[],
  requiredCount: number | null,
): boolean {
  if (selected.length === 0 || selected.length > 4) return false
  const cards = hand.filter((card) => selected.includes(card.id))
  if (cards.length !== selected.length) return false
  const first = cards[0]
  if (first === undefined) return false
  if (!cards.every((card) => card.rank === first.rank)) return false
  return requiredCount === null || cards.length === requiredCount
}
