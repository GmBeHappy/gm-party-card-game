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

const SUIT_COLOR: Readonly<Record<Suit, string>> = {
  S: 'text-suit-spade',
  H: 'text-suit-heart',
  D: 'text-suit-diamond',
  C: 'text-suit-club',
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZE: Readonly<Record<CardSize, string>> = {
  xs: 'h-12 w-[34px] rounded-[5px] text-[9px]',
  sm: 'h-16 w-[46px] rounded-md text-[11px]',
  md: 'h-24 w-[68px] rounded-lg text-sm',
  lg: 'h-32 w-[92px] rounded-xl text-base',
}

const GLYPH_SIZE: Readonly<Record<CardSize, string>> = {
  xs: 'text-[13px]',
  sm: 'text-lg',
  md: 'text-3xl',
  lg: 'text-4xl',
}

export interface PlayingCardProps {
  card: Card
  size?: CardSize
  selected?: boolean
  /** Illegal right now: dimmed and not clickable. */
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
      aria-label={`${rankLabel(card.rank)} of ${SUIT_NAME[card.suit]}`}
      aria-pressed={selected}
      whileTap={interactive ? { scale: 0.96 } : undefined}
      animate={{ y: selected ? -18 : 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
      className={cn(
        'relative flex shrink-0 select-none flex-col justify-between overflow-hidden bg-face p-1 font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.55)] ring-1 ring-black/25',
        SIZE[size],
        interactive ? 'cursor-pointer' : 'cursor-default',
        disabled && 'opacity-35 saturate-50',
        selected && 'ring-2 ring-primary shadow-[0_0_18px_-2px_var(--ring)]',
        className,
      )}
    >
      <span className={cn('leading-none', colour)}>
        {rankLabel(card.rank)}
        <span className="ml-px">{glyph}</span>
      </span>
      <span
        className={cn('-mt-1 self-center leading-none', GLYPH_SIZE[size], colour)}
        aria-hidden="true"
      >
        {glyph}
      </span>
      <span className={cn('rotate-180 self-end leading-none', colour)} aria-hidden="true">
        {rankLabel(card.rank)}
        <span className="ml-px">{glyph}</span>
      </span>
    </motion.button>
  )
}

const SUIT_NAME: Readonly<Record<Suit, string>> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
}

export function CardBack({ size = 'sm', className }: { size?: CardSize; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'shrink-0 border border-primary/30 bg-[repeating-linear-gradient(45deg,oklch(0.28_0.09_292)_0px,oklch(0.28_0.09_292)_3px,oklch(0.2_0.06_285)_3px,oklch(0.2_0.06_285)_6px)] shadow-[0_2px_8px_rgba(0,0,0,0.5)]',
        SIZE[size],
        className,
      )}
    />
  )
}

/** A small stack of backs used to show how many cards a seat is holding. */
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
            className={index === 0 ? '' : '-ml-[26px]'}
          />
        )
      })}
    </div>
  )
}
