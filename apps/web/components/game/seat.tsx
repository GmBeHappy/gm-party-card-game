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
  president: 'President',
  vicePresident: 'Vice-President',
  citizen: 'Citizen',
  viceSlave: 'Vice-Slave',
  slave: 'Slave',
}

const ROLE_STYLE: Readonly<Record<RoleName, string>> = {
  president: 'bg-suit-diamond/20 text-suit-diamond ring-suit-diamond/40',
  vicePresident: 'bg-suit-club/15 text-suit-club ring-suit-club/35',
  citizen: 'bg-white/8 text-muted-foreground ring-white/15',
  viceSlave: 'bg-white/8 text-muted-foreground ring-white/15',
  slave: 'bg-suit-heart/18 text-suit-heart ring-suit-heart/40',
}

export function RoleBadge({ role }: { role: RoleName }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wide ring-1',
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
            'absolute inset-[6px] overflow-hidden rounded-full ring-1 ring-white/15',
            seat.isCurrent && 'ring-2 ring-primary',
            !seat.connected && 'grayscale',
          )}
        >
          <Identicon seed={seat.id} />
        </div>
        {!seat.connected && (
          <span className="-right-1 -top-1 absolute rounded-full bg-background p-1 ring-1 ring-border">
            <WifiOff className="size-3 text-muted-foreground" />
          </span>
        )}
        {seat.finishedPlace !== null && (
          <span className="-bottom-1 -right-1 absolute grid size-5 place-items-center rounded-full bg-primary font-bold text-[10px] text-primary-foreground ring-2 ring-background">
            {seat.finishedPlace}
          </span>
        )}
      </div>

      <div className="flex max-w-[7.5rem] items-center gap-1">
        {seat.isHost && <Crown className="size-3 shrink-0 text-suit-diamond" />}
        {seat.isBot && <Bot className="size-3 shrink-0 text-muted-foreground" />}
        <span className="truncate font-medium text-xs">{seat.name}</span>
      </div>

      {seat.role !== null && <RoleBadge role={seat.role} />}

      <div className="flex items-center gap-1.5">
        <CardBackStack count={seat.handCount} />
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {seat.handCount}
        </span>
      </div>

      {seat.passed && (
        <span className="rounded bg-white/10 px-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">
          Passed
        </span>
      )}
    </motion.div>
  )
}
