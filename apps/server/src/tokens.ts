import { createHmac, timingSafeEqual } from 'node:crypto'
import { SESSION_SECRET } from './config'

/**
 * A seat token is `playerId.roomCode.signature`. It is the only thing that
 * proves a returning connection owns a seat, so it is signed server-side —
 * a client cannot mint one for somebody else's seat.
 */
export function signToken(playerId: string, roomCode: string): string {
  const body = `${playerId}.${roomCode}`
  return `${body}.${sign(body)}`
}

export function verifyToken(token: string, roomCode: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [playerId, tokenRoom, signature] = parts
  if (playerId === undefined || tokenRoom === undefined || signature === undefined) return null
  if (tokenRoom !== roomCode) return null

  const expected = sign(`${playerId}.${tokenRoom}`)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return playerId
}

function sign(body: string): string {
  return createHmac('sha256', SESSION_SECRET).update(body).digest('base64url')
}
