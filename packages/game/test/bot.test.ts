import { describe, expect, it } from 'vitest'
import { chooseBotAction, chooseBotExchange } from '../src/bot'
import { reduce } from '../src/engine'
import { cards, ctx, playingState } from './helpers'

describe('chooseBotAction', () => {
  it('leads with its weakest card', () => {
    const state = playingState({
      p1: cards('15C', '4D', '9H'),
      p2: cards('5C', '10H'),
      p3: cards('6C', '11H'),
    })
    expect(chooseBotAction(state, 'p1')).toEqual({
      type: 'play',
      playerId: 'p1',
      cardIds: ['4D'],
    })
  })

  it('prefers shedding a pair over a single at the same rank', () => {
    const state = playingState({
      p1: cards('4C', '4D', '9H'),
      p2: cards('5C', '10H'),
      p3: cards('6C', '11H'),
    })
    const action = chooseBotAction(state, 'p1')
    expect(action.type === 'play' && action.cardIds).toEqual(['4C', '4D'])
  })

  it('plays the cheapest card that beats the trick', () => {
    let state = playingState({
      p1: cards('4C', '9H'),
      p2: cards('5C', '13H', '10D'),
      p3: cards('6C', '11H'),
    })
    state = { ...state, currentPlayer: 'p1' }
    const played = reduce(state, { type: 'play', playerId: 'p1', cardIds: ['4C'] }, ctx())
    if (!played.ok) throw new Error(played.error)
    const action = chooseBotAction(played.state, 'p2')
    expect(action.type === 'play' && action.cardIds).toEqual(['5C'])
  })

  it('passes when it holds nothing legal', () => {
    let state = playingState({
      p1: cards('15C', '9H'),
      p2: cards('5C', '10H'),
      p3: cards('6C', '11H'),
    })
    const played = reduce(state, { type: 'play', playerId: 'p1', cardIds: ['15C'] }, ctx())
    if (!played.ok) throw new Error(played.error)
    state = played.state
    expect(chooseBotAction(state, 'p2')).toEqual({ type: 'pass', playerId: 'p2' })
  })

  it('hoards a 2 rather than spending it early', () => {
    const state = playingState({
      p1: cards('4C', '9H'),
      p2: cards('15C', '3H', '4H', '5H', '6H'),
      p3: cards('6C', '11D'),
    })
    const played = reduce(state, { type: 'play', playerId: 'p1', cardIds: ['9H'] }, ctx())
    if (!played.ok) throw new Error(played.error)
    expect(chooseBotAction(played.state, 'p2')).toEqual({ type: 'pass', playerId: 'p2' })
  })

  it('spends the 2 anyway when it would go out', () => {
    const state = playingState({
      p1: cards('4C', '9H'),
      p2: cards('15C'),
      p3: cards('6C', '11D'),
    })
    const played = reduce(state, { type: 'play', playerId: 'p1', cardIds: ['9H'] }, ctx())
    if (!played.ok) throw new Error(played.error)
    const action = chooseBotAction(played.state, 'p2')
    expect(action.type === 'play' && action.cardIds).toEqual(['15C'])
  })

  it('always produces an action the engine accepts', () => {
    let state = playingState({
      p1: cards('4C', '4D', '9H', '15C'),
      p2: cards('5C', '10H', '13D', '6H'),
      p3: cards('6C', '11H', '12D', '7S'),
    })
    for (let i = 0; i < 40 && state.phase === 'playing'; i++) {
      const player = state.currentPlayer
      if (player === null) break
      const result = reduce(state, chooseBotAction(state, player), ctx())
      if (!result.ok) throw new Error(`bot produced an illegal action: ${result.error}`)
      state = result.state
    }
    expect(state.phase).toBe('roundEnd')
  })
})

describe('chooseBotExchange', () => {
  it('sends back the weakest cards', () => {
    const state = playingState({
      p1: cards('15C', '3D', '9H', '4S'),
      p2: cards('5C'),
      p3: cards('6C'),
    })
    expect(chooseBotExchange(state, 'p1', 2)).toEqual({
      type: 'exchangeChoose',
      playerId: 'p1',
      cardIds: ['3D', '4S'],
    })
  })
})
