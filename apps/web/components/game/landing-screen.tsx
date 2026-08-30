'use client'

import type { GameKind } from '@cards/game'
import { ROOM_CODE_LENGTH } from '@cards/shared'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { GAME_INFO, GamePicker } from '@/components/game/game-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SERVER_URL } from '@/lib/config'
import { getName, setName as persistName } from '@/lib/session'
import { sound } from '@/lib/sound'

type Busy = 'create' | 'join' | null

export function LandingScreen() {
  const router = useRouter()
  const [game, setGame] = useState<GameKind>('slave')
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
      setNameError('ชื่อต้องยาว 2 ถึง 16 ตัวอักษร')
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
      const response = await fetch(`${SERVER_URL}/rooms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game }),
      })
      if (!response.ok) throw new Error('create failed')
      const { code: created } = (await response.json()) as { code: string }
      router.push(`/room/${created}`)
    } catch {
      setCodeError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
      setBusy(null)
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault()
    sound.unlock()
    if (!validateName()) return

    const wanted = code.trim().toUpperCase()
    if (wanted.length !== ROOM_CODE_LENGTH) {
      setCodeError(`รหัสห้องมี ${ROOM_CODE_LENGTH} ตัวอักษร`)
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
        setCodeError('ไม่พบห้องรหัสนี้')
        setBusy(null)
        return
      }
      if (info.canJoin === false && info.reason === 'room-full') {
        setCodeError('ห้องนี้เต็มแล้ว')
        setBusy(null)
        return
      }
      // A match in progress is not a dead end — you wait for the next round.
      router.push(`/room/${wanted}`)
    } catch {
      setCodeError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
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
        <motion.h1
          animate={{ rotate: [-2.5, 2.5, -2.5] }}
          transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          className="ink-edge font-display text-6xl text-lemon leading-none drop-shadow-[5px_5px_0_var(--ink)]"
        >
          เล่นไพ่
        </motion.h1>
        <p className="mt-3 font-semibold text-ink/80 text-sm">เลือกเกม ตั้งห้อง ชวนเพื่อนมาเล่น</p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 260, damping: 26 }}
        className="w-full max-w-sm"
      >
        <GamePicker value={game} onChange={setGame} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, type: 'spring', stiffness: 260, damping: 26 }}
        className="sticker w-full max-w-sm space-y-6 rounded-3xl bg-card p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="name">ชื่อของคุณ</Label>
          <Input
            id="name"
            value={name}
            maxLength={16}
            placeholder="ใส่ชื่อของคุณ"
            autoComplete="nickname"
            onChange={(event) => setName(event.target.value)}
          />
          {nameError !== null && <p className="text-destructive text-xs">{nameError}</p>}
        </div>

        <Button className="w-full" size="lg" disabled={busy !== null} onClick={createRoom}>
          {busy === 'create' ? 'กำลังสร้าง…' : `สร้างห้อง${GAME_INFO[game].name}`}
        </Button>

        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <span className="h-px flex-1 bg-border" />
          หรือเข้าห้องที่มีอยู่
          <span className="h-px flex-1 bg-border" />
        </div>

        <form className="space-y-2" onSubmit={joinRoom}>
          <Label htmlFor="code">รหัสห้อง</Label>
          <div className="flex gap-2">
            <Input
              id="code"
              value={code}
              maxLength={ROOM_CODE_LENGTH}
              placeholder="ABC234"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="tabular text-center text-lg uppercase tracking-[0.3em]"
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                setCodeError(null)
              }}
            />
            <Button type="submit" variant="secondary" disabled={busy !== null}>
              เข้าห้อง
            </Button>
          </div>
          {codeError !== null && <p className="text-destructive text-xs">{codeError}</p>}
        </form>
      </motion.div>
    </main>
  )
}
