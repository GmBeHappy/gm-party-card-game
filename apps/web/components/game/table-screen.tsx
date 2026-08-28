'use client'

import type { RoomView } from '@slave/shared'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Hand } from '@/components/game/hand'
import { RoleBadge, Seat } from '@/components/game/seat'
import { SoundControls } from '@/components/game/sound-controls'
import { type FlashKind, TableFlash } from '@/components/game/table-flash'
import { TrickPile } from '@/components/game/trick-pile'
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
  const you = view.you
  const myTurn = view.currentPlayerId === you?.id
  const requiredCount = view.trick.count
  // The selection belongs to one specific turn; when the table moves on it is
  // derived away rather than cleared in an effect (no extra render pass).
  const turnKey = `${view.round}:${view.currentPlayerId}:${view.trick.count}`
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
  const mySeat = view.seats.find((seat) => seat.id === you?.id) ?? null
  const leaderName = view.seats.find((seat) => seat.id === view.trick.leaderId)?.name ?? null

  const hand = you?.hand ?? []
  const canPlay = myTurn && isSubmittable(hand, selected, requiredCount)
  const stuck = myTurn && (you?.playable.length ?? 0) === 0

  return (
    <div className="table-felt flex min-h-dvh flex-col">
      <TableFlash flash={flash} />

      <header className="flex items-center justify-between gap-2 border-white/5 border-b px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-muted-foreground text-xs tracking-widest">
            {view.code}
          </span>
          <span className="text-muted-foreground text-xs">
            Round {view.round}
            {view.settings.totalRounds !== null && ` / ${view.settings.totalRounds}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {view.revolution && (
            <motion.span
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-full bg-suit-heart/20 px-2 py-0.5 font-semibold text-[10px] text-suit-heart uppercase tracking-wider ring-1 ring-suit-heart/40"
            >
              Revolution
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
          />
        ))}
      </section>

      <section className="flex flex-1 items-center justify-center px-4">
        <TrickPile cards={view.trick.cards} leaderName={leaderName} revolution={view.revolution} />
      </section>

      <footer className="space-y-2 border-white/5 border-t bg-background/40 px-4 pt-2 pb-safe backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {mySeat?.role != null && <RoleBadge role={mySeat.role} />}
            <span className="text-muted-foreground text-xs">
              {hand.length} card{hand.length === 1 ? '' : 's'}
            </span>
          </div>
          <span
            className={cn('font-medium text-xs', myTurn ? 'text-primary' : 'text-muted-foreground')}
          >
            {turnLabel(view, myTurn)}
          </span>
        </div>

        {stuck && (
          <p className="rounded-lg bg-white/5 px-3 py-1.5 text-center text-muted-foreground text-xs">
            Nothing in your hand beats that — you can only pass.
          </p>
        )}

        <Hand
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
            disabled={you?.canPass !== true}
            onClick={() => {
              setSelected([])
              actions.pass()
            }}
          >
            Pass
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
            {selected.length > 0 ? `Play ${selected.length}` : 'Play'}
          </Button>
        </div>
      </footer>
    </div>
  )
}

function turnLabel(view: RoomView, myTurn: boolean): string {
  if (myTurn) return view.trick.cards === null ? 'Your lead' : 'Your turn'
  const current = view.seats.find((seat) => seat.id === view.currentPlayerId)
  if (current === undefined) return ''
  return current.connected ? `${current.name}'s turn` : `${current.name} is away…`
}
