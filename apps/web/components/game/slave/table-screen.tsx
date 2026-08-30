'use client'

import type { RoomView } from '@cards/shared'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Hand } from '@/components/game/hand'
import { RoleBadge, Seat } from '@/components/game/seat'
import { TrickPile } from '@/components/game/slave/trick-pile'
import { SoundControls } from '@/components/game/sound-controls'
import { type FlashKind, TableFlash } from '@/components/game/table-flash'
import { Button } from '@/components/ui/button'
import { isSubmittable, toggleSelection } from '@/lib/selection'
import { sound } from '@/lib/sound'
import { useCountdown } from '@/lib/use-countdown'
import type { EventBatch, RoomActions } from '@/lib/use-room'
import { cn } from '@/lib/utils'

export function TableScreen({
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
  const requiredCount = table.game === 'slave' ? table.trick.count : null
  // The selection belongs to one specific turn; when the table moves on it is
  // derived away rather than cleared in an effect (no extra render pass).
  const turnKey = `${view.round}:${view.currentPlayerId}:${requiredCount}`
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({
    key: turnKey,
    ids: [],
  })
  const selected = selection.key === turnKey ? selection.ids : []
  const setSelected = (ids: string[]) => setSelection({ key: turnKey, ids })
  const [flash, setFlash] = useState<{ kind: FlashKind; id: number }>({ kind: null, id: 0 })

  const remaining = useCountdown(view.turnDeadline)
  const turnMs = (view.settings.turnSeconds ?? 0) * 1000
  const progress = remaining === null || turnMs === 0 ? null : remaining / turnMs
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
      (event) => event.type === 'revolution' || event.type === 'eightCut',
    )
    if (loud === undefined) return
    flashId.current += 1
    const kind: FlashKind = loud.type === 'revolution' ? 'revolution' : 'eightCut'
    setFlash({ kind, id: flashId.current })
    const timer = setTimeout(() => setFlash((current) => ({ ...current, kind: null })), 1100)
    return () => clearTimeout(timer)
  }, [batch])

  const opponents = useMemo(
    () => view.seats.filter((seat) => seat.id !== you?.id),
    [view.seats, you?.id],
  )
  const myRole = table.game === 'slave' ? (table.roles[you?.id ?? ''] ?? null) : null
  const leaderName =
    table.game === 'slave'
      ? (view.seats.find((seat) => seat.id === table.trick.leaderId)?.name ?? null)
      : null

  const hand = you?.hand ?? []
  const canPlay = myTurn && isSubmittable(hand, selected, requiredCount)
  if (table.game !== 'slave') return null
  const stuck = myTurn && (you?.playable.length ?? 0) === 0

  return (
    <div className="table-felt flex min-h-dvh flex-col">
      <TableFlash flash={flash} />

      <header className="flex items-center justify-between gap-2 border-ink border-b-[3px] bg-cream px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="tabular text-ink text-sm tracking-widest">{view.code}</span>
          <span className="font-semibold text-ink/70 text-xs">
            รอบ {view.round}
            {view.settings.totalRounds !== null && ` / ${view.settings.totalRounds}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {table.revolution && (
            <motion.span
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="sticker-sm rounded-full bg-bubblegum px-2 py-0.5 font-extrabold text-[10px] text-ink uppercase tracking-wider"
            >
              ปฏิวัติ
            </motion.span>
          )}
          <SoundControls />
        </div>
      </header>

      <section className="flex flex-wrap items-start justify-center gap-x-5 gap-y-3 px-3 py-4">
        {opponents.map((seat) => (
          <Seat
            key={seat.id}
            seat={seat}
            progress={seat.isCurrent ? progress : null}
            urgent={urgent}
            compact={opponents.length > 3}
            role={table.roles[seat.id] ?? null}
            finishedPlace={placeOf(table.finishOrder, seat.id)}
            passed={table.passedIds.includes(seat.id)}
          />
        ))}
      </section>

      <section className="flex flex-1 items-center justify-center px-4">
        <TrickPile
          cards={table.trick.cards}
          leaderName={leaderName}
          revolution={table.revolution}
        />
      </section>

      <footer className="space-y-2 border-ink border-t-[3px] bg-rail px-4 pt-2 pb-safe">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {myRole !== null && <RoleBadge role={myRole} />}
            <span className="font-semibold text-ink/70 text-xs">
              เหลือ <span className="tabular">{hand.length}</span> ใบ
            </span>
          </div>
          <span
            className={cn('font-medium text-xs', myTurn ? 'text-primary' : 'text-muted-foreground')}
          >
            {turnLabel(view, myTurn)}
          </span>
        </div>

        {stuck && (
          <p className="sticker-sm rounded-xl bg-cream px-3 py-1.5 text-center font-semibold text-ink text-xs">
            ไม่มีไพ่ในมือที่กินได้ ต้องผ่านอย่างเดียว
          </p>
        )}

        <Hand
          dealKey={view.round}
          cards={hand}
          selected={selected}
          playable={you?.playable ?? []}
          interactive={myTurn}
          onToggle={(cardId) => {
            const next = toggleSelection(hand, selected, cardId, requiredCount)
            sound.play(next.length > selected.length ? 'card:select' : 'card:deselect')
            setSelected(next)
          }}
        />

        <div className="flex gap-2 pb-2">
          <Button
            variant="secondary"
            className="flex-1"
            size="lg"
            disabled={!table.canPass}
            onClick={() => {
              setSelected([])
              actions.pass()
            }}
          >
            ผ่าน
          </Button>
          <Button
            className="flex-[2]"
            size="lg"
            disabled={!canPlay}
            onClick={() => {
              actions.play(selected)
              setSelected([])
            }}
          >
            {selected.length > 0 ? `ลง ${selected.length} ใบ` : 'ลงไพ่'}
          </Button>
        </div>
      </footer>
    </div>
  )
}

function placeOf(finishOrder: readonly string[], id: string): number | null {
  const index = finishOrder.indexOf(id)
  return index === -1 ? null : index + 1
}

function turnLabel(view: RoomView, myTurn: boolean): string {
  if (myTurn) {
    const led = view.table.game === 'slave' && view.table.trick.cards !== null
    return led ? 'ตาคุณแล้ว' : 'คุณเป็นคนนำ'
  }
  const current = view.seats.find((seat) => seat.id === view.currentPlayerId)
  if (current === undefined) return ''
  return current.connected ? `ตาของ ${current.name}` : `${current.name} หลุดอยู่…`
}
