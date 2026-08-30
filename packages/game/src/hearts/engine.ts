import { type Card, createDeck, deal, shuffle } from '../core/card'
import type { Action, ActionError, ActionResult, EngineContext, GameEvent } from '../core/module'
import { nextSeat, type Player, type PlayerId } from '../core/player'
import { addScores } from '../core/scoring'
import { highestCards, sortHand } from './order'
import { applyPasses, passDirection } from './passing'
import { reachedTarget, roundScores } from './scoring'
import { isPenalty, legalCards, trickPoints, trickWinner } from './tricks'
import {
  DEFAULT_HEARTS_SETTINGS,
  type HeartsSettings,
  type HeartsState,
  PASS_COUNT,
  PASS_SECONDS,
  TWO_OF_CLUBS,
} from './types'

export const HEARTS_MIN_PLAYERS = 4
export const HEARTS_MAX_PLAYERS = 4

const fail = (error: ActionError): ActionResult<HeartsState> => ({ ok: false, error })

export function createInitialState(
  players: readonly Player[],
  settings: HeartsSettings = DEFAULT_HEARTS_SETTINGS,
): HeartsState {
  const seatIds = players.map((player) => player.id)
  return {
    game: 'hearts',
    phase: 'lobby',
    settings,
    players: [...players],
    round: 0,
    hands: {},
    scores: Object.fromEntries(seatIds.map((id) => [id, 0])),
    currentPlayer: null,
    turnDeadline: null,
    phaseDeadline: null,
    history: [],
    version: 0,
    passing: null,
    trick: { plays: [], leadSuit: null },
    heartsBroken: false,
    trickNumber: 1,
    taken: Object.fromEntries(seatIds.map((id) => [id, []])),
    received: Object.fromEntries(seatIds.map((id) => [id, []])),
  }
}

/** Replace the seated players. Only safe between rounds, which the caller enforces. */
export function seatPlayers(state: HeartsState, players: readonly Player[]): HeartsState {
  const scores: Record<PlayerId, number> = {}
  for (const player of players) scores[player.id] = state.scores[player.id] ?? 0
  return { ...state, players: [...players], scores, version: state.version + 1 }
}

export function setConnected(
  state: HeartsState,
  playerId: PlayerId,
  connected: boolean,
): HeartsState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, connected } : player,
    ),
    version: state.version + 1,
  }
}

function deadlineFor(state: HeartsState, now: number): number | null {
  return state.settings.turnSeconds === null ? null : now + state.settings.turnSeconds * 1000
}

function holderOfTwoOfClubs(state: HeartsState): PlayerId | null {
  for (const player of state.players) {
    const hand = state.hands[player.id] ?? []
    if (hand.some((card) => card.id === TWO_OF_CLUBS)) return player.id
  }
  return null
}

// ------------------------------------------------------------------- rounds

export function startRound(
  state: HeartsState,
  round: number,
  ctx: EngineContext,
): ActionResult<HeartsState> {
  if (state.players.length !== HEARTS_MIN_PLAYERS) return fail('not-enough-players')

  const dealt = deal(shuffle(createDeck(), ctx.rng), state.players.length)
  const hands: Record<PlayerId, readonly Card[]> = {}
  state.players.forEach((player, index) => {
    hands[player.id] = sortHand(dealt[index] ?? [])
  })
  const seatIds = state.players.map((player) => player.id)

  const base: HeartsState = {
    ...state,
    round,
    hands,
    passing: null,
    trick: { plays: [], leadSuit: null },
    heartsBroken: false,
    trickNumber: 1,
    taken: Object.fromEntries(seatIds.map((id) => [id, []])),
    received: Object.fromEntries(seatIds.map((id) => [id, []])),
    currentPlayer: null,
    turnDeadline: null,
    phaseDeadline: null,
    version: state.version + 1,
  }

  const events: GameEvent[] = [{ type: 'dealt', round }]
  const direction = passDirection(round)

  // Every fourth round nobody passes, so play starts straight away.
  if (direction === 'none') {
    const playing = beginPlay(base, ctx)
    events.push({ type: 'turnChanged', playerId: playing.currentPlayer })
    return { ok: true, state: playing, events }
  }

  events.push({ type: 'exchangeStarted' })
  return {
    ok: true,
    state: {
      ...base,
      phase: 'exchange',
      passing: {
        direction,
        selections: Object.fromEntries(seatIds.map((id) => [id, null])),
      },
      phaseDeadline: ctx.now + PASS_SECONDS * 1000,
    },
    events,
  }
}

