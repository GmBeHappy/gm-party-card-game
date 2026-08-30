import type { ClientMessage, RoomView, ServerMessage } from '@cards/shared'

/**
 * A minimal test client that speaks the real protocol over a real socket —
 * the same path a browser takes.
 */
export class TestClient {
  private ws: WebSocket | null = null
  view: RoomView | null = null
  playerId: string | null = null
  token: string | null = null
  errors: string[] = []
  events: string[] = []

  constructor(
    private readonly url: string,
    readonly name: string,
  ) {}

  connect(roomCode: string, token: string | null = null): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url)
      this.ws = ws
      const timer = setTimeout(() => reject(new Error(`${this.name} never joined`)), 5_000)

      ws.onopen = () => {
        this.send({ type: 'join', payload: { roomCode, name: this.name, token } })
      }
      ws.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage
        switch (message.type) {
          case 'joined':
            this.playerId = message.payload.playerId
            this.token = message.payload.token
            clearTimeout(timer)
            resolve()
            break
          case 'state':
            this.view = message.payload.view
            for (const gameEvent of message.payload.events) this.events.push(gameEvent.type)
            break
          case 'error':
            this.errors.push(message.payload.code)
            break
          default:
            break
        }
      }
      ws.onerror = () => {
        clearTimeout(timer)
        reject(new Error(`${this.name} socket error`))
      }
    })
  }

  send(message: ClientMessage): void {
    this.ws?.send(JSON.stringify(message))
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
  }

  get seat() {
    return this.view?.seats.find((seat) => seat.id === this.playerId)
  }

  get myTurn(): boolean {
    return this.view?.currentPlayerId === this.playerId
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Poll until `predicate` holds, so tests never race the socket. */
export async function until(
  predicate: () => boolean,
  message: string,
  timeoutMs = 10_000,
): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for: ${message}`)
    await sleep(25)
  }
}

/**
 * Play the weakest legal set on the table, or pass. The server tells us which
 * cards are playable, so this only has to choose a shape of the right size.
 */
export function greedyTurn(client: TestClient): void {
  const view = client.view
  const you = view?.you
  if (view === null || view === undefined || you == null) return

  const playable = you.playable
  if (playable.length === 0) {
    client.send({ type: 'pass' })
    return
  }

  const table = view.table
  const required = table.game === 'slave' ? (table.trick.count ?? 1) : 1
  const first = you.hand.find((card) => playable.includes(card.id))
  const set = you.hand
    .filter((card) => card.rank === first?.rank && playable.includes(card.id))
    .slice(0, required)

  if (set.length < required) {
    client.send({ type: 'pass' })
    return
  }
  client.send({ type: 'play', payload: { cardIds: set.map((card) => card.id) } })
}

/** Drive every seat this test owns until the round is no longer in play. */
export async function playOutRound(
  clients: readonly TestClient[],
  observer: TestClient,
  maxTurns = 400,
): Promise<void> {
  for (let turn = 0; turn < maxTurns; turn++) {
    if (observer.view?.phase !== 'playing') return
    const actor = clients.find((client) => client.myTurn)
    if (actor === undefined) {
      await sleep(25)
      continue
    }
    greedyTurn(actor)
    await sleep(30)
  }
}
