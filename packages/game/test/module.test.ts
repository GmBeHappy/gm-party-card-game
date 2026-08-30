import { describe, expect, it } from 'vitest'
import { botActionFor, createStateFor, GAME_META, reduceGame, waitingOnIn } from '../src/index'
import { ctx, makePlayers } from './helpers'

describe('the game registry', () => {
  it('describes slave as a 3-to-6 player game where high scores win', () => {
    expect(GAME_META.slave).toMatchObject({
      kind: 'slave',
      minPlayers: 3,
      maxPlayers: 6,
      scoreDirection: 'high',
    })
  })

  it('builds a lobby state tagged with its game', () => {
    const state = createStateFor('slave', makePlayers(4))
    expect(state.game).toBe('slave')
    expect(state.phase).toBe('lobby')
    expect(state.version).toBe(0)
  })

  it('drives a match through the union without narrowing at the call site', () => {
    const state = createStateFor('slave', makePlayers(4))
    const result = reduceGame(state, { type: 'startMatch' }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.phase).toBe('playing')
    expect(Object.keys(result.state.hands)).toHaveLength(4)
  })

  it('has nobody to wait on outside a simultaneous phase', () => {
    const state = createStateFor('slave', makePlayers(4))
    expect(waitingOnIn(state)).toEqual([])
  })

  it('offers a bot an action on its own turn and none otherwise', () => {
    const started = reduceGame(
      createStateFor('slave', makePlayers(4)),
      { type: 'startMatch' },
      ctx(),
    )
    if (!started.ok) throw new Error('failed to start')
    const state = started.state
    const turn = state.currentPlayer
    if (turn === null) throw new Error('no current player')
    expect(botActionFor(state, turn)).not.toBeNull()
    const other = state.players.find((p) => p.id !== turn)?.id ?? ''
    expect(botActionFor(state, other)).toBeNull()
  })
})
