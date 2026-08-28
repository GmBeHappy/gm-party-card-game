'use client'

import type { GameEvent } from '@slave/game'
import type { ErrorCode, RoomView, SettingsPatch } from '@slave/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WS_URL } from './config'
import { getToken, setToken } from './session'
import { type ConnectionStatus, RoomSocket } from './socket'

/** Errors that mean "you are not getting into this room", not "try again". */
const FATAL: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'room-not-found',
  'room-full',
  'match-in-progress',
])

export interface EventBatch {
  readonly id: number
  readonly events: readonly GameEvent[]
}

export interface RoomActions {
  ready(ready: boolean): void
  start(): void
  addBot(): void
  removeSeat(playerId: string): void
  shuffleSeats(): void
  updateSettings(patch: SettingsPatch): void
  play(cardIds: readonly string[]): void
  pass(): void
  exchange(cardIds: readonly string[]): void
  nextRound(): void
  endMatch(): void
  rematch(): void
  leave(): void
  retry(): void
}

export interface UseRoom {
  view: RoomView | null
  status: ConnectionStatus
  attempt: number
  fatal: { code: ErrorCode; message: string } | null
  transient: { code: ErrorCode; message: string } | null
  batch: EventBatch
  actions: RoomActions
}

export function useRoom(roomCode: string, name: string | null): UseRoom {
  const [view, setView] = useState<RoomView | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [attempt, setAttempt] = useState(0)
  const [fatal, setFatal] = useState<UseRoom['fatal']>(null)
  const [transient, setTransient] = useState<UseRoom['transient']>(null)
  const [batch, setBatch] = useState<EventBatch>({ id: 0, events: [] })

  const socketRef = useRef<RoomSocket | null>(null)
  const nameRef = useRef(name)
  nameRef.current = name

  useEffect(() => {
    if (name === null || roomCode === '') return

    const socket = new RoomSocket({
      url: WS_URL,
      hello: () => {
        const current = nameRef.current
        if (current === null) return null
        return {
          type: 'join',
          payload: { roomCode, name: current, token: getToken(roomCode) },
        }
      },
      onStatus: (next, tries) => {
        setStatus(next)
        setAttempt(tries)
      },
      onMessage: (message) => {
        switch (message.type) {
          case 'joined':
            setToken(roomCode, message.payload.token)
            setFatal(null)
            break
          case 'state':
            // Snapshots are authoritative; a stale frame is simply dropped.
            setView((previous) =>
              previous !== null && previous.version > message.payload.view.version
                ? previous
                : message.payload.view,
            )
            if (message.payload.events.length > 0) {
              setBatch((previous) => ({ id: previous.id + 1, events: message.payload.events }))
            }
            break
          case 'error':
            if (FATAL.has(message.payload.code)) setFatal(message.payload)
            else setTransient({ ...message.payload })
            break
          case 'kicked':
            setFatal({
              code: 'not-seated',
              message:
                message.payload.reason === 'kicked' ? 'เจ้าของห้องเตะคุณออกจากห้อง' : 'ห้องนี้ปิดไปแล้ว',
            })
            break
          case 'pong':
            break
        }
      },
    })

    socketRef.current = socket
    socket.connect()
    return () => {
      socket.dispose()
      socketRef.current = null
    }
  }, [roomCode, name])

  const actions = useMemo<RoomActions>(() => {
    const send = socketRef
    return {
      ready: (value) => send.current?.send({ type: 'ready', payload: { ready: value } }),
      start: () => send.current?.send({ type: 'start' }),
      addBot: () => send.current?.send({ type: 'addBot' }),
      removeSeat: (playerId) => send.current?.send({ type: 'removeSeat', payload: { playerId } }),
      shuffleSeats: () => send.current?.send({ type: 'shuffleSeats' }),
      updateSettings: (patch) => send.current?.send({ type: 'settings', payload: patch }),
      play: (cardIds) => send.current?.send({ type: 'play', payload: { cardIds: [...cardIds] } }),
      pass: () => send.current?.send({ type: 'pass' }),
      exchange: (cardIds) =>
        send.current?.send({ type: 'exchange', payload: { cardIds: [...cardIds] } }),
      nextRound: () => send.current?.send({ type: 'nextRound' }),
      endMatch: () => send.current?.send({ type: 'endMatch' }),
      rematch: () => send.current?.send({ type: 'rematch' }),
      leave: () => send.current?.send({ type: 'leave' }),
      retry: () => send.current?.retryNow(),
    }
  }, [])

  const clearTransient = useCallback(() => setTransient(null), [])
  useEffect(() => {
    if (transient === null) return
    const timer = setTimeout(clearTransient, 3_000)
    return () => clearTimeout(timer)
  }, [transient, clearTransient])

  return { view, status, attempt, fatal, transient, batch, actions }
}
