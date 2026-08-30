export * from './core/card'
export * from './core/module'
export * from './core/phase'
export * from './core/player'
export * from './core/rng'
export * from './core/scoring'
export * from './slave/bot'
export * from './slave/engine'
export * from './slave/exchange'
export * from './slave/index'
export * from './slave/order'
export * from './slave/plays'
export * from './slave/roles'
export * from './slave/scoring'
export * from './slave/types'

import type { Action, ActionResult, EngineContext, GameKind, GameModule } from './core/module'
import type { Player, PlayerId } from './core/player'
import { slaveModule } from './slave/index'
import type { SlaveSettings, SlaveState } from './slave/types'

/** The authoritative state of any room, discriminated on `game`. */
export type GameState = SlaveState

/** Static facts about a game, safe to read without narrowing the state. */
export interface GameMeta {
  readonly kind: GameKind
  readonly minPlayers: number
  readonly maxPlayers: number
  readonly scoreDirection: 'high' | 'low'
}

export const GAME_META: Readonly<Record<GameKind, GameMeta>> = {
  slave: {
    kind: slaveModule.kind,
    minPlayers: slaveModule.minPlayers,
    maxPlayers: slaveModule.maxPlayers,
    scoreDirection: slaveModule.scoreDirection,
  },
}

export const GAME_KINDS: readonly GameKind[] = ['slave'] as const

/*
 * TypeScript cannot dispatch a union of modules across a union of states, so
 * these eight wrappers narrow once and delegate. Eight small functions cost
 * less than fighting the generics, and they keep every call site cast-free.
 */

export function createStateFor(kind: GameKind, players: readonly Player[]): GameState {
  switch (kind) {
    case 'slave':
      return slaveModule.createInitialState(players, slaveModule.defaultSettings)
  }
}

export function reduceGame(
  state: GameState,
  action: Action,
  ctx: EngineContext,
): ActionResult<GameState> {
  switch (state.game) {
    case 'slave':
      return slaveModule.reduce(state, action, ctx)
  }
}

export function seatPlayersIn(state: GameState, players: readonly Player[]): GameState {
  switch (state.game) {
    case 'slave':
      return slaveModule.seatPlayers(state, players)
  }
}

export function setConnectedIn(
  state: GameState,
  playerId: PlayerId,
  connected: boolean,
): GameState {
  switch (state.game) {
    case 'slave':
      return slaveModule.setConnected(state, playerId, connected)
  }
}

/**
 * The caller has already re-parsed `patch` with this game's strict schema, so
 * the narrowing here is a formality — but it has to be written down somewhere,
 * and one cast beside the switch beats a cast at every call site.
 */
export function applySettingsIn(state: GameState, patch: Record<string, unknown>): GameState {
  switch (state.game) {
    case 'slave':
      return slaveModule.applySettings(state, patch as Partial<SlaveSettings>)
  }
}

export function botActionFor(state: GameState, playerId: PlayerId): Action | null {
  switch (state.game) {
    case 'slave':
      return slaveModule.botAction(state, playerId)
  }
}

export function waitingOnIn(state: GameState): readonly PlayerId[] {
  switch (state.game) {
    case 'slave':
      return slaveModule.waitingOn(state)
  }
}

export type { GameModule }
