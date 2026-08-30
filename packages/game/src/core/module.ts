import type { Card } from './card'
import type { Phase, RoundResult } from './phase'
import type { Player, PlayerId } from './player'
import type { Rng } from './rng'

/** Widened as games are added. Keeping it exact keeps every switch exhaustive. */
export type GameKind = 'slave'

export interface EngineContext {
  readonly now: number
  readonly rng: Rng
}

/**
 * What every game's state has in common — the parts the room layer touches
 * without knowing the rules: who is seated, whose turn it is, what the clocks
 * say, and the score.
 */
export interface BaseState {
  readonly game: GameKind
  readonly phase: Phase
  /** Seat order. Turn order follows this array, wrapping around. */
  readonly players: readonly Player[]
  readonly round: number
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>
  readonly scores: Readonly<Record<PlayerId, number>>
  readonly currentPlayer: PlayerId | null
  /** Epoch ms after which the current turn auto-resolves; `null` if untimed. */
  readonly turnDeadline: number | null
  /** Deadline for a simultaneous phase — a tribute or a Hearts pass. */
  readonly phaseDeadline: number | null
  readonly history: readonly RoundResult[]
  readonly version: number
}

/**
 * Every intent any game accepts. `exchangeChoose` covers both the Daifugō
 * tribute and the Hearts pass — same phase, same wire message, same timer.
 */
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
  // shared
  | 'wrong-phase'
  | 'not-your-turn'
  | 'unknown-player'
  | 'card-not-in-hand'
  | 'invalid-play'
  | 'no-pending-exchange'
  | 'wrong-card-count'
  | 'not-enough-players'
  | 'wrong-game'
  // slave
  | 'cannot-beat'
  | 'cannot-pass'
  // hearts
  | 'must-follow-suit'
  | 'must-lead-clubs-two'
  | 'hearts-not-broken'
  | 'no-points-first-trick'

/**
 * Everything a game can announce. The web turns these into sound and flashes;
 * the server just forwards them. `played` carries card ids rather than a shape
 * so the type stays free of any one game's notion of a play.
 */
export type GameEvent =
  // shared
  | { readonly type: 'dealt'; readonly round: number }
  | { readonly type: 'exchangeStarted' }
  | { readonly type: 'exchangeResolved' }
  | { readonly type: 'played'; readonly playerId: PlayerId; readonly cardIds: readonly string[] }
  | { readonly type: 'trickCleared'; readonly leader: PlayerId | null }
  | { readonly type: 'turnChanged'; readonly playerId: PlayerId | null }
  | { readonly type: 'roundEnded'; readonly round: number }
  | { readonly type: 'matchEnded' }
  // slave
  | { readonly type: 'passed'; readonly playerId: PlayerId }
  | { readonly type: 'eightCut'; readonly playerId: PlayerId }
  | { readonly type: 'revolution'; readonly playerId: PlayerId; readonly active: boolean }
  | { readonly type: 'playerFinished'; readonly playerId: PlayerId; readonly place: number }
  // hearts
  | { readonly type: 'trickTaken'; readonly playerId: PlayerId; readonly points: number }
  | { readonly type: 'heartsBroken'; readonly playerId: PlayerId }
  | { readonly type: 'moonShot'; readonly playerId: PlayerId }

export type ActionResult<S> =
  | { readonly ok: true; readonly state: S; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: ActionError }

/** One game's rules, and nothing else. No sockets, no views, no React. */
export interface GameModule<S extends BaseState, Settings> {
  readonly kind: GameKind
  readonly minPlayers: number
  readonly maxPlayers: number
  /** Which end of the scoreboard wins. Daifugō: high. Hearts: low. */
  readonly scoreDirection: 'high' | 'low'
  readonly defaultSettings: Settings
  createInitialState(players: readonly Player[], settings: Settings): S
  applySettings(state: S, patch: Partial<Settings>): S
  seatPlayers(state: S, players: readonly Player[]): S
  setConnected(state: S, playerId: PlayerId, connected: boolean): S
  reduce(state: S, action: Action, ctx: EngineContext): ActionResult<S>
  /** What a bot in this seat should do now, in whatever phase. Null if nothing. */
  botAction(state: S, playerId: PlayerId): Action | null
  /** During a simultaneous phase, the seats still to act. Empty otherwise. */
  waitingOn(state: S): readonly PlayerId[]
}
