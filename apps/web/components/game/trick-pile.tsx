'use client'

import type { Card } from '@slave/game'
import { AnimatePresence, motion } from 'motion/react'
import { PlayingCard } from '@/components/game/playing-card'

export function TrickPile({
  cards,
  leaderName,
  revolution,
}: {
  cards: readonly Card[] | null
  leaderName: string | null
  revolution: boolean
}) {
  return (
    <div className="flex min-h-[9.5rem] flex-col items-center justify-center gap-2">
      <AnimatePresence mode="popLayout">
        {cards === null || cards.length === 0 ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-muted-foreground text-sm"
          >
            {revolution ? 'Revolution is running — lowest wins' : 'Open trick — anything leads'}
          </motion.p>
        ) : (
          <motion.div
            key={cards.map((card) => card.id).join('-')}
            initial={{ opacity: 0, y: 28, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="flex gap-1"
          >
            {cards.map((card) => (
              <PlayingCard key={card.id} card={card} size="md" />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {leaderName !== null && cards !== null && cards.length > 0 && (
        <p className="text-muted-foreground text-xs">played by {leaderName}</p>
      )}
    </div>
  )
}
