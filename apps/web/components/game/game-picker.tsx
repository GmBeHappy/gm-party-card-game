'use client'

import type { GameKind } from '@cards/game'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * Each game keeps its own name and its own suit. There is no umbrella brand,
 * because สลาฟ and โพแดง are what people already call these games.
 */
export const GAME_INFO: Readonly<
  Record<GameKind, { name: string; tagline: string; accent: string; suit: string; ink: string }>
> = {
  slave: {
    name: 'สลาฟ',
    tagline: 'ทิ้งไพ่ให้หมดมือก่อนใคร · 3–6 คน',
    accent: 'bg-lemon',
    suit: '♠',
    ink: 'text-suit-spade',
  },
  hearts: {
    name: 'โพแดง',
    tagline: 'หลบแต้มให้ได้มากที่สุด · 4 คน',
    accent: 'bg-bubblegum',
    suit: '♥',
    ink: 'text-suit-heart',
  },
}

const KINDS = Object.keys(GAME_INFO) as GameKind[]

export function GamePicker({
  value,
  onChange,
}: {
  value: GameKind
  onChange: (game: GameKind) => void
}) {
  return (
    <div className="grid w-full max-w-sm grid-cols-2 gap-3">
      {KINDS.map((kind) => {
        const info = GAME_INFO[kind]
        const active = kind === value
        return (
          <motion.button
            key={kind}
            type="button"
            whileTap={{ scale: 0.96 }}
            aria-pressed={active}
            onClick={() => onChange(kind)}
            className={cn(
              'sticker sticker-lift flex flex-col items-center gap-1 rounded-3xl px-3 py-4 text-center',
              active ? info.accent : 'bg-card',
              active && 'outline-4 outline-ink outline-offset-2',
            )}
          >
            <span
              className={cn('font-display text-4xl leading-none', active ? 'text-ink' : info.ink)}
            >
              {info.suit}
            </span>
            <span className="ink-edge font-display text-2xl text-ink leading-tight">
              {info.name}
            </span>
            <span className="font-semibold text-[11px] text-ink/70 leading-snug">
              {info.tagline}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
