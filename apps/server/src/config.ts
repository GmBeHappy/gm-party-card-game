export const PORT = Number(process.env.PORT ?? 3001)
export const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-secret-change-me'

/** A room with nobody connected is dropped after this long. */
export const ROOM_TTL_MS = 10 * 60 * 1000
export const GC_INTERVAL_MS = 60 * 1000

/**
 * Pacing knobs, grouped in one mutable object so tests can speed the clock up
 * without reaching into module internals or waiting out real bot pauses.
 */
export const timings = {
  /** How long a bot "thinks" before acting, so play stays readable. */
  botDelayMs: Number(process.env.BOT_DELAY_MS ?? 900),
  /**
   * A disconnected player's turn resolves on this timer even when the room has
   * no turn clock, so one dropped connection can never stall a match.
   */
  disconnectedTurnMs: Number(process.env.DISCONNECTED_TURN_MS ?? 5_000),
}
