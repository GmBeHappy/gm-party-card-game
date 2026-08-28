'use client'

import { MotionConfig } from 'motion/react'
import { TooltipProvider } from '@/components/ui/tooltip'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // `user` makes every spring below respect the OS reduced-motion setting.
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </MotionConfig>
  )
}
