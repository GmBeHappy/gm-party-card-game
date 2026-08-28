'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { sound } from '@/lib/sound'

export function SoundControls() {
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(0.7)

  useEffect(() => {
    setMuted(sound.isMuted())
    setVolume(sound.getVolume())
  }, [])

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        onClick={() => {
          const next = !muted
          sound.setMuted(next)
          setMuted(next)
          if (!next) sound.play('card:select')
        }}
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="px-1 text-muted-foreground text-xs">
            Volume
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 space-y-3">
          <Label className="text-xs">Sound volume</Label>
          <Slider
            value={[volume]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={([next]) => {
              const value = next ?? 0
              setVolume(value)
              sound.setVolume(value)
            }}
            onValueCommit={() => sound.play('card:select')}
          />
          <p className="text-[11px] text-muted-foreground">
            Effects are synthesised in the browser — nothing is downloaded.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
