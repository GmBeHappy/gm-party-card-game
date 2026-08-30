'use client'

import type { RoomView } from '@cards/shared'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Hand } from '@/components/game/hand'
import { PlayingCard } from '@/components/game/playing-card'
import { RoleBadge } from '@/components/game/seat'
import { Button } from '@/components/ui/button'
import { sound } from '@/lib/sound'
import { useCountdown } from '@/lib/use-countdown'
import type { RoomActions } from '@/lib/use-room'

/**
 * The namesake phase. The Slave has already lost their best two cards by the
 * time this renders — the only choice on the table is the President's.
 */
export function ExchangeScreen({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const table = view.table
  const exchange = table.game === 'slave' ? table.exchange : null
  const you = view.you
  const roundKey = String(view.round)
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({
    key: roundKey,
    ids: [],
  })
  const selected = selection.key === roundKey ? selection.ids : []
  const setSelected = (ids: string[]) => setSelection({ key: roundKey, ids })
  const remaining = useCountdown(view.phaseDeadline)

  if (exchange === null || you === null || table.game !== 'slave') return null
  const myRole = table.roles[you.id] ?? null

  const give = exchange.give
  const hand = you.hand
  const waitingNames = exchange.waitingOn
    .map((id) => view.seats.find((seat) => seat.id === id)?.name ?? 'ใครสักคน')
    .join(', ')

  return (
    <div className="table-felt flex min-h-dvh flex-col">
      <header className="space-y-1 px-4 pt-6 text-center">
        <p className="font-extrabold text-ink/70 text-xs uppercase tracking-widest">
          รอบ {view.round} · แลกไพ่
        </p>
        <h1 className="ink-edge font-display text-5xl text-lemon drop-shadow-[4px_4px_0_var(--ink)]">
          ส่งส่วย
        </h1>
        {myRole !== null && (
          <div className="flex justify-center pt-1">
            <RoleBadge role={myRole} />
          </div>
        )}
        {remaining !== null && (
          <p className="tabular text-ink text-sm">{Math.ceil(remaining / 1000)}s</p>
        )}
      </header>

      <div className="flex flex-1 flex-col justify-center gap-6 px-4 py-6">
        {exchange.surrendered.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 text-center"
          >
            <p className="sticker-sm mx-auto flex w-fit items-center gap-1.5 rounded-full bg-bubblegum px-3 py-0.5 font-extrabold text-ink text-xs">
              <ArrowUp className="size-3.5" />
              ถูกริบไป
            </p>
            <div className="flex justify-center gap-1">
              {exchange.surrendered.map((card) => (
                <PlayingCard key={card.id} card={card} size="sm" />
              ))}
            </div>
          </motion.section>
        )}

        {exchange.received.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 text-center"
          >
            <p className="sticker-sm mx-auto flex w-fit items-center gap-1.5 rounded-full bg-mint px-3 py-0.5 font-extrabold text-ink text-xs">
              <ArrowDown className="size-3.5" />
              ได้รับมา
            </p>
            <div className="flex justify-center gap-1">
              {exchange.received.map((card) => (
                <PlayingCard key={card.id} card={card} size="sm" />
              ))}
            </div>
          </motion.section>
        )}

        {give === null && (
          <p className="sticker-sm mx-auto w-fit rounded-full bg-cream px-4 py-1.5 text-center font-bold text-ink text-sm">
            รอ {waitingNames || 'คนอื่น'}…
          </p>
        )}
      </div>

      {give !== null && (
        <footer className="space-y-3 border-ink border-t-[3px] bg-rail px-4 pt-3 pb-safe">
          <p className="text-center text-sm">
            เลือกไพ่ <span className="tabular text-bubblegum">{give}</span> ใบส่งคืน
          </p>
          <Hand
            dealKey={`exchange-${view.round}`}
            cards={hand}
            selected={selected}
            playable={hand.map((card) => card.id)}
            interactive
            onToggle={(cardId) => {
              if (selected.includes(cardId)) {
                sound.play('card:deselect')
                setSelected(selected.filter((id) => id !== cardId))
                return
              }
              sound.play('card:select')
              // Past the limit, the oldest pick drops out rather than blocking.
              setSelected(
                selected.length >= give ? [...selected.slice(1), cardId] : [...selected, cardId],
              )
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
