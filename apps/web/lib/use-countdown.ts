'use client'

import { useEffect, useState } from 'react'

/** Milliseconds left until `deadline`, ticking ~10×/second. Null when untimed. */
export function useCountdown(deadline: number | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(
    deadline === null ? null : Math.max(0, deadline - Date.now()),
  )

  useEffect(() => {
    if (deadline === null) {
      setRemaining(null)
      return
    }
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()))
    tick()
    const timer = setInterval(tick, 100)
    return () => clearInterval(timer)
  }, [deadline])

  return remaining
}
