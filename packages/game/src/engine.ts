import { createDeck, deal, isJoker, shuffle, sortHand } from './cards'
import { applyTransfer, buildTransfers, pendingTransfers, weakestCards } from './exchange'
import { canBeat, classifyPlay, isEightCut, isRevolutionPlay, legalPlays } from './plays'
import type { Rng } from './rng'
import { assignRoles, findByRole } from './roles'
import { addScores, roundPoints } from './scoring'
import {
  type Card,
  DEFAULT_SETTINGS,
  type ExchangeTransfer,
  type GameState,
  type Play,
  type Player,
  type PlayerId,
  type RoomSettings,
} from './types'

export const EXCHANGE_SECONDS = 30
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 6

export interface EngineContext {
  readonly now: number
  readonly rng: Rng
}

export type Action =
  | { readonly type: 'startMatch' }
  | { readonly type: 'play'; readonly playerId: PlayerId; readonly cardIds: readonly string[] }
  | { readonly type: 'pass'; readonly playerId: PlayerId }
  | {
      readonly type: 'exchangeChoose'
      readonly playerId: PlayerId
      readonly cardIds: readonly string[]
    }
  | { readonly type: 'timeout' }
  | { readonly type: 'nextRound' }
  | { readonly type: 'endMatch' }

export type ActionError =
  | 'wrong-phase'
  | 'not-your-turn'
  | 'unknown-player'
  | 'card-not-in-hand'
  | 'invalid-play'
  | 'cannot-beat'
  | 'cannot-pass'
  | 'no-pending-exchange'
  | 'wrong-card-count'
  | 'not-enough-players'

export type GameEvent =
  | { readonly type: 'dealt'; readonly round: number }
  | { readonly type: 'exchangeStarted' }
  | { readonly type: 'exchangeResolved' }
  | { readonly type: 'played'; readonly playerId: PlayerId; readonly play: Play }
  | { readonly type: 'passed'; readonly playerId: PlayerId }
  | { readonly type: 'eightCut'; readonly playerId: PlayerId }
  | { readonly type: 'revolution'; readonly playerId: PlayerId; readonly active: boolean }
  | { readonly type: 'trickCleared'; readonly leader: PlayerId | null }
  | { readonly type: 'playerFinished'; readonly playerId: PlayerId; readonly place: number }
  | { readonly type: 'roundEnded'; readonly round: number }
  | { readonly type: 'matchEnded' }
  | { readonly type: 'turnChanged'; readonly playerId: PlayerId | null }

export type ActionResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: ActionError }

const fail = (error: ActionError): ActionResult => ({ ok: false, error })

export function createInitialState(
  players: readonly Player[],
  settings: RoomSettings = DEFAULT_SETTINGS,
): GameState {
  return {
    phase: 'lobby',
    settings,
    players: [...players],
    round: 0,
    hands: {},
    trick: { current: null, leader: null, passed: [] },
    revolution: false,
    currentPlayer: null,
    finishOrder: [],
    roles: {},
    scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    exchange: null,
    history: [],
    turnDeadline: null,
    version: 0,
  }
}

// ---------------------------------------------------------------- turn order

function seatIds(state: GameState): PlayerId[] {
  return state.players.map((p) => p.id)
}

/** Players who still hold cards this round. */
function activeIds(state: GameState): PlayerId[] {
  return seatIds(state).filter((id) => (state.hands[id] ?? []).length > 0)
}

/**
 * Walk seat order forward from `fromId` to the next player who still has cards
 * and has not passed out of the current trick.
 */
function nextTurn(state: GameState, fromId: PlayerId | null): PlayerId | null {
  const seats = seatIds(state)
  if (seats.length === 0) return null
  const start = fromId === null ? -1 : seats.indexOf(fromId)
  for (let step = 1; step <= seats.length; step++) {
    const id = seats[(start + step + seats.length) % seats.length]
    if (id === undefined) continue
    const hasCards = (state.hands[id] ?? []).length > 0
    if (hasCards && !state.trick.passed.includes(id)) return id
  }
  return null
}

/** Next player with cards, ignoring who has passed — used when a trick clears. */
function nextWithCards(state: GameState, fromId: PlayerId | null): PlayerId | null {
  const seats = seatIds(state)
  const start = fromId === null ? -1 : seats.indexOf(fromId)
  for (let step = 0; step <= seats.length; step++) {
    const id = seats[(start + step + seats.length) % seats.length]
    if (id === undefined) continue
    if (step === 0 && fromId !== null && (state.hands[fromId] ?? []).length > 0) return fromId
    if (step === 0) continue
    if ((state.hands[id] ?? []).length > 0) return id
  }
  return null
}

