'use client'

import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { HeartsPassingScreen } from '@/components/game/hearts/passing-screen'
import { HeartsRoundSummary } from '@/components/game/hearts/round-summary'
import { HeartsTableScreen } from '@/components/game/hearts/table-screen'
import { LobbyScreen } from '@/components/game/lobby-screen'
import { ReconnectOverlay } from '@/components/game/reconnect-overlay'
import { ExchangeScreen } from '@/components/game/slave/exchange-screen'
import { RoundSummary } from '@/components/game/slave/round-summary'
import { TableScreen } from '@/components/game/slave/table-screen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getName, setName as persistName } from '@/lib/session'
import { sound } from '@/lib/sound'
import { useGameSound } from '@/lib/use-game-sound'
import { useRoom } from '@/lib/use-room'

export function RoomScreen({ code }: { code: string }) {
  const [name, setName] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setName(getName())
    setHydrated(true)
  }, [])

  const { view, status, attempt, fatal, transient, batch, actions } = useRoom(code, name)
  useGameSound(batch, view?.you?.id ?? null)

  useEffect(() => {
    if (transient === null) return
    toast.error(transient.message)
    sound.play('error')
  }, [transient])

  if (!hydrated) {
    return (
      <Centered>
        <Loader2 className="size-8 animate-spin text-ink" />
      </Centered>
    )
  }

  if (name === null) {
    return (
      <NameGate
        code={code}
        onSubmit={(value) => {
          persistName(value)
          sound.unlock()
          setName(value)
        }}
      />
    )
  }

  if (fatal !== null) {
    return (
      <Centered>
        <div className="space-y-4 text-center">
          <h1 className="font-extrabold text-2xl">เข้าห้อง {code} ไม่ได้</h1>
          <p className="font-semibold text-ink/70 text-sm">{fatal.message}</p>
          <Button asChild>
            <Link href="/">กลับหน้าแรก</Link>
          </Button>
        </div>
      </Centered>
    )
  }

  if (view === null) {
    return (
      <Centered>
        <Loader2 className="size-8 animate-spin text-ink" />
        <p className="mt-3 font-bold text-ink text-sm">กำลังเข้าห้อง {code}…</p>
      </Centered>
    )
  }

  return (
    <>
      {view.youAreWaiting && view.phase !== 'lobby' ? (
        <WaitingScreen code={code} />
      ) : (
        <PhaseScreen view={view} actions={actions} batch={batch} />
      )}
      <ReconnectOverlay status={status} attempt={attempt} onRetry={actions.retry} />
    </>
  )
}

function PhaseScreen({
  view,
  actions,
  batch,
}: {
  view: ReturnType<typeof useRoom>['view'] & object
  actions: ReturnType<typeof useRoom>['actions']
  batch: ReturnType<typeof useRoom>['batch']
}) {
  const hearts = view.game === 'hearts'
  switch (view.phase) {
    case 'lobby':
      return <LobbyScreen view={view} actions={actions} />
    case 'exchange':
      return hearts ? (
        <HeartsPassingScreen view={view} actions={actions} />
      ) : (
        <ExchangeScreen view={view} actions={actions} />
      )
    case 'playing':
      return hearts ? (
        <HeartsTableScreen view={view} actions={actions} batch={batch} />
      ) : (
        <TableScreen view={view} actions={actions} batch={batch} />
      )
    case 'roundEnd':
    case 'matchEnd':
      return hearts ? (
        <HeartsRoundSummary view={view} actions={actions} />
      ) : (
        <RoundSummary view={view} actions={actions} />
      )
  }
}

function WaitingScreen({ code }: { code: string }) {
  return (
    <Centered>
      <div className="space-y-3 text-center">
        <h1 className="font-extrabold text-2xl">เกมกำลังเล่นอยู่</h1>
        <p className="max-w-xs font-semibold text-ink/80 text-sm">
          คุณอยู่ในห้อง <span className="tabular tracking-widest">{code}</span> แล้ว
          จะได้รับไพ่ตอนเริ่มรอบถัดไป
        </p>
        <Loader2 className="mx-auto size-6 animate-spin text-ink" />
      </div>
    </Centered>
  )
}

function NameGate({ code, onSubmit }: { code: string; onSubmit: (name: string) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <Centered>
      <form
        className="sticker w-full max-w-sm space-y-4 rounded-3xl bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = value.trim()
          if (trimmed.length < 2 || trimmed.length > 16) {
            setError('ชื่อต้องยาว 2 ถึง 16 ตัวอักษร')
            return
          }
          onSubmit(trimmed)
        }}
      >
        <div className="space-y-1 text-center">
          <p className="font-extrabold text-ink/70 text-xs uppercase tracking-widest">กำลังเข้าห้อง</p>
          <p className="tabular text-3xl tracking-[0.2em]">{code}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="join-name">ชื่อของคุณ</Label>
          <Input
            id="join-name"
            value={value}
            maxLength={16}
            autoFocus
            placeholder="ใส่ชื่อของคุณ"
            onChange={(event) => setValue(event.target.value)}
          />
          {error !== null && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <Button type="submit" className="w-full" size="lg">
          นั่งโต๊ะ
        </Button>
      </form>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="table-felt flex min-h-dvh flex-col items-center justify-center px-5">
      {children}
    </main>
  )
}
