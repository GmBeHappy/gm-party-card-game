'use client'

import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ExchangeScreen } from '@/components/game/exchange-screen'
import { LobbyScreen } from '@/components/game/lobby-screen'
import { ReconnectOverlay } from '@/components/game/reconnect-overlay'
import { RoundSummary } from '@/components/game/round-summary'
import { TableScreen } from '@/components/game/table-screen'
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

  if (!hydrated) return <Centered>{null}</Centered>

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
          <h1 className="font-bold text-2xl">Cannot join {code}</h1>
          <p className="text-muted-foreground text-sm">{fatal.message}</p>
          <Button asChild>
            <Link href="/">Back to the start</Link>
          </Button>
        </div>
      </Centered>
    )
  }

  if (view === null) {
    return (
      <Centered>
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="mt-3 text-muted-foreground text-sm">Joining {code}…</p>
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
  switch (view.phase) {
    case 'lobby':
      return <LobbyScreen view={view} actions={actions} />
    case 'exchange':
      return <ExchangeScreen view={view} actions={actions} />
    case 'playing':
      return <TableScreen view={view} actions={actions} batch={batch} />
    case 'roundEnd':
    case 'matchEnd':
      return <RoundSummary view={view} actions={actions} />
  }
}

function WaitingScreen({ code }: { code: string }) {
  return (
    <Centered>
      <div className="space-y-3 text-center">
        <h1 className="font-bold text-2xl">Match in progress</h1>
        <p className="max-w-xs text-muted-foreground text-sm">
          You are in room <span className="font-mono tracking-widest">{code}</span> and will be
          dealt in at the start of the next round.
        </p>
        <Loader2 className="mx-auto size-5 animate-spin text-primary" />
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
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-card/70 p-6 backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = value.trim()
          if (trimmed.length < 2 || trimmed.length > 16) {
            setError('Pick a name between 2 and 16 characters.')
            return
          }
          onSubmit(trimmed)
        }}
      >
        <div className="space-y-1 text-center">
          <p className="text-muted-foreground text-xs uppercase tracking-widest">Joining</p>
          <p className="font-bold font-mono text-2xl tracking-[0.3em]">{code}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="join-name">Your name</Label>
          <Input
            id="join-name"
            value={value}
            maxLength={16}
            autoFocus
            placeholder="Who are you?"
            onChange={(event) => setValue(event.target.value)}
          />
          {error !== null && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <Button type="submit" className="w-full" size="lg">
          Take a seat
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
