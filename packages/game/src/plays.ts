import { isJoker, isSpadeThree, strength } from './cards'
import {
  type Card,
  EIGHT_RANK,
  JOKER_RANK,
  type Play,
  type PlayKind,
  type RoomSettings,
} from './types'

const KINDS: Readonly<Record<number, PlayKind>> = {
  1: 'single',
  2: 'pair',
  3: 'triple',
  4: 'quad',
}

export type PlayError = 'empty' | 'too-many' | 'mixed-ranks' | 'joker-mixed' | 'duplicate-cards'

export type ClassifyResult =
  | { readonly ok: true; readonly play: Play }
  | { readonly ok: false; readonly error: PlayError }

/**
 * Validate a set of cards as a playable shape.
 *
 * Shapes are 1–4 cards of a single rank. Jokers are their own rank: two Jokers
 * form the strongest pair, but a Joker never substitutes for a natural card
 * (no wildcards), which keeps every play unambiguous to compare and to select.
 */
export function classifyPlay(cards: readonly Card[]): ClassifyResult {
  if (cards.length === 0) return { ok: false, error: 'empty' }
  if (cards.length > 4) return { ok: false, error: 'too-many' }

  const ids = new Set(cards.map((c) => c.id))
  if (ids.size !== cards.length) return { ok: false, error: 'duplicate-cards' }

  const first = cards[0]
  if (first === undefined) return { ok: false, error: 'empty' }

  const jokers = cards.filter(isJoker).length
  if (jokers > 0 && jokers !== cards.length) return { ok: false, error: 'joker-mixed' }

  if (!cards.every((c) => c.rank === first.rank)) return { ok: false, error: 'mixed-ranks' }

  const kind = KINDS[cards.length]
  if (kind === undefined) return { ok: false, error: 'too-many' }

  return { ok: true, play: { kind, count: cards.length, rank: first.rank, cards: [...cards] } }
}

/** Strength of a whole play, which is the strength of any one of its cards. */
export function playStrength(play: Play, revolution: boolean): number {
  const card = play.cards[0]
  if (card === undefined) return Number.NEGATIVE_INFINITY
  return strength(card, revolution)
}

function isLoneJoker(play: Play): boolean {
  return play.count === 1 && play.rank === JOKER_RANK
}

function isLoneSpadeThree(play: Play): boolean {
  const card = play.cards[0]
  return play.count === 1 && card !== undefined && isSpadeThree(card)
}

/**
 * Can `candidate` legally be played on top of `current`?
 *
 * A null `current` means the trick is open and any valid shape leads.
 */
export function canBeat(
  candidate: Play,
  current: Play | null,
  revolution: boolean,
  settings: RoomSettings,
): boolean {
  if (current === null) return true
  if (candidate.count !== current.count) return false

  // ♠3 is the one answer to a lone Joker, in both directions of revolution.
  if (settings.spadeThreeBeatsJoker && isLoneJoker(current) && isLoneSpadeThree(candidate)) {
    return true
  }

  return playStrength(candidate, revolution) > playStrength(current, revolution)
}

/** Does this play end the trick immediately under the 8-cut rule? */
export function isEightCut(play: Play, settings: RoomSettings): boolean {
  return settings.eightCut && play.rank === EIGHT_RANK
}

/** Does this play flip (or unflip) the rank order? */
export function isRevolutionPlay(play: Play, settings: RoomSettings): boolean {
  return settings.revolution && play.count === 4
}

/** Every legal play available from a hand against the current trick. */
export function legalPlays(
  hand: readonly Card[],
  current: Play | null,
  revolution: boolean,
  settings: RoomSettings,
): Play[] {
  const byRank = new Map<number, Card[]>()
  for (const card of hand) {
    const bucket = byRank.get(card.rank)
    if (bucket === undefined) byRank.set(card.rank, [card])
    else bucket.push(card)
  }

  const out: Play[] = []
  for (const group of byRank.values()) {
    const size = current === null ? group.length : Math.min(group.length, current.count)
    const wanted = current === null ? null : current.count
    for (let n = 1; n <= size; n++) {
      if (wanted !== null && n !== wanted) continue
      const result = classifyPlay(group.slice(0, n))
      if (result.ok && canBeat(result.play, current, revolution, settings)) out.push(result.play)
    }
  }
  return out
}

/** True when the hand contains no answer to the current trick. */
export function hasLegalPlay(
  hand: readonly Card[],
  current: Play | null,
  revolution: boolean,
  settings: RoomSettings,
): boolean {
  return legalPlays(hand, current, revolution, settings).length > 0
}
