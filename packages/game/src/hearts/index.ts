import type { GameModule } from '../core/module'
import { chooseHeartsAction } from './bot'
import {
  createInitialState,
  HEARTS_MAX_PLAYERS,
  HEARTS_MIN_PLAYERS,
  pendingPassers,
  reduce,
  seatPlayers,
  setConnected,
} from './engine'
import { DEFAULT_HEARTS_SETTINGS, type HeartsSettings, type HeartsState } from './types'

export const heartsModule: GameModule<HeartsState, HeartsSettings> = {
  kind: 'hearts',
  minPlayers: HEARTS_MIN_PLAYERS,
  maxPlayers: HEARTS_MAX_PLAYERS,
  scoreDirection: 'low',
  defaultSettings: DEFAULT_HEARTS_SETTINGS,
  createInitialState,
  applySettings: (state, patch) => ({
    ...state,
    settings: { ...state.settings, ...patch },
    version: state.version + 1,
  }),
  seatPlayers,
  setConnected,
  reduce,
  botAction: chooseHeartsAction,
  waitingOn: pendingPassers,
}
