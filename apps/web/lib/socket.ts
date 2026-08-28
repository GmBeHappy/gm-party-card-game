'use client'

import type { ClientMessage, ServerMessage } from '@slave/shared'

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface RoomSocketOptions {
  url: string
  /** Sent on every successful open — this is what re-claims the seat. */
  hello: () => ClientMessage | null
  onMessage: (message: ServerMessage) => void
  onStatus: (status: ConnectionStatus, attempt: number) => void
}

const MAX_BACKOFF_MS = 8_000
const PING_INTERVAL_MS = 20_000

/**
 * A small typed wrapper over WebSocket with the pieces Socket.IO would have
 * given us: automatic reconnection with backoff, a send queue for messages
 * written while the line is down, and a keepalive ping.
 */
export class RoomSocket {
  private ws: WebSocket | null = null
  private attempt = 0
  private disposed = false
  private queue: ClientMessage[] = []
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: RoomSocketOptions) {}

  connect(): void {
    if (this.disposed) return
    this.options.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting', this.attempt)

    const ws = new WebSocket(this.options.url)
    this.ws = ws

    ws.onopen = () => {
      this.attempt = 0
      this.options.onStatus('open', 0)
      const hello = this.options.hello()
      if (hello !== null) ws.send(JSON.stringify(hello))
      for (const message of this.queue.splice(0)) ws.send(JSON.stringify(message))
      this.startPing()
    }

    ws.onmessage = (event) => {
      try {
        this.options.onMessage(JSON.parse(String(event.data)) as ServerMessage)
      } catch {
        /* a malformed frame is not worth tearing the connection down for */
      }
    }

    ws.onclose = () => {
      this.stopPing()
      if (this.disposed) return
      this.attempt += 1
      this.options.onStatus('reconnecting', this.attempt)
      this.retryTimer = setTimeout(() => this.connect(), this.backoff())
    }

    ws.onerror = () => ws.close()
  }

  send(message: ClientMessage): void {
    if (this.ws !== null && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
      return
    }
    this.queue.push(message)
  }

  /** Give up on backoff and try again right now. */
  retryNow(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    this.retryTimer = null
    if (this.ws !== null) this.ws.onclose = null
    this.ws?.close()
    this.connect()
  }

  dispose(): void {
    this.disposed = true
    this.stopPing()
    if (this.retryTimer !== null) clearTimeout(this.retryTimer)
    if (this.ws !== null) this.ws.onclose = null
    this.ws?.close()
    this.options.onStatus('closed', 0)
  }

  private backoff(): number {
    const base = Math.min(500 * 2 ** (this.attempt - 1), MAX_BACKOFF_MS)
    return base + Math.random() * 250
  }

  private startPing(): void {
    this.stopPing()
    this.pingTimer = setInterval(() => this.send({ type: 'ping' }), PING_INTERVAL_MS)
  }

  private stopPing(): void {
    if (this.pingTimer !== null) clearInterval(this.pingTimer)
    this.pingTimer = null
  }
}
