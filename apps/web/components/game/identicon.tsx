'use client'

import { cn } from '@/lib/utils'

function hash(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A deterministic 5×5 mirrored avatar, so every seat is recognisable at a glance. */
export function Identicon({ seed, className }: { seed: string; className?: string }) {
  const h = hash(seed)
  const hue = h % 360
  const cells: boolean[] = []
  for (let i = 0; i < 15; i++) cells.push(((h >> i) & 1) === 1)

  return (
    <svg
      viewBox="0 0 5 5"
      className={cn('size-full', className)}
      role="img"
      aria-label="player avatar"
    >
      <rect width="5" height="5" fill={`oklch(0.24 0.05 ${hue})`} />
      {cells.map((on, index) => {
        if (!on) return null
        const column = Math.floor(index / 5)
        const row = index % 5
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed 15-cell grid, never reordered
          <g key={`cell-${index}`} fill={`oklch(0.72 0.17 ${hue})`}>
            <rect x={column} y={row} width="1" height="1" />
            <rect x={4 - column} y={row} width="1" height="1" />
          </g>
        )
      })}
    </svg>
  )
}
