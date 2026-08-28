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
            className="sticker-sm rounded-full bg-cream px-4 py-1.5 text-center font-bold text-ink text-sm"
          >
            {revolution ? 'ปฏิวัติอยู่ — ไพ่เล็กชนะ' : 'ตาเปิด — ลงไพ่อะไรก็ได้'}
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
        <p className="font-bold text-ink/70 text-xs">{leaderName} เป็นคนลง</p>
      )}
    </div>
  )
}
