'use client'

import { AnimatePresence, motion } from 'motion/react'

export type FlashKind = 'revolution' | 'eightCut' | 'heartsBroken' | 'moonShot' | null

/** Word and colour for each loud moment. The tilt alternates so two in a row read as two. */
const FLASH: Readonly<Record<string, { word: string; tone: string; from: number; to: number }>> = {
  revolution: { word: 'ปฏิวัติ!', tone: 'text-bubblegum', from: -10, to: 4 },
  eightCut: { word: 'ตัด 8!', tone: 'text-lemon', from: 6, to: -3 },
  heartsBroken: { word: 'โพแดงแตก!', tone: 'text-suit-heart', from: -8, to: 3 },
  moonShot: { word: 'ยิงพระจันทร์!', tone: 'text-lemon', from: 8, to: -4 },
}

/** The loud moments: a full-bleed flourish that clears itself. */
export function TableFlash({ flash }: { flash: { kind: FlashKind; id: number } }) {
  const shown = flash.kind === null ? null : FLASH[flash.kind]
  return (
    <AnimatePresence>
      {shown !== undefined && shown !== null && (
        <motion.div
          key={flash.id}
          initial={{ opacity: 0, scale: 1.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
        >
          <motion.span
            initial={{ rotate: shown.from }}
            animate={{ rotate: shown.to }}
            className={`ink-edge font-display text-6xl drop-shadow-[6px_6px_0_var(--ink)] ${shown.tone}`}
          >
            {shown.word}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
