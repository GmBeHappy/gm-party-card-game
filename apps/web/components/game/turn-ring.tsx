'use client'

import { cn } from '@/lib/utils'

/** A countdown ring drawn around the active seat. */
export function TurnRing({
  progress,
  urgent,
  className,
}: {
  /** 1 = full time left, 0 = out of time. */
  progress: number
  urgent: boolean
  className?: string
}) {
  const radius = 46
  const circumference = 2 * Math.PI * radius
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('-rotate-90 pointer-events-none absolute inset-0 size-full', className)}
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="4" className="stroke-ink/15" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, progress)))}
        className={cn(
          'transition-[stroke-dashoffset] duration-100 ease-linear',
          urgent ? 'stroke-destructive' : 'stroke-lemon',
        )}
      />
    </svg>
  )
}
