'use client'

import type { RoomView } from '@cards/shared'
import { ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Hand } from '@/components/game/hand'
import { Button } from '@/components/ui/button'
import { PASS_LABEL } from '@/lib/hearts'
import { sound } from '@/lib/sound'
import { useCountdown } from '@/lib/use-countdown'
import type { RoomActions } from '@/lib/use-room'

/** Three cards, chosen blind, all four seats at once. */
export function HeartsPassingScreen({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const table = view.table
  const you = view.you
  const roundKey = String(view.round)
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({
    key: roundKey,
    ids: [],
  })
  const selected = selection.key === roundKey ? selection.ids : []
  const remaining = useCountdown(view.phaseDeadline)

  if (table.game !== 'hearts' || table.passing === null || you === null) return null
  const passing = table.passing
  const give = passing.give
  const targetName = view.seats.find((seat) => seat.id === passing.targetId)?.name ?? 'คนถัดไป'
  const waitingNames = passing.waitingOn
    .map((id) => view.seats.find((seat) => seat.id === id)?.name ?? 'ใครสักคน')
    .join(', ')

  return (
    <div className="table-felt flex min-h-dvh flex-col">
      <header className="space-y-1 px-4 pt-6 text-center">
        <p className="font-extrabold text-ink/70 text-xs uppercase tracking-widest">
          รอบ {view.round} · ส่งไพ่
        </p>
        <h1 className="ink-edge font-display text-5xl text-lemon drop-shadow-[4px_4px_0_var(--ink)]">
          ส่งสามใบ
        </h1>
        <p className="flex items-center justify-center gap-1.5 font-bold text-ink text-sm">
          {PASS_LABEL[passing.direction]}
          <ArrowRight className="size-4" />
          <span className="text-bubblegum">{targetName}</span>
        </p>
        {remaining !== null && (
          <p className="tabular text-ink text-sm">{Math.ceil(remaining / 1000)}s</p>
        )}
      </header>

      <div className="flex flex-1 items-center justify-center px-4">
        {give === null && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticker-sm rounded-full bg-cream px-4 py-1.5 text-center font-bold text-ink text-sm"
          >
            ส่งแล้ว รอ {waitingNames || 'คนอื่น'}…
          </motion.p>
        )}
      </div>

      {give !== null && (
        <footer className="space-y-3 border-ink border-t-[3px] bg-rail px-4 pt-3 pb-safe">
          <p className="text-center text-sm">
            เลือกไพ่ <span className="tabular text-bubblegum">{give}</span> ใบ
          </p>
          <Hand
            dealKey={`pass-${view.round}`}
            cards={you.hand}
            selected={selected}
            playable={you.hand.map((card) => card.id)}
            interactive
            onToggle={(cardId) => {
              if (selected.includes(cardId)) {
                sound.play('card:deselect')
                setSelection({ key: roundKey, ids: selected.filter((id) => id !== cardId) })
                return
              }
              sound.play('card:select')
              // Past three, the oldest pick drops out rather than blocking the tap.
              setSelection({
                key: roundKey,
                ids:
                  selected.length >= give ? [...selected.slice(1), cardId] : [...selected, cardId],
              })
            }}
          />
          <div className="pb-2">
            <Button
              className="w-full"
              size="lg"
              disabled={selected.length !== give}
              onClick={() => actions.exchange(selected)}
            >
              ส่ง {selected.length}/{give}
            </Button>
          </div>
        </footer>
      )}
    </div>
  )
}