function deadlineFor(state: GameState, now: number): number | null {
  return state.settings.turnSeconds === null ? null : now + state.settings.turnSeconds * 1000
}

// ------------------------------------------------------------------- rounds

export function startRound(state: GameState, round: number, ctx: EngineContext): ActionResult {
  const players = state.players
  if (players.length < MIN_PLAYERS) return fail('not-enough-players')

  const deck = shuffle(createDeck(), ctx.rng)
  const dealt = deal(deck, players.length)
  const hands: Record<PlayerId, readonly Card[]> = {}
  players.forEach((player, index) => {
    hands[player.id] = sortHand(dealt[index] ?? [])
  })

  const base: GameState = {
    ...state,
    round,
    hands,
    trick: { current: null, leader: null, passed: [] },
    revolution: false,
    finishOrder: [],
    exchange: null,
    currentPlayer: null,
    turnDeadline: null,
    version: state.version + 1,
  }

  const events: GameEvent[] = [{ type: 'dealt', round }]

  // Round 1 has no roles yet, so nobody exchanges and ♦3 leads.
  if (round === 1 || Object.keys(state.roles).length === 0) {
    const leader = findDiamondThreeHolder(hands, players) ?? players[0]?.id ?? null
    const playing: GameState = {
      ...base,
      phase: 'playing',
      currentPlayer: leader,
      turnDeadline: deadlineFor(base, ctx.now),
    }
    events.push({ type: 'turnChanged', playerId: leader })
    return { ok: true, state: playing, events }
  }

  // Later rounds: the Slave side surrenders first, then the President chooses.
  let transfers = buildTransfers(state.roles, hands)
  let workingHands = hands
  transfers = transfers.map((transfer) => {
    if (!transfer.forced) return transfer
    workingHands = applyTransfer(workingHands, transfer)
    return transfer
  })

  const withHands: GameState = { ...base, hands: workingHands }
  const pending = pendingTransfers(transfers)

  if (pending.length === 0) {
    return { ok: true, state: beginPlay(withHands, transfers, ctx), events }
  }

  events.push({ type: 'exchangeStarted' })
  return {
    ok: true,
    state: {
      ...withHands,
      phase: 'exchange',
      exchange: { transfers, deadline: ctx.now + EXCHANGE_SECONDS * 1000 },
    },
    events,
  }
}

function findDiamondThreeHolder(
  hands: Readonly<Record<PlayerId, readonly Card[]>>,
  players: readonly Player[],
): PlayerId | null {
  for (const player of players) {
    const hand = hands[player.id] ?? []
    if (hand.some((card) => card.rank === 3 && card.suit === 'D')) return player.id
  }
  return null
}

/** Exchange is done — the Slave leads the first trick of the round. */
function beginPlay(
  state: GameState,
  transfers: readonly ExchangeTransfer[],
  ctx: EngineContext,
): GameState {
  let hands = state.hands
  for (const transfer of transfers) {
    if (transfer.forced) continue
    hands = applyTransfer(hands, transfer)
  }
  const leader = findByRole(state.roles, 'slave') ?? state.players[0]?.id ?? null
  return {
    ...state,
    hands,
    phase: 'playing',
    exchange: null,
    currentPlayer: leader,
    turnDeadline: deadlineFor(state, ctx.now),
    version: state.version + 1,
  }
}

function finishRound(state: GameState, events: GameEvent[]): GameState {
  const remaining = activeIds(state)
  const finishOrder = [...state.finishOrder, ...remaining]
  const points = roundPoints(finishOrder)
  const roles = assignRoles(finishOrder)
  const scores = addScores(state.scores, points)
  const history = [...state.history, { round: state.round, finishOrder, points }]
  const isLast = state.settings.totalRounds !== null && state.round >= state.settings.totalRounds

  events.push({ type: 'roundEnded', round: state.round })
  if (isLast) events.push({ type: 'matchEnded' })

  return {
    ...state,
    phase: isLast ? 'matchEnd' : 'roundEnd',
    finishOrder,
    roles,
    scores,
    history,
    currentPlayer: null,
    turnDeadline: null,
    version: state.version + 1,
  }
}

