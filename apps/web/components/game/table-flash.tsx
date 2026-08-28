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
            initial={{ rotate: flash.kind === 'revolution' ? -10 : 6 }}
            animate={{ rotate: flash.kind === 'revolution' ? 4 : -3 }}
            className={
              flash.kind === 'revolution'
                ? 'ink-edge font-display text-6xl text-bubblegum drop-shadow-[6px_6px_0_var(--ink)]'
                : 'ink-edge font-display text-6xl text-lemon drop-shadow-[6px_6px_0_var(--ink)]'
            }
          >
            {flash.kind === 'revolution' ? 'ปฏิวัติ!' : 'ตัด 8!'}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
