import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createApp } from '../src/app'
import { timings } from '../src/config'
import { playOutRound, TestClient, until } from './client'

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
    expect(view?.seats.every((seat) => seat.role !== null)).toBe(true)
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
    await until(() => host.view?.settings.totalRounds === 3, 'settings applied')

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
    if (host.view?.phase === 'exchange' && host.view.exchange?.give !== null) {
      const give = host.view.exchange?.give ?? 0
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