// ------------------------------------------------------------------ actions

function doPlay(
  state: GameState,
  playerId: PlayerId,
  cardIds: readonly string[],
  ctx: EngineContext,
): ActionResult {
  if (state.phase !== 'playing') return fail('wrong-phase')
  if (state.currentPlayer !== playerId) return fail('not-your-turn')

  const hand = state.hands[playerId]
  if (hand === undefined) return fail('unknown-player')

  const wanted = new Set(cardIds)
  const cards = hand.filter((card) => wanted.has(card.id))
  if (cards.length !== wanted.size) return fail('card-not-in-hand')

  const classified = classifyPlay(cards)
  if (!classified.ok) return fail('invalid-play')
  const play = classified.play

  if (!canBeat(play, state.trick.current, state.revolution, state.settings)) {
    return fail('cannot-beat')
  }

  const events: GameEvent[] = [{ type: 'played', playerId, play }]
  const remainingHand = hand.filter((card) => !wanted.has(card.id))

  let next: GameState = {
    ...state,
    hands: { ...state.hands, [playerId]: remainingHand },
    trick: { current: play, leader: playerId, passed: state.trick.passed },
    version: state.version + 1,
  }

  if (isRevolutionPlay(play, state.settings)) {
    next = { ...next, revolution: !next.revolution }
    events.push({ type: 'revolution', playerId, active: next.revolution })
  }

  if (remainingHand.length === 0) {
    const finishOrder = [...next.finishOrder, playerId]
    next = { ...next, finishOrder }
    events.push({ type: 'playerFinished', playerId, place: finishOrder.length })
  }

  // Only one player left holding cards — the round is over.
  if (activeIds(next).length <= 1) return { ok: true, state: finishRound(next, events), events }

  if (isEightCut(play, state.settings)) {
    events.push({ type: 'eightCut', playerId })
    return { ok: true, state: clearTrick(next, playerId, ctx, events), events }
  }

  const upcoming = nextTurn(next, playerId)
  if (upcoming === null) return { ok: true, state: clearTrick(next, playerId, ctx, events), events }

  events.push({ type: 'turnChanged', playerId: upcoming })
  return {
    ok: true,
    state: { ...next, currentPlayer: upcoming, turnDeadline: deadlineFor(next, ctx.now) },
    events,
  }
}

/** Reset the trick and hand the lead to `leaderId` (or the next player holding cards). */
function clearTrick(
  state: GameState,
  leaderId: PlayerId | null,
  ctx: EngineContext,
  events: GameEvent[],
): GameState {
  const cleared: GameState = {
    ...state,
    trick: { current: null, leader: null, passed: [] },
  }
  const leader = nextWithCards(cleared, leaderId)
  events.push({ type: 'trickCleared', leader })
  events.push({ type: 'turnChanged', playerId: leader })
  return {
    ...cleared,
    currentPlayer: leader,
    turnDeadline: deadlineFor(cleared, ctx.now),
    version: cleared.version + 1,
  }
}

function doPass(state: GameState, playerId: PlayerId, ctx: EngineContext): ActionResult {
  if (state.phase !== 'playing') return fail('wrong-phase')
  if (state.currentPlayer !== playerId) return fail('not-your-turn')
  // Leading a fresh trick, you must play something.
  if (state.trick.current === null) return fail('cannot-pass')

  const events: GameEvent[] = [{ type: 'passed', playerId }]
  const passed = [...state.trick.passed, playerId]
  const next: GameState = {
    ...state,
    trick: { ...state.trick, passed },
    version: state.version + 1,
  }

  // Trick ends once everyone except the last player to play has folded.
  const stillIn = activeIds(next).filter((id) => !passed.includes(id) && id !== next.trick.leader)
  if (stillIn.length === 0) {
    return { ok: true, state: clearTrick(next, next.trick.leader, ctx, events), events }
  }

  const upcoming = nextTurn(next, playerId)
  if (upcoming === null) {
    return { ok: true, state: clearTrick(next, next.trick.leader, ctx, events), events }
  }

  events.push({ type: 'turnChanged', playerId: upcoming })
  return {
    ok: true,
    state: { ...next, currentPlayer: upcoming, turnDeadline: deadlineFor(next, ctx.now) },
    events,
  }
}