/** The two of clubs opens every round, and its holder has no choice about it. */
function beginPlay(state: HeartsState, ctx: EngineContext): HeartsState {
  const leader = holderOfTwoOfClubs(state) ?? state.players[0]?.id ?? null
  return {
    ...state,
    phase: 'playing',
    passing: null,
    phaseDeadline: null,
    currentPlayer: leader,
    turnDeadline: deadlineFor(state, ctx.now),
    version: state.version + 1,
  }
}

function finishRound(state: HeartsState, events: GameEvent[]): HeartsState {
  const seatOrder = state.players.map((player) => player.id)
  const { points, moonShooter } = roundScores(seatOrder, state.taken)
  const scores = addScores(state.scores, points)
  const history = [...state.history, { round: state.round, points }]
  const over = reachedTarget(scores, state.settings.targetScore)

  if (moonShooter !== null) events.push({ type: 'moonShot', playerId: moonShooter })
  events.push({ type: 'roundEnded', round: state.round })
  if (over) events.push({ type: 'matchEnded' })

  return {
    ...state,
    phase: over ? 'matchEnd' : 'roundEnd',
    scores,
    history,
    currentPlayer: null,
    turnDeadline: null,
    phaseDeadline: null,
    version: state.version + 1,
  }
}

// ------------------------------------------------------------------ passing

export function pendingPassers(state: HeartsState): PlayerId[] {
  if (state.phase !== 'exchange' || state.passing === null) return []
  const selections = state.passing.selections
  return state.players.map((player) => player.id).filter((id) => (selections[id] ?? null) === null)
}

function doChoosePass(
  state: HeartsState,
  playerId: PlayerId,
  cardIds: readonly string[],
  ctx: EngineContext,
): ActionResult<HeartsState> {
  if (state.phase !== 'exchange' || state.passing === null) return fail('wrong-phase')
  if (!state.players.some((player) => player.id === playerId)) return fail('unknown-player')
  if ((state.passing.selections[playerId] ?? null) !== null) return fail('no-pending-exchange')
  if (cardIds.length !== PASS_COUNT) return fail('wrong-card-count')

  const hand = state.hands[playerId] ?? []
  const wanted = new Set(cardIds)
  const chosen = hand.filter((card) => wanted.has(card.id))
  if (chosen.length !== wanted.size) return fail('card-not-in-hand')

  const selections = { ...state.passing.selections, [playerId]: chosen }
  const settled = settlePassing({ ...state, passing: { ...state.passing, selections } }, ctx)
  return { ok: true, state: settled.state, events: settled.events }
}

/** Nothing moves until all four have chosen — that is what makes it a pass. */
function settlePassing(
  state: HeartsState,
  ctx: EngineContext,
): { state: HeartsState; events: readonly GameEvent[] } {
  const passing = state.passing
  if (passing === null) return { state, events: [] }
  if (pendingPassers(state).length > 0) {
    return { state: { ...state, version: state.version + 1 }, events: [] }
  }

  const { hands, received } = applyPasses(state.players, state.hands, passing)
  const playing = beginPlay({ ...state, hands, received }, ctx)
  return {
    state: playing,
    events: [
      { type: 'exchangeResolved' },
      { type: 'turnChanged', playerId: playing.currentPlayer },
    ],
  }
}

// -------------------------------------------------------------------- plays

/**
 * Say precisely why a card was refused. `legalCards` decides; this only
 * explains, so the table can print a real sentence instead of shrugging.
 */
function refusalFor(state: HeartsState, playerId: PlayerId, card: Card): ActionError {
  const hand = state.hands[playerId] ?? []
  const leading = state.trick.plays.length === 0
  const leadSuit = state.trick.leadSuit

  if (leading && state.trickNumber === 1) return 'must-lead-clubs-two'
  if (leadSuit !== null && card.suit !== leadSuit && hand.some((item) => item.suit === leadSuit)) {
    return 'must-follow-suit'
  }
  if (leading && card.suit === 'H' && !state.heartsBroken) return 'hearts-not-broken'
  if (state.trickNumber === 1 && isPenalty(card)) return 'no-points-first-trick'
  return 'invalid-play'
}

