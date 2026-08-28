'use client'

import type { RoleName } from '@slave/game'
import type { SeatView } from '@slave/shared'
import { Bot, Crown, WifiOff } from 'lucide-react'
import { motion } from 'motion/react'
import { Identicon } from '@/components/game/identicon'
import { CardBackStack } from '@/components/game/playing-card'
import { TurnRing } from '@/components/game/turn-ring'
import { cn } from '@/lib/utils'

export const ROLE_LABEL: Readonly<Record<RoleName, string>> = {
  president: 'เศรษฐี',
  vicePresident: 'รองเศรษฐี',
  citizen: 'สามัญชน',
  viceSlave: 'รองสลาฟ',
  slave: 'สลาฟ',
}

/** Rank is the whole point of the game, so it gets the whole palette. */
const ROLE_STYLE: Readonly<Record<RoleName, string>> = {
  president: 'bg-lemon',
  vicePresident: 'bg-mint',
  citizen: 'bg-cream',
  viceSlave: 'bg-cream',
  slave: 'bg-bubblegum',
}

export function RoleBadge({ role }: { role: RoleName }) {
  return (
    <span
      className={cn(
        'sticker-sm rounded-full px-2 py-0.5 font-extrabold text-[10px] text-ink uppercase tracking-wide',
        ROLE_STYLE[role],
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  )
}

export interface SeatProps {
  seat: SeatView
  /** 1 = full turn remaining, 0 = expired. Null when this seat is not on the clock. */
  progress: number | null
  urgent: boolean
  compact?: boolean
}

export function Seat({ seat, progress, urgent, compact = false }: SeatProps) {
  return (
    <motion.div
      layout
      className={cn(
        'flex flex-col items-center gap-1 transition-opacity',
        seat.passed && 'opacity-40',
        seat.finishedPlace !== null && 'opacity-70',
      )}
    >
      <div className={cn('relative', compact ? 'size-12' : 'size-14')}>
        {progress !== null && <TurnRing progress={progress} urgent={urgent} />}
        <div
          className={cn(
            'sticker-sm absolute inset-[7px] overflow-hidden rounded-full',
            seat.isCurrent && 'ring-4 ring-lemon',
            !seat.connected && 'grayscale',
          )}
        >
          <Identicon seed={seat.id} />
        </div>
        {!seat.connected && (
          <span className="sticker-sm -right-1 -top-1 absolute rounded-full bg-cream p-1">
            <WifiOff className="size-3 text-ink" />
          </span>
        )}
        {seat.finishedPlace !== null && (
          <span className="sticker-sm tabular -bottom-1 -right-1 absolute grid size-6 place-items-center rounded-full bg-lemon text-[11px] text-ink">
            {seat.finishedPlace}
          </span>
        )}
      </div>

      <div className="flex max-w-[7.5rem] items-center gap-1">
        {seat.isHost && <Crown className="size-3.5 shrink-0 fill-lemon text-ink" />}
        {seat.isBot && <Bot className="size-3 shrink-0 text-ink/60" />}
        <span className="truncate font-bold text-xs">{seat.name}</span>
      </div>

      {seat.role !== null && <RoleBadge role={seat.role} />}

      <div className="flex items-center gap-1.5">
        <CardBackStack count={seat.handCount} />
        <span className="tabular text-[12px] text-ink">{seat.handCount}</span>
      </div>

      {seat.passed && (
        <span className="sticker-sm rounded-full bg-cream px-2 font-extrabold text-[10px] text-ink uppercase tracking-wide">
          ผ่านแล้ว
        </span>
      )}
    </motion.div>
  )
}