function doExchangeChoose(
  state: GameState,
  playerId: PlayerId,
  cardIds: readonly string[],
  ctx: EngineContext,
): ActionResult {
  if (state.phase !== 'exchange' || state.exchange === null) return fail('wrong-phase')

  const transfer = state.exchange.transfers.find((t) => t.from === playerId && t.cards === null)
  if (transfer === undefined) return fail('no-pending-exchange')
  if (cardIds.length !== transfer.count) return fail('wrong-card-count')

  const hand = state.hands[playerId] ?? []
  const wanted = new Set(cardIds)
  const cards = hand.filter((card) => wanted.has(card.id))
  if (cards.length !== wanted.size) return fail('card-not-in-hand')

  const transfers = state.exchange.transfers.map((t) => (t === transfer ? { ...t, cards } : t))
  return {
    ok: true,
    ...settleExchange({ ...state, exchange: { ...state.exchange, transfers } }, ctx),
  }
}

function settleExchange(
  state: GameState,
  ctx: EngineContext,
): { state: GameState; events: readonly GameEvent[] } {
  const transfers = state.exchange?.transfers ?? []
  if (pendingTransfers(transfers).length > 0) {
    return { state: { ...state, version: state.version + 1 }, events: [] }
  }
  const played = beginPlay(state, transfers, ctx)
  return {
    state: played,
    events: [{ type: 'exchangeResolved' }, { type: 'turnChanged', playerId: played.currentPlayer }],
  }
}

function doTimeout(state: GameState, ctx: EngineContext): ActionResult {
  if (state.phase === 'exchange' && state.exchange !== null) {
    // Stalled President: their weakest cards go automatically, so the match
    // can never deadlock behind one idle player.
    const transfers = state.exchange.transfers.map((t) =>
      t.cards === null ? { ...t, cards: weakestCards(state.hands[t.from] ?? [], t.count) } : t,
    )
    const settled = settleExchange({ ...state, exchange: { ...state.exchange, transfers } }, ctx)
    return { ok: true, state: settled.state, events: settled.events }
  }

  if (state.phase !== 'playing' || state.currentPlayer === null) return fail('wrong-phase')

  const playerId = state.currentPlayer
  if (state.trick.current !== null) return doPass(state, playerId, ctx)

  // Leading and out of time: shed the single weakest card.
  const hand = sortHand(state.hands[playerId] ?? [], state.revolution)
  const lowest = hand[0]
  if (lowest === undefined) return fail('wrong-phase')
  return doPlay(state, playerId, [lowest.id], ctx)
}

export function reduce(state: GameState, action: Action, ctx: EngineContext): ActionResult {
  switch (action.type) {
    case 'startMatch': {
      if (state.phase !== 'lobby') return fail('wrong-phase')
      if (state.players.length < MIN_PLAYERS) return fail('not-enough-players')
      return startRound(state, 1, ctx)
    }
    case 'nextRound': {
      if (state.phase !== 'roundEnd') return fail('wrong-phase')
      return startRound(state, state.round + 1, ctx)
    }
    case 'play':
      return doPlay(state, action.playerId, action.cardIds, ctx)
    case 'pass':
      return doPass(state, action.playerId, ctx)
    case 'exchangeChoose':
      return doExchangeChoose(state, action.playerId, action.cardIds, ctx)
    case 'timeout':
      return doTimeout(state, ctx)
    case 'endMatch': {
      if (state.phase === 'lobby') return fail('wrong-phase')
      return {
        ok: true,
        state: { ...state, phase: 'matchEnd', version: state.version + 1 },
        events: [{ type: 'matchEnded' }],
      }
    }
  }
}

// ------------------------------------------------------------------ queries

export function playableCardIds(state: GameState, playerId: PlayerId): Set<string> {
  if (state.phase !== 'playing' || state.currentPlayer !== playerId) return new Set()
  const hand = state.hands[playerId] ?? []
  const plays = legalPlays(hand, state.trick.current, state.revolution, state.settings)
  const ids = new Set<string>()
  for (const play of plays) {
    for (const card of play.cards) ids.add(card.id)
  }
  return ids
}

export function canPass(state: GameState, playerId: PlayerId): boolean {
  return (
    state.phase === 'playing' && state.currentPlayer === playerId && state.trick.current !== null
  )
}

export function handCounts(state: GameState): Record<PlayerId, number> {
  const counts: Record<PlayerId, number> = {}
  for (const player of state.players) counts[player.id] = (state.hands[player.id] ?? []).length
  return counts
}

export { isJoker }
