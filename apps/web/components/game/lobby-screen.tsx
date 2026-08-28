'use client'

import { MAX_PLAYERS, MIN_PLAYERS } from '@slave/game'
import type { RoomView } from '@slave/shared'
import { Bot, Check, Copy, Crown, Shuffle, UserMinus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Identicon } from '@/components/game/identicon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { RoomActions } from '@/lib/use-room'
import { cn } from '@/lib/utils'

export function LobbyScreen({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const [copied, setCopied] = useState(false)
  const you = view.you
  const isHost = you?.isHost === true
  const seated = view.seats.length
  const humans = view.seats.filter((seat) => !seat.isBot)
  const allReady = humans.every((seat) => seat.ready)
  const canStart = isHost && seated >= MIN_PLAYERS && allReady

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${view.code}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-6">
      <section className="rounded-2xl border border-white/10 bg-card/70 p-5 text-center backdrop-blur">
        <p className="text-muted-foreground text-xs uppercase tracking-widest">Room code</p>
        <p className="mt-1 font-bold font-mono text-4xl tracking-[0.35em]">{view.code}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={copyLink}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Link copied' : 'Copy invite link'}
        </Button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">
            Players{' '}
            <span className="text-muted-foreground">
              {seated}/{MAX_PLAYERS}
            </span>
          </h2>
          {isHost && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={seated >= MAX_PLAYERS}
                onClick={actions.addBot}
              >
                <Bot className="size-3.5" /> Add bot
              </Button>
              <Button variant="ghost" size="sm" onClick={actions.shuffleSeats}>
                <Shuffle className="size-3.5" /> Shuffle
              </Button>
            </div>
          )}
        </div>

        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {view.seats.map((seat, index) => (
              <motion.li
                key={seat.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-white/10 bg-card/60 p-3',
                  seat.ready && 'border-primary/40',
                )}
              >
                <span className="w-5 text-center font-mono text-muted-foreground text-xs">
                  {index + 1}
                </span>
                <div className="size-9 overflow-hidden rounded-full ring-1 ring-white/15">
                  <Identicon seed={seat.id} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium text-sm">
                    {seat.name}
                    {seat.isHost && <Crown className="size-3.5 text-suit-diamond" />}
                    {seat.isBot && <Bot className="size-3.5 text-muted-foreground" />}
                  </p>
                  {!seat.connected && !seat.isBot && (
                    <p className="text-muted-foreground text-xs">disconnected</p>
                  )}
                </div>
                {seat.ready ? (
                  <Badge className="bg-primary/20 text-primary">Ready</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Waiting
                  </Badge>
                )}
                {isHost && seat.id !== you?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${seat.name}`}
                    onClick={() => actions.removeSeat(seat.id)}
                  >
                    <UserMinus className="size-4 text-muted-foreground" />
                  </Button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        {view.waiting.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Waiting for a seat: {view.waiting.map((person) => person.name).join(', ')}
          </p>
        )}
      </section>

      {isHost && <RoomSettings view={view} actions={actions} />}

      <section className="space-y-3 pb-safe">
        <Button
          variant={you?.id !== undefined && seatReady(view) ? 'secondary' : 'default'}
          className="w-full"
          size="lg"
          onClick={() => actions.ready(!seatReady(view))}
        >
          {seatReady(view) ? "I'm not ready" : "I'm ready"}
        </Button>

        {isHost && (
          <Button className="w-full" size="lg" disabled={!canStart} onClick={actions.start}>
            Start match
          </Button>
        )}

        {isHost && !canStart && (
          <p className="text-center text-muted-foreground text-xs">
            {seated < MIN_PLAYERS
              ? `Needs at least ${MIN_PLAYERS} players — add a bot to fill a seat.`
              : 'Waiting for everyone to be ready.'}
          </p>
        )}
        {!isHost && (
          <p className="text-center text-muted-foreground text-xs">The host starts the match.</p>
        )}
      </section>
    </div>
  )
}

function seatReady(view: RoomView): boolean {
  return view.seats.find((seat) => seat.id === view.you?.id)?.ready === true
}

function RoomSettings({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const { settings } = view
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-card/60 p-4">
      <h2 className="font-semibold text-sm">Room rules</h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="eight-cut">8-cut</Label>
          <p className="text-muted-foreground text-xs">Any play with an 8 ends the trick.</p>
        </div>
        <Switch
          id="eight-cut"
          checked={settings.eightCut}
          onCheckedChange={(value) => actions.updateSettings({ eightCut: value })}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="revolution">Revolution</Label>
          <p className="text-muted-foreground text-xs">
            Four of a kind flips the rank order for the round.
          </p>
        </div>
        <Switch
          id="revolution"
          checked={settings.revolution}
          onCheckedChange={(value) => actions.updateSettings({ revolution: value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Turn timer</Label>
          <Select
            value={String(settings.turnSeconds ?? 'off')}
            onValueChange={(value) =>
              actions.updateSettings({
                turnSeconds: value === 'off' ? null : (Number(value) as 15 | 30 | 60),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 seconds</SelectItem>
              <SelectItem value="30">30 seconds</SelectItem>
              <SelectItem value="60">60 seconds</SelectItem>
              <SelectItem value="off">No timer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Rounds</Label>
          <Select
            value={String(settings.totalRounds ?? 'endless')}
            onValueChange={(value) =>
              actions.updateSettings({
                totalRounds: value === 'endless' ? null : (Number(value) as 3 | 5 | 10),
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 rounds</SelectItem>
              <SelectItem value="5">5 rounds</SelectItem>
              <SelectItem value="10">10 rounds</SelectItem>
              <SelectItem value="endless">Endless</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  )
}
