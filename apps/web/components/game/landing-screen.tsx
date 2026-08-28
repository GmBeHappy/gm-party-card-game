'use client'

import { ROOM_CODE_LENGTH } from '@slave/shared'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SERVER_URL } from '@/lib/config'
import { getName, setName as persistName } from '@/lib/session'
import { sound } from '@/lib/sound'

type Busy = 'create' | 'join' | null

export function LandingScreen() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<Busy>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)

  useEffect(() => {
    const stored = getName()
    if (stored !== null) setName(stored)
  }, [])

  function validateName(): boolean {
    const trimmed = name.trim()
    if (trimmed.length < 2 || trimmed.length > 16) {
      setNameError('Pick a name between 2 and 16 characters.')
      return false
    }
    setNameError(null)
    persistName(trimmed)
    return true
  }

  async function createRoom() {
    sound.unlock()
    if (!validateName()) return
    setBusy('create')
    try {
      const response = await fetch(`${SERVER_URL}/rooms`, { method: 'POST' })
      if (!response.ok) throw new Error('create failed')
      const { code: created } = (await response.json()) as { code: string }
      router.push(`/room/${created}`)
    } catch {
      setCodeError('Could not reach the game server.')
      setBusy(null)
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault()
    sound.unlock()
    if (!validateName()) return

    const wanted = code.trim().toUpperCase()
    if (wanted.length !== ROOM_CODE_LENGTH) {
      setCodeError(`Room codes are ${ROOM_CODE_LENGTH} characters.`)
      return
    }

    setBusy('join')
    setCodeError(null)
    try {
      const response = await fetch(`${SERVER_URL}/rooms/${wanted}`)
      const info = (await response.json()) as {
        exists: boolean
        canJoin?: boolean
        reason?: string | null
      }
      if (!info.exists) {
        setCodeError('No room with that code.')
        setBusy(null)
        return
      }
      if (info.canJoin === false && info.reason === 'room-full') {
        setCodeError('That room is full.')
        setBusy(null)
        return
      }
      // A match in progress is not a dead end — you wait for the next round.
      router.push(`/room/${wanted}`)
    } catch {
      setCodeError('Could not reach the game server.')
      setBusy(null)
    }
  }

  return (
    <main className="table-felt flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-10">
      <motion.header
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="text-center"
      >
        <h1 className="bg-gradient-to-b from-white to-primary/70 bg-clip-text font-bold text-6xl text-transparent tracking-tight">
          SLAVE
        </h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Shed your hand first. Finish last and you serve the table.
        </p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 26 }}
        className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-card/70 p-6 backdrop-blur"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            value={name}
            maxLength={16}
            placeholder="Who are you?"
            autoComplete="nickname"
            onChange={(event) => setName(event.target.value)}
          />
          {nameError !== null && <p className="text-destructive text-xs">{nameError}</p>}
        </div>

        <Button className="w-full" size="lg" disabled={busy !== null} onClick={createRoom}>
          {busy === 'create' ? 'Creating…' : 'Create a room'}
        </Button>

        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <span className="h-px flex-1 bg-border" />
          or join one
          <span className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-2" onSubmit={joinRoom}>
          <Label htmlFor="code">Room code</Label>
          <div className="flex gap-2">
            <Input
              id="code"
              value={code}
              maxLength={ROOM_CODE_LENGTH}
              placeholder="ABC234"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase tracking-[0.3em]"
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                setCodeError(null)
              }}
            />
            <Button type="submit" variant="secondary" disabled={busy !== null}>
              Join
            </Button>
          </div>
          {codeError !== null && <p className="text-destructive text-xs">{codeError}</p>}
        </form>
      </motion.div>

      <p className="max-w-sm text-center text-[11px] text-muted-foreground leading-relaxed">
        3–6 players · 52 cards · 8-cut and revolution on by default
      </p>
    </main>
  )
}
