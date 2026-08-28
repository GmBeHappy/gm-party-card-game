'use client'

import type { RoomView } from '@slave/shared'
import { Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { Identicon } from '@/components/game/identicon'
import { RoleBadge } from '@/components/game/seat'
import { Button } from '@/components/ui/button'
import type { RoomActions } from '@/lib/use-room'
import { cn } from '@/lib/utils'

/** Between-round scoreboard and end-of-match podium — the same table, two moods. */
export function RoundSummary({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const isMatchEnd = view.phase === 'matchEnd'
  const isHost = view.you?.isHost === true
  const last = view.history.at(-1)

  return (
    <div className="table-felt flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        {isMatchEnd ? (
          <>
            <Trophy className="mx-auto size-8 text-suit-diamond" />
            <h1 className="mt-2 font-bold text-3xl">Match over</h1>
            <p className="text-muted-foreground text-sm">
              {view.history.length} round{view.history.length === 1 ? '' : 's'} played
            </p>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-xs uppercase tracking-widest">
              Round {view.round} complete
            </p>
            <h1 className="mt-1 font-bold text-3xl">Standings</h1>
          </>
        )}
      </motion.header>

      <ol className="w-full max-w-md space-y-2">
        {view.standings.map((row, index) => {
          const seat = view.seats.find((item) => item.id === row.playerId)
          if (seat === undefined) return null
          const gained = last?.points[row.playerId] ?? 0
          return (
            <motion.li
              key={row.playerId}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06 }}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-white/10 bg-card/60 p-3',
                index === 0 && isMatchEnd && 'border-suit-diamond/50 bg-suit-diamond/10',
              )}
            >
              <span className="w-5 text-center font-bold font-mono text-muted-foreground">
                {index + 1}
              </span>
              <div className="size-9 overflow-hidden rounded-full ring-1 ring-white/15">
                <Identicon seed={seat.id} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm">{seat.name}</p>
                {seat.role !== null && (
                  <div className="pt-0.5">
                    <RoleBadge role={seat.role} />
                  </div>
                )}
              </div>
              {!isMatchEnd && gained > 0 && (
                <span className="font-mono text-primary text-xs">+{gained}</span>
              )}
              <span className="w-8 text-right font-bold font-mono tabular-nums">{row.score}</span>
            </motion.li>
          )
        })}
      </ol>

      <div className="w-full max-w-md space-y-2 pb-safe">
        {isHost ? (
          isMatchEnd ? (
            <Button className="w-full" size="lg" onClick={actions.rematch}>
              Play again — same room
            </Button>
          ) : (
            <>
              <Button className="w-full" size="lg" onClick={actions.nextRound}>
                Next round
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={actions.endMatch}
              >
                End match here
              </Button>
            </>
          )
        ) : (
          <p className="text-center text-muted-foreground text-sm">
            Waiting for the host to continue…
          </p>
        )}
      </div>
    </div>
  )
}
