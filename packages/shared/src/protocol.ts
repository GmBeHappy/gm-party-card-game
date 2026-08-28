import { z } from 'zod'

export const ROOM_CODE_LENGTH = 6
/** No O/0 or I/1 — codes get read aloud. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`), 'invalid room code')

export const nameSchema = z.string().trim().min(2).max(16)

export const settingsPatchSchema = z.object({
  eightCut: z.boolean().optional(),
  revolution: z.boolean().optional(),
  turnSeconds: z.union([z.literal(15), z.literal(30), z.literal(60), z.null()]).optional(),
  totalRounds: z.union([z.literal(3), z.literal(5), z.literal(10), z.null()]).optional(),
})

export type SettingsPatch = z.infer<typeof settingsPatchSchema>

const cardIdsSchema = z.array(z.string().max(4)).min(1).max(4)

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    payload: z.object({
      roomCode: roomCodeSchema,
      name: nameSchema,
      token: z.string().max(512).nullable().optional(),
    }),
  }),
  z.object({ type: z.literal('ready'), payload: z.object({ ready: z.boolean() }) }),
  z.object({ type: z.literal('start'), payload: z.object({}).optional() }),
  z.object({ type: z.literal('settings'), payload: settingsPatchSchema }),
  z.object({ type: z.literal('addBot'), payload: z.object({}).optional() }),
  z.object({ type: z.literal('removeSeat'), payload: z.object({ playerId: z.string().max(64) }) }),
  z.object({ type: z.literal('shuffleSeats'), payload: z.object({}).optional() }),
  z.object({ type: z.literal('play'), payload: z.object({ cardIds: cardIdsSchema }) }),
  z.object({ type: z.literal('pass'), payload: z.object({}).optional() }),
  z.object({ type: z.literal('exchange'), payload: z.object({ cardIds: cardIdsSchema }) }),
  z.object({ type: z.literal('nextRound'), payload: z.object({}).optional() }),
  z.object({ type: z.literal('endMatch'), payload: z.object({}).optional() }),
  z.object({ type: z.literal('rematch'), payload: z.object({}).optional() }),
  z.object({ type: z.literal('leave'), payload: z.object({}).optional() }),
  z.object({ type: z.literal('ping'), payload: z.object({}).optional() }),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>
export type ClientMessageType = ClientMessage['type']

/** Machine-readable failures, so the UI never has to parse an error string. */
export const ERROR_CODES = [
  'room-not-found',
  'room-full',
  'match-in-progress',
  'name-taken',
  'not-host',
  'not-seated',
  'seat-taken',
  'bad-message',
  'rate-limited',
  'wrong-phase',
  'not-your-turn',
  'unknown-player',
  'card-not-in-hand',
  'invalid-play',
  'cannot-beat',
  'cannot-pass',
  'no-pending-exchange',
  'wrong-card-count',
  'not-enough-players',
  'internal',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  'room-not-found': 'ไม่พบห้องรหัสนี้',
  'room-full': 'ห้องนี้เต็มแล้ว',
  'match-in-progress': 'เกมในห้องนี้เริ่มไปแล้ว',
  'name-taken': 'มีคนใช้ชื่อนี้ในห้องแล้ว',
  'not-host': 'เฉพาะเจ้าของห้องเท่านั้นที่ทำได้',
  'not-seated': 'คุณไม่ได้นั่งอยู่ในห้องนี้',
  'seat-taken': 'ที่นั่งนี้มีคนอยู่แล้ว',
  'bad-message': 'เซิร์ฟเวอร์ไม่เข้าใจคำสั่งนี้',
  'rate-limited': 'ช้าลงอีกนิด',
  'wrong-phase': 'ตอนนี้ยังทำแบบนั้นไม่ได้',
  'not-your-turn': 'ยังไม่ถึงตาคุณ',
  'unknown-player': 'ไม่รู้จักผู้เล่นคนนี้',
  'card-not-in-hand': 'คุณไม่มีไพ่ใบนั้นในมือ',
  'invalid-play': 'ลงไพ่แบบนี้ไม่ได้',
  'cannot-beat': 'ไพ่นี้กินไพ่บนกองไม่ได้',
  'cannot-pass': 'ตาที่คุณเป็นคนนำ ต้องลงไพ่',
  'no-pending-exchange': 'คุณไม่มีไพ่ที่ต้องแลก',
  'wrong-card-count': 'จำนวนไพ่ไม่ถูกต้อง',
  'not-enough-players': 'ต้องมีผู้เล่นอย่างน้อย 3 คนถึงจะเริ่มได้',
  internal: 'เซิร์ฟเวอร์มีปัญหา',
}
