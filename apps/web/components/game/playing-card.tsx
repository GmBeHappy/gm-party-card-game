'use client'

import type { Card, Suit } from '@slave/game'
import { rankLabel } from '@slave/game'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const SUIT_GLYPH: Readonly<Record<Suit, string>> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
}

const SUIT_NAME: Readonly<Record<Suit, string>> = {
  S: 'โพดำ',
  H: 'โพแดง',
  D: 'ข้าวหลามตัด',
  C: 'ดอกจิก',
}

/** Four colours, not two — a fanned hand of 18 has to be scannable. */
const SUIT_COLOR: Readonly<Record<Suit, string>> = {
  S: 'text-suit-spade',
  H: 'text-suit-heart',
  D: 'text-suit-diamond',
  C: 'text-suit-club',
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE: Readonly<Record<CardSize, string>> = {
  xs: 'h-[46px] w-[32px] rounded-[7px] text-[10px]',
  sm: 'h-[66px] w-[46px] rounded-[10px] text-[13px]',
  md: 'h-[104px] w-[72px] rounded-[14px] text-lg',
  lg: 'h-[136px] w-[94px] rounded-[18px] text-xl',
}

const GLYPH_SIZE: Readonly<Record<CardSize, string>> = {
  xs: 'text-[14px]',
  sm: 'text-2xl',
  md: 'text-[40px]',
  lg: 'text-5xl',
}

export interface PlayingCardProps {
  card: Card
  size?: CardSize
  selected?: boolean
  /** Illegal right now: greyed out and not clickable. */
  disabled?: boolean
  onClick?: () => void
  className?: string
}

export function PlayingCard({
  card,
  size = 'md',
  selected = false,
  disabled = false,
  onClick,
  className,
}: PlayingCardProps) {
  const glyph = SUIT_GLYPH[card.suit]
  const colour = SUIT_COLOR[card.suit]
  const interactive = onClick !== undefined && !disabled

  return (
    <motion.button
      type="button"
      layout
      disabled={!interactive}
      onClick={interactive ? onClick : undefined}
      aria-label={`${rankLabel(card.rank)} ${SUIT_NAME[card.suit]}`}
      aria-pressed={selected}
      whileTap={interactive ? { scale: 0.94 } : undefined}
      animate={{ y: selected ? -22 : 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
      className={cn(
        'sticker relative flex shrink-0 select-none flex-col justify-between bg-face px-1.5 py-1 font-extrabold',
        SIZE[size],
        size === 'xs' ? 'sticker-sm' : 'sticker',
        interactive ? 'cursor-pointer' : 'cursor-default',
        disabled && 'opacity-40 grayscale',
        selected && 'ring-4 ring-lemon',
        className,
      )}
    >
      <span className={cn('flex items-center gap-px leading-none', colour)}>
        {rankLabel(card.rank)}
        <span>{glyph}</span>
      </span>
      <span
        className={cn('-mt-0.5 self-center leading-none', GLYPH_SIZE[size], colour)}
        aria-hidden="true"
      >
        {glyph}
      </span>
      <span
        className={cn('flex rotate-180 items-center gap-px self-end leading-none', colour)}
        aria-hidden="true"
      >
        {rankLabel(card.rank)}
        <span>{glyph}</span>
      </span>
    </motion.button>
  )
}

export function CardBack({ size = 'sm', className }: { size?: CardSize; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'shrink-0 bg-[repeating-linear-gradient(45deg,var(--bubblegum)_0px,var(--bubblegum)_7px,var(--lemon)_7px,var(--lemon)_14px)]',
        size === 'xs' ? 'sticker-sm' : 'sticker',
        SIZE[size],
        className,
      )}
    />
  )
}

/** A little stack of backs showing how many cards a seat is holding. */
export function CardBackStack({ count, size = 'xs' }: { count: number; size?: CardSize }) {
  const shown = Math.min(count, 5)
  return (
    <div className="flex items-center">
      {Array.from({ length: shown }, (_, index) => {
        return (
          <CardBack
            // biome-ignore lint/suspicious/noArrayIndexKey: identical decorative backs, never reordered
            key={`back-${index}`}
            size={size}
            className={index === 0 ? '' : '-ml-[24px]'}
          />
        )
      })}
    </div>
  )
}
