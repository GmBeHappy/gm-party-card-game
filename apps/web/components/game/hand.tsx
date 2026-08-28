'use client'

import type { Card } from '@slave/game'
import { motion } from 'motion/react'
import { PlayingCard } from '@/components/game/playing-card'

/**
 * A gentle spread. Anything steeper turns a heavily overlapped hand into a
 * sawtooth and makes the indices harder to compare, not easier.
 */
function fanAngle(index: number, total: number): number {
  if (total < 2) return 0
  const middle = (total - 1) / 2
  return ((index - middle) / middle) * 3
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
    <div className="-mx-4 overflow-x-auto overflow-y-visible px-4 pt-12 pb-6">
      <motion.div
        key={dealKey}
        variants={container}
        initial="hidden"
        animate="shown"
        layout
        className="flex w-max min-w-full items-end justify-center pl-[26px]"
      >
        {cards.map((card, index) => {
          const angle = fanAngle(index, cards.length)
          const canHover = interactive && playableSet.has(card.id)
          return (
            // Outer element owns the deal and the card's place in the fan…
            <motion.div
              key={card.id}
              variants={dealt}
              className="-ml-[26px]"
              style={{ rotate: angle }}
            >
              {/* …inner element owns the hover, so pointing at a card pulls it
                  upright and out of the spread instead of fighting the fan. */}
              <motion.div
                className="relative"
                whileHover={
                  canHover ? { y: -16, scale: 1.08, rotate: -angle, zIndex: 30 } : undefined
                }
                transition={{ type: 'spring', stiffness: 460, damping: 24 }}
              >
                <PlayingCard
                  card={card}
                  size="md"
                  selected={selected.includes(card.id)}
                  disabled={!canHover}
                  onClick={() => onToggle(card.id)}
                />
              </motion.div>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
