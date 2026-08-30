'use client'

import { GAME_META, type HeartsSettings, type SlaveSettings } from '@cards/game'
import type { RoomView } from '@cards/shared'
import { Bot, Check, Copy, Crown, Shuffle, UserMinus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { GAME_INFO, GamePicker } from '@/components/game/game-picker'
import { Identicon } from '@/components/game/identicon'
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
  const { minPlayers, maxPlayers } = GAME_META[view.game]
  const seated = view.seats.length
  const humans = view.seats.filter((seat) => !seat.isBot)
  const allReady = humans.every((seat) => seat.ready)
  const canStart = isHost && seated >= minPlayers && allReady

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
      <section className="sticker rounded-3xl bg-lemon p-5 text-center">
        <p className="text-muted-foreground text-xs uppercase tracking-widest">รหัสห้อง</p>
        <p className="mt-1 font-bold font-mono text-4xl tracking-[0.35em]">{view.code}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={copyLink}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์ชวนเพื่อน'}
        </Button>
      </section>

      {isHost ? (
        <section className="space-y-2">
          <h2 className="font-extrabold text-base">เกม</h2>
          <GamePicker value={view.game} onChange={actions.setGame} />
        </section>
      ) : (
        <p className="text-center font-semibold text-ink/60 text-xs">
          กำลังจะเล่น {GAME_INFO[view.game].name}
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-base">
            ผู้เล่น{' '}
            <span className="text-muted-foreground">
              {seated}/{maxPlayers}
            </span>
          </h2>
          {isHost && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={seated >= maxPlayers}
                onClick={actions.addBot}
              >
                <Bot className="size-3.5" /> เพิ่มบอท
              </Button>
              <Button variant="ghost" size="sm" onClick={actions.shuffleSeats}>
                <Shuffle className="size-3.5" /> สลับที่นั่ง
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
                  'sticker flex items-center gap-3 rounded-2xl p-3',
                  seat.ready ? 'bg-mint' : 'bg-card',
                )}
              >
                <span className="tabular w-5 text-center text-ink/50 text-xs">{index + 1}</span>
                <div className="sticker-sm size-10 shrink-0 overflow-hidden rounded-full">
                  <Identicon seed={seat.id} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-bold text-sm">
                    {seat.name}
                    {seat.isHost && <Crown className="size-4 fill-lemon text-ink" />}
                    {seat.isBot && <Bot className="size-3.5 text-muted-foreground" />}
                  </p>
                  {!seat.connected && !seat.isBot && (
                    <p className="text-muted-foreground text-xs">หลุดการเชื่อมต่อ</p>
                  )}
                </div>
                <span className="sticker-sm shrink-0 rounded-full bg-cream px-2.5 py-0.5 font-extrabold text-[11px] text-ink">
                  {seat.ready ? 'พร้อม' : 'ยังไม่พร้อม'}
                </span>
                {isHost && seat.id !== you?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`เตะ ${seat.name} ออกจากห้อง`}
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
            รอที่นั่ง: {view.waiting.map((person) => person.name).join(', ')}
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
          {seatReady(view) ? 'ยังไม่พร้อม' : 'ฉันพร้อมแล้ว'}
        </Button>

        {isHost && (
          <Button className="w-full" size="lg" disabled={!canStart} onClick={actions.start}>
            เริ่มเกม
          </Button>
        )}

        {isHost && !canStart && (
          <p className="text-center text-muted-foreground text-xs">
            {seated < minPlayers
              ? minPlayers === maxPlayers
                ? `ต้องมี ${minPlayers} คนพอดี เพิ่มบอทเติมที่นั่งก็ได้`
                : `ต้องมีอย่างน้อย ${minPlayers} คน เพิ่มบอทเติมที่นั่งก็ได้`
              : 'รอให้ทุกคนกดพร้อมก่อน'}
          </p>
        )}
        {!isHost && (
          <p className="text-center font-semibold text-ink/60 text-xs">เจ้าของห้องเป็นคนกดเริ่มเกม</p>
        )}
      </section>
    </div>
  )
}

function seatReady(view: RoomView): boolean {
  return view.seats.find((seat) => seat.id === view.you?.id)?.ready === true
}

function RoomSettings({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const table = view.table
  return table.game === 'hearts' ? (
    <HeartsRoomSettings settings={table.settings} actions={actions} />
  ) : (
    <SlaveRoomSettings settings={table.settings} actions={actions} />
  )
}

function HeartsRoomSettings({
  settings,
  actions,
}: {
  settings: HeartsSettings
  actions: RoomActions
}) {
  return (
    <section className="sticker space-y-4 rounded-3xl bg-card p-4">
      <h2 className="font-bold text-base">กติกาห้อง</h2>
      <p className="text-muted-foreground text-xs">
        โพแดง 1 แต้ม · โพดำ Q 13 แต้ม · เก็บครบ 26 คนอื่นรับไปคนละ 26
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>เวลาต่อตา</Label>
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
              <SelectItem value="15">15 วินาที</SelectItem>
              <SelectItem value="30">30 วินาที</SelectItem>
              <SelectItem value="60">60 วินาที</SelectItem>
              <SelectItem value="off">ไม่จับเวลา</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>เล่นถึงกี่แต้ม</Label>
          <Select
            value={String(settings.targetScore)}
            onValueChange={(value) =>
              actions.updateSettings({ targetScore: Number(value) as 50 | 100 | 200 })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 แต้ม — สั้น</SelectItem>
              <SelectItem value="100">100 แต้ม</SelectItem>
              <SelectItem value="200">200 แต้ม — ยาว</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  )
}

function SlaveRoomSettings({
  settings,
  actions,
}: {
  settings: SlaveSettings
  actions: RoomActions
}) {
  return (
    <section className="sticker space-y-4 rounded-3xl bg-card p-4">
      <h2 className="font-bold text-base">กติกาห้อง</h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="eight-cut">ตัด 8</Label>
          <p className="text-muted-foreground text-xs">ลงไพ่ 8 จบตานั้นทันที คนลงได้นำต่อ</p>
        </div>
        <Switch
          id="eight-cut"
          checked={settings.eightCut}
          onCheckedChange={(value) => actions.updateSettings({ eightCut: value })}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="revolution">ปฏิวัติ</Label>
          <p className="text-muted-foreground text-xs">ลงไพ่สี่ใบเหมือนกัน สลับลำดับไพ่ทั้งรอบ</p>
        </div>
        <Switch
          id="revolution"
          checked={settings.revolution}
          onCheckedChange={(value) => actions.updateSettings({ revolution: value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>เวลาต่อตา</Label>
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
              <SelectItem value="15">15 วินาที</SelectItem>
              <SelectItem value="30">30 วินาที</SelectItem>
              <SelectItem value="60">60 วินาที</SelectItem>
              <SelectItem value="off">ไม่จับเวลา</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>จำนวนรอบ</Label>
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
              <SelectItem value="3">3 รอบ</SelectItem>
              <SelectItem value="5">5 รอบ</SelectItem>
              <SelectItem value="10">10 รอบ</SelectItem>
              <SelectItem value="endless">ไม่จำกัด</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  )
}
