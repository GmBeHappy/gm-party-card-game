import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import type { RoomView } from '@cards/shared'
import { createApp } from '../src/app'
import { timings } from '../src/config'
import { heartsTurn, passThree, playOutRound, sleep, TestClient, until } from './client'

/** Narrow a view to one game's settings, or null if it is the other game. */
function slaveSettings(view: RoomView | null | undefined) {
  return view?.table.game === 'slave' ? view.table.settings : null
}
function heartsSettings(view: RoomView | null | undefined) {
  return view?.table.game === 'hearts' ? view.table.settings : null
}

let handle: ReturnType<typeof createApp>
let base: string
let wsUrl: string

beforeAll(() => {
  // Bots pause ~900ms in a real game purely for readability; a test should not
  // sit through 40 of those.
  timings.botDelayMs = 5
  handle = createApp()
  handle.app.listen(0)
  const port = handle.app.server?.port
  base = `http://localhost:${port}`
  wsUrl = `ws://localhost:${port}/ws`
})

afterAll(() => {
  handle.stop()
  handle.app.server?.stop(true)
})

async function createRoom(): Promise<string> {
  const response = await fetch(`${base}/rooms`, { method: 'POST' })
  const { code } = (await response.json()) as { code: string }
  return code
}

describe('room lifecycle over HTTP', () => {
  it('creates a room and reports it as joinable', async () => {
    const code = await createRoom()
    expect(code).toHaveLength(6)

    const info = await fetch(`${base}/rooms/${code}`).then((r) => r.json())
    expect(info).toMatchObject({ exists: true, canJoin: true, players: 0 })
  })

  it('404s an unknown code', async () => {
    const response = await fetch(`${base}/rooms/ZZZZZZ`)
    expect(response.status).toBe(404)
  })

  it('rejects a malformed code without touching the store', async () => {
    const response = await fetch(`${base}/rooms/abc`)
    expect(response.status).toBe(404)
  })
})

describe('a full round with three humans', () => {
  it('deals, plays to a finish, and never leaks another hand', async () => {
    const code = await createRoom()
    const clients = [
      new TestClient(wsUrl, 'Alice'),
      new TestClient(wsUrl, 'Bob'),
      new TestClient(wsUrl, 'Cara'),
    ]
    for (const client of clients) await client.connect(code)
    const [alice] = clients
    if (alice === undefined) throw new Error('no host')

    await until(() => alice.view?.seats.length === 3, 'three seats')
    expect(alice.seat?.isHost).toBe(true)

    for (const client of clients) client.send({ type: 'ready', payload: { ready: true } })
    await until(() => alice.view?.seats.every((seat) => seat.ready) === true, 'everyone ready')

    alice.send({ type: 'start' })
    await until(() => alice.view?.phase === 'playing', 'match started')

    // 52 cards across three seats.
    const counts = alice.view?.seats.map((seat) => seat.handCount) ?? []
    expect(counts.reduce((total, n) => total + n, 0)).toBe(52)

    // Nobody can see anybody else's cards.
    for (const client of clients) {
      expect(client.view?.you?.hand.length).toBe(client.seat?.handCount)
      expect(JSON.stringify(client.view?.seats)).not.toContain('"rank"')
    }

    // The opening lead belongs to whoever holds the three of diamonds.
    const leader = clients.find((client) => client.myTurn)
    expect(leader).toBeDefined()
    expect(leader?.view?.you?.hand.some((card) => card.id === '3D')).toBe(true)

    // Drive the round to completion, always taking the weakest legal option.
    await playOutRound(clients, alice)

    await until(() => alice.view?.phase === 'roundEnd', 'round finished', 15_000)

    const view = alice.view
    expect(view?.standings).toHaveLength(3)
    const table = view?.table
    expect(table?.game).toBe('slave')
    expect(
      view?.seats.every((seat) => (table?.game === 'slave' ? table.roles[seat.id] : null) != null),
    ).toBe(true)
    expect(view?.history).toHaveLength(1)
    // Points are playerCount - position: 2 / 1 / 0.
    expect(view?.standings.map((row) => row.score).sort()).toEqual([0, 1, 2])
    for (const client of clients) expect(client.errors).toEqual([])

    for (const client of clients) client.disconnect()
  })
})

