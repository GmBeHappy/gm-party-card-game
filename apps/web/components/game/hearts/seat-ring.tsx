'use client'

import type { SeatView } from '@cards/shared'
import { Bot, WifiOff } from 'lucide-react'
import { motion } from 'motion/react'
import { Identicon } from '@/components/game/identicon'
import { TurnRing } from '@/components/game/turn-ring'
import { cn } from '@/lib/utils'

/**
 * A seat plus the one number Hearts needs that Daifugō does not: the points
 * this player has already taken. Public, the way they are at a real table.
 */
export function HeartsSeat({
  seat,
  points,
  progress,
  urgent,
  className,
}: {
  seat: SeatView | null
  points: number
  progress: number | null
  urgent: boolean
  className?: string
}) {
  if (seat === null) return null
  return (
    <motion.div
      layout
      className={cn(
        'flex w-full flex-col items-center gap-0.5',
        !seat.connected && 'opacity-70',
        className,
      )}
    >
      <div className="relative size-12">
        {progress !== null && <TurnRing progress={progress} urgent={urgent} />}
        <div
          className={cn(
            'sticker-sm absolute inset-[6px] overflow-hidden rounded-full',
            seat.isCurrent && 'ring-4 ring-lemon',
            !seat.connected && 'grayscale',
          )}
        >
          <Identicon seed={seat.id} />
        </div>
        {!seat.connected && (
          <span className="sticker-sm -right-1 -top-1 absolute rounded-full bg-cream p-0.5">
            <WifiOff className="size-2.5 text-ink" />
          </span>
        )}
      </div>

      <div className="flex max-w-full items-center gap-0.5">
        {seat.isBot && <Bot className="size-2.5 shrink-0 text-ink/60" />}
        <span className="truncate font-bold text-[11px]">{seat.name}</span>
      </div>

      {/* Cards left, then points taken — the two numbers a Hearts player scans. */}
      <div className="flex items-center gap-1">
        <span className="tabular font-semibold text-[11px] text-ink/70">{seat.handCount} ใบ</span>
        <span
          className={cn(
            'sticker-sm tabular rounded-full px-1.5 font-extrabold text-[11px] text-ink',
            points > 0 ? 'bg-bubblegum' : 'bg-cream',
          )}
        >
          {points}
        </span>
      </div>
    </motion.div>
  )
}
