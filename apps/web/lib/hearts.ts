import type { SeatView } from '@cards/shared'

export interface RelativeSeats {
  you: SeatView | null
  left: SeatView | null
  across: SeatView | null
  right: SeatView | null
}

/**
 * Put the table on screen from the viewer's own chair. Turn order runs
 * clockwise, so the next seat is on your left and the one after that is
 * opposite you — which is also the order a trick's cards land in.
 */
export function relativeSeats(seats: readonly SeatView[], youId: string | null): RelativeSeats {
  const mine = seats.findIndex((seat) => seat.id === youId)
  if (mine === -1) {
    return {
      you: null,
      left: seats[0] ?? null,
      across: seats[1] ?? null,
      right: seats[2] ?? null,
    }
  }
  const at = (offset: number) => seats[(mine + offset) % seats.length] ?? null
  return { you: at(0), left: at(1), across: at(2), right: at(3) }
}

/** Where this round's three cards are going. */
export const PASS_LABEL: Readonly<Record<string, string>> = {
  left: 'ส่งไปทางซ้าย',
  right: 'ส่งไปทางขวา',
  across: 'ส่งไปฝั่งตรงข้าม',
  none: 'รอบนี้ไม่ต้องส่งไพ่',
}
