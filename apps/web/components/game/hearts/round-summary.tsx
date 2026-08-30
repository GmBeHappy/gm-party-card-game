'use client'

import type { RoomView } from '@cards/shared'
import { Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { Identicon } from '@/components/game/identicon'
import { Button } from '@/components/ui/button'
import type { RoomActions } from '@/lib/use-room'
import { cn } from '@/lib/utils'

/**
 * The same moment as Daifugō's scoreboard, with the arithmetic pointing the
 * other way: fewest points wins, and a point gained is bad news.
 */
export function HeartsRoundSummary({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const table = view.table
  const isMatchEnd = view.phase === 'matchEnd'
  const isHost = view.you?.isHost === true
  const last = view.history.at(-1)
  const target = table.game === 'hearts' ? table.settings.targetScore : 100
  const moonShooter = findMoonShooter(last?.points ?? {})

  return (
    <div className="table-felt flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        {isMatchEnd ? (
          <>
            <Trophy className="mx-auto size-10 fill-lemon text-ink" />
            <h1 className="ink-edge mt-2 font-display text-5xl text-lemon drop-shadow-[5px_5px_0_var(--ink)]">
              จบเกมแล้ว
            </h1>
            <p className="font-bold text-ink/70 text-sm">แต้มน้อยที่สุดคือผู้ชนะ</p>
          </>
        ) : (
          <>
            <p className="font-extrabold text-ink/70 text-xs uppercase tracking-widest">
              จบรอบ {view.round}
            </p>
            <h1 className="mt-1 font-extrabold text-3xl">ตารางแต้ม</h1>
            <p className="font-semibold text-ink/70 text-xs">
              เกมจบเมื่อมีคนถึง <span className="tabular">{target}</span> แต้ม
            </p>
          </>
        )}
      </motion.header>

      {moonShooter !== null && (
        <motion.p
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="sticker rounded-full bg-lemon px-5 py-2 text-center font-display text-ink text-xl"
        >
          {view.seats.find((seat) => seat.id === moonShooter)?.name ?? 'ใครบางคน'} เก็บครบ 26 —
          ยิงพระจันทร์!
        </motion.p>
      )}

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
                'sticker flex items-center gap-3 rounded-2xl p-3',
                index === 0 ? 'bg-lemon' : 'bg-card',
              )}
            >
              <span className="tabular w-5 text-center text-ink/60">{index + 1}</span>
              <div className="sticker-sm size-10 shrink-0 overflow-hidden rounded-full">
                <Identicon seed={seat.id} />
              </div>
              <p className="min-w-0 flex-1 truncate font-bold text-sm">{seat.name}</p>
              {!isMatchEnd && gained > 0 && (
                <span className="tabular text-bubblegum text-xs">+{gained}</span>
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
              เล่นอีกครั้ง — ห้องเดิม
            </Button>
          ) : (
            <>
              <Button className="w-full" size="lg" onClick={actions.nextRound}>
                ไปรอบถัดไป
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={actions.endMatch}
              >
                จบเกมตรงนี้
              </Button>
            </>
          )
        ) : (
          <p className="sticker-sm mx-auto w-fit rounded-full bg-cream px-4 py-1.5 text-center font-bold text-ink text-sm">
            รอเจ้าของห้องกดต่อ…
          </p>
        )}
      </div>
    </div>
  )
}

/** A shot moon is the only way three seats gain 26 in one round. */
function findMoonShooter(points: Readonly<Record<string, number>>): string | null {
  const entries = Object.entries(points)
  if (entries.length === 0) return null
  const zeroes = entries.filter(([, value]) => value === 0)
  const full = entries.filter(([, value]) => value === 26)
  if (zeroes.length !== 1 || full.length !== entries.length - 1) return null
  return zeroes[0]?.[0] ?? null
}
