'use client'

import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3001'

export default function Home() {
  const [health, setHealth] = useState<string>('checking…')

  useEffect(() => {
    fetch(`${SERVER_URL}/health`)
      .then((r) => r.json())
      .then((d) => setHealth(d.ok ? 'connected' : 'unhealthy'))
      .catch(() => setHealth('unreachable'))
  }, [])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-bold text-4xl tracking-tight"
      >
        Slave
      </motion.h1>
      <p className="text-muted-foreground text-sm">server: {health}</p>
      <Button>Stage 1 skeleton</Button>
    </main>
  )
}
