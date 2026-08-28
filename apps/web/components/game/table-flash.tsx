'use client'

import { AnimatePresence, motion } from 'motion/react'

export type FlashKind = 'revolution' | 'eightCut' | null

/** The loud moments: a full-bleed flourish that clears itself. */
export function TableFlash({ flash }: { flash: { kind: FlashKind; id: number } }) {
  return (
    <AnimatePresence>
      {flash.kind !== null && (
        <motion.div
          key={flash.id}
          initial={{ opacity: 0, scale: 1.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
        >
          <motion.span
            initial={{ rotate: flash.kind === 'revolution' ? -8 : 0 }}
            animate={{ rotate: 0 }}
            className={
              flash.kind === 'revolution'
                ? 'bg-gradient-to-b from-suit-heart to-primary bg-clip-text font-black text-6xl text-transparent tracking-tighter drop-shadow-[0_0_30px_var(--danger-glow)]'
                : 'font-black text-6xl text-suit-diamond tracking-tighter drop-shadow-[0_0_24px_oklch(0.8_0.16_72_/_50%)]'
            }
          >
            {flash.kind === 'revolution' ? 'REVOLUTION' : '8 CUT'}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
