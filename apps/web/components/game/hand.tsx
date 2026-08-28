'use client'

import type { Card } from '@slave/game'
import { motion } from 'motion/react'
import { PlayingCard } from '@/components/game/playing-card'

/** Spread the fan across roughly 10 degrees, whatever the hand size. */
function fanAngle(index: number, total: number): number {
  if (total < 2) return 0
  const middle = (total - 1) / 2
  return ((index - middle) / middle) * 5
}

const container = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.035 } },
}

const dealt = {
  hidden: { opacity: 0, y: 70, rotate: -6 },
  shown: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { type: 'spring' as const, stiffness: 420, damping: 30 },
  },
}

export function Hand({
  cards,
  selected,
  playable,
  interactive,
  onToggle,
  dealKey,
}: {
  cards: readonly Card[]
  selected: readonly string[]
  playable: readonly string[]
  interactive: boolean
  onToggle: (cardId: string) => void
  /** Changing this replays the deal animation — pass the round number. */
  dealKey?: string | number
}) {
  const playableSet = new Set(playable)

  return (
    <div className="-mx-4 overflow-x-auto overflow-y-visible px-4 pt-6 pb-2">
      <motion.div
        key={dealKey}
        variants={container}
        initial="hidden"
        animate="shown"
        layout
        className="flex w-max min-w-full items-end justify-center pl-[26px]"
      >
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            variants={dealt}
            className="-ml-[26px]"
            style={{ rotate: fanAngle(index, cards.length) }}
          >
            <PlayingCard
              card={card}
              size="md"
              selected={selected.includes(card.id)}
              disabled={!interactive || !playableSet.has(card.id)}
              onClick={() => onToggle(card.id)}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
