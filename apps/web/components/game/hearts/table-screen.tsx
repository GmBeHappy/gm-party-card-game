'use client'

import type { Card, PlayerId, Suit } from '@cards/game'
import { cardPoints } from '@cards/game'
import type { RoomView } from '@cards/shared'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Hand } from '@/components/game/hand'
import { HeartsSeat } from '@/components/game/hearts/seat-ring'
import { TrickCircle } from '@/components/game/hearts/trick-circle'
import { SoundControls } from '@/components/game/sound-controls'
import { type FlashKind, TableFlash } from '@/components/game/table-flash'
import { Button } from '@/components/ui/button'
import { relativeSeats } from '@/lib/hearts'
import { sound } from '@/lib/sound'
import { useCountdown } from '@/lib/use-countdown'
import type { EventBatch, RoomActions } from '@/lib/use-room'
import { cn } from '@/lib/utils'

export function HeartsTableScreen({
  view,
  actions,
  batch,
}: {
  view: RoomView
  actions: RoomActions
  batch: EventBatch
}) {
  const table = view.table
  const you = view.you
  const myTurn = view.currentPlayerId === you?.id
  const playsDown = table.game === 'hearts' ? table.trick.plays.length : 0
  // The selection belongs to one turn; when the table moves on it is derived
  // away rather than cleared in an effect.
  const turnKey = `${view.round}:${view.currentPlayerId}:${playsDown}`
  const [selection, setSelection] = useState<{ key: string; id: string | null }>({
    key: turnKey,
    id: null,
  })
  const selected = selection.key === turnKey ? selection.id : null
  const [flash, setFlash] = useState<{ kind: FlashKind; id: number }>({ kind: null, id: 0 })

  const remaining = useCountdown(view.turnDeadline)
  const turnSeconds = table.game === 'hearts' ? (table.settings.turnSeconds ?? 0) : 0
  const progress = remaining === null || turnSeconds === 0 ? null : remaining / (turnSeconds * 1000)
  const urgent = remaining !== null && remaining <= 5_000

  // A ticking clock in the last five seconds of your own turn.
  const lastTick = useRef(-1)
  useEffect(() => {
    if (!myTurn || remaining === null || remaining > 5_000) return
    const second = Math.ceil(remaining / 1000)
    if (second !== lastTick.current) {
      lastTick.current = second
      if (second > 0) sound.play('tick')
    }
  }, [myTurn, remaining])

  const flashId = useRef(0)
  useEffect(() => {
    const loud = batch.events.find(
      (event) => event.type === 'heartsBroken' || event.type === 'moonShot',
    )
    if (loud === undefined) return
    flashId.current += 1
    setFlash({ kind: loud.type as FlashKind, id: flashId.current })
    const timer = setTimeout(() => setFlash((current) => ({ ...current, kind: null })), 1100)
    return () => clearTimeout(timer)
  }, [batch])

  if (table.game !== 'hearts') return null
  const seats = relativeSeats(view.seats, you?.id ?? null)
  const winnerId = leadingSeatId(table.trick.plays, table.trick.leadSuit)
  const trickPoints = table.trick.plays.reduce((sum, play) => sum + cardPoints(play.card), 0)
  const hand = you?.hand ?? []
  const myPoints = table.takenPoints[you?.id ?? ''] ?? 0

  return (
    <div className="table-felt flex min-h-dvh flex-col">
      <TableFlash flash={flash} />

      <header className="flex items-center justify-between gap-2 border-ink border-b-[3px] bg-cream px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="tabular text-ink text-sm tracking-widest">{view.code}</span>
          <span className="font-semibold text-ink/70 text-xs">
            รอบ {view.round} · ตาที่ <span className="tabular">{table.trickNumber}</span>/13
          </span>
        </div>
        <div className="flex items-center gap-1">
          {table.heartsBroken && (
            <motion.span
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="sticker-sm rounded-full bg-bubblegum px-2 py-0.5 font-extrabold text-[10px] text-ink uppercase tracking-wider"
            >
              โพแดงแตก
            </motion.span>
          )}
          <SoundControls />
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-2 py-3">
        <div className="grid w-full max-w-[26rem] grid-cols-[5rem_1fr_5rem] items-center justify-items-center gap-y-2">
          <div className="col-span-3">
            <HeartsSeat
              seat={seats.across}
              points={table.takenPoints[seats.across?.id ?? ''] ?? 0}
              progress={seats.across?.isCurrent === true ? progress : null}
              urgent={urgent}
            />
          </div>
          <HeartsSeat
            seat={seats.left}
            points={table.takenPoints[seats.left?.id ?? ''] ?? 0}
            progress={seats.left?.isCurrent === true ? progress : null}
            urgent={urgent}
          />
          <TrickCircle
            plays={table.trick.plays}
            seats={seats}
            winnerId={winnerId}
            points={trickPoints}
          />
          <HeartsSeat
            seat={seats.right}
            points={table.takenPoints[seats.right?.id ?? ''] ?? 0}
            progress={seats.right?.isCurrent === true ? progress : null}
            urgent={urgent}
          />
        </div>
      </section>

      <footer className="space-y-2 border-ink border-t-[3px] bg-rail px-4 pt-2 pb-safe">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'sticker-sm tabular rounded-full px-2 py-0.5 font-extrabold text-[11px] text-ink',
              myPoints > 0 ? 'bg-bubblegum' : 'bg-cream',
            )}
          >
            เก็บไป {myPoints} แต้ม
          </span>
          <span
            className={cn('font-medium text-xs', myTurn ? 'text-primary' : 'text-muted-foreground')}
          >
            {turnLabel(view, myTurn, playsDown)}
          </span>
        </div>

        {table.received.length > 0 && table.trickNumber === 1 && (
          <p className="sticker-sm rounded-xl bg-mint px-3 py-1.5 text-center font-semibold text-ink text-xs">
            เพื่อนส่งมาให้ {table.received.length} ใบ
          </p>
        )}

        <Hand
          dealKey={view.round}
          cards={hand}
          selected={selected === null ? [] : [selected]}
          playable={you?.playable ?? []}
          interactive={myTurn}
          onToggle={(cardId) => {
            sound.play(selected === cardId ? 'card:deselect' : 'card:select')
            setSelection({ key: turnKey, id: selected === cardId ? null : cardId })
          }}
        />

        <div className="pb-2">
          <Button
            className="w-full"
            size="lg"
            disabled={!myTurn || selected === null}
            onClick={() => {
              if (selected === null) return
              actions.play([selected])
              setSelection({ key: turnKey, id: null })
            }}
          >
            ลงไพ่
          </Button>
        </div>
      </footer>
    </div>
  )
}

/** Who is taking the trick as it stands — the highest card of the led suit. */
function leadingSeatId(
  plays: readonly { seatId: PlayerId; card: Card }[],
  leadSuit: Suit | null,
): PlayerId | null {
  if (leadSuit === null) return null
  let best: { seatId: PlayerId; rank: number } | null = null
  for (const play of plays) {
    if (play.card.suit !== leadSuit) continue
    if (best === null || play.card.rank > best.rank) {
      best = { seatId: play.seatId, rank: play.card.rank }
    }
  }
  return best?.seatId ?? null
}

function turnLabel(view: RoomView, myTurn: boolean, playsDown: number): string {
  if (myTurn) return playsDown === 0 ? 'คุณเป็นคนนำ' : 'ตาคุณแล้ว'
  const current = view.seats.find((seat) => seat.id === view.currentPlayerId)
  if (current === undefined) return ''
  return current.connected ? `ตาของ ${current.name}` : `${current.name} หลุดอยู่…`
}
