export const PORT = Number(process.env.PORT ?? 3001)

/** What `bun dev` falls back to. It is committed, so it is public knowledge. */
export const DEV_SESSION_SECRET = 'dev-secret-change-me'

/**
 * The secret that signs seat tokens.
 *
 * A seat token is the only thing proving a returning connection owns its seat,
 * so anyone who knows this value can forge one for any player in any room and
 * take over their seat — see their hand, play their cards. A committed default
 * is fine for `bun dev` on your own machine and is an authentication bypass
 * anywhere else, so production refuses to start rather than falling back to it.
 */
export function resolveSessionSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const secret = env.SESSION_SECRET?.trim()
  const usable = secret !== undefined && secret !== '' && secret !== DEV_SESSION_SECRET
  if (usable) return secret
  if (env.NODE_ENV !== 'production') return DEV_SESSION_SECRET

  throw new Error(
    'SESSION_SECRET is missing, empty, or still the development default. It ' +
      'signs the seat tokens that prove a returning player owns their seat, so ' +
      'a known value lets anyone take over any seat in any room. Generate one ' +
      'with:  openssl rand -hex 32',
  )
}

/*
 * Throwing at import time prints a bundled source frame rather than the
 * message, so the failure is captured here and reported by the entrypoint,
 * which can say one clear line and exit. Nothing starts either way.
 */
const resolved = ((): { secret: string; error: string | null } => {
  try {
    return { secret: resolveSessionSecret(), error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { secret: DEV_SESSION_SECRET, error: message }
  }
})()

export const SESSION_SECRET = resolved.secret
/** Non-null when the process must not serve traffic. */
export const CONFIG_ERROR = resolved.error

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