function doPlay(
  state: HeartsState,
  playerId: PlayerId,
  cardIds: readonly string[],
  ctx: EngineContext,
): ActionResult<HeartsState> {
  if (state.phase !== 'playing') return fail('wrong-phase')
  if (state.currentPlayer !== playerId) return fail('not-your-turn')
  if (cardIds.length !== 1) return fail('wrong-card-count')

  const hand = state.hands[playerId]
  if (hand === undefined) return fail('unknown-player')
  const card = hand.find((item) => item.id === cardIds[0])
  if (card === undefined) return fail('card-not-in-hand')

  const legal = legalCards(state, playerId)
  if (!legal.some((item) => item.id === card.id)) return fail(refusalFor(state, playerId, card))

  const events: GameEvent[] = [{ type: 'played', playerId, cardIds: [card.id] }]
  if (card.suit === 'H' && !state.heartsBroken) {
    events.push({ type: 'heartsBroken', playerId })
  }

  const plays = [...state.trick.plays, { playerId, card }]
  const next: HeartsState = {
    ...state,
    hands: { ...state.hands, [playerId]: hand.filter((item) => item.id !== card.id) },
    trick: { plays, leadSuit: state.trick.leadSuit ?? card.suit },
    heartsBroken: state.heartsBroken || card.suit === 'H',
    version: state.version + 1,
  }

  if (plays.length < next.players.length) {
    const upcoming = nextSeat(next.players, playerId)
    events.push({ type: 'turnChanged', playerId: upcoming })
    return {
      ok: true,
      state: { ...next, currentPlayer: upcoming, turnDeadline: deadlineFor(next, ctx.now) },
      events,
    }
  }

  return { ok: true, state: takeTrick(next, ctx, events), events }
}

/** Four cards are down: award the trick, bank its penalties, and hand on the lead. */
function takeTrick(state: HeartsState, ctx: EngineContext, events: GameEvent[]): HeartsState {
  const winner = trickWinner(state.trick) ?? state.players[0]?.id ?? null
  const played = state.trick.plays.map((play) => play.card)
  const penalties = played.filter(isPenalty)

  const taken =
    winner === null
      ? state.taken
      : { ...state.taken, [winner]: [...(state.taken[winner] ?? []), ...penalties] }

  if (winner !== null) {
    events.push({ type: 'trickTaken', playerId: winner, points: trickPoints(played) })
  }
  events.push({ type: 'trickCleared', leader: winner })

  const cleared: HeartsState = {
    ...state,
    taken,
    trick: { plays: [], leadSuit: null },
    trickNumber: state.trickNumber + 1,
    version: state.version + 1,
  }

  const spent = cleared.players.every((player) => (cleared.hands[player.id] ?? []).length === 0)
  if (spent) return finishRound(cleared, events)

  events.push({ type: 'turnChanged', playerId: winner })
  return { ...cleared, currentPlayer: winner, turnDeadline: deadlineFor(cleared, ctx.now) }
}

function doTimeout(state: HeartsState, ctx: EngineContext): ActionResult<HeartsState> {
  // A stalled pass resolves for everyone at once: their three highest go.
  if (state.phase === 'exchange' && state.passing !== null) {
    const selections = { ...state.passing.selections }
    for (const id of pendingPassers(state)) {
      selections[id] = highestCards(state.hands[id] ?? [], PASS_COUNT)
    }
    const settled = settlePassing({ ...state, passing: { ...state.passing, selections } }, ctx)
    return { ok: true, state: settled.state, events: settled.events }
  }

  if (state.phase !== 'playing' || state.currentPlayer === null) return fail('wrong-phase')

  const playerId = state.currentPlayer
  const lowest = [...legalCards(state, playerId)].sort((a, b) => a.rank - b.rank)[0]
  if (lowest === undefined) return fail('wrong-phase')
  return doPlay(state, playerId, [lowest.id], ctx)
}

// ------------------------------------------------------------------ reducer

export function reduce(
  state: HeartsState,
  action: Action,
  ctx: EngineContext,
): ActionResult<HeartsState> {
  switch (action.type) {
    case 'startMatch': {
      if (state.phase !== 'lobby') return fail('wrong-phase')
      if (state.players.length !== HEARTS_MIN_PLAYERS) return fail('not-enough-players')
      return startRound(state, 1, ctx)
    }
    case 'nextRound': {
      if (state.phase !== 'roundEnd') return fail('wrong-phase')
      return startRound(state, state.round + 1, ctx)
    }
    case 'play':
      return doPlay(state, action.playerId, action.cardIds, ctx)
    case 'exchangeChoose':
      return doChoosePass(state, action.playerId, action.cardIds, ctx)
    case 'timeout':
      return doTimeout(state, ctx)
    // Daifugō's pass has no meaning here — you always play a card.
    case 'pass':
      return fail('wrong-game')
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

export function legalCardIds(state: HeartsState, playerId: PlayerId): Set<string> {
  return new Set(legalCards(state, playerId).map((card) => card.id))
}
