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
        interactive ? 'sticker-lift cursor-pointer' : 'cursor-default',
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

/**
 * The cover. Built like a real card back — an inset frame, a dotted field, and
 * a medallion — because a flat stripe fill reads as a placeholder, and this is
 * the single most-repeated object on the table.
 */
export function CardBack({ size = 'sm', className }: { size?: CardSize; className?: string }) {
  const detailed = size !== 'xs'
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative shrink-0 overflow-hidden bg-bubblegum',
        size === 'xs' ? 'sticker-sm' : 'sticker',
        SIZE[size],
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--lemon)_1.6px,transparent_1.7px)] bg-[length:9px_9px] opacity-80" />
      {detailed && (
        <>
          <div className="absolute inset-[3px] rounded-[inherit] border-2 border-cream/70" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid size-[56%] place-items-center rounded-full bg-cream ring-2 ring-ink">
              <Crown className="size-[62%] text-ink" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** The rank ladder is what the game is about, so the cover wears a crown. */
function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M2.6 6.8 7 10.4l4.3-6.5a.85.85 0 0 1 1.4 0L17 10.4l4.4-3.6c.6-.5 1.5 0 1.3.8l-2.2 8.2a1 1 0 0 1-1 .8H4.5a1 1 0 0 1-1-.8L1.3 7.6c-.2-.8.7-1.3 1.3-.8Z" />
      <rect x="4.6" y="17.6" width="14.8" height="2.4" rx="1.2" />
    </svg>
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
