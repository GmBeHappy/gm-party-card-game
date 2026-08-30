import type { GameModule } from '../core/module'
import { chooseBotAction, chooseBotExchange } from './bot'
import {
  createInitialState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  reduce,
  seatPlayers,
  setConnected,
} from './engine'
import { pendingTransfers } from './exchange'
import { DEFAULT_SLAVE_SETTINGS, type SlaveSettings, type SlaveState } from './types'

export const slaveModule: GameModule<SlaveState, SlaveSettings> = {
  kind: 'slave',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  scoreDirection: 'high',
  defaultSettings: DEFAULT_SLAVE_SETTINGS,
  createInitialState,
  applySettings: (state, patch) => ({
    ...state,
    settings: { ...state.settings, ...patch },
    version: state.version + 1,
  }),
  seatPlayers,
  setConnected,
  reduce,
  /** One entry point for both phases, so the room never asks which one to call. */
  botAction(state, playerId) {
    if (state.phase === 'exchange' && state.exchange !== null) {
      const mine = pendingTransfers(state.exchange.transfers).find((t) => t.from === playerId)
      return mine === undefined ? null : chooseBotExchange(state, playerId, mine.count)
    }
    if (state.phase !== 'playing' || state.currentPlayer !== playerId) return null
    return chooseBotAction(state, playerId)
  },
  waitingOn(state) {
    if (state.phase !== 'exchange' || state.exchange === null) return []
    return pendingTransfers(state.exchange.transfers).map((transfer) => transfer.from)
  },
}