describe('reconnection mid-match', () => {
  it('holds the seat, keeps the hand, and resumes on the same token', async () => {
    const code = await createRoom()
    const host = new TestClient(wsUrl, 'Host')
    const leaver = new TestClient(wsUrl, 'Leaver')
    const third = new TestClient(wsUrl, 'Third')
    for (const client of [host, leaver, third]) await client.connect(code)

    for (const client of [host, leaver, third]) {
      client.send({ type: 'ready', payload: { ready: true } })
    }
    await until(() => host.view?.seats.every((seat) => seat.ready) === true, 'ready')
    host.send({ type: 'start' })
    await until(() => host.view?.phase === 'playing', 'started')

    const savedId = leaver.playerId
    const savedToken = leaver.token
    const handBefore = leaver.view?.you?.hand.map((card) => card.id) ?? []
    expect(handBefore.length).toBeGreaterThan(0)

    leaver.disconnect()
    await until(
      () => host.view?.seats.find((seat) => seat.id === savedId)?.connected === false,
      'seat marked away',
    )

    // The seat is held, not freed — the table still has three players.
    expect(host.view?.seats).toHaveLength(3)

    const returning = new TestClient(wsUrl, 'Leaver')
    await returning.connect(code, savedToken)
    await until(() => returning.view !== null, 'state replayed')

    expect(returning.playerId).toBe(savedId)
    expect(returning.view?.phase).toBe('playing')
    // The full private hand comes back on the reconnect snapshot.
    const handAfter = returning.view?.you?.hand.map((card) => card.id) ?? []
    expect(handAfter.length).toBeGreaterThan(0)
    expect(handAfter.every((id) => handBefore.includes(id))).toBe(true)
    await until(
      () => host.view?.seats.find((seat) => seat.id === savedId)?.connected === true,
      'seat marked back',
    )

    for (const client of [host, returning, third]) client.disconnect()
  })

  it('refuses a token that was signed for a different room', async () => {
    const roomA = await createRoom()
    const roomB = await createRoom()

    const first = new TestClient(wsUrl, 'Someone')
    await first.connect(roomA)
    const stolen = first.token

    const impostor = new TestClient(wsUrl, 'Impostor')
    await impostor.connect(roomB, stolen)
    // The token does not verify for room B, so this is a brand new seat.
    expect(impostor.playerId).not.toBe(first.playerId)

    first.disconnect()
    impostor.disconnect()
  })
})

describe('bots', () => {
  it('fill seats and play a round to the end on their own', async () => {
    const code = await createRoom()
    const host = new TestClient(wsUrl, 'Solo')
    await host.connect(code)

    host.send({ type: 'addBot' })
    host.send({ type: 'addBot' })
    await until(() => host.view?.seats.length === 3, 'two bots seated')
    expect(host.view?.seats.filter((seat) => seat.isBot)).toHaveLength(2)

    host.send({ type: 'ready', payload: { ready: true } })
    host.send({ type: 'settings', payload: { turnSeconds: 15, totalRounds: 3 } })
    await until(() => slaveSettings(host.view)?.totalRounds === 3, 'settings applied')

    host.send({ type: 'start' })
    await until(() => host.view?.phase === 'playing', 'started')

    // The human plays greedily; the bots drive themselves.
    await playOutRound([host], host)

    await until(() => host.view?.phase === 'roundEnd', 'bots finished the round', 20_000)
    expect(host.errors.filter((code) => code !== 'cannot-beat')).toEqual([])
    host.disconnect()
  })

  it('runs the exchange phase automatically when a bot is president', async () => {
    const code = await createRoom()
    const host = new TestClient(wsUrl, 'Watcher')
    await host.connect(code)
    host.send({ type: 'addBot' })
    host.send({ type: 'addBot' })
    await until(() => host.view?.seats.length === 3, 'seated')
    host.send({ type: 'ready', payload: { ready: true } })
    host.send({ type: 'start' })
    await until(() => host.view?.phase === 'playing', 'started')

    await playOutRound([host], host)
    await until(() => host.view?.phase === 'roundEnd', 'round one done', 20_000)

    host.send({ type: 'nextRound' })
    await until(
      () => host.view?.phase === 'exchange' || host.view?.phase === 'playing',
      'round two opened',
    )

    // Whatever the roles are, the exchange must resolve without a human unless
    // the human is the one holding the choice.
    const hostTable = host.view?.table
    const hostExchange = hostTable?.game === 'slave' ? hostTable.exchange : null
    if (host.view?.phase === 'exchange' && hostExchange?.give != null) {
      const give = hostExchange.give
      const cardIds = (host.view.you?.hand ?? []).slice(0, give).map((card) => card.id)
      host.send({ type: 'exchange', payload: { cardIds } })
    }
    await until(() => host.view?.phase === 'playing', 'exchange settled', 20_000)
    expect(host.view?.round).toBe(2)
    host.disconnect()
  })
})

