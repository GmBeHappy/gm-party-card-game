'use client'

import type { RoomView } from '@slave/shared'
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
  const exchange = view.exchange
  const you = view.you
  const roundKey = String(view.round)
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({
    key: roundKey,
    ids: [],
  })
  const selected = selection.key === roundKey ? selection.ids : []
  const setSelected = (ids: string[]) => setSelection({ key: roundKey, ids })
  const remaining = useCountdown(exchange?.deadline ?? null)

  if (exchange === null || you === null) return null

  const give = exchange.give
  const hand = you.hand
  const waitingNames = exchange.waitingOn
    .map((id) => view.seats.find((seat) => seat.id === id)?.name ?? 'someone')
    .join(', ')

  return (
    <div className="table-felt flex min-h-dvh flex-col">
      <header className="space-y-1 px-4 pt-6 text-center">
        <p className="text-muted-foreground text-xs uppercase tracking-widest">
          Round {view.round} · Exchange
        </p>
        <h1 className="font-bold text-2xl">Tribute</h1>
        {you.role !== null && (
          <div className="flex justify-center pt-1">
            <RoleBadge role={you.role} />
          </div>
        )}
        {remaining !== null && (
          <p className="font-mono text-muted-foreground text-xs tabular-nums">
            {Math.ceil(remaining / 1000)}s
          </p>
        )}
      </header>

      <div className="flex flex-1 flex-col justify-center gap-6 px-4 py-6">
        {exchange.surrendered.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 text-center"
          >
            <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
              <ArrowUp className="size-3.5 text-suit-heart" />
              Taken from you
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
            <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
              <ArrowDown className="size-3.5 text-suit-club" />
              Handed to you
            </p>
            <div className="flex justify-center gap-1">
              {exchange.received.map((card) => (
                <PlayingCard key={card.id} card={card} size="sm" />
              ))}
            </div>
          </motion.section>
        )}

        {give === null && (
          <p className="text-center text-muted-foreground text-sm">
            Waiting for {waitingNames || 'the table'}…
          </p>
        )}
      </div>

      {give !== null && (
        <footer className="space-y-3 border-white/5 border-t bg-background/40 px-4 pt-3 pb-safe backdrop-blur">
          <p className="text-center text-sm">
            Choose <span className="font-semibold text-primary">{give}</span> card
            {give === 1 ? '' : 's'} to send back.
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
              Send {selected.length}/{give}
            </Button>
          </div>
        </footer>
      )}
    </div>
  )
}
