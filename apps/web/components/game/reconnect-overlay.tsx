'use client'

import { Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import type { ConnectionStatus } from '@/lib/socket'

/**
 * Shown over a frozen but still readable table, so you can see what you are
 * missing while the socket comes back.
 */
export function ReconnectOverlay({
  status,
  attempt,
  onRetry,
}: {
  status: ConnectionStatus
  attempt: number
  onRetry: () => void
}) {
  if (status === 'open') return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-mint/95"
    >
      <Loader2 className="size-9 animate-spin text-ink" />
      <div className="sticker rounded-3xl bg-cream px-6 py-4 text-center">
        <p className="font-extrabold text-lg">
          {status === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </p>
        <p className="mt-1 font-semibold text-ink/70 text-sm">
          {attempt > 0
            ? `Attempt ${attempt}. Your seat is held until the match ends.`
            : 'Your seat is held until the match ends.'}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try now
      </Button>
    </motion.div>
  )
}
