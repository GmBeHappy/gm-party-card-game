import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@cards/shared'

export function generateRoomCode(exists: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = ''
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)
      code += ROOM_CODE_ALPHABET[index] ?? 'A'
    }
    if (!exists(code)) return code
  }
  throw new Error('could not allocate a free room code')
}

export function generatePlayerId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16)
}