describe('protocol guards', () => {
  it('rejects a malformed frame without dropping the connection', async () => {
    const code = await createRoom()
    const client = new TestClient(wsUrl, 'Fuzzer')
    await client.connect(code)

    client.send({ type: 'play', payload: { cardIds: [] } } as never)
    await until(() => client.errors.includes('bad-message'), 'schema rejection')

    client.send({ type: 'ready', payload: { ready: true } })
    await until(() => client.seat?.ready === true, 'still usable after a bad frame')
    client.disconnect()
  })

  it('stops a non-host from starting the match', async () => {
    const code = await createRoom()
    const host = new TestClient(wsUrl, 'Host')
    const guest = new TestClient(wsUrl, 'Guest')
    await host.connect(code)
    await guest.connect(code)

    guest.send({ type: 'addBot' })
    await until(() => guest.errors.includes('not-host'), 'host-only rejection')
    expect(host.view?.seats).toHaveLength(2)

    host.disconnect()
    guest.disconnect()
  })

  it('refuses to start below three players', async () => {
    const code = await createRoom()
    const host = new TestClient(wsUrl, 'Lonely')
    await host.connect(code)
    host.send({ type: 'ready', payload: { ready: true } })
    host.send({ type: 'start' })
    await until(() => host.errors.includes('not-enough-players'), 'minimum enforced')
    host.disconnect()
  })
})

describe('choosing a game', () => {
  it('defaults a room to slave', async () => {
    const code = await createRoom()
    const info = await fetch(`${base}/rooms/${code}`).then((r) => r.json())
    expect(info).toMatchObject({ exists: true, game: 'slave', maxPlayers: 6 })
  })

  it('creates a room for an explicitly requested game', async () => {
    const response = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: 'slave' }),
    })
    const { code } = (await response.json()) as { code: string }
    const info = (await fetch(`${base}/rooms/${code}`).then((r) => r.json())) as { game: string }
    expect(info.game).toBe('slave')
  })

  it('refuses an unknown game', async () => {
    const response = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: 'poker' }),
    })
    expect(response.status).toBe(400)
  })

  it('lets only the host change the game, and only in the lobby', async () => {
    const code = await createRoom()
    const host = new TestClient(wsUrl, 'Host')
    const guest = new TestClient(wsUrl, 'Guest')
    await host.connect(code)
    await guest.connect(code)
    await until(() => host.view?.seats.length === 2, 'both seated')

    guest.send({ type: 'setGame', payload: { game: 'slave' } })
    await until(() => guest.errors.includes('not-host'), 'guest refused')

    host.send({ type: 'setGame', payload: { game: 'slave' } })
    await until(() => host.view?.game === 'slave', 'game applied')

    host.disconnect()
    guest.disconnect()
  })

  it('switches a room to the other game and keeps the version climbing', async () => {
    const code = await createRoom()
    const host = new TestClient(wsUrl, 'Host')
    await host.connect(code)
    await until(() => host.view !== null, 'joined')

    const before = host.view?.version ?? 0
    expect(host.view?.game).toBe('slave')

    host.send({ type: 'setGame', payload: { game: 'hearts' } })
    await until(() => host.view?.game === 'hearts', 'switched to hearts')

    expect(host.view?.table.game).toBe('hearts')
    // A fresh state must not restart the version, or every client drops it.
    expect(host.view?.version ?? 0).toBeGreaterThan(before)
    host.disconnect()
  })

  it('moves overflow seats to the waiting list rather than kicking them', async () => {
    const code = await createRoom()
    const host = new TestClient(wsUrl, 'Host')
    await host.connect(code)
    await until(() => host.view !== null, 'joined')
    // Six seats in Slave, then switch to a four-handed game.
    for (let i = 0; i < 5; i++) host.send({ type: 'addBot' })
    await until(() => host.view?.seats.length === 6, 'six seated')

    host.send({ type: 'setGame', payload: { game: 'hearts' } })
    await until(() => host.view?.game === 'hearts', 'switched')

    expect(host.view?.seats.length).toBe(4)
    expect(host.view?.waiting.length).toBe(2)
    host.disconnect()
  })
})

