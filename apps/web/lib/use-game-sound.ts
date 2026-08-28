'use client'

import { useEffect, useRef } from 'react'
import { type SoundName, sound } from './sound'
import type { EventBatch } from './use-room'

/** Turn the server's game events into sound. Runs once per delivered batch. */
export function useGameSound(batch: EventBatch, myId: string | null): void {
  const lastId = useRef(0)

  useEffect(() => {
    if (batch.id === lastId.current) return
    lastId.current = batch.id

    for (const event of batch.events) {
      let name: SoundName | null = null
      switch (event.type) {
        case 'dealt':
          name = 'deal'
          break
        case 'played':
          name = 'card:play'
          break
        case 'passed':
          name = 'pass'
          break
        case 'eightCut':
          name = 'eightCut'
          break
        case 'revolution':
          name = 'revolution'
          break
        case 'playerFinished':
          name = 'finish'
          break
        case 'matchEnded':
          name = 'victory'
          break
        case 'turnChanged':
          // Only announce your own turn — otherwise it chimes every few seconds.
          if (event.playerId !== null && event.playerId === myId) {
            name = 'turn'
            sound.vibrate(30)
          }
          break
        default:
          name = null
      }
      if (name !== null) sound.play(name)
    }
  }, [batch, myId])
}
