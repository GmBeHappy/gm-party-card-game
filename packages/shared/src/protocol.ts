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
  'room-not-found': 'No room with that code.',
  'room-full': 'That room is full.',
  'match-in-progress': 'That match has already started.',
  'name-taken': 'Someone in the room is already using that name.',
  'not-host': 'Only the host can do that.',
  'not-seated': 'You are not seated in this room.',
  'seat-taken': 'That seat is already taken.',
  'bad-message': 'The server could not understand that request.',
  'rate-limited': 'Slow down a moment.',
  'wrong-phase': 'That is not possible right now.',
  'not-your-turn': 'It is not your turn.',
  'unknown-player': 'Unknown player.',
  'card-not-in-hand': 'You do not hold those cards.',
  'invalid-play': 'That is not a legal play.',
  'cannot-beat': 'That does not beat the current play.',
  'cannot-pass': 'You must play when you lead a trick.',
  'no-pending-exchange': 'You have nothing to exchange.',
  'wrong-card-count': 'Wrong number of cards.',
  'not-enough-players': 'You need at least three players to start.',
  internal: 'Something went wrong on the server.',
}