describe('a hearts room', () => {
  async function createHeartsRoom(): Promise<string> {
    const response = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: 'hearts' }),
    })
    const { code } = (await response.json()) as { code: string }
    return code
  }

  it('serves a hearts table view with hearts settings', async () => {
    const code = await createHeartsRoom()
    const host = new TestClient(wsUrl, 'Host')
    await host.connect(code)
    await until(() => host.view !== null, 'view arrived')

    expect(host.view?.game).toBe('hearts')
    expect(host.view?.table.game).toBe('hearts')
    expect(heartsSettings(host.view)).toMatchObject({ targetScore: 100 })
    host.disconnect()
  })

  it('accepts a hearts settings patch and rejects a slave one', async () => {
    const code = await createHeartsRoom()
    const host = new TestClient(wsUrl, 'Host')
    await host.connect(code)
    await until(() => host.view !== null, 'view arrived')

    host.send({ type: 'settings', payload: { targetScore: 50 } })
    await until(() => heartsSettings(host.view)?.targetScore === 50, 'target applied')

    host.send({ type: 'settings', payload: { eightCut: false } })
    await until(() => host.errors.includes('invalid-settings'), 'slave key refused')
    host.disconnect()
  })

  it('caps the table at four seats', async () => {
    const code = await createHeartsRoom()
    const info = (await fetch(`${base}/rooms/${code}`).then((r) => r.json())) as {
      maxPlayers: number
    }
    expect(info.maxPlayers).toBe(4)
  })
})

describe('a full hearts match over real sockets', () => {
  async function createHearts(): Promise<string> {
    const response = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: 'hearts' }),
    })
    const { code } = (await response.json()) as { code: string }
    return code
  }

  /** One human among three bots, seated and started. */
  async function startHearts(name: string, targetScore: 50 | 100 | 200) {
    const code = await createHearts()
    const host = new TestClient(wsUrl, name)
    await host.connect(code)
    await until(() => host.view !== null, 'joined')

    host.send({ type: 'settings', payload: { targetScore } })
    await until(() => heartsSettings(host.view)?.targetScore === targetScore, 'target set')

    for (let i = 0; i < 3; i++) host.send({ type: 'addBot' })
    await until(() => host.view?.seats.length === 4, 'table full')

    host.send({ type: 'ready', payload: { ready: true } })
    await until(() => host.seat?.ready === true, 'ready')
    host.send({ type: 'start' })
    await until(() => host.view?.phase !== 'lobby', 'match started', 15_000)
    return host
  }

  it('plays from the lobby to a finished match, and the lowest score wins', async () => {
    const host = await startHearts('Watcher', 50)

    for (let step = 0; step < 3_000; step++) {
      const view = host.view
      if (view?.phase === 'matchEnd') break
      if (view?.phase === 'roundEnd' && view.you?.isHost === true) {
        host.send({ type: 'nextRound' })
      } else if (view?.phase === 'exchange') {
        passThree(host)
      } else if (view?.phase === 'playing' && host.myTurn) {
        heartsTurn(host)
      }
      await sleep(15)
    }

    expect(host.view?.phase).toBe('matchEnd')
    const scores = (host.view?.standings ?? []).map((row) => row.score)
    expect(scores).toHaveLength(4)
    // Someone reached the target, and the leader is the lowest of the four.
    expect(Math.max(...scores)).toBeGreaterThanOrEqual(50)
    expect(host.view?.standings[0]?.score).toBe(Math.min(...scores))
    host.disconnect()
  }, 120_000)

  it('never puts another hand on the wire', async () => {
    const host = await startHearts('Alice', 100)
    await until(() => host.view?.phase === 'exchange', 'dealt')

    const mine = new Set((host.view?.you?.hand ?? []).map((card) => card.id))
    expect(mine.size).toBe(13)
    expect(host.view?.seats.every((seat) => seat.handCount === 13)).toBe(true)

    // The wire carries the viewer's own thirteen cards and nobody else's.
    const onTheWire = [...JSON.stringify(host.view).matchAll(/"id":"(\d+[CDHS])"/g)].map(
      (match) => match[1] ?? '',
    )
    expect(onTheWire.length).toBeGreaterThan(0)
    expect(onTheWire.filter((id) => !mine.has(id))).toEqual([])
    host.disconnect()
  }, 60_000)

  it('resolves the pass on the deadline when a seat never chooses', async () => {
    const host = await startHearts('Idle', 100)
    await until(() => host.view?.phase === 'exchange', 'passing')

    // Say nothing. The three bots pass at once; a disconnected human is
    // covered by the short fuse rather than the full 30s pass clock.
    const token = host.token
    host.disconnect()
    await sleep(timings.disconnectedTurnMs + 500)

    const back = new TestClient(wsUrl, 'Idle')
    await back.connect(code(host), token)
    await until(() => back.view?.phase === 'playing', 'pass resolved', 45_000)
    expect(back.view?.you?.hand).toHaveLength(13)
    back.disconnect()
  }, 90_000)
})

/** The room code a client is sitting in. */
function code(client: TestClient): string {
  return client.view?.code ?? ''
}
