'use client'

import type { Card, PlayerId } from '@cards/game'
import { AnimatePresence, motion } from 'motion/react'
import { PlayingCard } from '@/components/game/playing-card'
import type { RelativeSeats } from '@/lib/hearts'
import { cn } from '@/lib/utils'

type Slot = 'you' | 'left' | 'across' | 'right'

/** Each card sits where its player sits, so the trick reads without a legend. */
const SLOT_POSITION: Readonly<Record<Slot, string>> = {
  you: '-translate-x-1/2 bottom-0 left-1/2',
  left: '-translate-y-1/2 top-1/2 left-0',
  across: '-translate-x-1/2 top-0 left-1/2',
  right: '-translate-y-1/2 top-1/2 right-0',
}

/** Cards fly in from their owner's edge of the table. */
const SLOT_ENTRY: Readonly<Record<Slot, { x: number; y: number }>> = {
  you: { x: 0, y: 64 },
  left: { x: -64, y: 0 },
  across: { x: 0, y: -64 },
  right: { x: 64, y: 0 },
}

export function TrickCircle({
  plays,
  seats,
  winnerId,
  points,
}: {
  plays: readonly { seatId: PlayerId; card: Card }[]
  seats: RelativeSeats
  /** Who is taking the trick as it stands, so the leading card can be marked. */
  winnerId: PlayerId | null
  /** What the trick is worth so far — the question the whole game turns on. */
  points: number
}) {
  const slotFor = (seatId: PlayerId): Slot | null => {
    if (seats.you?.id === seatId) return 'you'
    if (seats.left?.id === seatId) return 'left'
    if (seats.across?.id === seatId) return 'across'
    if (seats.right?.id === seatId) return 'right'
    return null
  }

  return (
    <div className="relative size-[13rem] shrink-0">
      {/* The stake, dead centre: is this trick worth ducking? */}
      <div className="absolute inset-0 grid place-items-center">
        <AnimatePresence mode="popLayout">
          {points > 0 && (
            <motion.span
              key={points}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 24 }}
              className="sticker-sm tabular rounded-full bg-bubblegum px-3 py-1 font-extrabold text-ink text-sm"
            >
              {points} แต้ม
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {plays.map(({ seatId, card }) => {
          const slot = slotFor(seatId)
          if (slot === null) return null
          const entry = SLOT_ENTRY[slot]
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.8, x: entry.x, y: entry.y }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={cn('absolute', SLOT_POSITION[slot])}
            >
              <PlayingCard
                card={card}
                size="sm"
                className={cn(seatId === winnerId && 'outline-4 outline-lemon outline-offset-2')}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
