'use client'

import type { Card } from '@slave/game'
import { motion } from 'motion/react'
import { PlayingCard } from '@/components/game/playing-card'
import { cn } from '@/lib/utils'

export function Hand({
  cards,
  selected,
  playable,
  interactive,
  onToggle,
}: {
  cards: readonly Card[]
  selected: readonly string[]
  playable: readonly string[]
  interactive: boolean
  onToggle: (cardId: string) => void
}) {
  const playableSet = new Set(playable)

  return (
    <div className="-mx-4 overflow-x-auto overflow-y-visible px-4 pt-6 pb-2">
      <motion.div layout className="flex w-max min-w-full items-end justify-center pl-[26px]">
        {cards.map((card) => {
          const disabled = !interactive || !playableSet.has(card.id)
          return (
            <div key={card.id} className={cn('-ml-[26px]')}>
              <PlayingCard
                card={card}
                size="md"
                selected={selected.includes(card.id)}
                disabled={disabled}
                onClick={() => onToggle(card.id)}
              />
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}
