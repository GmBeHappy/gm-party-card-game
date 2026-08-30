# Hearts as a Second Game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hearts (โพแดง) alongside the existing Daifugō game (สลาฟ), so one room, one code, and one reconnect path serve either game.

**Architecture:** `packages/game` splits into a game-agnostic `core/` plus `slave/` and `hearts/` modules implementing one `GameModule` interface. `GameState` becomes a union discriminated on a `game` field. The server's room layer resolves the module from the state and calls through it; the socket, timer, reconnect and host-migration code is generalised, not rewritten. `RoomView` keeps a shared envelope and hangs each game's slice off a discriminated `table` field.

**Tech Stack:** Bun workspaces, TypeScript (strict, `noUncheckedIndexedAccess`), Vitest (engine), `bun test` (server integration), Elysia + WebSocket, Next.js 16 App Router, Tailwind v4, shadcn/ui on Radix, Motion, Biome.

**Spec:** `docs/superpowers/specs/2026-08-31-hearts-multi-game-design.md` — read it before starting. This plan implements it and argues from it.

## Global Constraints

- **Package names** are `@cards/game` and `@cards/shared` after Task 1. Never write `@slave/*` in new code.
- **Card ranks** are standard `2..14` (ace high) after Task 3. Card ids are `rank + suit`: `2C`, `10H`, `14D`, `12S`. Daifugō's `2`-is-highest order lives only in `slave/order.ts`.
- **The engine is I/O-free.** Nothing under `packages/game` imports from `@cards/shared`, `apps/server`, or `apps/web`. Redaction lives in `@cards/shared`.
- **All interface copy is Thai.** Hearts is **โพแดง**. Suit names already exist in `playing-card.tsx`: โพดำ / โพแดง / ข้าวหลามตัด / ดอกจิก.
- **Hearts is exactly 4 players.** `minPlayers === maxPlayers === 4`. Slave stays 3–6.
- **Hearts rule set is fixed** — no ♦J, no ♠Q-breaks-hearts, no take-minus-26. Only `turnSeconds` and `targetScore` (50 / 100 / 200, default 100) are configurable.
- **Formatting:** Biome — single quotes, no semicolons, trailing commas, 2-space indent, 100-column lines. Run `bun run check:fix` before every commit.
- **Every task ends green** on the commands its verification step names. Tasks 1–8 must additionally leave all 99 existing Slave engine tests and 11 server integration tests passing.

### Commands

```bash
bun test                              # engine (vitest) + server (bun test)
bun run --cwd packages/game test      # engine only
bun run --cwd apps/server test        # server only
bun run typecheck                     # all workspaces
bun run check                         # Biome lint + format check
bun run check:fix                     # Biome autofix
bun run build                         # production build of apps/web
```

### Screenshotting the web app

The Chrome browser extension does not work in this environment. Verify UI tasks
with headless Chrome:

```bash
bun dev &                             # web on :3000, server on :3001
sleep 8
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars \
  --window-size=430,932 \
  --screenshot="$SCRATCH/shot.png" \
  http://localhost:3000
```

Use a phone-sized window (430×932) — the table is designed mobile-first. Read the
PNG back with the Read tool and look at it before claiming a UI task is done.

---

## File Structure

### `packages/game` after the split

| Path | Responsibility |
| --- | --- |
| `src/core/card.ts` | `Suit`, `Rank` (2–14), `Card`, `SUITS`, `RANKS`, `createDeck`, `shuffle`, `deal`, `rankLabel`, `cardLabel`. No game order. |
| `src/core/rng.ts` | Seeded RNG. Moved unchanged. |
| `src/core/player.ts` | `Player`, `PlayerId`, seat-order walking. |
| `src/core/scoring.ts` | `addScores`, `standings(scores, seatOrder, direction)`. |
| `src/core/phase.ts` | `Phase`, `RoundResult`, `BaseState`. |
| `src/core/module.ts` | `GameKind`, `Action`, `ActionError`, `GameEvent`, `ActionResult`, `EngineContext`, `GameModule`. |
| `src/slave/order.ts` | `daifugoOrder`, `strength`, `sortHand`. |
| `src/slave/types.ts` | `SlaveState`, `SlaveSettings`, `Play`, `PlayKind`, `RoleName`, `Trick`, `ExchangeTransfer`, `ExchangeState`. |
| `src/slave/plays.ts` `roles.ts` `exchange.ts` `scoring.ts` `bot.ts` `engine.ts` | Existing Daifugō rules, moved. |
| `src/slave/index.ts` | `slaveModule: GameModule<SlaveState, SlaveSettings>`. |
| `src/hearts/types.ts` | `HeartsState`, `HeartsSettings`, `PassDirection`, `PassingState`, `HeartsTrick`. |
| `src/hearts/order.ts` | `sortHand` by suit then rank. |
| `src/hearts/passing.ts` | `passDirection`, `passTarget`, `applyPasses`. |
| `src/hearts/tricks.ts` | `legalCards`, `trickWinner`, `isPenalty`, `cardPoints`. |
| `src/hearts/scoring.ts` | `roundScores`, `reachedTarget`. |
| `src/hearts/bot.ts` | `chooseHeartsAction`. |
| `src/hearts/engine.ts` | `reduce`, `startRound`, timeouts. |
| `src/hearts/index.ts` | `heartsModule: GameModule<HeartsState, HeartsSettings>`. |
| `src/index.ts` | `GAMES` registry, `GameState` union, re-exports. |

### `packages/shared`

| Path | Responsibility |
| --- | --- |
| `src/protocol.ts` | Zod schemas, `ERROR_CODES`, `ERROR_MESSAGES`. Gains `setGame`, per-game settings schemas, Hearts error codes. |
| `src/view.ts` | `RoomView` envelope, `SeatView`, `YouView`, `buildRoomView`. |
| `src/views/slave.ts` | `SlaveTable`, `buildSlaveTable`. |
| `src/views/hearts.ts` | `HeartsTable`, `buildHeartsTable`. |
| `src/messages.ts` | `ServerMessage`. Unchanged in shape. |

### `apps/web/components/game`

Shared and untouched: `hand.tsx`, `playing-card.tsx`, `seat.tsx`, `identicon.tsx`, `turn-ring.tsx`, `sound-controls.tsx`, `reconnect-overlay.tsx`, `table-flash.tsx`.

| Path | Responsibility |
| --- | --- |
| `slave/table-screen.tsx` `slave/exchange-screen.tsx` `slave/round-summary.tsx` `slave/trick-pile.tsx` | Existing screens, moved and re-pointed at `view.table`. |
| `hearts/passing-screen.tsx` | Pick exactly three, direction named. |
| `hearts/table-screen.tsx` | The Hearts table. |
| `hearts/trick-circle.tsx` | Four cards laid around a centre, anchored per seat. |
| `hearts/round-summary.tsx` | Points taken, moon-shot callout, target-score progress. |
| `game-picker.tsx` | The two game stickers on the landing screen. |

---

## Stage 1 — Core split, rank scheme, rename

No behaviour changes. Slave is still the only game. The 99 engine tests and 11
integration tests are the safety net for the whole plan; they must stay green.

### Task 1: Rename `@slave/*` packages to `@cards/*`

**Files:**
- Modify: `packages/game/package.json`, `packages/shared/package.json`, `apps/server/package.json`, `apps/web/package.json`
- Modify: every `.ts`/`.tsx` importing `@slave/game` or `@slave/shared`

**Interfaces:**
- Consumes: nothing.
- Produces: the module specifiers `@cards/game` and `@cards/shared`. Every later task imports from these.

- [ ] **Step 1: Rewrite the package names**

```bash
cd /Users/gm/gm/slave-card-game
sed -i '' 's|"@slave/game"|"@cards/game"|g; s|"@slave/shared"|"@cards/shared"|g; s|"@slave/server"|"@cards/server"|g' \
  packages/game/package.json packages/shared/package.json apps/server/package.json apps/web/package.json
```

- [ ] **Step 2: Rewrite every import specifier**

```bash
grep -rl "@slave/" --include='*.ts' --include='*.tsx' packages apps \
  | grep -v node_modules \
  | xargs sed -i '' "s|@slave/game|@cards/game|g; s|@slave/shared|@cards/shared|g"
```

- [ ] **Step 3: Re-resolve the workspace links**

Run: `bun install`
Expected: succeeds, `bun.lock` updates.

- [ ] **Step 4: Verify nothing references the old names**

Run: `grep -rn "@slave/" --include='*.ts' --include='*.tsx' --include='*.json' packages apps | grep -v node_modules`
Expected: no output.

- [ ] **Step 5: Verify the suite is still green**

Run: `bun run typecheck && bun test && bun run check`
Expected: typecheck clean, 99 engine tests pass, 11 server tests pass, Biome clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename @slave/* packages to @cards/*"
```

---

### Task 2: Split `packages/game/src` into `core/` and `slave/`

Pure file moves and import rewiring. **No type renames and no logic changes** —
those come in Tasks 3 and 4. `src/index.ts` re-exports exactly what it does
today, so nothing outside `packages/game` changes.

**Files:**
- Create: `packages/game/src/core/card.ts`, `core/rng.ts`, `core/player.ts`, `core/phase.ts`
- Create: `packages/game/src/slave/order.ts`, `slave/types.ts`, `slave/plays.ts`, `slave/roles.ts`, `slave/exchange.ts`, `slave/scoring.ts`, `slave/bot.ts`, `slave/engine.ts`
- Delete: `packages/game/src/cards.ts`, `rng.ts`, `types.ts`, `plays.ts`, `roles.ts`, `exchange.ts`, `scoring.ts`, `bot.ts`, `engine.ts`
- Modify: `packages/game/src/index.ts`
- Modify: `packages/game/test/*.ts` (import paths only)

**Interfaces:**
- Consumes: `@cards/game` from Task 1.
- Produces: `core/card.ts` exporting `Suit`, `SUITS`, `CardRank`, `RANKS`, `Card`, `createDeck`, `shuffle`, `deal`, `rankLabel`, `cardLabel`. `core/player.ts` exporting `Player`, `PlayerId`. `core/phase.ts` exporting `Phase`, `RoundResult`. `slave/order.ts` exporting `strength`, `sortHand`. Everything else keeps its current name and signature.

- [ ] **Step 1: Move the files that need no editing**

```bash
cd packages/game/src
mkdir -p core slave
git mv rng.ts core/rng.ts
git mv plays.ts slave/plays.ts
git mv roles.ts slave/roles.ts
git mv exchange.ts slave/exchange.ts
git mv scoring.ts slave/scoring.ts
git mv bot.ts slave/bot.ts
git mv engine.ts slave/engine.ts
git mv cards.ts core/card.ts
git mv types.ts slave/types.ts
```

- [ ] **Step 2: Carve the shared types out of `slave/types.ts` into `core/`**

Create `packages/game/src/core/player.ts`:

```ts
export type PlayerId = string

export interface Player {
  readonly id: PlayerId
  readonly name: string
  readonly isBot: boolean
  readonly connected: boolean
}
```

Create `packages/game/src/core/phase.ts`:

```ts
import type { PlayerId } from './player'

export type Phase = 'lobby' | 'exchange' | 'playing' | 'roundEnd' | 'matchEnd'

export interface RoundResult {
  readonly round: number
  readonly finishOrder: readonly PlayerId[]
  readonly points: Readonly<Record<PlayerId, number>>
}
```

Then delete `PlayerId`, `Player`, `Phase` and `RoundResult` from `slave/types.ts`
and re-import them there:

```ts
import type { Phase, RoundResult } from '../core/phase'
import type { Player, PlayerId } from '../core/player'
```

Move `Suit`, `SUITS`, `CardRank`, `RANKS` and `Card` from `slave/types.ts` into
`core/card.ts` (they belong with the deck), and have `slave/types.ts` import
`Card` and `CardRank` from `../core/card`. Leave `TWO_RANK`, `EIGHT_RANK` and
`THREE_RANK` in `slave/types.ts` — they are Daifugō's, not the deck's.

- [ ] **Step 3: Move `strength` and `sortHand` out of the deck**

Create `packages/game/src/slave/order.ts` with the two functions currently at the
bottom of `core/card.ts`, moved verbatim:

```ts
import { type Card, SUITS } from '../core/card'

/** Effective strength under the current revolution state. */
export function strength(card: Card, revolution: boolean): number {
  return revolution ? -card.rank : card.rank
}

/** Sort by play strength, then by suit, so hands render in a stable order. */
export function sortHand(cards: readonly Card[], revolution = false): Card[] {
  return [...cards].sort((a, b) => {
    const diff = strength(a, revolution) - strength(b, revolution)
    if (diff !== 0) return diff
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
  })
}
```

Delete both from `core/card.ts`.

- [ ] **Step 4: Fix every import inside `packages/game`**

Within `slave/*.ts`, sibling imports stay `./plays`, `./roles`, etc.; deck and
player imports become `../core/card`, `../core/rng`, `../core/player`,
`../core/phase`. `strength`/`sortHand` come from `./order`.

Rewrite `packages/game/src/index.ts` so the public surface is unchanged:

```ts
export * from './core/card'
export * from './core/phase'
export * from './core/player'
export * from './core/rng'
export * from './slave/bot'
export * from './slave/engine'
export * from './slave/exchange'
export * from './slave/order'
export * from './slave/plays'
export * from './slave/roles'
export * from './slave/scoring'
export * from './slave/types'
```

- [ ] **Step 5: Fix the test imports**

```bash
cd /Users/gm/gm/slave-card-game/packages/game
sed -i '' \
  "s|'../src/cards'|'../src/core/card'|g; \
   s|'../src/rng'|'../src/core/rng'|g; \
   s|'../src/types'|'../src/slave/types'|g; \
   s|'../src/plays'|'../src/slave/plays'|g; \
   s|'../src/roles'|'../src/slave/roles'|g; \
   s|'../src/exchange'|'../src/slave/exchange'|g; \
   s|'../src/scoring'|'../src/slave/scoring'|g; \
   s|'../src/bot'|'../src/slave/bot'|g; \
   s|'../src/engine'|'../src/slave/engine'|g" \
  test/*.ts
```

Some tests import `strength`/`sortHand` from `../src/cards`; those now come from
`../src/slave/order`. Fix them by hand where the compiler points.

- [ ] **Step 6: Verify**

Run: `bun run typecheck && bun test && bun run check`
Expected: typecheck clean, 99 engine tests pass, 11 server tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(game): split src into core/ and slave/"
```

---

### Task 3: Standard ranks, with Daifugō's order in `slave/order.ts`

The deck stops being Daifugō-shaped. `CardRank` becomes `2..14`; the `2`-is-top
ordering moves into `slave/order.ts`. Slave's behaviour is unchanged.

**Files:**
- Modify: `packages/game/src/core/card.ts`
- Modify: `packages/game/src/slave/order.ts`, `slave/types.ts`, `slave/bot.ts`
- Modify: `packages/game/test/*.ts` (card ids `15X` → `2X`)

**Interfaces:**
- Consumes: `core/card.ts` and `slave/order.ts` from Task 2.
- Produces: `CardRank = 2 | 3 | … | 14`; card id format `${rank}${suit}`; `daifugoOrder(rank: CardRank): number` exported from `slave/order.ts`. Hearts (Task 9 onward) relies on `card.rank` being the plain standard rank.

- [ ] **Step 1: Write the failing tests**

Append to `packages/game/test/cards.test.ts`:

```ts
describe('standard ranks', () => {
  it('runs 2 to 14 with the ace high', () => {
    expect(RANKS[0]).toBe(2)
    expect(RANKS.at(-1)).toBe(14)
    expect(RANKS).toHaveLength(13)
  })

  it('ids a card as rank plus suit', () => {
    expect(c('2C').rank).toBe(2)
    expect(c('14S').rank).toBe(14)
    expect(cardLabel(c('14S'))).toBe('AS')
    expect(rankLabel(2)).toBe('2')
  })
})
```

Append to `packages/game/test/plays.test.ts`:

```ts
describe('daifugo order', () => {
  it('puts the 2 above the ace and the 3 at the bottom', () => {
    expect(daifugoOrder(2)).toBeGreaterThan(daifugoOrder(14))
    expect(daifugoOrder(3)).toBeLessThan(daifugoOrder(4))
  })

  it('still lets a 2 beat an ace', () => {
    expect(canBeat(play('2C'), play('14C'), false)).toBe(true)
    expect(canBeat(play('14C'), play('2C'), false)).toBe(false)
  })
})
```

Import `daifugoOrder` from `../src/slave/order` and `cardLabel`, `RANKS`,
`rankLabel` from `../src/core/card` at the top of those files.

- [ ] **Step 2: Run to verify they fail**

Run: `bun run --cwd packages/game test`
Expected: FAIL — `daifugoOrder` is not exported, `RANKS[0]` is 3, `c('2C')` throws `no such card: 2C`.

- [ ] **Step 3: Make the deck standard**

In `packages/game/src/core/card.ts`:

```ts
/**
 * Numeric card ranks, 2 low through 14 (the ace) high — the order a plain deck
 * has. Games that want a different order supply their own, as `slave/order.ts`
 * does for Daifugō. This deck has no Jokers.
 */
export type CardRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export const RANKS: readonly CardRank[] = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
] as const

const RANK_LABELS: Readonly<Record<number, string>> = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
}
```

`rankLabel`, `cardLabel`, `createDeck`, `shuffle` and `deal` are unchanged —
`createDeck` already builds ids as `${rank}${suit}`.

- [ ] **Step 4: Move Daifugō's order into `slave/order.ts`**

```ts
import { type Card, type CardRank, SUITS } from '../core/card'

/**
 * Daifugō's ladder: 3 < 4 < … < K < A < 2. The deck is ordered 2 low, so the
 * 2 is lifted above the ace here and nowhere else.
 */
export function daifugoOrder(rank: CardRank): number {
  return rank === 2 ? 15 : rank
}

/** Effective strength under the current revolution state. */
export function strength(card: Card, revolution: boolean): number {
  const order = daifugoOrder(card.rank)
  return revolution ? -order : order
}
```

`sortHand` is unchanged — it already goes through `strength`.

- [ ] **Step 5: Fix the two rank constants that moved**

In `packages/game/src/slave/types.ts`:

```ts
/** The strongest card in Daifugō, which is the deck's lowest rank. */
export const TWO_RANK = 2 as const
export const EIGHT_RANK = 8 as const
export const THREE_RANK = 3 as const
```

In `packages/game/src/slave/bot.ts`, `isPremium` becomes:

```ts
/** A 2 (or a 3 under revolution) is worth hoarding rather than spending. */
function isPremium(play: Play, revolution: boolean): boolean {
  const card = play.cards[0]
  if (card === undefined) return false
  return revolution ? card.rank === 3 : card.rank === 2
}
```

- [ ] **Step 6: Rewrite the card ids in the tests**

```bash
cd /Users/gm/gm/slave-card-game/packages/game
sed -i '' "s/'15\([CDHS]\)'/'2\1'/g" test/*.ts
sed -i '' "s|c('15D')|c('2D')|g" test/helpers.ts
```

Then read `test/helpers.ts` and fix the doc comment on `c()` — it should read
``` `c('3S')`, `c('10H')`, `c('2D')` ```.

- [ ] **Step 7: Run the tests**

Run: `bun run --cwd packages/game test`
Expected: PASS — all 99 original tests plus the 4 new ones. If an assertion about
sort order fails, the expectation string still holds a `15`; fix the expectation,
not the implementation.

- [ ] **Step 8: Verify the whole suite and commit**

Run: `bun run typecheck && bun test && bun run check:fix`

```bash
git add -A
git commit -m "refactor(game): standard 2-14 deck, Daifugo order in slave/order"
```

---
## Stage 2 — The module seam

Still no Hearts. This stage introduces `GameModule`, the `game` discriminant, and
the split view, with Slave as the only implementation.

**A deliberate trick:** `GameKind` is introduced as `'slave'` alone and widened to
`'slave' | 'hearts'` in Task 13. Every switch stays exhaustive at every stage, and
when Hearts joins the union the compiler enumerates precisely what Tasks 13–15
still have to fill in. Do not pre-add `'hearts'` to the union.

### Task 4: `GameModule`, `BaseState`, and the registry

**Files:**
- Create: `packages/game/src/core/module.ts`, `packages/game/src/slave/index.ts`
- Modify: `packages/game/src/core/phase.ts`, `slave/types.ts`, `slave/engine.ts`, `slave/scoring.ts`, `slave/bot.ts`, `src/index.ts`
- Test: `packages/game/test/module.test.ts` (new), and fixes to existing tests

**Interfaces:**
- Consumes: `core/card.ts`, `core/player.ts`, `core/phase.ts`, `slave/*` from Tasks 2–3.
- Produces:
  - `GameKind = 'slave'`
  - `BaseState`, `EngineContext`, `Action`, `ActionError`, `GameEvent`, `ActionResult<S>`, `GameModule<S, Settings>` from `core/module.ts`
  - `SlaveState` (was `GameState`), `SlaveSettings` (was `RoomSettings`), `DEFAULT_SLAVE_SETTINGS` (was `DEFAULT_SETTINGS`)
  - `slaveModule: GameModule<SlaveState, SlaveSettings>`
  - From `src/index.ts`: `GameState`, `GAME_META`, `createStateFor`, `reduceGame`, `seatPlayersIn`, `setConnectedIn`, `applySettingsIn`, `botActionFor`, `waitingOnIn`

- [ ] **Step 1: Write the failing test**

Create `packages/game/test/module.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  botActionFor,
  createStateFor,
  GAME_META,
  reduceGame,
  waitingOnIn,
} from '../src/index'
import { makePlayers, ctx } from './helpers'

describe('the game registry', () => {
  it('describes slave as a 3-to-6 player game where high scores win', () => {
    expect(GAME_META.slave).toMatchObject({
      kind: 'slave',
      minPlayers: 3,
      maxPlayers: 6,
      scoreDirection: 'high',
    })
  })

  it('builds a lobby state tagged with its game', () => {
    const state = createStateFor('slave', makePlayers(4))
    expect(state.game).toBe('slave')
    expect(state.phase).toBe('lobby')
    expect(state.version).toBe(0)
  })

  it('drives a match through the union without narrowing at the call site', () => {
    const state = createStateFor('slave', makePlayers(4))
    const result = reduceGame(state, { type: 'startMatch' }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.phase).toBe('playing')
    expect(Object.keys(result.state.hands)).toHaveLength(4)
  })

  it('has nobody to wait on outside a simultaneous phase', () => {
    const state = createStateFor('slave', makePlayers(4))
    expect(waitingOnIn(state)).toEqual([])
  })

  it('offers a bot an action on its own turn and none otherwise', () => {
    const started = reduceGame(createStateFor('slave', makePlayers(4)), { type: 'startMatch' }, ctx())
    if (!started.ok) throw new Error('failed to start')
    const state = started.state
    const turn = state.currentPlayer
    if (turn === null) throw new Error('no current player')
    expect(botActionFor(state, turn)).not.toBeNull()
    const other = state.players.find((p) => p.id !== turn)?.id ?? ''
    expect(botActionFor(state, other)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run --cwd packages/game test test/module.test.ts`
Expected: FAIL — none of `GAME_META`, `createStateFor`, `reduceGame`, `waitingOnIn`, `botActionFor` exist.

- [ ] **Step 3: Write `core/module.ts`**

```ts
import type { Card } from './card'
import type { Phase, RoundResult } from './phase'
import type { Player, PlayerId } from './player'
import type { Rng } from './rng'

/** Widened as games are added. Keeping it exact keeps every switch exhaustive. */
export type GameKind = 'slave'

export interface EngineContext {
  readonly now: number
  readonly rng: Rng
}

/**
 * What every game's state has in common — the parts the room layer touches
 * without knowing the rules: who is seated, whose turn it is, what the clocks
 * say, and the score.
 */
export interface BaseState {
  readonly game: GameKind
  readonly phase: Phase
  readonly players: readonly Player[]
  readonly round: number
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>
  readonly scores: Readonly<Record<PlayerId, number>>
  readonly currentPlayer: PlayerId | null
  readonly turnDeadline: number | null
  /** Deadline for a simultaneous phase — a tribute or a Hearts pass. */
  readonly phaseDeadline: number | null
  readonly history: readonly RoundResult[]
  readonly version: number
}

/**
 * Every intent any game accepts. `exchangeChoose` covers both the Daifugō
 * tribute and the Hearts pass — same phase, same wire message, same timer.
 */
export type Action =
  | { readonly type: 'startMatch' }
  | { readonly type: 'play'; readonly playerId: PlayerId; readonly cardIds: readonly string[] }
  | { readonly type: 'pass'; readonly playerId: PlayerId }
  | {
      readonly type: 'exchangeChoose'
      readonly playerId: PlayerId
      readonly cardIds: readonly string[]
    }
  | { readonly type: 'timeout' }
  | { readonly type: 'nextRound' }
  | { readonly type: 'endMatch' }

export type ActionError =
  // shared
  | 'wrong-phase'
  | 'not-your-turn'
  | 'unknown-player'
  | 'card-not-in-hand'
  | 'invalid-play'
  | 'no-pending-exchange'
  | 'wrong-card-count'
  | 'not-enough-players'
  | 'wrong-game'
  // slave
  | 'cannot-beat'
  | 'cannot-pass'
  // hearts
  | 'must-follow-suit'
  | 'must-lead-clubs-two'
  | 'hearts-not-broken'
  | 'no-points-first-trick'

/**
 * Everything a game can announce. The web turns these into sound and flashes;
 * the server just forwards them. `played` carries card ids rather than a shape
 * so the type stays free of any one game's notion of a play.
 */
export type GameEvent =
  // shared
  | { readonly type: 'dealt'; readonly round: number }
  | { readonly type: 'exchangeStarted' }
  | { readonly type: 'exchangeResolved' }
  | {
      readonly type: 'played'
      readonly playerId: PlayerId
      readonly cardIds: readonly string[]
    }
  | { readonly type: 'trickCleared'; readonly leader: PlayerId | null }
  | { readonly type: 'turnChanged'; readonly playerId: PlayerId | null }
  | { readonly type: 'roundEnded'; readonly round: number }
  | { readonly type: 'matchEnded' }
  // slave
  | { readonly type: 'passed'; readonly playerId: PlayerId }
  | { readonly type: 'eightCut'; readonly playerId: PlayerId }
  | { readonly type: 'revolution'; readonly playerId: PlayerId; readonly active: boolean }
  | { readonly type: 'playerFinished'; readonly playerId: PlayerId; readonly place: number }
  // hearts
  | { readonly type: 'trickTaken'; readonly playerId: PlayerId; readonly points: number }
  | { readonly type: 'heartsBroken'; readonly playerId: PlayerId }
  | { readonly type: 'moonShot'; readonly playerId: PlayerId }

export type ActionResult<S> =
  | { readonly ok: true; readonly state: S; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: ActionError }

/** One game's rules, and nothing else. No sockets, no views, no React. */
export interface GameModule<S extends BaseState, Settings> {
  readonly kind: GameKind
  readonly minPlayers: number
  readonly maxPlayers: number
  /** Which end of the scoreboard wins. Daifugō: high. Hearts: low. */
  readonly scoreDirection: 'high' | 'low'
  readonly defaultSettings: Settings
  createInitialState(players: readonly Player[], settings: Settings): S
  applySettings(state: S, patch: Partial<Settings>): S
  seatPlayers(state: S, players: readonly Player[]): S
  setConnected(state: S, playerId: PlayerId, connected: boolean): S
  reduce(state: S, action: Action, ctx: EngineContext): ActionResult<S>
  /** What a bot in this seat should do now, in whatever phase. Null if nothing. */
  botAction(state: S, playerId: PlayerId): Action | null
  /** During a simultaneous phase, the seats still to act. Empty otherwise. */
  waitingOn(state: S): readonly PlayerId[]
}
```

- [ ] **Step 4: Narrow `RoundResult` and rename Slave's types**

In `core/phase.ts`, drop `finishOrder` — the scoreboard only ever renders points:

```ts
export interface RoundResult {
  readonly round: number
  readonly points: Readonly<Record<PlayerId, number>>
}
```

In `slave/types.ts`: rename `RoomSettings` → `SlaveSettings`, `DEFAULT_SETTINGS` →
`DEFAULT_SLAVE_SETTINGS`, and `GameState` → `SlaveState`. `SlaveState` now extends
`BaseState`, so it declares `game: 'slave'`, adds `phaseDeadline`, and keeps its
own `settings`, `trick`, `revolution`, `finishOrder`, `roles` and `exchange`:

```ts
export interface SlaveState extends BaseState {
  readonly game: 'slave'
  readonly settings: SlaveSettings
  readonly trick: Trick
  readonly revolution: boolean
  /** Players who have emptied their hand this round, in finishing order. */
  readonly finishOrder: readonly PlayerId[]
  /** Roles carried from the previous round; drives the exchange phase. */
  readonly roles: Readonly<Record<PlayerId, RoleName>>
  readonly exchange: ExchangeState | null
}
```

Drop `deadline` from `ExchangeState` — the exchange clock is now `phaseDeadline`:

```ts
export interface ExchangeState {
  readonly transfers: readonly ExchangeTransfer[]
}
```

- [ ] **Step 5: Update `slave/engine.ts` for the renames**

Mechanical throughout: `GameState` → `SlaveState`, `RoomSettings` → `SlaveSettings`,
`DEFAULT_SETTINGS` → `DEFAULT_SLAVE_SETTINGS`. Delete the local `Action`,
`ActionError`, `GameEvent`, `ActionResult` and `EngineContext` declarations and
import them from `../core/module` instead. Four substantive edits:

1. `createInitialState` sets the new fields:

```ts
return {
  game: 'slave',
  phase: 'lobby',
  settings,
  players: [...players],
  round: 0,
  hands: {},
  trick: { current: null, leader: null, passed: [] },
  revolution: false,
  currentPlayer: null,
  turnDeadline: null,
  phaseDeadline: null,
  finishOrder: [],
  roles: {},
  scores: Object.fromEntries(players.map((p) => [p.id, 0])),
  exchange: null,
  history: [],
  version: 0,
}
```

2. Where `startRound` opened the exchange, the deadline moves:

```ts
events.push({ type: 'exchangeStarted' })
return {
  ok: true,
  state: {
    ...withHands,
    phase: 'exchange',
    exchange: { transfers },
    phaseDeadline: ctx.now + EXCHANGE_SECONDS * 1000,
  },
  events,
}
```

and `beginPlay` clears it with `phaseDeadline: null`.

3. `doTimeout`'s exchange branch reads `state.exchange.transfers` and no longer
   touches a deadline field.

4. `finishRound` writes the narrowed `RoundResult` and `doPlay` emits card ids:

```ts
const history = [...state.history, { round: state.round, points }]
```

```ts
const events: GameEvent[] = [
  { type: 'played', playerId, cardIds: cards.map((card) => card.id) },
]
```

- [ ] **Step 6: Give `standings` a direction**

In `slave/scoring.ts`, move `standings` to `core/scoring.ts` (a new file) together
with `addScores`, and add the direction. `roundPoints` stays in `slave/scoring.ts`.

```ts
import type { PlayerId } from './player'

export function addScores(
  scores: Readonly<Record<PlayerId, number>>,
  points: Readonly<Record<PlayerId, number>>,
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = { ...scores }
  for (const [id, value] of Object.entries(points)) {
    out[id] = (out[id] ?? 0) + value
  }
  return out
}

/**
 * Standings, best first. Daifugō wants the highest score at the top and Hearts
 * the lowest, so the direction is the caller's. Ties break on seat order either
 * way, which keeps the board stable between renders.
 */
export function standings(
  scores: Readonly<Record<PlayerId, number>>,
  seatOrder: readonly PlayerId[],
  direction: 'high' | 'low' = 'high',
): { playerId: PlayerId; score: number }[] {
  return seatOrder
    .map((playerId) => ({ playerId, score: scores[playerId] ?? 0 }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return direction === 'high' ? b.score - a.score : a.score - b.score
      }
      return seatOrder.indexOf(a.playerId) - seatOrder.indexOf(b.playerId)
    })
}
```

- [ ] **Step 7: Write `slave/index.ts`**

`botAction` folds the two existing bot entry points into one, so the server no
longer has to know which phase calls which.

```ts
import type { GameModule } from '../core/module'
import { chooseBotAction, chooseBotExchange } from './bot'
import {
  createInitialState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  reduce,
  seatPlayers,
  setConnected,
} from './engine'
import { pendingTransfers } from './exchange'
import { DEFAULT_SLAVE_SETTINGS, type SlaveSettings, type SlaveState } from './types'

export const slaveModule: GameModule<SlaveState, SlaveSettings> = {
  kind: 'slave',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  scoreDirection: 'high',
  defaultSettings: DEFAULT_SLAVE_SETTINGS,
  createInitialState,
  applySettings: (state, patch) => ({
    ...state,
    settings: { ...state.settings, ...patch },
    version: state.version + 1,
  }),
  seatPlayers,
  setConnected,
  reduce,
  botAction(state, playerId) {
    if (state.phase === 'exchange' && state.exchange !== null) {
      const mine = pendingTransfers(state.exchange.transfers).find((t) => t.from === playerId)
      return mine === undefined ? null : chooseBotExchange(state, playerId, mine.count)
    }
    if (state.phase !== 'playing' || state.currentPlayer !== playerId) return null
    return chooseBotAction(state, playerId)
  },
  waitingOn(state) {
    if (state.phase !== 'exchange' || state.exchange === null) return []
    return pendingTransfers(state.exchange.transfers).map((transfer) => transfer.from)
  },
}
```

- [ ] **Step 8: Write the registry in `src/index.ts`**

The narrow-and-delegate helpers exist because TypeScript cannot dispatch a union
of modules across a union of states. Eight small wrappers cost less than fighting
the generics, and they keep every call site free of casts.

```ts
export * from './core/card'
export * from './core/module'
export * from './core/phase'
export * from './core/player'
export * from './core/rng'
export * from './core/scoring'
export * from './slave/bot'
export * from './slave/engine'
export * from './slave/exchange'
export * from './slave/index'
export * from './slave/order'
export * from './slave/plays'
export * from './slave/roles'
export * from './slave/scoring'
export * from './slave/types'

import type {
  Action,
  ActionResult,
  EngineContext,
  GameKind,
  GameModule,
} from './core/module'
import type { Player, PlayerId } from './core/player'
import { slaveModule } from './slave/index'
import type { SlaveSettings, SlaveState } from './slave/types'

/** The authoritative state of any room, discriminated on `game`. */
export type GameState = SlaveState

/** Static facts about a game, safe to read without narrowing the state. */
export interface GameMeta {
  readonly kind: GameKind
  readonly minPlayers: number
  readonly maxPlayers: number
  readonly scoreDirection: 'high' | 'low'
}

export const GAME_META: Readonly<Record<GameKind, GameMeta>> = {
  slave: {
    kind: slaveModule.kind,
    minPlayers: slaveModule.minPlayers,
    maxPlayers: slaveModule.maxPlayers,
    scoreDirection: slaveModule.scoreDirection,
  },
}

export const GAME_KINDS: readonly GameKind[] = ['slave'] as const

export function createStateFor(kind: GameKind, players: readonly Player[]): GameState {
  switch (kind) {
    case 'slave':
      return slaveModule.createInitialState(players, slaveModule.defaultSettings)
  }
}

export function reduceGame(
  state: GameState,
  action: Action,
  ctx: EngineContext,
): ActionResult<GameState> {
  switch (state.game) {
    case 'slave':
      return slaveModule.reduce(state, action, ctx)
  }
}

export function seatPlayersIn(state: GameState, players: readonly Player[]): GameState {
  switch (state.game) {
    case 'slave':
      return slaveModule.seatPlayers(state, players)
  }
}

export function setConnectedIn(
  state: GameState,
  playerId: PlayerId,
  connected: boolean,
): GameState {
  switch (state.game) {
    case 'slave':
      return slaveModule.setConnected(state, playerId, connected)
  }
}

/**
 * The caller has already re-parsed `patch` with this game's strict schema, so
 * the narrowing here is a formality — but it has to be written down somewhere,
 * and one cast beside the switch beats a cast at every call site.
 */
export function applySettingsIn(state: GameState, patch: Record<string, unknown>): GameState {
  switch (state.game) {
    case 'slave':
      return slaveModule.applySettings(state, patch as Partial<SlaveSettings>)
  }
}

export function botActionFor(state: GameState, playerId: PlayerId): Action | null {
  switch (state.game) {
    case 'slave':
      return slaveModule.botAction(state, playerId)
  }
}

export function waitingOnIn(state: GameState): readonly PlayerId[] {
  switch (state.game) {
    case 'slave':
      return slaveModule.waitingOn(state)
  }
}
```

- [ ] **Step 9: Fix the fallout in the existing tests, `@cards/shared` and `apps/server`**

`bun run typecheck` lists every site. Expect: `GameState` → `SlaveState` in
`packages/shared/src/view.ts` and `apps/server/src/room.ts`; `RoomSettings` →
`SlaveSettings` in `store.ts`, `room.ts` and `view.ts`; `DEFAULT_SETTINGS` →
`DEFAULT_SLAVE_SETTINGS` in `app.ts` and the test helpers; `state.exchange.deadline`
→ `state.phaseDeadline` in `view.ts` and `room.ts`; `event.play` → `event.cardIds`
if any test reads it; and any assertion on `history[0].finishOrder`, which is gone
— assert on `history[0].points` instead. Pass `slaveModule.scoreDirection` as the
third argument to `standings` in `view.ts`.

- [ ] **Step 10: Run everything**

Run: `bun run --cwd packages/game test`
Expected: PASS — 99 original + 5 new.

Run: `bun run typecheck && bun test && bun run check:fix`
Expected: all green, 11 server integration tests still pass.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(game): GameModule seam, BaseState, and the game registry"
```

---
### Task 5: Split `RoomView` into an envelope plus a per-game `table`

**Files:**
- Create: `packages/shared/src/views/slave.ts`
- Modify: `packages/shared/src/view.ts`, `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `SlaveState`, `GameState`, `GameKind`, `standings`, `slaveModule` from Task 4.
- Produces:
  - `RoomView` with `game: GameKind`, `settings: SlaveSettings`, `table: TableView`
  - `SeatView` without `role`, `finishedPlace`, `passed`
  - `YouView` without `canPass`, `role`
  - `TableView = SlaveTable` (widened to include `HeartsTable` in Task 14)
  - `SlaveTable` and `buildSlaveTable(state: SlaveState, viewerId: PlayerId | null): SlaveTable` from `views/slave.ts`

- [ ] **Step 1: Write `views/slave.ts`**

```ts
import {
  type Card,
  canPass,
  type ExchangeTransfer,
  type PlayerId,
  playableCardIds,
  type RoleName,
  type SlaveState,
} from '@cards/game'

export interface ExchangeView {
  /** Players the table is still waiting on. */
  readonly waitingOn: readonly PlayerId[]
  /** How many cards the viewer must choose, or null if they have nothing to do. */
  readonly give: number | null
  /** Cards handed to the viewer by their counterpart. */
  readonly received: readonly Card[]
  /** Cards taken from the viewer without their say. */
  readonly surrendered: readonly Card[]
}

export interface SlaveTable {
  readonly game: 'slave'
  readonly trick: {
    readonly cards: readonly Card[] | null
    readonly count: number | null
    readonly leaderId: PlayerId | null
  }
  readonly revolution: boolean
  readonly canPass: boolean
  readonly roles: Readonly<Record<PlayerId, RoleName>>
  /** Finishing order this round, earliest first. */
  readonly finishOrder: readonly PlayerId[]
  readonly passedIds: readonly PlayerId[]
  readonly exchange: ExchangeView | null
}

export function buildSlaveTable(state: SlaveState, viewerId: PlayerId | null): SlaveTable {
  return {
    game: 'slave',
    trick: {
      cards: state.trick.current?.cards ?? null,
      count: state.trick.current?.count ?? null,
      leaderId: state.trick.leader,
    },
    revolution: state.revolution,
    canPass: viewerId !== null && canPass(state, viewerId),
    roles: state.roles,
    finishOrder: state.finishOrder,
    passedIds: state.trick.passed,
    exchange: buildExchangeView(state, viewerId),
  }
}

function buildExchangeView(state: SlaveState, viewerId: PlayerId | null): ExchangeView | null {
  const exchange = state.exchange
  if (exchange === null) return null

  const pending = exchange.transfers.filter((transfer) => transfer.cards === null)
  const mine = viewerId === null ? undefined : pending.find((t) => t.from === viewerId)

  const received: Card[] = []
  const surrendered: Card[] = []
  if (viewerId !== null) {
    for (const transfer of exchange.transfers) {
      if (transfer.cards === null) continue
      if (transfer.to === viewerId) received.push(...transfer.cards)
      if (transfer.from === viewerId && transfer.forced) surrendered.push(...transfer.cards)
    }
  }

  return {
    waitingOn: pending.map((transfer: ExchangeTransfer) => transfer.from),
    give: mine?.count ?? null,
    received,
    surrendered,
  }
}
```

`MemberInfo` stays declared in `view.ts` where it already lives — do not move it.


- [ ] **Step 2: Rewrite `view.ts` as the envelope**

Delete `TrickView`, `ExchangeView` and `buildExchangeView` from this file — they
moved. `SeatView` sheds `role`, `finishedPlace` and `passed`; `YouView` sheds
`canPass` and `role`.

```ts
import {
  type Card,
  type GameKind,
  type GameState,
  handCounts,
  type Phase,
  type PlayerId,
  playableCardIds,
  type RoundResult,
  type SlaveSettings,
  slaveModule,
  standings,
} from '@cards/game'
import { buildSlaveTable, type SlaveTable } from './views/slave'

export type TableView = SlaveTable

export interface SeatView {
  readonly id: PlayerId
  readonly name: string
  readonly isBot: boolean
  readonly connected: boolean
  readonly ready: boolean
  readonly isHost: boolean
  readonly handCount: number
  readonly score: number
  readonly isCurrent: boolean
}

export interface YouView {
  readonly id: PlayerId
  readonly hand: readonly Card[]
  /** Card ids that can legally be part of a play right now. */
  readonly playable: readonly string[]
  readonly isHost: boolean
  readonly score: number
}

export interface RoomView {
  readonly code: string
  readonly hostId: PlayerId | null
  readonly game: GameKind
  readonly phase: Phase
  readonly settings: SlaveSettings
  readonly round: number
  readonly seats: readonly SeatView[]
  /** The viewer's private slice. Null for a connection with no seat. */
  readonly you: YouView | null
  readonly currentPlayerId: PlayerId | null
  readonly turnDeadline: number | null
  /** People who arrived mid-match and are queued for the next round. */
  readonly waiting: readonly { readonly id: PlayerId; readonly name: string }[]
  readonly youAreWaiting: boolean
  readonly history: readonly RoundResult[]
  readonly standings: readonly { playerId: PlayerId; score: number }[]
  readonly version: number
  /** Everything specific to the game being played. */
  readonly table: TableView
}
```

`buildRoomView` keeps its shape; the seat mapping loses three fields and the
bottom of the function gains the table and the score direction:

```ts
  const direction = state.game === 'slave' ? slaveModule.scoreDirection : 'high'
  const table: TableView = buildSlaveTable(state, viewerId)

  return {
    code,
    hostId,
    game: state.game,
    phase: state.phase,
    settings: state.settings,
    round: state.round,
    seats,
    you,
    currentPlayerId: state.currentPlayer,
    turnDeadline: state.turnDeadline,
    waiting: waiting.map((member) => ({ id: member.id, name: member.name })),
    youAreWaiting: viewerId !== null && waiting.some((member) => member.id === viewerId),
    history: state.history,
    standings: standings(
      state.scores,
      members.map((member) => member.id),
      direction,
    ),
    version: state.version,
    table,
  }
```

- [ ] **Step 3: Export the new module**

In `packages/shared/src/index.ts`:

```ts
export * from './messages'
export * from './protocol'
export * from './view'
export * from './views/slave'
```

- [ ] **Step 4: Verify the compiler finds every web call site**

Run: `bun run typecheck`
Expected: FAIL, only inside `apps/web` — `view.trick`, `view.revolution`,
`view.exchange`, `seat.role`, `seat.passed`, `seat.finishedPlace`, `you.canPass`
and `you.role` no longer exist. Task 7 fixes those. `packages/shared` and
`apps/server` must be clean.

- [ ] **Step 5: Verify the engine and server suites still pass**

Run: `bun test`
Expected: 104 engine tests pass; server integration tests pass (they read
`view.trick.count` in `client.ts` — change that one line to `view.table.trick.count`
and add a `view.table.game === 'slave'` guard around it).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(shared): split RoomView into envelope plus per-game table"
```

---

### Task 6: Make the server game-agnostic, and let the host choose

**Files:**
- Modify: `packages/shared/src/protocol.ts`
- Modify: `apps/server/src/room.ts`, `apps/server/src/store.ts`, `apps/server/src/app.ts`
- Test: `apps/server/test/integration.test.ts`

**Interfaces:**
- Consumes: `GAME_META`, `createStateFor`, `reduceGame`, `seatPlayersIn`, `setConnectedIn`, `applySettingsIn`, `botActionFor`, `waitingOnIn`, `GameState`, `GameKind` from Task 4.
- Produces:
  - `gameKindSchema`, `createRoomSchema`, `slaveSettingsPatchSchema`, `settingsPatchSchema` (loose, per-game strict parse happens server-side), and a `setGame` client message
  - `setGame(room, playerId, game): RoomResult` in `room.ts`
  - `POST /rooms` accepting `{ game?: GameKind }`; `GET /rooms/:code` reporting `game` and that game's `maxPlayers`

- [ ] **Step 1: Write the failing tests**

Append to `apps/server/test/integration.test.ts`:

```ts
describe('choosing a game', () => {
  it('defaults a room to slave', async () => {
    const code = await createRoom()
    const info = await fetch(`${base}/rooms/${code}`).then((r) => r.json())
    expect(info).toMatchObject({ exists: true, game: 'slave', maxPlayers: 6 })
  })

  it('creates a room for an explicitly requested game', async () => {
    const response = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: 'slave' }),
    })
    const { code } = (await response.json()) as { code: string }
    const info = await fetch(`${base}/rooms/${code}`).then((r) => r.json())
    expect(info.game).toBe('slave')
  })

  it('refuses an unknown game', async () => {
    const response = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: 'poker' }),
    })
    expect(response.status).toBe(400)
  })

  it('lets only the host change the game, and only in the lobby', async () => {
    const code = await createRoom()
    const host = new TestClient(wsUrl, 'Host')
    const guest = new TestClient(wsUrl, 'Guest')
    await host.connect(code)
    await guest.connect(code)
    await until(() => host.view?.seats.length === 2, 'both seated')

    guest.send({ type: 'setGame', payload: { game: 'slave' } })
    await until(() => guest.errors.includes('not-host'), 'guest refused')

    host.send({ type: 'setGame', payload: { game: 'slave' } })
    await until(() => host.view?.game === 'slave', 'game applied')

    host.disconnect()
    guest.disconnect()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun run --cwd apps/server test`
Expected: FAIL — the responses carry no `game`, and `setGame` is rejected as `bad-message`.

- [ ] **Step 3: Extend the protocol**

In `packages/shared/src/protocol.ts`:

```ts
import { GAME_KINDS, type GameKind } from '@cards/game'

export const gameKindSchema = z.enum(GAME_KINDS as unknown as [GameKind, ...GameKind[]])

export const createRoomSchema = z.object({ game: gameKindSchema.optional() })

/** Daifugō's settings. Strict, so an unknown key is a rejected patch. */
export const slaveSettingsPatchSchema = z
  .object({
    eightCut: z.boolean().optional(),
    revolution: z.boolean().optional(),
    turnSeconds: z.union([z.literal(15), z.literal(30), z.literal(60), z.null()]).optional(),
    totalRounds: z.union([z.literal(3), z.literal(5), z.literal(10), z.null()]).optional(),
  })
  .strict()

/**
 * The wire accepts any settings-shaped object; `updateSettings` re-parses it
 * with the active game's strict schema, so a Hearts key cannot land in a
 * Daifugō room.
 */
export const settingsPatchSchema = z.record(z.string(), z.unknown())

export type SettingsPatch = z.infer<typeof settingsPatchSchema>
```

Add to `clientMessageSchema`:

```ts
z.object({ type: z.literal('setGame'), payload: z.object({ game: gameKindSchema }) }),
```

Add to `ERROR_CODES` and `ERROR_MESSAGES` (Thai copy, matching the existing tone):

```ts
'invalid-settings',
'must-follow-suit',
'must-lead-clubs-two',
'hearts-not-broken',
'no-points-first-trick',
'wrong-game',
```

```ts
'invalid-settings': 'ตั้งค่านี้ไม่ถูกต้อง',
'must-follow-suit': 'ต้องลงไพ่ดอกเดียวกับที่นำ',
'must-lead-clubs-two': 'ตาแรกต้องนำด้วยดอกจิก 2',
'hearts-not-broken': 'ยังนำโพแดงไม่ได้ ต้องมีคนทิ้งโพแดงก่อน',
'no-points-first-trick': 'ตาแรกลงไพ่ที่มีแต้มไม่ได้',
'wrong-game': 'ทำแบบนี้ในเกมนี้ไม่ได้',
```

- [ ] **Step 4: Make `room.ts` call through the registry**

Replace the direct engine imports with the narrow-and-delegate helpers, and give
`Room` a `game`-aware store entry point. The substantive edits:

```ts
import {
  type Action,
  type ActionError,
  applySettingsIn,
  botActionFor,
  createRng,
  createStateFor,
  GAME_META,
  type GameEvent,
  type GameKind,
  type GameState,
  type Player,
  type PlayerId,
  reduceGame,
  seatPlayersIn,
  setConnectedIn,
  waitingOnIn,
} from '@cards/game'
```

- `createRoom(code, game: GameKind)` calls `createStateFor(game, [])`.
- `syncPlayers` uses `seatPlayersIn`; `join`/`detach` use `setConnectedIn`.
- Every `MAX_PLAYERS` / `MIN_PLAYERS` reference becomes
  `GAME_META[room.state.game].maxPlayers` / `.minPlayers`.
- `dispatch` calls `reduceGame`.
- `updateSettings` re-parses with the active game's schema:

```ts
export function updateSettings(room: Room, playerId: PlayerId, patch: object): RoomResult {
  const host = requireHost(room, playerId)
  if (!host.ok) return host
  if (room.state.phase !== 'lobby') return { ok: false, code: 'wrong-phase' }

  const schema = SETTINGS_SCHEMAS[room.state.game]
  const parsed = schema.safeParse(patch)
  if (!parsed.success) return { ok: false, code: 'invalid-settings' }

  room.state = applySettingsIn(room.state, parsed.data)
  return { ok: true, value: undefined }
}
```

with, at the top of the file:

```ts
import { slaveSettingsPatchSchema } from '@cards/shared'

const SETTINGS_SCHEMAS = { slave: slaveSettingsPatchSchema } as const
```

- Add `setGame`. Seats past the new game's limit move to the waiting list rather
  than being kicked, so switching a six-player Slave room to a four-player game
  leaves everyone in the room:

```ts
/**
 * Swap the room's game in the lobby. Settings reset to the new game's defaults,
 * and any seat past its limit becomes a waiting player rather than being kicked
 * — nobody gets ejected because the host changed their mind.
 */
export function setGame(room: Room, playerId: PlayerId, game: GameKind): RoomResult {
  const host = requireHost(room, playerId)
  if (!host.ok) return host
  if (room.state.phase !== 'lobby') return { ok: false, code: 'wrong-phase' }
  if (room.state.game === game) return { ok: true, value: undefined }

  const limit = GAME_META[game].maxPlayers
  seated(room)
    .slice(limit)
    .forEach((member) => {
      member.seated = false
      member.ready = false
    })

  room.state = createStateFor(game, seated(room).map(toPlayer))
  return { ok: true, value: undefined }
}
```

- `scheduleTimers` loses its knowledge of the exchange phase:

```ts
export function scheduleTimers(room: Room, onChange: (events: readonly GameEvent[]) => void): void {
  clearTimers(room)
  const state = room.state
  const now = Date.now()

  const run = (action: Action) => {
    const result = dispatch(room, action)
    if (result.ok) onChange(result.value)
    scheduleTimers(room, onChange)
  }

  // A simultaneous phase: bots answer first, then the whole phase times out.
  const pending = waitingOnIn(state)
  if (pending.length > 0) {
    const botSeat = pending.find((id) => findMember(room, id)?.isBot === true)
    if (botSeat !== undefined) {
      const action = botActionFor(state, botSeat)
      if (action !== null) {
        room.botTimer = setTimeout(() => run(action), timings.botDelayMs)
        return
      }
    }
    if (state.phaseDeadline !== null) {
      room.turnTimer = setTimeout(
        () => run({ type: 'timeout' }),
        Math.max(0, state.phaseDeadline - now),
      )
    }
    return
  }

  if (state.phase !== 'playing' || state.currentPlayer === null) return

  const member = findMember(room, state.currentPlayer)
  if (member?.isBot === true) {
    const action = botActionFor(state, member.id)
    if (action !== null) {
      room.botTimer = setTimeout(() => run(action), timings.botDelayMs)
      return
    }
  }

  const deadlines: number[] = []
  if (state.turnDeadline !== null) deadlines.push(state.turnDeadline)
  // An absent player resolves quickly, even in a room with the clock switched off.
  if (member !== undefined && !isConnected(member)) {
    deadlines.push(now + timings.disconnectedTurnMs)
  }
  if (deadlines.length === 0) return

  room.turnTimer = setTimeout(
    () => run({ type: 'timeout' }),
    Math.max(0, Math.min(...deadlines) - now),
  )
}
```

- [ ] **Step 5: Update `store.ts` and `app.ts`**

`RoomStore.create(code: string, game: GameKind)` replaces the `settings` argument;
`MemoryRoomStore.create` forwards it to `createRoom`.

In `app.ts`:

```ts
    .post('/rooms', ({ body, status }) => {
      const parsed = createRoomSchema.safeParse(body ?? {})
      if (!parsed.success) return status(400, { error: 'invalid-game' as const })
      const game = parsed.data.game ?? 'slave'
      const code = generateRoomCode((candidate) => store.has(candidate))
      store.create(code, game)
      return { code, game }
    })
```

`GET /rooms/:code` reports the room's game and that game's limits:

```ts
      const players = seated(room)
      const inLobby = room.state.phase === 'lobby'
      const maxPlayers = GAME_META[room.state.game].maxPlayers
      const full = players.length >= maxPlayers
      return {
        exists: true,
        code: room.code,
        game: room.state.game,
        phase: room.state.phase,
        players: players.length,
        maxPlayers,
        canJoin: inLobby && !full,
        reason: inLobby ? (full ? ('room-full' as const) : null) : ('match-in-progress' as const),
      }
```

And route the new message in `handle`:

```ts
    case 'setGame':
      resolve(setGame(room, playerId, message.payload.game))
      return
```

- [ ] **Step 6: Run the tests**

Run: `bun run --cwd apps/server test`
Expected: PASS — 11 original + 4 new.

- [ ] **Step 7: Verify and commit**

Run: `bun run typecheck` — `apps/web` still fails from Task 5; everything else clean.
Run: `bun test && bun run check:fix`

```bash
git add -A
git commit -m "feat(server): resolve rules through the game registry, add setGame"
```

---

### Task 7: Re-point the web app at the new view shape

Slave only, no new features. This clears the `apps/web` typecheck failures from
Tasks 5 and 6 and moves the Slave screens into their own folder so the Hearts
screens have somewhere to sit beside them.

**Files:**
- Move: `components/game/table-screen.tsx` → `components/game/slave/table-screen.tsx`
- Move: `components/game/exchange-screen.tsx` → `components/game/slave/exchange-screen.tsx`
- Move: `components/game/round-summary.tsx` → `components/game/slave/round-summary.tsx`
- Move: `components/game/trick-pile.tsx` → `components/game/slave/trick-pile.tsx`
- Modify: `components/game/room-screen.tsx`, `components/game/seat.tsx`, `components/game/landing-screen.tsx`, `components/game/lobby-screen.tsx`, `lib/use-room.ts`

**Interfaces:**
- Consumes: `RoomView`, `SlaveTable`, `SeatView` from Task 5; `setGame` message from Task 6.
- Produces: `RoomActions.setGame(game: GameKind): void`; `SeatProps` gaining `role`, `finishedPlace` and `passed` as explicit props rather than reading them off `SeatView`.

- [ ] **Step 1: Move the Slave screens**

```bash
cd apps/web/components/game
mkdir -p slave
git mv table-screen.tsx slave/table-screen.tsx
git mv exchange-screen.tsx slave/exchange-screen.tsx
git mv round-summary.tsx slave/round-summary.tsx
git mv trick-pile.tsx slave/trick-pile.tsx
```

Fix the `@/components/game/...` import paths inside them and in `room-screen.tsx`.

- [ ] **Step 2: Make `Seat` take the Daifugō extras as props**

`Seat` is shared with Hearts, which has no roles and no finishing places. In
`components/game/seat.tsx`:

```ts
export interface SeatProps {
  seat: SeatView
  /** 1 = full turn remaining, 0 = expired. Null when this seat is not on the clock. */
  progress: number | null
  urgent: boolean
  compact?: boolean
  /** Daifugō only — Hearts passes none of these. */
  role?: RoleName | null
  finishedPlace?: number | null
  passed?: boolean
}
```

Default them (`role = null`, `finishedPlace = null`, `passed = false`) and replace
every `seat.role` / `seat.finishedPlace` / `seat.passed` in the body with the prop.

- [ ] **Step 3: Re-point `slave/table-screen.tsx`**

At the top of the component, narrow once and use `table` throughout:

```ts
  const table = view.table
  if (table.game !== 'slave') return null
```

Then: `view.trick` → `table.trick`, `view.revolution` → `table.revolution`,
`you.canPass` → `table.canPass`, `mySeat.role` → `table.roles[you.id] ?? null`.
The opponent map passes the extras through:

```tsx
        {opponents.map((seat) => (
          <Seat
            key={seat.id}
            seat={seat}
            progress={seat.isCurrent ? progress : null}
            urgent={urgent}
            compact={opponents.length > 3}
            role={table.roles[seat.id] ?? null}
            finishedPlace={placeOf(table.finishOrder, seat.id)}
            passed={table.passedIds.includes(seat.id)}
          />
        ))}
```

with a small helper at the bottom of the file:

```ts
function placeOf(finishOrder: readonly string[], id: string): number | null {
  const index = finishOrder.indexOf(id)
  return index === -1 ? null : index + 1
}
```

- [ ] **Step 4: Re-point `slave/exchange-screen.tsx` and `slave/round-summary.tsx`**

The exchange clock moved off `ExchangeState` in Task 4, so put it on the
envelope: add `readonly phaseDeadline: number | null` to `RoomView` in
`packages/shared/src/view.ts`, sourced from `state.phaseDeadline`. Then in
`exchange-screen.tsx`: `view.exchange` → `table.exchange`, `you.role` →
`table.roles[you.id] ?? null`, and `useCountdown(exchange?.deadline ?? null)` →
`useCountdown(view.phaseDeadline)`. In `round-summary.tsx`: `seat.role` →
`table.roles[seat.id] ?? null`.

- [ ] **Step 5: Add the `setGame` action**

In `lib/use-room.ts`, add to `RoomActions` and the `useMemo` body:

```ts
  setGame(game: GameKind): void
```

```ts
      setGame: (game) => send.current?.send({ type: 'setGame', payload: { game } }),
```

- [ ] **Step 6: Use the game's real seat limits in the lobby**

`lobby-screen.tsx` imports `MIN_PLAYERS`/`MAX_PLAYERS` from the engine. Replace
with `GAME_META[view.game]`:

```ts
import { GAME_META } from '@cards/game'
```

```ts
  const { minPlayers, maxPlayers } = GAME_META[view.game]
```

and swap the constants through the component.

- [ ] **Step 7: Verify**

Run: `bun run typecheck && bun run check:fix && bun run build`
Expected: all clean.

- [ ] **Step 8: Look at it**

Start the app, screenshot the landing page and a lobby with three bots using the
headless-Chrome recipe in Global Constraints, and read both PNGs. The Slave game
must look exactly as it did before this stage.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(web): read the per-game table slice, move Slave screens"
```

---
## Stage 3 — The Hearts engine

Headless. Nothing in `apps/` changes until Task 13. Write every task test-first;
these tests are the only thing standing between a subtle rules bug and a table
full of confused players.

### Task 8: Hearts types, hand order, and the shared seat helpers

**Files:**
- Create: `packages/game/src/hearts/types.ts`, `packages/game/src/hearts/order.ts`
- Modify: `packages/game/src/core/player.ts` (add `nextSeat`, `handCounts`)
- Modify: `packages/game/src/slave/engine.ts` (remove `handCounts`, import it)
- Test: `packages/game/test/hearts/order.test.ts`

**Interfaces:**
- Consumes: `Card`, `Suit`, `CardRank` from `core/card`; `BaseState` from `core/module`; `Player`, `PlayerId` from `core/player`.
- Produces:
  - `HEARTS_PLAYERS = 4`, `CARDS_EACH = 13`, `PASS_COUNT = 3`, `PASS_SECONDS = 30`, `MAX_ROUND_POINTS = 26`, `QUEEN_OF_SPADES = '12S'`, `TWO_OF_CLUBS = '2C'`
  - `PassDirection`, `HeartsSettings`, `DEFAULT_HEARTS_SETTINGS`, `PassingState`, `HeartsTrick`, `HeartsState`
  - `sortHand(cards: readonly Card[]): Card[]` and `highestCards(hand: readonly Card[], n: number): Card[]` from `hearts/order.ts`
  - `nextSeat(players, fromId): PlayerId | null` and `handCounts(state: BaseState): Record<PlayerId, number>` from `core/player.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/game/test/hearts/order.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { nextSeat } from '../../src/core/player'
import { highestCards, sortHand } from '../../src/hearts/order'
import { cards, ids, makePlayers } from '../helpers'

describe('hearts hand order', () => {
  it('groups by suit in alternating colours, ascending within a suit', () => {
    const hand = cards('14H', '2C', '12S', '5D', '3C', '7H')
    expect(ids(sortHand(hand))).toEqual(['2C', '3C', '5D', '12S', '7H', '14H'])
  })

  it('takes the highest cards regardless of suit', () => {
    const hand = cards('2C', '14H', '12S', '5D', '13C')
    expect(ids(highestCards(hand, 3))).toEqual(['14H', '13C', '12S'])
  })

  it('takes the whole hand when asked for more than it holds', () => {
    expect(highestCards(cards('2C', '3C'), 3)).toHaveLength(2)
  })
})

describe('seat order', () => {
  it('wraps around to the first seat', () => {
    const players = makePlayers(4)
    expect(nextSeat(players, 'p1')).toBe('p2')
    expect(nextSeat(players, 'p4')).toBe('p1')
  })

  it('returns null for a seat that is not at the table', () => {
    expect(nextSeat(makePlayers(4), 'nobody')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run --cwd packages/game test test/hearts/order.test.ts`
Expected: FAIL — `src/hearts/order` does not exist and `nextSeat` is not exported.

- [ ] **Step 3: Write `hearts/types.ts`**

```ts
import type { Card, Suit } from '../core/card'
import type { BaseState } from '../core/module'
import type { PlayerId } from '../core/player'

/** Hearts is a four-handed game and this table does not adapt it. */
export const HEARTS_PLAYERS = 4
export const CARDS_EACH = 13
export const PASS_COUNT = 3
export const PASS_SECONDS = 30
/** Thirteen hearts and the queen of spades. */
export const MAX_ROUND_POINTS = 26

export const QUEEN_OF_SPADES = '12S'
export const TWO_OF_CLUBS = '2C'

export type PassDirection = 'left' | 'right' | 'across' | 'none'

export interface HeartsSettings {
  /** Seconds per turn; `null` disables the timer. */
  readonly turnSeconds: number | null
  /** The match ends the moment anyone reaches this. */
  readonly targetScore: number
}

export const DEFAULT_HEARTS_SETTINGS: HeartsSettings = {
  turnSeconds: 30,
  targetScore: 100,
}

export interface PassingState {
  readonly direction: Exclude<PassDirection, 'none'>
  /** Null for a seat that has not chosen yet. */
  readonly selections: Readonly<Record<PlayerId, readonly Card[] | null>>
}

export interface HeartsTrick {
  /** In play order, so the table can lay them out as they landed. */
  readonly plays: readonly { readonly playerId: PlayerId; readonly card: Card }[]
  readonly leadSuit: Suit | null
}

export interface HeartsState extends BaseState {
  readonly game: 'hearts'
  readonly settings: HeartsSettings
  /** Non-null only during the passing phase. */
  readonly passing: PassingState | null
  readonly trick: HeartsTrick
  readonly heartsBroken: boolean
  /** 1 through 13. The first trick has extra rules, so it has to be counted. */
  readonly trickNumber: number
  /** Point-bearing cards captured this round, per seat. Plain cards are dropped. */
  readonly taken: Readonly<Record<PlayerId, readonly Card[]>>
  /** What each seat was passed this round, so the table can show it. */
  readonly received: Readonly<Record<PlayerId, readonly Card[]>>
}
```

- [ ] **Step 4: Write `hearts/order.ts`**

```ts
import type { Card, Suit } from '../core/card'

/**
 * Clubs, diamonds, spades, hearts — black, red, black, red. Alternating the
 * colours stops two suits from bleeding into one another in a fanned hand.
 */
const SUIT_ORDER: readonly Suit[] = ['C', 'D', 'S', 'H'] as const

/** Grouped by suit, ascending within each — the way a Hearts hand is held. */
export function sortHand(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const bySuit = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit)
    if (bySuit !== 0) return bySuit
    return a.rank - b.rank
  })
}

/** The n highest cards by rank, ignoring suit. What an idle seat passes away. */
export function highestCards(hand: readonly Card[], n: number): Card[] {
  return [...hand].sort((a, b) => b.rank - a.rank).slice(0, n)
}
```

- [ ] **Step 5: Move `handCounts` and add `nextSeat` to `core/player.ts`**

Append to `packages/game/src/core/player.ts`:

```ts
import type { BaseState } from './module'

/** The seat after `fromId`, wrapping around. Null if that seat is unknown. */
export function nextSeat(players: readonly Player[], fromId: PlayerId): PlayerId | null {
  const index = players.findIndex((player) => player.id === fromId)
  if (index === -1) return null
  return players[(index + 1) % players.length]?.id ?? null
}

/** How many cards each seat is holding — the only thing other players see. */
export function handCounts(state: BaseState): Record<PlayerId, number> {
  const counts: Record<PlayerId, number> = {}
  for (const player of state.players) counts[player.id] = (state.hands[player.id] ?? []).length
  return counts
}
```

Delete `handCounts` from `slave/engine.ts`. It is re-exported from `src/index.ts`
either way, so nothing outside `packages/game` changes.

- [ ] **Step 6: Run the tests**

Run: `bun run --cwd packages/game test test/hearts/order.test.ts`
Expected: PASS — 5 tests.

Run: `bun run --cwd packages/game test`
Expected: PASS — everything still green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(hearts): state types, hand order, shared seat helpers"
```

---

### Task 9: The passing rotation

**Files:**
- Create: `packages/game/src/hearts/passing.ts`
- Test: `packages/game/test/hearts/passing.test.ts`

**Interfaces:**
- Consumes: `PassDirection`, `PassingState`, `PASS_COUNT` from Task 8; `sortHand` from `hearts/order`.
- Produces:
  - `passDirection(round: number): PassDirection`
  - `passTarget(players, from, direction: Exclude<PassDirection, 'none'>): PlayerId | null`
  - `applyPasses(players, hands, passing): { hands: Record<PlayerId, readonly Card[]>; received: Record<PlayerId, readonly Card[]> }`

- [ ] **Step 1: Write the failing test**

Create `packages/game/test/hearts/passing.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyPasses, passDirection, passTarget } from '../../src/hearts/passing'
import { cards, ids, makePlayers } from '../helpers'

describe('pass direction', () => {
  it('runs left, right, across, none', () => {
    expect(passDirection(1)).toBe('left')
    expect(passDirection(2)).toBe('right')
    expect(passDirection(3)).toBe('across')
    expect(passDirection(4)).toBe('none')
  })

  it('repeats the cycle from round five', () => {
    expect(passDirection(5)).toBe('left')
    expect(passDirection(8)).toBe('none')
    expect(passDirection(9)).toBe('left')
  })
})

describe('pass target', () => {
  const players = makePlayers(4)

  it('passes left to the next seat, wrapping', () => {
    expect(passTarget(players, 'p1', 'left')).toBe('p2')
    expect(passTarget(players, 'p4', 'left')).toBe('p1')
  })

  it('passes right to the previous seat, wrapping', () => {
    expect(passTarget(players, 'p1', 'right')).toBe('p4')
    expect(passTarget(players, 'p2', 'right')).toBe('p1')
  })

  it('passes across to the opposite seat', () => {
    expect(passTarget(players, 'p1', 'across')).toBe('p3')
    expect(passTarget(players, 'p3', 'across')).toBe('p1')
  })

  it('returns null for a seat that is not at the table', () => {
    expect(passTarget(players, 'nobody', 'left')).toBeNull()
  })
})

describe('applying a pass', () => {
  const players = makePlayers(4)

  it('moves each seat its three cards and reports what arrived', () => {
    const hands = {
      p1: cards('2C', '3C', '4C', '5C'),
      p2: cards('2D', '3D', '4D', '5D'),
      p3: cards('2H', '3H', '4H', '5H'),
      p4: cards('2S', '3S', '4S', '5S'),
    }
    const result = applyPasses(players, hands, {
      direction: 'left',
      selections: {
        p1: cards('2C', '3C', '4C'),
        p2: cards('2D', '3D', '4D'),
        p3: cards('2H', '3H', '4H'),
        p4: cards('2S', '3S', '4S'),
      },
    })

    expect(ids(result.hands.p2 ?? [])).toEqual(['2C', '3C', '4C', '5D'])
    expect(ids(result.received.p2 ?? [])).toEqual(['2C', '3C', '4C'])
    expect(ids(result.hands.p1 ?? [])).toEqual(['5C', '2S', '3S', '4S'])
  })

  it('keeps every hand the size it started', () => {
    const hands = {
      p1: cards('2C', '3C', '4C', '5C'),
      p2: cards('2D', '3D', '4D', '5D'),
      p3: cards('2H', '3H', '4H', '5H'),
      p4: cards('2S', '3S', '4S', '5S'),
    }
    const result = applyPasses(players, hands, {
      direction: 'across',
      selections: {
        p1: cards('2C', '3C', '4C'),
        p2: cards('2D', '3D', '4D'),
        p3: cards('2H', '3H', '4H'),
        p4: cards('2S', '3S', '4S'),
      },
    })
    for (const player of players) expect(result.hands[player.id]).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run --cwd packages/game test test/hearts/passing.test.ts`
Expected: FAIL — `src/hearts/passing` does not exist.

- [ ] **Step 3: Write `hearts/passing.ts`**

```ts
import type { Card } from '../core/card'
import type { Player, PlayerId } from '../core/player'
import { sortHand } from './order'
import type { PassDirection, PassingState } from './types'

const CYCLE: readonly PassDirection[] = ['left', 'right', 'across', 'none'] as const

/** Round 1 passes left, 2 right, 3 across, 4 nothing, and then it repeats. */
export function passDirection(round: number): PassDirection {
  return CYCLE[(round - 1) % CYCLE.length] ?? 'none'
}

/**
 * Who a seat passes to. Seat order runs clockwise, so "left" is the next seat
 * and "across" is two along — which at a four-handed table is the seat opposite.
 */
export function passTarget(
  players: readonly Player[],
  from: PlayerId,
  direction: Exclude<PassDirection, 'none'>,
): PlayerId | null {
  const index = players.findIndex((player) => player.id === from)
  if (index === -1) return null
  const step = direction === 'left' ? 1 : direction === 'right' ? -1 : 2
  const n = players.length
  return players[(index + step + n) % n]?.id ?? null
}

/**
 * Move every chosen set to its target at once. Each seat gives three and gets
 * three, so this is a permutation — nobody is ever briefly holding ten or
 * sixteen cards, which is why it is one function and not a loop of transfers.
 */
export function applyPasses(
  players: readonly Player[],
  hands: Readonly<Record<PlayerId, readonly Card[]>>,
  passing: PassingState,
): {
  hands: Record<PlayerId, readonly Card[]>
  received: Record<PlayerId, readonly Card[]>
} {
  const received: Record<PlayerId, Card[]> = {}
  for (const player of players) received[player.id] = []

  for (const player of players) {
    const chosen = passing.selections[player.id] ?? []
    const target = passTarget(players, player.id, passing.direction)
    if (target === null) continue
    received[target]?.push(...chosen)
  }

  const next: Record<PlayerId, readonly Card[]> = {}
  for (const player of players) {
    const gone = new Set((passing.selections[player.id] ?? []).map((card) => card.id))
    const kept = (hands[player.id] ?? []).filter((card) => !gone.has(card.id))
    next[player.id] = sortHand([...kept, ...(received[player.id] ?? [])])
  }

  return { hands: next, received }
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run --cwd packages/game test test/hearts/passing.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(hearts): passing rotation and simultaneous pass application"
```

---

### Task 10: Legal cards and taking tricks

The heart of the rules. Every refusal in the spec is a test here.

**Files:**
- Create: `packages/game/src/hearts/tricks.ts`
- Test: `packages/game/test/hearts/tricks.test.ts`, `packages/game/test/hearts/helpers.ts`

**Interfaces:**
- Consumes: `HeartsState`, `HeartsTrick`, `QUEEN_OF_SPADES`, `TWO_OF_CLUBS` from Task 8.
- Produces:
  - `cardPoints(card: Card): number`, `isPenalty(card: Card): boolean`, `trickPoints(cards: readonly Card[]): number`
  - `legalCards(state: HeartsState, playerId: PlayerId): Card[]`
  - `trickWinner(trick: HeartsTrick): PlayerId | null`
  - `heartsPlayingState(...)` test helper from `test/hearts/helpers.ts`

- [ ] **Step 1: Write the test helper**

Create `packages/game/test/hearts/helpers.ts`:

```ts
import type { Card } from '../../src/core/card'
import type { PlayerId } from '../../src/core/player'
import { DEFAULT_HEARTS_SETTINGS, type HeartsState } from '../../src/hearts/types'
import { makePlayers } from '../helpers'

/** A four-handed Hearts state parked mid-round with hands the test dictates. */
export function heartsPlayingState(
  hands: Record<PlayerId, Card[]>,
  overrides: Partial<HeartsState> = {},
): HeartsState {
  const players = makePlayers(4)
  const ids = players.map((player) => player.id)
  return {
    game: 'hearts',
    phase: 'playing',
    settings: DEFAULT_HEARTS_SETTINGS,
    players,
    round: 1,
    hands,
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    currentPlayer: ids[0] ?? null,
    turnDeadline: null,
    phaseDeadline: null,
    history: [],
    version: 0,
    passing: null,
    trick: { plays: [], leadSuit: null },
    heartsBroken: false,
    trickNumber: 2,
    taken: Object.fromEntries(ids.map((id) => [id, []])),
    received: Object.fromEntries(ids.map((id) => [id, []])),
    ...overrides,
  }
}
```

Note `trickNumber: 2` — most tests want the ordinary rules, so the first trick's
extra restrictions are opt-in via an override.

- [ ] **Step 2: Write the failing test**

Create `packages/game/test/hearts/tricks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  cardPoints,
  isPenalty,
  legalCards,
  trickPoints,
  trickWinner,
} from '../../src/hearts/tricks'
import { c, cards, ids } from '../helpers'
import { heartsPlayingState } from './helpers'

describe('penalty cards', () => {
  it('scores a heart at one and the queen of spades at thirteen', () => {
    expect(cardPoints(c('7H'))).toBe(1)
    expect(cardPoints(c('12S'))).toBe(13)
    expect(cardPoints(c('12H'))).toBe(1)
    expect(cardPoints(c('13S'))).toBe(0)
    expect(cardPoints(c('2C'))).toBe(0)
  })

  it('knows which cards hurt', () => {
    expect(isPenalty(c('2H'))).toBe(true)
    expect(isPenalty(c('12S'))).toBe(true)
    expect(isPenalty(c('14S'))).toBe(false)
  })

  it('adds a whole trick up', () => {
    expect(trickPoints(cards('2H', '3H', '12S', '4C'))).toBe(15)
    expect(trickPoints(cards('2C', '3C', '4C', '5C'))).toBe(0)
  })
})

describe('legal cards', () => {
  it('forces the two of clubs on the opening lead', () => {
    const state = heartsPlayingState(
      {
        p1: cards('2C', '5H', '12S', '9D'),
        p2: [],
        p3: [],
        p4: [],
      },
      { trickNumber: 1 },
    )
    expect(ids(legalCards(state, 'p1'))).toEqual(['2C'])
  })

  it('makes you follow the led suit when you can', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('3C', '9C', '5H', '12S'), p3: [], p4: [] },
      {
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('7C') }], leadSuit: 'C' },
      },
    )
    expect(ids(legalCards(state, 'p2'))).toEqual(['3C', '9C'])
  })

  it('opens the whole hand when you are void in the led suit', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('5H', '12S', '9D'), p3: [], p4: [] },
      {
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('7C') }], leadSuit: 'C' },
      },
    )
    expect(ids(legalCards(state, 'p2'))).toEqual(['5H', '12S', '9D'])
  })

  it('will not let you lead a heart before they are broken', () => {
    const state = heartsPlayingState({ p1: cards('5H', '9D', '12S'), p2: [], p3: [], p4: [] })
    expect(ids(legalCards(state, 'p1'))).toEqual(['9D', '12S'])
  })

  it('lets you lead a heart once they are broken', () => {
    const state = heartsPlayingState(
      { p1: cards('5H', '9D'), p2: [], p3: [], p4: [] },
      { heartsBroken: true },
    )
    expect(ids(legalCards(state, 'p1'))).toEqual(['5H', '9D'])
  })

  it('lets a hand of nothing but hearts lead one anyway', () => {
    const state = heartsPlayingState({ p1: cards('5H', '9H'), p2: [], p3: [], p4: [] })
    expect(ids(legalCards(state, 'p1'))).toEqual(['5H', '9H'])
  })

  it('keeps point cards off the first trick', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('5H', '12S', '9D'), p3: [], p4: [] },
      {
        trickNumber: 1,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('2C') }], leadSuit: 'C' },
      },
    )
    expect(ids(legalCards(state, 'p2'))).toEqual(['9D'])
  })

  it('allows a point card on the first trick when the hand holds nothing else', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('5H', '12S'), p3: [], p4: [] },
      {
        trickNumber: 1,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('2C') }], leadSuit: 'C' },
      },
    )
    expect(ids(legalCards(state, 'p2'))).toEqual(['5H', '12S'])
  })

  it('offers nothing to a seat whose turn it is not', () => {
    const state = heartsPlayingState({ p1: cards('2C'), p2: cards('3C'), p3: [], p4: [] })
    expect(legalCards(state, 'p2')).toEqual([])
  })
})

describe('taking a trick', () => {
  it('gives it to the highest card of the led suit', () => {
    expect(
      trickWinner({
        leadSuit: 'C',
        plays: [
          { playerId: 'p1', card: c('7C') },
          { playerId: 'p2', card: c('13C') },
          { playerId: 'p3', card: c('3C') },
          { playerId: 'p4', card: c('14S') },
        ],
      }),
    ).toBe('p2')
  })

  it('ignores a higher card of another suit', () => {
    expect(
      trickWinner({
        leadSuit: 'D',
        plays: [
          { playerId: 'p1', card: c('4D') },
          { playerId: 'p2', card: c('14H') },
          { playerId: 'p3', card: c('14S') },
          { playerId: 'p4', card: c('14C') },
        ],
      }),
    ).toBe('p1')
  })

  it('has no winner before anything is led', () => {
    expect(trickWinner({ leadSuit: null, plays: [] })).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `bun run --cwd packages/game test test/hearts/tricks.test.ts`
Expected: FAIL — `src/hearts/tricks` does not exist.

- [ ] **Step 4: Write `hearts/tricks.ts`**

```ts
import type { Card } from '../core/card'
import type { PlayerId } from '../core/player'
import { type HeartsState, type HeartsTrick, QUEEN_OF_SPADES, TWO_OF_CLUBS } from './types'

/** Hearts are a point each; the queen of spades is thirteen on her own. */
export function cardPoints(card: Card): number {
  if (card.id === QUEEN_OF_SPADES) return 13
  return card.suit === 'H' ? 1 : 0
}

export function isPenalty(card: Card): boolean {
  return cardPoints(card) > 0
}

export function trickPoints(cards: readonly Card[]): number {
  return cards.reduce((total, card) => total + cardPoints(card), 0)
}

/**
 * Every card this seat may legally play right now.
 *
 * The filters run in the order the rules do: the opening lead is forced,
 * following suit overrides everything else, hearts stay locked until one has
 * been discarded, and the first trick sheds no blood unless there is no choice.
 * Each rule has an escape hatch for a hand that cannot obey it, which is why
 * every branch checks for an empty result before committing to it.
 */
export function legalCards(state: HeartsState, playerId: PlayerId): Card[] {
  if (state.phase !== 'playing' || state.currentPlayer !== playerId) return []
  const hand = state.hands[playerId] ?? []
  if (hand.length === 0) return []

  const leading = state.trick.plays.length === 0

  // The first lead of a round is the two of clubs and nothing else.
  if (leading && state.trickNumber === 1) {
    return hand.filter((card) => card.id === TWO_OF_CLUBS)
  }

  let candidates: Card[]
  if (state.trick.leadSuit !== null) {
    const inSuit = hand.filter((card) => card.suit === state.trick.leadSuit)
    candidates = inSuit.length > 0 ? inSuit : [...hand]
  } else if (!state.heartsBroken) {
    const offHearts = hand.filter((card) => card.suit !== 'H')
    // A hand of nothing but hearts has to lead one.
    candidates = offHearts.length > 0 ? offHearts : [...hand]
  } else {
    candidates = [...hand]
  }

  if (state.trickNumber === 1) {
    const safe = candidates.filter((card) => !isPenalty(card))
    if (safe.length > 0) return safe
  }
  return candidates
}

/** The highest card of the led suit takes the trick. Nothing else can. */
export function trickWinner(trick: HeartsTrick): PlayerId | null {
  if (trick.leadSuit === null) return null
  let best: { playerId: PlayerId; card: Card } | null = null
  for (const play of trick.plays) {
    if (play.card.suit !== trick.leadSuit) continue
    if (best === null || play.card.rank > best.card.rank) best = play
  }
  return best?.playerId ?? null
}
```

- [ ] **Step 5: Run the tests**

Run: `bun run --cwd packages/game test test/hearts/tricks.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(hearts): legal cards, penalty values, trick winner"
```

---

### Task 11: Round scoring and shooting the moon

**Files:**
- Create: `packages/game/src/hearts/scoring.ts`
- Test: `packages/game/test/hearts/scoring.test.ts`

**Interfaces:**
- Consumes: `trickPoints` from Task 10; `MAX_ROUND_POINTS` from Task 8.
- Produces:
  - `roundScores(seatOrder, taken): { points: Record<PlayerId, number>; moonShooter: PlayerId | null }`
  - `reachedTarget(scores, target): boolean`

- [ ] **Step 1: Write the failing test**

Create `packages/game/test/hearts/scoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { reachedTarget, roundScores } from '../../src/hearts/scoring'
import { cards } from '../helpers'

const SEATS = ['p1', 'p2', 'p3', 'p4']

/** All thirteen hearts plus the queen — the whole twenty-six. */
const ALL_PENALTIES = cards(
  '2H', '3H', '4H', '5H', '6H', '7H', '8H',
  '9H', '10H', '11H', '12H', '13H', '14H', '12S',
)

describe('round scores', () => {
  it('charges each seat what it took', () => {
    const result = roundScores(SEATS, {
      p1: cards('2H', '3H'),
      p2: cards('12S'),
      p3: [],
      p4: cards('4H'),
    })
    expect(result.points).toEqual({ p1: 2, p2: 13, p3: 0, p4: 1 })
    expect(result.moonShooter).toBeNull()
  })

  it('gives a seat that took nothing a zero rather than nothing at all', () => {
    const result = roundScores(SEATS, { p1: cards('2H') })
    expect(result.points).toEqual({ p1: 1, p2: 0, p3: 0, p4: 0 })
  })

  it('turns the table on a shot moon', () => {
    const result = roundScores(SEATS, { p1: ALL_PENALTIES, p2: [], p3: [], p4: [] })
    expect(result.points).toEqual({ p1: 0, p2: 26, p3: 26, p4: 26 })
    expect(result.moonShooter).toBe('p1')
  })

  it('is not a moon shot when one point got away', () => {
    const short = ALL_PENALTIES.filter((card) => card.id !== '2H')
    const result = roundScores(SEATS, { p1: short, p2: cards('2H'), p3: [], p4: [] })
    expect(result.points.p1).toBe(25)
    expect(result.points.p2).toBe(1)
    expect(result.moonShooter).toBeNull()
  })
})

describe('reaching the target', () => {
  it('ends the match at the target exactly', () => {
    expect(reachedTarget({ p1: 100, p2: 20 }, 100)).toBe(true)
  })

  it('ends the match past the target', () => {
    expect(reachedTarget({ p1: 113, p2: 20 }, 100)).toBe(true)
  })

  it('keeps playing below it', () => {
    expect(reachedTarget({ p1: 99, p2: 20 }, 100)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run --cwd packages/game test test/hearts/scoring.test.ts`
Expected: FAIL — `src/hearts/scoring` does not exist.

- [ ] **Step 3: Write `hearts/scoring.ts`**

```ts
import type { Card } from '../core/card'
import type { PlayerId } from '../core/player'
import { trickPoints } from './tricks'
import { MAX_ROUND_POINTS } from './types'

/**
 * Points for a round. Normally a seat scores what it took. Take all twenty-six
 * and the table pays instead: the shooter scores nothing and everyone else gets
 * the lot, which is the only reason anyone ever chases the queen.
 */
export function roundScores(
  seatOrder: readonly PlayerId[],
  taken: Readonly<Record<PlayerId, readonly Card[]>>,
): { points: Record<PlayerId, number>; moonShooter: PlayerId | null } {
  const raw: Record<PlayerId, number> = {}
  for (const id of seatOrder) raw[id] = trickPoints(taken[id] ?? [])

  const shooter = seatOrder.find((id) => raw[id] === MAX_ROUND_POINTS) ?? null
  if (shooter === null) return { points: raw, moonShooter: null }

  const points: Record<PlayerId, number> = {}
  for (const id of seatOrder) points[id] = id === shooter ? 0 : MAX_ROUND_POINTS
  return { points, moonShooter: shooter }
}

/** The match ends the moment anyone reaches the target. Lowest score wins. */
export function reachedTarget(
  scores: Readonly<Record<PlayerId, number>>,
  target: number,
): boolean {
  return Object.values(scores).some((score) => score >= target)
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run --cwd packages/game test test/hearts/scoring.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(hearts): round scoring and shooting the moon"
```

---
### Task 12: The Hearts reducer

**Files:**
- Create: `packages/game/src/hearts/engine.ts`
- Test: `packages/game/test/hearts/engine.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 8–11; `Action`, `ActionResult`, `ActionError`, `GameEvent`, `EngineContext` from `core/module`; `createDeck`, `deal`, `shuffle` from `core/card`; `nextSeat` from `core/player`; `addScores` from `core/scoring`.
- Produces:
  - `HEARTS_MIN_PLAYERS = 4`, `HEARTS_MAX_PLAYERS = 4`
  - `createInitialState(players, settings): HeartsState`
  - `seatPlayers(state, players): HeartsState`, `setConnected(state, playerId, connected): HeartsState`
  - `startRound(state, round, ctx): ActionResult<HeartsState>`
  - `reduce(state, action, ctx): ActionResult<HeartsState>`
  - `legalCardIds(state, playerId): Set<string>`
  - `pendingPassers(state): PlayerId[]`

- [ ] **Step 1: Write the failing test**

Create `packages/game/test/hearts/engine.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ActionResult } from '../../src/core/module'
import { createInitialState, legalCardIds, reduce, startRound } from '../../src/hearts/engine'
import { DEFAULT_HEARTS_SETTINGS, type HeartsState } from '../../src/hearts/types'
import { c, cards, ctx, ids, makePlayers } from '../helpers'
import { heartsPlayingState } from './helpers'

function unwrap(result: ActionResult<HeartsState>): HeartsState {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`)
  return result.state
}

const lobby = () => createInitialState(makePlayers(4), DEFAULT_HEARTS_SETTINGS)

describe('starting a match', () => {
  it('refuses a table that is not exactly four', () => {
    const three = createInitialState(makePlayers(3), DEFAULT_HEARTS_SETTINGS)
    const result = reduce(three, { type: 'startMatch' }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('not-enough-players')
  })

  it('deals thirteen cards each and opens the passing phase', () => {
    const state = unwrap(reduce(lobby(), { type: 'startMatch' }, ctx()))
    expect(state.phase).toBe('exchange')
    expect(state.passing?.direction).toBe('left')
    for (const player of state.players) expect(state.hands[player.id]).toHaveLength(13)
    expect(state.phaseDeadline).not.toBeNull()
  })

  it('skips passing on round four and leads with the two of clubs', () => {
    const state = unwrap(startRound(lobby(), 4, ctx()))
    expect(state.phase).toBe('playing')
    expect(state.passing).toBeNull()
    const leader = state.currentPlayer
    expect(leader).not.toBeNull()
    expect(state.hands[leader ?? '']?.some((card) => card.id === '2C')).toBe(true)
    expect([...legalCardIds(state, leader ?? '')]).toEqual(['2C'])
  })
})

describe('the passing phase', () => {
  it('waits for all four seats, then deals the pass and starts play', () => {
    let state = unwrap(reduce(lobby(), { type: 'startMatch' }, ctx()))
    for (const player of state.players) {
      const chosen = (state.hands[player.id] ?? []).slice(0, 3).map((card) => card.id)
      const before = state.phase
      state = unwrap(reduce(state, { type: 'exchangeChoose', playerId: player.id, cardIds: chosen }, ctx()))
      expect(before).toBe('exchange')
    }
    expect(state.phase).toBe('playing')
    for (const player of state.players) {
      expect(state.hands[player.id]).toHaveLength(13)
      expect(state.received[player.id]).toHaveLength(3)
    }
  })

  it('refuses a pass that is not three cards', () => {
    const state = unwrap(reduce(lobby(), { type: 'startMatch' }, ctx()))
    const player = state.players[0]
    const chosen = (state.hands[player?.id ?? ''] ?? []).slice(0, 2).map((card) => card.id)
    const result = reduce(state, { type: 'exchangeChoose', playerId: player?.id ?? '', cardIds: chosen }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('wrong-card-count')
  })

  it('refuses a second pass from the same seat', () => {
    let state = unwrap(reduce(lobby(), { type: 'startMatch' }, ctx()))
    const id = state.players[0]?.id ?? ''
    const chosen = (state.hands[id] ?? []).slice(0, 3).map((card) => card.id)
    state = unwrap(reduce(state, { type: 'exchangeChoose', playerId: id, cardIds: chosen }, ctx()))
    const again = reduce(state, { type: 'exchangeChoose', playerId: id, cardIds: chosen }, ctx())
    expect(again.ok).toBe(false)
    if (again.ok) return
    expect(again.error).toBe('no-pending-exchange')
  })

  it('passes the three highest cards for anyone still dithering at the deadline', () => {
    const state = unwrap(reduce(lobby(), { type: 'startMatch' }, ctx()))
    const timed = unwrap(reduce(state, { type: 'timeout' }, ctx()))
    expect(timed.phase).toBe('playing')
    for (const player of timed.players) expect(timed.hands[player.id]).toHaveLength(13)
  })
})

describe('playing a trick', () => {
  it('refuses a card that does not follow the led suit', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('3C', '5H'), p3: [], p4: [] },
      { currentPlayer: 'p2', trick: { plays: [{ playerId: 'p1', card: c('7C') }], leadSuit: 'C' } },
    )
    const result = reduce(state, { type: 'play', playerId: 'p2', cardIds: ['5H'] }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('must-follow-suit')
  })

  it('refuses a heart led before they are broken', () => {
    const state = heartsPlayingState({ p1: cards('5H', '9D'), p2: [], p3: [], p4: [] })
    const result = reduce(state, { type: 'play', playerId: 'p1', cardIds: ['5H'] }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('hearts-not-broken')
  })

  it('refuses a point card on the first trick', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('12S', '9D'), p3: [], p4: [] },
      {
        trickNumber: 1,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('2C') }], leadSuit: 'C' },
      },
    )
    const result = reduce(state, { type: 'play', playerId: 'p2', cardIds: ['12S'] }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('no-points-first-trick')
  })

  it('refuses more than one card', () => {
    const state = heartsPlayingState({ p1: cards('9D', '10D'), p2: [], p3: [], p4: [] })
    const result = reduce(state, { type: 'play', playerId: 'p1', cardIds: ['9D', '10D'] }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('wrong-card-count')
  })

  it('refuses the Daifugō pass outright', () => {
    const state = heartsPlayingState({ p1: cards('9D'), p2: [], p3: [], p4: [] })
    const result = reduce(state, { type: 'pass', playerId: 'p1' }, ctx())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('wrong-game')
  })

  it('breaks hearts when one is discarded, and says so', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('5H'), p3: [], p4: [] },
      { currentPlayer: 'p2', trick: { plays: [{ playerId: 'p1', card: c('7C') }], leadSuit: 'C' } },
    )
    const result = reduce(state, { type: 'play', playerId: 'p2', cardIds: ['5H'] }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.heartsBroken).toBe(true)
    expect(result.events.some((event) => event.type === 'heartsBroken')).toBe(true)
  })

  it('awards the trick to the highest card of the led suit and gives them the lead', () => {
    let state = heartsPlayingState({
      p1: cards('7C', '2D'),
      p2: cards('13C', '3D'),
      p3: cards('3C', '4D'),
      p4: cards('5H', '5D'),
    })
    state = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['7C'] }, ctx()))
    state = unwrap(reduce(state, { type: 'play', playerId: 'p2', cardIds: ['13C'] }, ctx()))
    state = unwrap(reduce(state, { type: 'play', playerId: 'p3', cardIds: ['3C'] }, ctx()))
    const result = reduce(state, { type: 'play', playerId: 'p4', cardIds: ['5H'] }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.state.currentPlayer).toBe('p2')
    expect(ids(result.state.taken.p2 ?? [])).toEqual(['5H'])
    expect(result.state.trick.plays).toEqual([])
    expect(result.state.trickNumber).toBe(3)
    expect(result.events.some((e) => e.type === 'trickTaken' && e.points === 1)).toBe(true)
  })

  it('plays the lowest legal card when a turn times out', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('9C', '3C', '5H'), p3: [], p4: [] },
      { currentPlayer: 'p2', trick: { plays: [{ playerId: 'p1', card: c('7C') }], leadSuit: 'C' } },
    )
    const next = unwrap(reduce(state, { type: 'timeout' }, ctx()))
    expect(next.trick.plays.at(-1)?.card.id).toBe('3C')
  })
})

describe('finishing a round', () => {
  it('scores the round and moves to roundEnd on the last trick', () => {
    const state = heartsPlayingState(
      {
        p1: cards('7C'),
        p2: cards('13C'),
        p3: cards('3C'),
        p4: cards('5H'),
      },
      { trickNumber: 13, heartsBroken: true },
    )
    let next = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['7C'] }, ctx()))
    next = unwrap(reduce(next, { type: 'play', playerId: 'p2', cardIds: ['13C'] }, ctx()))
    next = unwrap(reduce(next, { type: 'play', playerId: 'p3', cardIds: ['3C'] }, ctx()))
    next = unwrap(reduce(next, { type: 'play', playerId: 'p4', cardIds: ['5H'] }, ctx()))

    expect(next.phase).toBe('roundEnd')
    expect(next.scores.p2).toBe(1)
    expect(next.history).toHaveLength(1)
    expect(next.currentPlayer).toBeNull()
  })

  it('ends the match once someone reaches the target', () => {
    const state = heartsPlayingState(
      { p1: cards('7C'), p2: cards('13C'), p3: cards('3C'), p4: cards('5H') },
      {
        trickNumber: 13,
        heartsBroken: true,
        settings: { turnSeconds: 30, targetScore: 1 },
      },
    )
    let next = unwrap(reduce(state, { type: 'play', playerId: 'p1', cardIds: ['7C'] }, ctx()))
    next = unwrap(reduce(next, { type: 'play', playerId: 'p2', cardIds: ['13C'] }, ctx()))
    next = unwrap(reduce(next, { type: 'play', playerId: 'p3', cardIds: ['3C'] }, ctx()))
    next = unwrap(reduce(next, { type: 'play', playerId: 'p4', cardIds: ['5H'] }, ctx()))

    expect(next.phase).toBe('matchEnd')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run --cwd packages/game test test/hearts/engine.test.ts`
Expected: FAIL — `src/hearts/engine` does not exist.

- [ ] **Step 3: Write `hearts/engine.ts`**

```ts
import { createDeck, deal, shuffle } from '../core/card'
import type { Card } from '../core/card'
import type {
  Action,
  ActionError,
  ActionResult,
  EngineContext,
  GameEvent,
} from '../core/module'
import { nextSeat, type Player, type PlayerId } from '../core/player'
import { addScores } from '../core/scoring'
import { highestCards, sortHand } from './order'
import { applyPasses, passDirection } from './passing'
import { reachedTarget, roundScores } from './scoring'
import { isPenalty, legalCards, trickPoints, trickWinner } from './tricks'
import {
  DEFAULT_HEARTS_SETTINGS,
  type HeartsSettings,
  type HeartsState,
  PASS_COUNT,
  PASS_SECONDS,
  TWO_OF_CLUBS,
} from './types'

export const HEARTS_MIN_PLAYERS = 4
export const HEARTS_MAX_PLAYERS = 4

const fail = (error: ActionError): ActionResult<HeartsState> => ({ ok: false, error })

export function createInitialState(
  players: readonly Player[],
  settings: HeartsSettings = DEFAULT_HEARTS_SETTINGS,
): HeartsState {
  const ids = players.map((player) => player.id)
  return {
    game: 'hearts',
    phase: 'lobby',
    settings,
    players: [...players],
    round: 0,
    hands: {},
    scores: Object.fromEntries(ids.map((id) => [id, 0])),
    currentPlayer: null,
    turnDeadline: null,
    phaseDeadline: null,
    history: [],
    version: 0,
    passing: null,
    trick: { plays: [], leadSuit: null },
    heartsBroken: false,
    trickNumber: 1,
    taken: Object.fromEntries(ids.map((id) => [id, []])),
    received: Object.fromEntries(ids.map((id) => [id, []])),
  }
}

/** Replace the seated players. Only safe between rounds, which the caller enforces. */
export function seatPlayers(state: HeartsState, players: readonly Player[]): HeartsState {
  const scores: Record<PlayerId, number> = {}
  for (const player of players) scores[player.id] = state.scores[player.id] ?? 0
  return { ...state, players: [...players], scores, version: state.version + 1 }
}

export function setConnected(
  state: HeartsState,
  playerId: PlayerId,
  connected: boolean,
): HeartsState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.id === playerId ? { ...player, connected } : player,
    ),
    version: state.version + 1,
  }
}

function deadlineFor(state: HeartsState, now: number): number | null {
  return state.settings.turnSeconds === null ? null : now + state.settings.turnSeconds * 1000
}

function holderOfTwoOfClubs(state: HeartsState): PlayerId | null {
  for (const player of state.players) {
    const hand = state.hands[player.id] ?? []
    if (hand.some((card) => card.id === TWO_OF_CLUBS)) return player.id
  }
  return null
}

// ------------------------------------------------------------------- rounds

export function startRound(
  state: HeartsState,
  round: number,
  ctx: EngineContext,
): ActionResult<HeartsState> {
  if (state.players.length !== HEARTS_MIN_PLAYERS) return fail('not-enough-players')

  const dealt = deal(shuffle(createDeck(), ctx.rng), state.players.length)
  const hands: Record<PlayerId, readonly Card[]> = {}
  state.players.forEach((player, index) => {
    hands[player.id] = sortHand(dealt[index] ?? [])
  })
  const ids = state.players.map((player) => player.id)

  const base: HeartsState = {
    ...state,
    round,
    hands,
    passing: null,
    trick: { plays: [], leadSuit: null },
    heartsBroken: false,
    trickNumber: 1,
    taken: Object.fromEntries(ids.map((id) => [id, []])),
    received: Object.fromEntries(ids.map((id) => [id, []])),
    currentPlayer: null,
    turnDeadline: null,
    phaseDeadline: null,
    version: state.version + 1,
  }

  const events: GameEvent[] = [{ type: 'dealt', round }]
  const direction = passDirection(round)

  // Every fourth round nobody passes, so play starts straight away.
  if (direction === 'none') {
    const playing = beginPlay(base, ctx)
    events.push({ type: 'turnChanged', playerId: playing.currentPlayer })
    return { ok: true, state: playing, events }
  }

  events.push({ type: 'exchangeStarted' })
  return {
    ok: true,
    state: {
      ...base,
      phase: 'exchange',
      passing: {
        direction,
        selections: Object.fromEntries(ids.map((id) => [id, null])),
      },
      phaseDeadline: ctx.now + PASS_SECONDS * 1000,
    },
    events,
  }
}

/** The two of clubs opens every round, and its holder has no choice about it. */
function beginPlay(state: HeartsState, ctx: EngineContext): HeartsState {
  const leader = holderOfTwoOfClubs(state) ?? state.players[0]?.id ?? null
  return {
    ...state,
    phase: 'playing',
    passing: null,
    phaseDeadline: null,
    currentPlayer: leader,
    turnDeadline: deadlineFor(state, ctx.now),
    version: state.version + 1,
  }
}

function finishRound(state: HeartsState, events: GameEvent[]): HeartsState {
  const seatOrder = state.players.map((player) => player.id)
  const { points, moonShooter } = roundScores(seatOrder, state.taken)
  const scores = addScores(state.scores, points)
  const history = [...state.history, { round: state.round, points }]
  const over = reachedTarget(scores, state.settings.targetScore)

  if (moonShooter !== null) events.push({ type: 'moonShot', playerId: moonShooter })
  events.push({ type: 'roundEnded', round: state.round })
  if (over) events.push({ type: 'matchEnded' })

  return {
    ...state,
    phase: over ? 'matchEnd' : 'roundEnd',
    scores,
    history,
    currentPlayer: null,
    turnDeadline: null,
    phaseDeadline: null,
    version: state.version + 1,
  }
}

// ------------------------------------------------------------------ passing

export function pendingPassers(state: HeartsState): PlayerId[] {
  if (state.phase !== 'exchange' || state.passing === null) return []
  const selections = state.passing.selections
  return state.players
    .map((player) => player.id)
    .filter((id) => (selections[id] ?? null) === null)
}

function doChoosePass(
  state: HeartsState,
  playerId: PlayerId,
  cardIds: readonly string[],
  ctx: EngineContext,
): ActionResult<HeartsState> {
  if (state.phase !== 'exchange' || state.passing === null) return fail('wrong-phase')
  if (!state.players.some((player) => player.id === playerId)) return fail('unknown-player')
  if ((state.passing.selections[playerId] ?? null) !== null) return fail('no-pending-exchange')
  if (cardIds.length !== PASS_COUNT) return fail('wrong-card-count')

  const hand = state.hands[playerId] ?? []
  const wanted = new Set(cardIds)
  const chosen = hand.filter((card) => wanted.has(card.id))
  if (chosen.length !== wanted.size) return fail('card-not-in-hand')

  const selections = { ...state.passing.selections, [playerId]: chosen }
  const settled = settlePassing({ ...state, passing: { ...state.passing, selections } }, ctx)
  return { ok: true, state: settled.state, events: settled.events }
}

/** Nothing moves until all four have chosen — that is what makes it a pass. */
function settlePassing(
  state: HeartsState,
  ctx: EngineContext,
): { state: HeartsState; events: readonly GameEvent[] } {
  const passing = state.passing
  if (passing === null) return { state, events: [] }
  if (pendingPassers(state).length > 0) {
    return { state: { ...state, version: state.version + 1 }, events: [] }
  }

  const { hands, received } = applyPasses(state.players, state.hands, passing)
  const playing = beginPlay({ ...state, hands, received }, ctx)
  return {
    state: playing,
    events: [
      { type: 'exchangeResolved' },
      { type: 'turnChanged', playerId: playing.currentPlayer },
    ],
  }
}

// -------------------------------------------------------------------- plays

/**
 * Say precisely why a card was refused. `legalCards` decides; this only
 * explains, so the table can print a real sentence instead of shrugging.
 */
function refusalFor(state: HeartsState, playerId: PlayerId, card: Card): ActionError {
  const hand = state.hands[playerId] ?? []
  const leading = state.trick.plays.length === 0
  const leadSuit = state.trick.leadSuit

  if (leading && state.trickNumber === 1) return 'must-lead-clubs-two'
  if (leadSuit !== null && card.suit !== leadSuit && hand.some((item) => item.suit === leadSuit)) {
    return 'must-follow-suit'
  }
  if (leading && card.suit === 'H' && !state.heartsBroken) return 'hearts-not-broken'
  if (state.trickNumber === 1 && isPenalty(card)) return 'no-points-first-trick'
  return 'invalid-play'
}

function doPlay(
  state: HeartsState,
  playerId: PlayerId,
  cardIds: readonly string[],
  ctx: EngineContext,
): ActionResult<HeartsState> {
  if (state.phase !== 'playing') return fail('wrong-phase')
  if (state.currentPlayer !== playerId) return fail('not-your-turn')
  if (cardIds.length !== 1) return fail('wrong-card-count')

  const hand = state.hands[playerId]
  if (hand === undefined) return fail('unknown-player')
  const card = hand.find((item) => item.id === cardIds[0])
  if (card === undefined) return fail('card-not-in-hand')

  const legal = legalCards(state, playerId)
  if (!legal.some((item) => item.id === card.id)) return fail(refusalFor(state, playerId, card))

  const events: GameEvent[] = [{ type: 'played', playerId, cardIds: [card.id] }]
  if (card.suit === 'H' && !state.heartsBroken) {
    events.push({ type: 'heartsBroken', playerId })
  }

  const plays = [...state.trick.plays, { playerId, card }]
  const next: HeartsState = {
    ...state,
    hands: { ...state.hands, [playerId]: hand.filter((item) => item.id !== card.id) },
    trick: { plays, leadSuit: state.trick.leadSuit ?? card.suit },
    heartsBroken: state.heartsBroken || card.suit === 'H',
    version: state.version + 1,
  }

  if (plays.length < next.players.length) {
    const upcoming = nextSeat(next.players, playerId)
    events.push({ type: 'turnChanged', playerId: upcoming })
    return {
      ok: true,
      state: { ...next, currentPlayer: upcoming, turnDeadline: deadlineFor(next, ctx.now) },
      events,
    }
  }

  return { ok: true, state: takeTrick(next, ctx, events), events }
}

/** Four cards are down: award the trick, bank its penalties, and hand on the lead. */
function takeTrick(state: HeartsState, ctx: EngineContext, events: GameEvent[]): HeartsState {
  const winner = trickWinner(state.trick) ?? state.players[0]?.id ?? null
  const played = state.trick.plays.map((play) => play.card)
  const penalties = played.filter(isPenalty)

  const taken =
    winner === null
      ? state.taken
      : { ...state.taken, [winner]: [...(state.taken[winner] ?? []), ...penalties] }

  if (winner !== null) {
    events.push({ type: 'trickTaken', playerId: winner, points: trickPoints(played) })
  }
  events.push({ type: 'trickCleared', leader: winner })

  const cleared: HeartsState = {
    ...state,
    taken,
    trick: { plays: [], leadSuit: null },
    trickNumber: state.trickNumber + 1,
    version: state.version + 1,
  }

  const spent = cleared.players.every((player) => (cleared.hands[player.id] ?? []).length === 0)
  if (spent) return finishRound(cleared, events)

  events.push({ type: 'turnChanged', playerId: winner })
  return { ...cleared, currentPlayer: winner, turnDeadline: deadlineFor(cleared, ctx.now) }
}

function doTimeout(state: HeartsState, ctx: EngineContext): ActionResult<HeartsState> {
  // A stalled pass resolves for everyone at once: their three highest go.
  if (state.phase === 'exchange' && state.passing !== null) {
    const selections = { ...state.passing.selections }
    for (const id of pendingPassers(state)) {
      selections[id] = highestCards(state.hands[id] ?? [], PASS_COUNT)
    }
    const settled = settlePassing({ ...state, passing: { ...state.passing, selections } }, ctx)
    return { ok: true, state: settled.state, events: settled.events }
  }

  if (state.phase !== 'playing' || state.currentPlayer === null) return fail('wrong-phase')

  const playerId = state.currentPlayer
  const lowest = [...legalCards(state, playerId)].sort((a, b) => a.rank - b.rank)[0]
  if (lowest === undefined) return fail('wrong-phase')
  return doPlay(state, playerId, [lowest.id], ctx)
}

// ------------------------------------------------------------------ reducer

export function reduce(
  state: HeartsState,
  action: Action,
  ctx: EngineContext,
): ActionResult<HeartsState> {
  switch (action.type) {
    case 'startMatch': {
      if (state.phase !== 'lobby') return fail('wrong-phase')
      if (state.players.length !== HEARTS_MIN_PLAYERS) return fail('not-enough-players')
      return startRound(state, 1, ctx)
    }
    case 'nextRound': {
      if (state.phase !== 'roundEnd') return fail('wrong-phase')
      return startRound(state, state.round + 1, ctx)
    }
    case 'play':
      return doPlay(state, action.playerId, action.cardIds, ctx)
    case 'exchangeChoose':
      return doChoosePass(state, action.playerId, action.cardIds, ctx)
    case 'timeout':
      return doTimeout(state, ctx)
    // Daifugō's pass has no meaning here — you always play a card.
    case 'pass':
      return fail('wrong-game')
    case 'endMatch': {
      if (state.phase === 'lobby') return fail('wrong-phase')
      return {
        ok: true,
        state: { ...state, phase: 'matchEnd', version: state.version + 1 },
        events: [{ type: 'matchEnded' }],
      }
    }
  }
}

// ------------------------------------------------------------------ queries

export function legalCardIds(state: HeartsState, playerId: PlayerId): Set<string> {
  return new Set(legalCards(state, playerId).map((card) => card.id))
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run --cwd packages/game test test/hearts/engine.test.ts`
Expected: PASS — 16 tests.

- [ ] **Step 5: Run the whole engine suite**

Run: `bun run --cwd packages/game test`
Expected: PASS — Slave's tests untouched, Hearts' 47 new tests green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(hearts): the reducer — dealing, passing, tricks, scoring"
```

---

### Task 13: Register Hearts and widen `GameKind`

The moment `GameKind` gains `'hearts'`, every exhaustive switch in the repo fails
to compile and lists exactly what is left to do. Work through the list.

**Files:**
- Create: `packages/game/src/hearts/index.ts`
- Modify: `packages/game/src/core/module.ts`, `packages/game/src/index.ts`
- Modify: `packages/shared/src/view.ts` (the `playable` and score-direction branches)
- Test: `packages/game/test/module.test.ts`

**Interfaces:**
- Consumes: `heartsModule`'s parts from Tasks 8–12.
- Produces:
  - `GameKind = 'slave' | 'hearts'`, `GAME_KINDS = ['slave', 'hearts']`
  - `heartsModule: GameModule<HeartsState, HeartsSettings>`
  - `GameState = SlaveState | HeartsState`
  - `playableFor(state: GameState, playerId: PlayerId): string[]` from `src/index.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/game/test/module.test.ts`:

```ts
describe('the hearts entry in the registry', () => {
  it('describes hearts as a four-handed game where low scores win', () => {
    expect(GAME_META.hearts).toMatchObject({
      kind: 'hearts',
      minPlayers: 4,
      maxPlayers: 4,
      scoreDirection: 'low',
    })
  })

  it('builds a hearts lobby and starts it through the union', () => {
    const state = createStateFor('hearts', makePlayers(4))
    expect(state.game).toBe('hearts')
    const result = reduceGame(state, { type: 'startMatch' }, ctx())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.phase).toBe('exchange')
  })

  it('waits on all four seats during the pass', () => {
    const started = reduceGame(createStateFor('hearts', makePlayers(4)), { type: 'startMatch' }, ctx())
    if (!started.ok) throw new Error('failed to start')
    expect(waitingOnIn(started.state)).toHaveLength(4)
  })

  it('offers a bot something to pass during the pass phase', () => {
    const started = reduceGame(createStateFor('hearts', makePlayers(4)), { type: 'startMatch' }, ctx())
    if (!started.ok) throw new Error('failed to start')
    const action = botActionFor(started.state, 'p1')
    expect(action?.type).toBe('exchangeChoose')
  })
})
```

Note the last test depends on `heartsModule.botAction`, which Task 19 fills in
properly. For now `hearts/bot.ts` gets a placeholder that passes the three highest
cards and plays the lowest legal card; Task 19 replaces its body and adds its own
tests. Write it now so the module is complete — a `GameModule` with a stubbed
method is not a module.

- [ ] **Step 2: Write the first-cut `hearts/bot.ts`**

```ts
import type { Action } from '../core/module'
import type { PlayerId } from '../core/player'
import { legalCards } from './tricks'
import { highestCards } from './order'
import { pendingPassers } from './engine'
import { PASS_COUNT, type HeartsState } from './types'

/**
 * A first-cut opponent: pass the three biggest cards and always play the
 * cheapest legal one. Task 19 replaces the body with something that ducks.
 */
export function chooseHeartsAction(state: HeartsState, playerId: PlayerId): Action | null {
  if (state.phase === 'exchange') {
    if (!pendingPassers(state).includes(playerId)) return null
    const hand = state.hands[playerId] ?? []
    return {
      type: 'exchangeChoose',
      playerId,
      cardIds: highestCards(hand, PASS_COUNT).map((card) => card.id),
    }
  }

  if (state.phase !== 'playing' || state.currentPlayer !== playerId) return null
  const lowest = [...legalCards(state, playerId)].sort((a, b) => a.rank - b.rank)[0]
  if (lowest === undefined) return null
  return { type: 'play', playerId, cardIds: [lowest.id] }
}
```

- [ ] **Step 3: Write `hearts/index.ts`**

```ts
import type { GameModule } from '../core/module'
import { chooseHeartsAction } from './bot'
import {
  createInitialState,
  HEARTS_MAX_PLAYERS,
  HEARTS_MIN_PLAYERS,
  pendingPassers,
  reduce,
  seatPlayers,
  setConnected,
} from './engine'
import { DEFAULT_HEARTS_SETTINGS, type HeartsSettings, type HeartsState } from './types'

export const heartsModule: GameModule<HeartsState, HeartsSettings> = {
  kind: 'hearts',
  minPlayers: HEARTS_MIN_PLAYERS,
  maxPlayers: HEARTS_MAX_PLAYERS,
  scoreDirection: 'low',
  defaultSettings: DEFAULT_HEARTS_SETTINGS,
  createInitialState,
  applySettings: (state, patch) => ({
    ...state,
    settings: { ...state.settings, ...patch },
    version: state.version + 1,
  }),
  seatPlayers,
  setConnected,
  reduce,
  botAction: chooseHeartsAction,
  waitingOn: pendingPassers,
}
```

- [ ] **Step 4: Widen `GameKind` and extend every switch**

In `core/module.ts`:

```ts
export type GameKind = 'slave' | 'hearts'
```

In `src/index.ts`: export `./hearts/*`, add `'hearts'` to `GAME_KINDS`, widen
`GameState` to `SlaveState | HeartsState`, add the `hearts` entry to `GAME_META`,
and add a `case 'hearts':` arm to `createStateFor`, `reduceGame`, `seatPlayersIn`,
`setConnectedIn`, `applySettingsIn`, `botActionFor` and `waitingOnIn`. Also add a
new helper, because `playable` is per-game:

```ts
/** Card ids the viewer may legally use right now, whichever game this is. */
export function playableFor(state: GameState, playerId: PlayerId): string[] {
  switch (state.game) {
    case 'slave':
      return [...playableCardIds(state, playerId)]
    case 'hearts':
      return [...legalCardIds(state, playerId)]
  }
}
```

Beware a name clash: `slave/engine.ts` and `hearts/engine.ts` both export
`createInitialState`, `seatPlayers`, `setConnected`, `reduce` and `startRound`. Do
**not** `export *` from both in `src/index.ts`. Export the Slave names as today,
and from Hearts export only the non-clashing surface:

```ts
export { heartsModule } from './hearts/index'
export * from './hearts/order'
export * from './hearts/passing'
export * from './hearts/scoring'
export * from './hearts/tricks'
export * from './hearts/types'
export { legalCardIds, pendingPassers } from './hearts/engine'
```

- [ ] **Step 5: Fix `packages/shared/src/view.ts`**

`you.playable` goes through the new helper, and the score direction comes from
the meta table rather than a hardcoded branch:

```ts
          playable: playableFor(state, viewerId),
```

```ts
  const direction = GAME_META[state.game].scoreDirection
```

`buildRoomView` will not compile until `buildHeartsTable` exists. Add a temporary
`case 'hearts':` that throws `new Error('hearts view not built yet')`; Task 14
replaces it. Leave a comment saying so.

- [ ] **Step 6: Run everything**

Run: `bun run --cwd packages/game test`
Expected: PASS — 4 new registry tests included.

Run: `bun run typecheck && bun test && bun run check:fix`
Expected: green. `apps/server` compiles unchanged — it only ever touches
`GAME_META`, the narrow helpers and `GameState`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(hearts): register the module and widen GameKind"
```

---
## Stage 4 — Wire and view

### Task 14: The Hearts table view and settings

**Files:**
- Create: `packages/shared/src/views/hearts.ts`
- Modify: `packages/shared/src/view.ts`, `packages/shared/src/protocol.ts`, `packages/shared/src/index.ts`
- Modify: `apps/server/src/room.ts` (`SETTINGS_SCHEMAS`)
- Test: `apps/server/test/integration.test.ts`

**Interfaces:**
- Consumes: `HeartsState`, `PassDirection`, `PASS_COUNT`, `cardPoints`, `passTarget`, `pendingPassers` from Stage 3.
- Produces:
  - `PassingView`, `HeartsTable`, `buildHeartsTable(state: HeartsState, viewerId: PlayerId | null): HeartsTable`
  - `TableView = SlaveTable | HeartsTable`
  - `RoomView.settings: SlaveSettings | HeartsSettings`
  - `heartsSettingsPatchSchema`

- [ ] **Step 1: Write the failing test**

Append to `apps/server/test/integration.test.ts`:

```ts
describe('a hearts room', () => {
  async function createHeartsRoom(): Promise<string> {
    const response = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: 'hearts' }),
    })
    const { code } = (await response.json()) as { code: string }
    return code
  }

  it('serves a hearts table view with hearts settings', async () => {
    const code = await createHeartsRoom()
    const host = new TestClient(wsUrl, 'Host')
    await host.connect(code)
    await until(() => host.view !== null, 'view arrived')

    expect(host.view?.game).toBe('hearts')
    expect(host.view?.table.game).toBe('hearts')
    expect(host.view?.settings).toMatchObject({ targetScore: 100 })
    host.disconnect()
  })

  it('accepts a hearts settings patch and rejects a slave one', async () => {
    const code = await createHeartsRoom()
    const host = new TestClient(wsUrl, 'Host')
    await host.connect(code)
    await until(() => host.view !== null, 'view arrived')

    host.send({ type: 'settings', payload: { targetScore: 50 } })
    await until(() => host.view?.settings.targetScore === 50, 'target applied')

    host.send({ type: 'settings', payload: { eightCut: false } })
    await until(() => host.errors.includes('invalid-settings'), 'slave key refused')
    host.disconnect()
  })

  it('caps the table at four seats', async () => {
    const code = await createHeartsRoom()
    const info = await fetch(`${base}/rooms/${code}`).then((r) => r.json())
    expect(info.maxPlayers).toBe(4)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run --cwd apps/server test`
Expected: FAIL — `buildRoomView` throws `hearts view not built yet`.

- [ ] **Step 3: Write `views/hearts.ts`**

```ts
import {
  type Card,
  cardPoints,
  type HeartsState,
  PASS_COUNT,
  type PassDirection,
  passTarget,
  pendingPassers,
  type PlayerId,
  type Suit,
} from '@cards/game'

export interface PassingView {
  readonly direction: PassDirection
  /** How many cards the viewer still owes, or null once they have chosen. */
  readonly give: number | null
  /** Who this viewer is passing to. Null on a no-pass round. */
  readonly targetId: PlayerId | null
  /** Seats the table is still waiting on. */
  readonly waitingOn: readonly PlayerId[]
  /** What the viewer already chose, so a reconnect shows their own picks back. */
  readonly chosen: readonly Card[]
}

export interface HeartsTable {
  readonly game: 'hearts'
  readonly trick: {
    /** In play order, so the table can lay them out as they landed. */
    readonly plays: readonly { readonly seatId: PlayerId; readonly card: Card }[]
    readonly leadSuit: Suit | null
  }
  readonly heartsBroken: boolean
  /** 1 through 13. */
  readonly trickNumber: number
  /** Points each seat has taken this round — public, as they are at a real table. */
  readonly takenPoints: Readonly<Record<PlayerId, number>>
  /** What the viewer was passed this round. Empty on a no-pass round. */
  readonly received: readonly Card[]
  readonly passing: PassingView | null
  readonly targetScore: number
}

export function buildHeartsTable(state: HeartsState, viewerId: PlayerId | null): HeartsTable {
  const takenPoints: Record<PlayerId, number> = {}
  for (const player of state.players) {
    takenPoints[player.id] = (state.taken[player.id] ?? []).reduce(
      (total, card) => total + cardPoints(card),
      0,
    )
  }

  return {
    game: 'hearts',
    trick: {
      plays: state.trick.plays.map((play) => ({ seatId: play.playerId, card: play.card })),
      leadSuit: state.trick.leadSuit,
    },
    heartsBroken: state.heartsBroken,
    trickNumber: state.trickNumber,
    takenPoints,
    received: viewerId === null ? [] : (state.received[viewerId] ?? []),
    passing: buildPassingView(state, viewerId),
    targetScore: state.settings.targetScore,
  }
}

function buildPassingView(state: HeartsState, viewerId: PlayerId | null): PassingView | null {
  const passing = state.passing
  if (passing === null) return null

  const chosen = viewerId === null ? null : (passing.selections[viewerId] ?? null)
  return {
    direction: passing.direction,
    give: chosen === null ? PASS_COUNT : null,
    targetId: viewerId === null ? null : passTarget(state.players, viewerId, passing.direction),
    waitingOn: pendingPassers(state),
    chosen: chosen ?? [],
  }
}
```

- [ ] **Step 4: Finish `view.ts`**

```ts
export type TableView = SlaveTable | HeartsTable
```

`RoomView.settings` becomes `SlaveSettings | HeartsSettings`, and the branch that
threw is replaced:

```ts
  const table: TableView =
    state.game === 'slave' ? buildSlaveTable(state, viewerId) : buildHeartsTable(state, viewerId)
```

Add `export * from './views/hearts'` to `packages/shared/src/index.ts`.

- [ ] **Step 5: Add the Hearts settings schema**

In `packages/shared/src/protocol.ts`:

```ts
/** Hearts takes only a clock and a finish line — the rules themselves are fixed. */
export const heartsSettingsPatchSchema = z
  .object({
    turnSeconds: z.union([z.literal(15), z.literal(30), z.literal(60), z.null()]).optional(),
    targetScore: z.union([z.literal(50), z.literal(100), z.literal(200)]).optional(),
  })
  .strict()
```

In `apps/server/src/room.ts`:

```ts
const SETTINGS_SCHEMAS = {
  slave: slaveSettingsPatchSchema,
  hearts: heartsSettingsPatchSchema,
} as const
```

- [ ] **Step 6: Run the tests**

Run: `bun run --cwd apps/server test`
Expected: PASS. Remove the labelled block from Step 1 first.

Run: `bun run typecheck && bun test && bun run check:fix`
Expected: green everywhere except `apps/web`, which does not yet handle
`table.game === 'hearts'` — Task 15 fixes that.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(shared): hearts table view and settings schema"
```

---

## Stage 5 — The Hearts table on screen

### Task 15: The Hearts screens

One deliverable: a Hearts match you can play end to end in the browser. Passing,
the table, and the scoreboard ship together because you cannot reach the table
without getting through the pass.

**Files:**
- Create: `apps/web/components/game/hearts/passing-screen.tsx`, `hearts/trick-circle.tsx`, `hearts/table-screen.tsx`, `hearts/round-summary.tsx`, `hearts/seat-ring.tsx`
- Modify: `apps/web/components/game/room-screen.tsx`
- Create: `apps/web/lib/hearts.ts`

**Interfaces:**
- Consumes: `RoomView`, `HeartsTable`, `PassingView` from Task 14; `RoomActions` from Task 7; the shared `Hand`, `PlayingCard`, `Seat`, `SoundControls` components.
- Produces:
  - `relativeSeats(seats, youId): RelativeSeats` and `PASS_LABEL` from `lib/hearts.ts`
  - `HeartsPassingScreen`, `HeartsTableScreen`, `HeartsRoundSummary`, `TrickCircle`, `HeartsSeat`

- [ ] **Step 1: Write the seat-position helper**

Create `apps/web/lib/hearts.ts`:

```ts
import type { SeatView } from '@cards/shared'

export interface RelativeSeats {
  you: SeatView | null
  left: SeatView | null
  across: SeatView | null
  right: SeatView | null
}

/**
 * Put the table on screen from the viewer's chair. Turn order runs clockwise,
 * so the next seat is on your left and the one after that is opposite you —
 * which is also the order the trick's cards land in.
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

export const PASS_LABEL: Readonly<Record<string, string>> = {
  left: 'ส่งไปทางซ้าย',
  right: 'ส่งไปทางขวา',
  across: 'ส่งไปฝั่งตรงข้าม',
  none: 'รอบนี้ไม่ต้องส่งไพ่',
}
```

- [ ] **Step 2: Write the passing screen**

Create `apps/web/components/game/hearts/passing-screen.tsx`. It mirrors the
Daifugō exchange screen's structure so the two games feel like one app: a
`table-felt` column, a `font-display` heading, the shared `Hand`, and a footer
button whose label counts the picks.

```tsx
'use client'

import type { RoomView } from '@cards/shared'
import { ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Hand } from '@/components/game/hand'
import { Button } from '@/components/ui/button'
import { PASS_LABEL } from '@/lib/hearts'
import { sound } from '@/lib/sound'
import { useCountdown } from '@/lib/use-countdown'
import type { RoomActions } from '@/lib/use-room'

/** Three cards, chosen blind, all four seats at once. */
export function HeartsPassingScreen({
  view,
  actions,
}: {
  view: RoomView
  actions: RoomActions
}) {
  const table = view.table
  const you = view.you
  const roundKey = String(view.round)
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({
    key: roundKey,
    ids: [],
  })
  const selected = selection.key === roundKey ? selection.ids : []
  const remaining = useCountdown(view.phaseDeadline)

  if (table.game !== 'hearts' || table.passing === null || you === null) return null
  const passing = table.passing
  const give = passing.give
  const targetName =
    view.seats.find((seat) => seat.id === passing.targetId)?.name ?? 'คนถัดไป'
  const waitingNames = passing.waitingOn
    .map((id) => view.seats.find((seat) => seat.id === id)?.name ?? 'ใครสักคน')
    .join(', ')

  return (
    <div className="table-felt flex min-h-dvh flex-col">
      <header className="space-y-1 px-4 pt-6 text-center">
        <p className="font-extrabold text-ink/70 text-xs uppercase tracking-widest">
          รอบ {view.round} · ส่งไพ่
        </p>
        <h1 className="ink-edge font-display text-5xl text-lemon drop-shadow-[4px_4px_0_var(--ink)]">
          ส่งสามใบ
        </h1>
        <p className="flex items-center justify-center gap-1.5 font-bold text-ink text-sm">
          {PASS_LABEL[passing.direction]}
          <ArrowRight className="size-4" />
          <span className="text-bubblegum">{targetName}</span>
        </p>
        {remaining !== null && (
          <p className="tabular text-ink text-sm">{Math.ceil(remaining / 1000)}s</p>
        )}
      </header>

      <div className="flex flex-1 items-center justify-center px-4">
        {give === null && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticker-sm rounded-full bg-cream px-4 py-1.5 text-center font-bold text-ink text-sm"
          >
            ส่งแล้ว รอ {waitingNames || 'คนอื่น'}…
          </motion.p>
        )}
      </div>

      {give !== null && (
        <footer className="space-y-3 border-ink border-t-[3px] bg-rail px-4 pt-3 pb-safe">
          <p className="text-center text-sm">
            เลือกไพ่ <span className="tabular text-bubblegum">{give}</span> ใบ
          </p>
          <Hand
            dealKey={`pass-${view.round}`}
            cards={you.hand}
            selected={selected}
            playable={you.hand.map((card) => card.id)}
            interactive
            onToggle={(cardId) => {
              if (selected.includes(cardId)) {
                sound.play('card:deselect')
                setSelection({ key: roundKey, ids: selected.filter((id) => id !== cardId) })
                return
              }
              sound.play('card:select')
              // Past three, the oldest pick drops out rather than blocking the tap.
              setSelection({
                key: roundKey,
                ids: selected.length >= give ? [...selected.slice(1), cardId] : [...selected, cardId],
              })
            }}
          />
          <div className="pb-2">
            <Button
              className="w-full"
              size="lg"
              disabled={selected.length !== give}
              onClick={() => actions.exchange(selected)}
            >
              ส่ง {selected.length}/{give}
            </Button>
          </div>
        </footer>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write the trick circle**

Create `apps/web/components/game/hearts/trick-circle.tsx`. Four cards land in
four fixed places, each under the seat that played it — a pile would throw away
the one thing a Hearts player needs to read at a glance, which is who is winning
the trick.

```tsx
'use client'

import type { Card } from '@cards/game'
import type { PlayerId } from '@cards/game'
import { AnimatePresence, motion } from 'motion/react'
import { PlayingCard } from '@/components/game/playing-card'
import type { RelativeSeats } from '@/lib/hearts'
import { cn } from '@/lib/utils'

type Slot = 'you' | 'left' | 'across' | 'right'

/** Each card sits where its player sits, so the trick reads without a legend. */
const SLOT_POSITION: Readonly<Record<Slot, string>> = {
  you: 'bottom-0 left-1/2 -translate-x-1/2',
  left: 'left-0 top-1/2 -translate-y-1/2',
  across: 'top-0 left-1/2 -translate-x-1/2',
  right: 'right-0 top-1/2 -translate-y-1/2',
}

const SLOT_ENTRY: Readonly<Record<Slot, { x: number; y: number }>> = {
  you: { x: 0, y: 60 },
  left: { x: -60, y: 0 },
  across: { x: 0, y: -60 },
  right: { x: 60, y: 0 },
}

export function TrickCircle({
  plays,
  seats,
  winnerId,
}: {
  plays: readonly { seatId: PlayerId; card: Card }[]
  seats: RelativeSeats
  /** Who is currently taking the trick, so the leading card can be marked. */
  winnerId: PlayerId | null
}) {
  const slotFor = (seatId: PlayerId): Slot | null => {
    if (seats.you?.id === seatId) return 'you'
    if (seats.left?.id === seatId) return 'left'
    if (seats.across?.id === seatId) return 'across'
    if (seats.right?.id === seatId) return 'right'
    return null
  }

  return (
    <div className="relative h-[15rem] w-[15rem]">
      <AnimatePresence>
        {plays.map(({ seatId, card }) => {
          const slot = slotFor(seatId)
          if (slot === null) return null
          const entry = SLOT_ENTRY[slot]
          return (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.8, x: entry.x, y: entry.y }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={cn('absolute', SLOT_POSITION[slot])}
            >
              <PlayingCard
                card={card}
                size="sm"
                className={cn(seatId === winnerId && 'outline-4 outline-lemon outline-offset-2')}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 4: Write the seat ring**

Create `apps/web/components/game/hearts/seat-ring.tsx`. It reuses the shared
`Seat` and adds the one number Hearts needs that Daifugō does not — the points
that seat has already taken.

```tsx
'use client'

import type { SeatView } from '@cards/shared'
import { Seat } from '@/components/game/seat'
import { cn } from '@/lib/utils'

export function HeartsSeat({
  seat,
  points,
  progress,
  urgent,
  className,
}: {
  seat: SeatView | null
  points: number
  progress: number | null
  urgent: boolean
  className?: string
}) {
  if (seat === null) return null
  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <Seat seat={seat} progress={progress} urgent={urgent} compact />
      <span
        className={cn(
          'sticker-sm tabular rounded-full px-2 py-0.5 font-extrabold text-[11px] text-ink',
          points > 0 ? 'bg-bubblegum' : 'bg-cream',
        )}
      >
        {points} แต้ม
      </span>
    </div>
  )
}
```

- [ ] **Step 5: Write the Hearts table screen**

Create `apps/web/components/game/hearts/table-screen.tsx`.

```tsx
'use client'

import type { RoomView } from '@cards/shared'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Hand } from '@/components/game/hand'
import { HeartsSeat } from '@/components/game/hearts/seat-ring'
import { TrickCircle } from '@/components/game/hearts/trick-circle'
import { SoundControls } from '@/components/game/sound-controls'
import { Button } from '@/components/ui/button'
import { relativeSeats } from '@/lib/hearts'
import { sound } from '@/lib/sound'
import { useCountdown } from '@/lib/use-countdown'
import type { RoomActions } from '@/lib/use-room'
import { cn } from '@/lib/utils'

export function HeartsTableScreen({
  view,
  actions,
}: {
  view: RoomView
  actions: RoomActions
}) {
  const table = view.table
  const you = view.you
  const myTurn = view.currentPlayerId === you?.id
  // The selection belongs to one turn; when the table moves on it is derived
  // away rather than cleared in an effect.
  const turnKey = `${view.round}:${view.currentPlayerId}:${
    table.game === 'hearts' ? table.trick.plays.length : 0
  }`
  const [selection, setSelection] = useState<{ key: string; id: string | null }>({
    key: turnKey,
    id: null,
  })
  const selected = selection.key === turnKey ? selection.id : null

  const remaining = useCountdown(view.turnDeadline)
  const turnMs = (view.settings.turnSeconds ?? 0) * 1000
  const progress = remaining === null || turnMs === 0 ? null : remaining / turnMs
  const urgent = remaining !== null && remaining <= 5_000

  if (table.game !== 'hearts') return null
  const seats = relativeSeats(view.seats, you?.id ?? null)
  const winnerId = leadingSeatId(table.trick)
  const hand = you?.hand ?? []
  const myPoints = table.takenPoints[you?.id ?? ''] ?? 0

  return (
    <div className="table-felt flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-2 border-ink border-b-[3px] bg-cream px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="tabular text-ink text-sm tracking-widest">{view.code}</span>
          <span className="font-semibold text-ink/70 text-xs">
            รอบ {view.round} · ตาที่ <span className="tabular">{table.trickNumber}</span>/13
          </span>
        </div>
        <div className="flex items-center gap-1">
          {table.heartsBroken && (
            <motion.span
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="sticker-sm rounded-full bg-bubblegum px-2 py-0.5 font-extrabold text-[10px] text-ink uppercase tracking-wider"
            >
              โพแดงแตกแล้ว
            </motion.span>
          )}
          <SoundControls />
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-2 py-3">
        <div className="relative grid w-full max-w-[26rem] grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr] items-center justify-items-center gap-2">
          <div className="col-span-3">
            <HeartsSeat
              seat={seats.across}
              points={table.takenPoints[seats.across?.id ?? ''] ?? 0}
              progress={seats.across?.isCurrent === true ? progress : null}
              urgent={urgent}
            />
          </div>
          <HeartsSeat
            seat={seats.left}
            points={table.takenPoints[seats.left?.id ?? ''] ?? 0}
            progress={seats.left?.isCurrent === true ? progress : null}
            urgent={urgent}
          />
          <TrickCircle plays={table.trick.plays} seats={seats} winnerId={winnerId} />
          <HeartsSeat
            seat={seats.right}
            points={table.takenPoints[seats.right?.id ?? ''] ?? 0}
            progress={seats.right?.isCurrent === true ? progress : null}
            urgent={urgent}
          />
        </div>
      </section>

      <footer className="space-y-2 border-ink border-t-[3px] bg-rail px-4 pt-2 pb-safe">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'sticker-sm tabular rounded-full px-2 py-0.5 font-extrabold text-[11px] text-ink',
              myPoints > 0 ? 'bg-bubblegum' : 'bg-cream',
            )}
          >
            เก็บไป {myPoints} แต้ม
          </span>
          <span
            className={cn('font-medium text-xs', myTurn ? 'text-primary' : 'text-muted-foreground')}
          >
            {turnLabel(view, myTurn)}
          </span>
        </div>

        {table.received.length > 0 && table.trickNumber === 1 && (
          <p className="sticker-sm rounded-xl bg-mint px-3 py-1.5 text-center font-semibold text-ink text-xs">
            ได้รับไพ่ {table.received.map((card) => card.id).join(' · ')}
          </p>
        )}

        <Hand
          dealKey={view.round}
          cards={hand}
          selected={selected === null ? [] : [selected]}
          playable={you?.playable ?? []}
          interactive={myTurn}
          onToggle={(cardId) => {
            sound.play(selected === cardId ? 'card:deselect' : 'card:select')
            setSelection({ key: turnKey, id: selected === cardId ? null : cardId })
          }}
        />

        <div className="pb-2">
          <Button
            className="w-full"
            size="lg"
            disabled={!myTurn || selected === null}
            onClick={() => {
              if (selected === null) return
              actions.play([selected])
              setSelection({ key: turnKey, id: null })
            }}
          >
            ลงไพ่
          </Button>
        </div>
      </footer>
    </div>
  )
}

/** Who is taking the trick as it stands — the highest card of the led suit. */
function leadingSeatId(trick: {
  plays: readonly { seatId: string; card: { suit: string; rank: number } }[]
  leadSuit: string | null
}): string | null {
  if (trick.leadSuit === null) return null
  let best: { seatId: string; rank: number } | null = null
  for (const play of trick.plays) {
    if (play.card.suit !== trick.leadSuit) continue
    if (best === null || play.card.rank > best.rank) {
      best = { seatId: play.seatId, rank: play.card.rank }
    }
  }
  return best?.seatId ?? null
}

function turnLabel(view: RoomView, myTurn: boolean): string {
  if (myTurn) return view.table.game === 'hearts' && view.table.trick.plays.length === 0
    ? 'คุณเป็นคนนำ'
    : 'ตาคุณแล้ว'
  const current = view.seats.find((seat) => seat.id === view.currentPlayerId)
  if (current === undefined) return ''
  return current.connected ? `ตาของ ${current.name}` : `${current.name} หลุดอยู่…`
}
```

- [ ] **Step 6: Write the Hearts round summary**

Create `apps/web/components/game/hearts/round-summary.tsx`. Same bones as the
Daifugō summary — it is the same moment in the match — but the arithmetic points
the other way: fewest points wins, and a gained point is bad news.

```tsx
'use client'

import type { RoomView } from '@cards/shared'
import { Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import { Identicon } from '@/components/game/identicon'
import { Button } from '@/components/ui/button'
import type { RoomActions } from '@/lib/use-room'
import { cn } from '@/lib/utils'

export function HeartsRoundSummary({
  view,
  actions,
}: {
  view: RoomView
  actions: RoomActions
}) {
  const table = view.table
  const isMatchEnd = view.phase === 'matchEnd'
  const isHost = view.you?.isHost === true
  const last = view.history.at(-1)
  const target = table.game === 'hearts' ? table.targetScore : 100
  // 26 to three players in one round is the tell for a shot moon.
  const moonShooter = findMoonShooter(last?.points ?? {})

  return (
    <div className="table-felt flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        {isMatchEnd ? (
          <>
            <Trophy className="mx-auto size-10 fill-lemon text-ink" />
            <h1 className="ink-edge mt-2 font-display text-5xl text-lemon drop-shadow-[5px_5px_0_var(--ink)]">
              จบเกมแล้ว
            </h1>
            <p className="font-bold text-ink/70 text-sm">แต้มน้อยที่สุดคือผู้ชนะ</p>
          </>
        ) : (
          <>
            <p className="font-extrabold text-ink/70 text-xs uppercase tracking-widest">
              จบรอบ {view.round}
            </p>
            <h1 className="mt-1 font-extrabold text-3xl">ตารางแต้ม</h1>
            <p className="font-semibold text-ink/70 text-xs">
              เกมจบเมื่อมีคนถึง <span className="tabular">{target}</span> แต้ม
            </p>
          </>
        )}
      </motion.header>

      {moonShooter !== null && (
        <motion.p
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="sticker rounded-full bg-lemon px-5 py-2 text-center font-display text-ink text-xl"
        >
          {view.seats.find((seat) => seat.id === moonShooter)?.name ?? 'ใครบางคน'} เก็บครบ 26 —
          ยิงพระจันทร์!
        </motion.p>
      )}

      <ol className="w-full max-w-md space-y-2">
        {view.standings.map((row, index) => {
          const seat = view.seats.find((item) => item.id === row.playerId)
          if (seat === undefined) return null
          const gained = last?.points[row.playerId] ?? 0
          return (
            <motion.li
              key={row.playerId}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06 }}
              className={cn(
                'sticker flex items-center gap-3 rounded-2xl p-3',
                index === 0 ? 'bg-mint' : 'bg-card',
              )}
            >
              <span className="tabular w-5 text-center text-ink/60">{index + 1}</span>
              <div className="sticker-sm size-10 shrink-0 overflow-hidden rounded-full">
                <Identicon seed={seat.id} />
              </div>
              <p className="min-w-0 flex-1 truncate font-bold text-sm">{seat.name}</p>
              {!isMatchEnd && gained > 0 && (
                <span className="tabular text-bubblegum text-xs">+{gained}</span>
              )}
              <span className="w-8 text-right font-bold font-mono tabular-nums">{row.score}</span>
            </motion.li>
          )
        })}
      </ol>

      <div className="w-full max-w-md space-y-2 pb-safe">
        {isHost ? (
          isMatchEnd ? (
            <Button className="w-full" size="lg" onClick={actions.rematch}>
              เล่นอีกครั้ง — ห้องเดิม
            </Button>
          ) : (
            <>
              <Button className="w-full" size="lg" onClick={actions.nextRound}>
                ไปรอบถัดไป
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={actions.endMatch}
              >
                จบเกมตรงนี้
              </Button>
            </>
          )
        ) : (
          <p className="sticker-sm mx-auto w-fit rounded-full bg-cream px-4 py-1.5 text-center font-bold text-ink text-sm">
            รอเจ้าของห้องกดต่อ…
          </p>
        )}
      </div>
    </div>
  )
}

/** A shot moon is the only way three seats gain 26 in one round. */
function findMoonShooter(points: Readonly<Record<string, number>>): string | null {
  const entries = Object.entries(points)
  if (entries.length === 0) return null
  const zeroes = entries.filter(([, value]) => value === 0)
  const full = entries.filter(([, value]) => value === 26)
  if (zeroes.length !== 1 || full.length !== entries.length - 1) return null
  return zeroes[0]?.[0] ?? null
}
```

- [ ] **Step 7: Route on `(phase, game)`**

In `apps/web/components/game/room-screen.tsx`, replace `PhaseScreen`'s body:

```tsx
function PhaseScreen({ view, actions, batch }: PhaseScreenProps) {
  const hearts = view.game === 'hearts'
  switch (view.phase) {
    case 'lobby':
      return <LobbyScreen view={view} actions={actions} />
    case 'exchange':
      return hearts ? (
        <HeartsPassingScreen view={view} actions={actions} />
      ) : (
        <ExchangeScreen view={view} actions={actions} />
      )
    case 'playing':
      return hearts ? (
        <HeartsTableScreen view={view} actions={actions} />
      ) : (
        <TableScreen view={view} actions={actions} batch={batch} />
      )
    case 'roundEnd':
    case 'matchEnd':
      return hearts ? (
        <HeartsRoundSummary view={view} actions={actions} />
      ) : (
        <RoundSummary view={view} actions={actions} />
      )
  }
}
```

- [ ] **Step 8: Verify it compiles and builds**

Run: `bun run typecheck && bun run check:fix && bun run build`
Expected: all clean.

- [ ] **Step 9: Play a Hearts round and look at it**

The landing picker does not exist yet, so make the room by hand:

```bash
bun dev &
sleep 8
curl -s -X POST http://localhost:3001/rooms \
  -H 'content-type: application/json' -d '{"game":"hearts"}'
```

Open `http://localhost:3000/room/<CODE>`, add three bots, mark yourself ready and
start. Screenshot the passing screen, the table mid-trick, and the round summary
with the headless-Chrome recipe from Global Constraints, then read all three PNGs.

Check by eye: the four trick cards sit under their own players; the leading card
is ringed in lemon; the hand is grouped by suit in club/diamond/spade/heart order;
illegal cards are tinted and unclickable; the pass direction names a real player.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(web): hearts passing, table, trick circle, and scoreboard"
```

---
### Task 16: The game picker and the lobby switch

**Files:**
- Create: `apps/web/components/game/game-picker.tsx`
- Modify: `apps/web/components/game/landing-screen.tsx`, `apps/web/components/game/lobby-screen.tsx`

**Interfaces:**
- Consumes: `actions.setGame` from Task 7; `GAME_META`, `GameKind` from Task 13; `heartsSettingsPatchSchema`'s shape from Task 14.
- Produces: `GamePicker`, and `GAME_INFO: Record<GameKind, { name: string; tagline: string; accent: string }>` exported from `game-picker.tsx` for reuse in the lobby.

- [ ] **Step 1: Write the picker**

Create `apps/web/components/game/game-picker.tsx`. Each game keeps its own
wordmark rather than sitting under an invented umbrella brand — สลาฟ and โพแดง
are what people call them.

```tsx
'use client'

import type { GameKind } from '@cards/game'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

export const GAME_INFO: Readonly<
  Record<GameKind, { name: string; tagline: string; accent: string; suit: string }>
> = {
  slave: {
    name: 'สลาฟ',
    tagline: 'ทิ้งไพ่ให้หมดมือก่อนใคร · 3–6 คน',
    accent: 'bg-lemon',
    suit: '♠',
  },
  hearts: {
    name: 'โพแดง',
    tagline: 'หลบแต้มให้ได้มากที่สุด · 4 คน',
    accent: 'bg-bubblegum',
    suit: '♥',
  },
}

export function GamePicker({
  value,
  onChange,
}: {
  value: GameKind
  onChange: (game: GameKind) => void
}) {
  return (
    <div className="grid w-full max-w-sm grid-cols-2 gap-3">
      {(Object.keys(GAME_INFO) as GameKind[]).map((kind) => {
        const info = GAME_INFO[kind]
        const active = kind === value
        return (
          <motion.button
            key={kind}
            type="button"
            whileTap={{ scale: 0.96 }}
            aria-pressed={active}
            onClick={() => onChange(kind)}
            className={cn(
              'sticker sticker-lift flex flex-col items-center gap-1 rounded-3xl px-3 py-4 text-center',
              active ? info.accent : 'bg-card',
              active && 'outline-4 outline-ink outline-offset-2',
            )}
          >
            <span className="font-display text-4xl leading-none text-ink">{info.suit}</span>
            <span className="ink-edge font-display text-2xl text-ink leading-tight">
              {info.name}
            </span>
            <span className="font-semibold text-[11px] text-ink/70 leading-snug">
              {info.tagline}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Put the picker on the landing screen**

In `landing-screen.tsx`: add `const [game, setGame] = useState<GameKind>('slave')`,
render `<GamePicker value={game} onChange={setGame} />` between the header and the
form card, and send the choice when creating:

```ts
      const response = await fetch(`${SERVER_URL}/rooms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game }),
      })
```

Replace the fixed wordmark and tagline in the header with the app's two-game
identity — the animated `สลาฟ` heading becomes a neutral one:

```tsx
        <motion.h1
          animate={{ rotate: [-2.5, 2.5, -2.5] }}
          transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          className="ink-edge font-display text-6xl text-lemon leading-none drop-shadow-[5px_5px_0_var(--ink)]"
        >
          เล่นไพ่
        </motion.h1>
        <p className="mt-3 font-semibold text-ink/80 text-sm">เลือกเกม ตั้งห้อง ชวนเพื่อนมาเล่น</p>
```

And the footer pill becomes the chosen game's own line:

```tsx
      <p className="sticker-sm max-w-sm rounded-full bg-cream px-4 py-1.5 text-center font-semibold text-ink text-xs">
        {GAME_INFO[game].tagline}
      </p>
```

- [ ] **Step 3: Let the host switch games in the lobby**

In `lobby-screen.tsx`, above the player list and only for the host:

```tsx
      {isHost && view.phase === 'lobby' && (
        <section className="space-y-2">
          <h2 className="font-extrabold text-base">เกม</h2>
          <GamePicker value={view.game} onChange={actions.setGame} />
        </section>
      )}
      {!isHost && (
        <p className="text-center font-semibold text-ink/60 text-xs">
          กำลังจะเล่น {GAME_INFO[view.game].name}
        </p>
      )}
```

- [ ] **Step 4: Branch the settings panel**

`RoomSettings` in `lobby-screen.tsx` currently reads Daifugō keys off
`view.settings`, which is now a union. Split it in two and pick by game:

```tsx
function RoomSettings({ view, actions }: { view: RoomView; actions: RoomActions }) {
  return view.game === 'hearts' ? (
    <HeartsSettings view={view} actions={actions} />
  ) : (
    <SlaveSettings view={view} actions={actions} />
  )
}
```

`SlaveSettings` is the existing body, with `const settings = view.settings as SlaveSettingsType`
replaced by a proper narrow — read it from a guard at the top:

```tsx
  if (view.game !== 'slave') return null
  const settings = view.settings
```

(`RoomView.settings` narrows with `view.game` only if you make `RoomView` a
discriminated union. It is not one, so instead pass the already-narrowed values
down: give `SlaveSettings` a `settings: SlaveSettingsType` prop and read it from
`view.settings as SlaveSettingsType` at the single call site above, where the
`view.game` check has just proved it. One assertion in one place, guarded by the
check immediately above it, beats threading a discriminant through the envelope.)

`HeartsSettings` is new:

```tsx
function HeartsSettings({ view, actions }: { view: RoomView; actions: RoomActions }) {
  const settings = view.settings as HeartsSettingsType
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
```

Import the settings types as `import type { HeartsSettings as HeartsSettingsType, SlaveSettings as SlaveSettingsType } from '@cards/game'`.

- [ ] **Step 5: Fix the start-button copy for a four-seat game**

The "ต้องมีอย่างน้อย N คน" hint reads wrong when min and max are both 4. Make it
game-aware:

```tsx
            {seated < minPlayers
              ? minPlayers === maxPlayers
                ? `ต้องมี ${minPlayers} คนพอดี เพิ่มบอทเติมที่นั่งก็ได้`
                : `ต้องมีอย่างน้อย ${minPlayers} คน เพิ่มบอทเติมที่นั่งก็ได้`
              : 'รอให้ทุกคนกดพร้อมก่อน'}
```

- [ ] **Step 6: Verify**

Run: `bun run typecheck && bun run check:fix && bun run build`
Expected: all clean.

- [ ] **Step 7: Look at it**

Start the app and screenshot: the landing page with สลาฟ selected, the landing
page with โพแดง selected, a Hearts lobby showing the four-seat hint and the target
score selector, and a Slave lobby showing the unchanged 8-cut and revolution
switches. Read all four PNGs. Both games must still start from the picker.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(web): game picker on the landing page and in the lobby"
```

---

### Task 17: Sound for Hearts

**Files:**
- Modify: `apps/web/lib/sound.ts`, `apps/web/lib/use-game-sound.ts`

**Interfaces:**
- Consumes: `GameEvent`'s `trickTaken`, `heartsBroken`, `moonShot` variants from Task 4.
- Produces: `SoundName` gaining `'trick:taken'`, `'hearts:broken'`, `'moon'`.

- [ ] **Step 1: Add the three recipes**

In `apps/web/lib/sound.ts`, extend `SoundName` and `RECIPES`. Match the existing
house style: short envelopes, one or two oscillators, gain well under 0.25.

```ts
  | 'trick:taken'
  | 'hearts:broken'
  | 'moon'
```

```ts
  // A soft sweep down — cards being pulled toward someone.
  'trick:taken': [
    { freq: 520, type: 'triangle', duration: 0.14, slideTo: 300, gain: 0.12 },
    { freq: 260, type: 'sine', duration: 0.12, at: 0.05, gain: 0.08 },
  ],
  // A glassy crack, because hearts breaking is the round's turning point.
  'hearts:broken': [
    { freq: 1500, type: 'square', duration: 0.09, slideTo: 900, gain: 0.12 },
    { freq: 320, type: 'sawtooth', duration: 0.18, at: 0.04, gain: 0.1 },
  ],
  // A rising fanfare — the rarest thing that happens at this table.
  moon: [
    { freq: 440, type: 'triangle', duration: 0.14, gain: 0.16 },
    { freq: 660, type: 'triangle', duration: 0.14, at: 0.12, gain: 0.16 },
    { freq: 880, type: 'triangle', duration: 0.3, at: 0.24, gain: 0.18 },
  ],
```

- [ ] **Step 2: Map the events**

In `apps/web/lib/use-game-sound.ts`, add three cases to the switch:

```ts
        case 'trickTaken':
          name = 'trick:taken'
          if (event.playerId === myId && event.points > 0) sound.vibrate(40)
          break
        case 'heartsBroken':
          name = 'hearts:broken'
          break
        case 'moonShot':
          name = 'moon'
          break
```

- [ ] **Step 3: Hook the Hearts table up to the batch**

`HeartsTableScreen` does not currently take `batch`. It does not need it — sound
runs from `useGameSound` in `room-screen.tsx`, which already receives every batch
regardless of which screen is mounted. Confirm by reading `room-screen.tsx`: the
`useGameSound(batch, ...)` call sits above the phase switch. No change needed.

- [ ] **Step 4: Verify**

Run: `bun run typecheck && bun run check:fix && bun run build`
Expected: clean. `SoundName` is a closed union, so a missed recipe is a compile
error, not a silent gap.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): sounds for taking a trick, breaking hearts, and the moon"
```

---

## Stage 6 — A bot worth playing against, and proof it all works

### Task 18: The real Hearts bot

Replaces the first-cut bot from Task 13. A Hearts bot that always plays its lowest
card is not merely weak — it never ducks, so it takes the queen constantly and the
game is not fun.

**Files:**
- Modify: `packages/game/src/hearts/bot.ts`
- Test: `packages/game/test/hearts/bot.test.ts`

**Interfaces:**
- Consumes: `legalCards`, `isPenalty`, `cardPoints` from Task 10; `pendingPassers` from Task 12.
- Produces: `chooseHeartsAction(state, playerId): Action | null` — same signature, better body.

- [ ] **Step 1: Write the failing test**

Create `packages/game/test/hearts/bot.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { chooseHeartsAction } from '../../src/hearts/bot'
import { c, cards } from '../helpers'
import { heartsPlayingState } from './helpers'

function playedIds(action: ReturnType<typeof chooseHeartsAction>): readonly string[] {
  if (action === null || action.type !== 'play') throw new Error('expected a play')
  return action.cardIds
}

describe('the hearts bot passing', () => {
  it('gets rid of the queen of spades and the high spades first', () => {
    const state = heartsPlayingState(
      { p1: cards('12S', '14S', '13S', '2C', '3C', '4C'), p2: [], p3: [], p4: [] },
      {
        phase: 'exchange',
        currentPlayer: null,
        passing: {
          direction: 'left',
          selections: { p1: null, p2: null, p3: null, p4: null },
        },
      },
    )
    const action = chooseHeartsAction(state, 'p1')
    expect(action?.type).toBe('exchangeChoose')
    if (action?.type !== 'exchangeChoose') return
    expect([...action.cardIds].sort()).toEqual(['12S', '13S', '14S'].sort())
  })

  it('offers nothing to a seat that has already passed', () => {
    const state = heartsPlayingState(
      { p1: cards('12S', '14S', '13S'), p2: [], p3: [], p4: [] },
      {
        phase: 'exchange',
        currentPlayer: null,
        passing: {
          direction: 'left',
          selections: { p1: cards('12S', '14S', '13S'), p2: null, p3: null, p4: null },
        },
      },
    )
    expect(chooseHeartsAction(state, 'p1')).toBeNull()
  })
})

describe('the hearts bot playing', () => {
  it('leads its lowest card', () => {
    const state = heartsPlayingState({ p1: cards('9D', '3D', '13C'), p2: [], p3: [], p4: [] })
    expect(playedIds(chooseHeartsAction(state, 'p1'))).toEqual(['3D'])
  })

  it('ducks under the current winner when it can', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('3C', '9C', '14C'), p3: [], p4: [] },
      { currentPlayer: 'p2', trick: { plays: [{ playerId: 'p1', card: c('10C') }], leadSuit: 'C' } },
    )
    // The highest card that still loses — it sheds a big card safely.
    expect(playedIds(chooseHeartsAction(state, 'p2'))).toEqual(['9C'])
  })

  it('plays its lowest card when it cannot avoid winning', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('11C', '14C'), p3: [], p4: [] },
      { currentPlayer: 'p2', trick: { plays: [{ playerId: 'p1', card: c('10C') }], leadSuit: 'C' } },
    )
    expect(playedIds(chooseHeartsAction(state, 'p2'))).toEqual(['11C'])
  })

  it('dumps the queen of spades the moment it is void', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('12S', '14H', '2D'), p3: [], p4: [] },
      {
        heartsBroken: true,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('10C') }], leadSuit: 'C' },
      },
    )
    expect(playedIds(chooseHeartsAction(state, 'p2'))).toEqual(['12S'])
  })

  it('dumps its highest heart when void and holding no queen', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('14H', '3H', '2D'), p3: [], p4: [] },
      {
        heartsBroken: true,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('10C') }], leadSuit: 'C' },
      },
    )
    expect(playedIds(chooseHeartsAction(state, 'p2'))).toEqual(['14H'])
  })

  it('respects the first trick, where none of that is allowed', () => {
    const state = heartsPlayingState(
      { p1: [], p2: cards('12S', '14H', '2D'), p3: [], p4: [] },
      {
        trickNumber: 1,
        currentPlayer: 'p2',
        trick: { plays: [{ playerId: 'p1', card: c('2C') }], leadSuit: 'C' },
      },
    )
    expect(playedIds(chooseHeartsAction(state, 'p2'))).toEqual(['2D'])
  })

  it('offers nothing when it is not this seat to act', () => {
    const state = heartsPlayingState({ p1: cards('2C'), p2: cards('3C'), p3: [], p4: [] })
    expect(chooseHeartsAction(state, 'p2')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run --cwd packages/game test test/hearts/bot.test.ts`
Expected: FAIL — the first-cut bot leads its lowest card everywhere and passes the
three highest by raw rank, so ducking, the queen dump and the spade pass all fail.

- [ ] **Step 3: Rewrite `hearts/bot.ts`**

```ts
import type { Card } from '../core/card'
import type { Action } from '../core/module'
import type { PlayerId } from '../core/player'
import { pendingPassers } from './engine'
import { isPenalty, legalCards } from './tricks'
import { type HeartsState, PASS_COUNT, QUEEN_OF_SPADES } from './types'

/**
 * How badly a bot wants a card gone. The queen is the whole game, and the ace
 * and king of spades are the two cards that catch her, so they go with her.
 * After that, big hearts, then simply big cards.
 */
function passDanger(card: Card): number {
  if (card.id === QUEEN_OF_SPADES) return 100
  if (card.suit === 'S' && card.rank > 12) return 90 + card.rank
  if (card.suit === 'H') return 40 + card.rank
  return card.rank
}

const lowestFirst = (a: Card, b: Card): number => a.rank - b.rank

/**
 * A deliberately simple opponent that nonetheless plays the two moves that
 * matter: it ducks under the trick when it can, and it throws its worst card
 * away the moment it is void. Good enough to fill a seat and to keep a human
 * honest about the queen.
 */
export function chooseHeartsAction(state: HeartsState, playerId: PlayerId): Action | null {
  if (state.phase === 'exchange') {
    if (!pendingPassers(state).includes(playerId)) return null
    const hand = state.hands[playerId] ?? []
    const worst = [...hand].sort((a, b) => passDanger(b) - passDanger(a)).slice(0, PASS_COUNT)
    return { type: 'exchangeChoose', playerId, cardIds: worst.map((card) => card.id) }
  }

  if (state.phase !== 'playing' || state.currentPlayer !== playerId) return null

  const legal = [...legalCards(state, playerId)].sort(lowestFirst)
  const cheapest = legal[0]
  if (cheapest === undefined) return null

  const play = (card: Card): Action => ({ type: 'play', playerId, cardIds: [card.id] })

  // Leading: the cheapest card keeps the lead cheap.
  const leadSuit = state.trick.leadSuit
  if (leadSuit === null) return play(cheapest)

  const following = legal.filter((card) => card.suit === leadSuit)
  if (following.length > 0) {
    const toBeat = highestOfSuit(state, leadSuit)
    // The biggest card that still loses: shed weight without taking the trick.
    const under = following.filter((card) => card.rank < toBeat)
    const duck = under.at(-1)
    return play(duck ?? following[0] ?? cheapest)
  }

  // Void, and free to throw anything legal — so throw the most expensive thing.
  const queen = legal.find((card) => card.id === QUEEN_OF_SPADES)
  if (queen !== undefined) return play(queen)

  const hearts = legal.filter((card) => card.suit === 'H')
  const worstHeart = hearts.at(-1)
  if (worstHeart !== undefined) return play(worstHeart)

  const biggest = legal.at(-1)
  return play(biggest ?? cheapest)
}

/** The rank currently taking the trick. */
function highestOfSuit(state: HeartsState, suit: Card['suit']): number {
  let best = 0
  for (const play of state.trick.plays) {
    if (play.card.suit !== suit) continue
    if (play.card.rank > best) best = play.card.rank
  }
  return best
}
```

Note `isPenalty` is imported but only used if you extend the void branch; if
Biome flags it as unused, drop the import rather than inventing a use for it.

- [ ] **Step 4: Run the tests**

Run: `bun run --cwd packages/game test test/hearts/bot.test.ts`
Expected: PASS — 9 tests.

Run: `bun run --cwd packages/game test`
Expected: PASS — everything, including the registry test from Task 13 that asserts
a bot offers an `exchangeChoose` during the pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(hearts): a bot that ducks and sheds the queen"
```

---

### Task 19: Server integration tests for Hearts

Mirrors the existing Daifugō suite: a full match over real sockets, a mid-round
disconnect and reconnect, and a pass-phase timeout.

**Files:**
- Modify: `apps/server/test/client.ts` (a Hearts-aware turn driver)
- Modify: `apps/server/test/integration.test.ts`

**Interfaces:**
- Consumes: `TestClient`, `until`, `sleep` from the existing harness.
- Produces: `heartsTurn(client): void` and `passThree(client): void` in `client.ts`.

- [ ] **Step 1: Add the Hearts turn driver**

Append to `apps/server/test/client.ts`:

```ts
/** Play the first legal card the server offered. Hearts plays exactly one. */
export function heartsTurn(client: TestClient): void {
  const view = client.view
  const you = view?.you
  if (view == null || you == null) return
  const cardId = you.playable[0]
  if (cardId === undefined) return
  client.send({ type: 'play', payload: { cardIds: [cardId] } })
}

/** Pass the first three cards in hand, for whichever seats this test owns. */
export function passThree(client: TestClient): void {
  const you = client.view?.you
  if (you == null) return
  const cardIds = you.hand.slice(0, 3).map((card) => card.id)
  if (cardIds.length < 3) return
  client.send({ type: 'exchange', payload: { cardIds } })
}
```

Two small helpers are enough: the Hearts tests below seat one human among three
bots and drive only that seat, so there is no multi-client turn loop to write.

- [ ] **Step 2: Write the failing tests**

First extend the import at the top of `apps/server/test/integration.test.ts`:

```ts
import { heartsTurn, passThree, playOutRound, sleep, TestClient, until } from './client'
```

(`playOutRound` is the existing Daifugō driver — keep it, the Slave tests use it.)

Then append:

```ts
describe('a full hearts match', () => {
  async function createHearts(): Promise<string> {
    const response = await fetch(`${base}/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ game: 'hearts' }),
    })
    const { code } = (await response.json()) as { code: string }
    return code
  }

  it('plays four bots from the lobby to a finished match', async () => {
    const code = await createHearts()
    const host = new TestClient(wsUrl, 'Watcher')
    await host.connect(code)
    await until(() => host.view !== null, 'joined')

    // A short target so the match ends in a couple of rounds.
    host.send({ type: 'settings', payload: { targetScore: 50 } })
    await until(() => host.view?.settings.targetScore === 50, 'target set')

    for (let i = 0; i < 3; i++) host.send({ type: 'addBot' })
    await until(() => host.view?.seats.length === 4, 'table full')

    // One human among three bots — the human seat is driven by the loop below.
    host.send({ type: 'ready', payload: { ready: true } })
    await until(() => host.seat?.ready === true, 'ready')
    host.send({ type: 'start' })

    await until(() => host.view?.phase !== 'lobby', 'match started', 15_000)

    // Drive only the human seat; the three bots drive themselves.
    for (let step = 0; step < 2_000; step++) {
      const view = host.view
      if (view?.phase === 'matchEnd') break
      if (view?.phase === 'roundEnd' && view.you?.isHost === true) {
        host.send({ type: 'nextRound' })
      } else if (view?.phase === 'exchange') {
        const passing = view.table.game === 'hearts' ? view.table.passing : null
        if (passing?.give !== null && passing?.give !== undefined) passThree(host)
      } else if (view?.phase === 'playing' && host.myTurn) {
        heartsTurn(host)
      }
      await sleep(20)
    }

    expect(host.view?.phase).toBe('matchEnd')
    const top = host.view?.standings[0]
    expect(top).toBeDefined()
    // Lowest score wins, so the leader is the lowest of the four.
    const scores = (host.view?.standings ?? []).map((row) => row.score)
    expect(top?.score).toBe(Math.min(...scores))
  }, 90_000)

  it('never puts another hand on the wire', async () => {
    const code = await createHearts()
    const host = new TestClient(wsUrl, 'Alice')
    await host.connect(code)
    await until(() => host.view !== null, 'joined')
    for (let i = 0; i < 3; i++) host.send({ type: 'addBot' })
    await until(() => host.view?.seats.length === 4, 'table full')
    host.send({ type: 'ready', payload: { ready: true } })
    await until(() => host.seat?.ready === true, 'ready')
    host.send({ type: 'start' })
    await until(() => host.view?.phase === 'exchange', 'dealt')

    const serialised = JSON.stringify(host.view)
    // Only the viewer's own thirteen cards may appear anywhere in the payload.
    const mine = new Set((host.view?.you?.hand ?? []).map((card) => card.id))
    expect(mine.size).toBe(13)
    expect(host.view?.seats.every((seat) => seat.handCount === 13)).toBe(true)
    expect(serialised).not.toContain('"taken"')
    host.disconnect()
  })

  it('resolves the pass on the deadline when a seat never chooses', async () => {
    const code = await createHearts()
    const host = new TestClient(wsUrl, 'Idle')
    await host.connect(code)
    await until(() => host.view !== null, 'joined')
    for (let i = 0; i < 3; i++) host.send({ type: 'addBot' })
    await until(() => host.view?.seats.length === 4, 'table full')
    host.send({ type: 'ready', payload: { ready: true } })
    await until(() => host.seat?.ready === true, 'ready')
    host.send({ type: 'start' })
    await until(() => host.view?.phase === 'exchange', 'passing')

    // Say nothing. The three bots pass immediately; the deadline covers the human.
    host.disconnect()
    // A disconnected seat resolves on the short fuse, not the 30s pass clock.
    await sleep(timings.disconnectedTurnMs + 500)

    const watcher = new TestClient(wsUrl, 'Idle')
    await watcher.connect(code, host.token)
    await until(() => watcher.view?.phase === 'playing', 'pass resolved', 45_000)
    expect(watcher.view?.you?.hand).toHaveLength(13)
    watcher.disconnect()
  }, 60_000)
})
```

- [ ] **Step 3: Run to verify they fail, then pass**

Run: `bun run --cwd apps/server test`
Expected: the three new tests run against the real stack. If the deadline test
hangs, the fault is in `scheduleTimers` — a disconnected seat during a
simultaneous phase must still be covered by `phaseDeadline`. Check that
`waitingOnIn` returns the human's id and that `state.phaseDeadline` is non-null;
if a disconnected seat needs the short fuse during `exchange` too, add it there
the same way the `playing` branch does, and say so in the commit message.

- [ ] **Step 4: Verify the whole suite**

Run: `bun test && bun run typecheck && bun run check:fix`
Expected: green — Slave's 11 integration tests plus the Hearts ones.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(server): a full hearts match, redaction, and a stalled pass"
```

---

## Stage 7 — Polish
### Task 20: Update the README

The README currently opens "A multiplayer **Daifugō** (สลาฟ / President) card
game". That is now false. Every step below names the exact prose to write, so the
result reads in one voice rather than as a Hearts section bolted onto a Daifugō
document.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the finished implementation.
- Produces: documentation only.

- [ ] **Step 1: Replace the title and lead**

```markdown
# เล่นไพ่

Two multiplayer card games in one room: **สลาฟ** (Daifugō / President) and
**โพแดง** (Hearts), with a Thai interface. Create a room, pick a game, share the
six-character code. Disconnecting never costs you your seat: while a match is
running you can close the tab, come back, and your hand is still there.

```bash
bun install
bun dev          # web on :3000, game server on :3001
```

Open <http://localhost:3000>, choose a game, create a room, and either share the
invite link or fill the empty seats with bots.
```

- [ ] **Step 2: Rewrite the layout table's first row**

```markdown
| `packages/game` | Two rules engines behind one `GameModule` interface, over the plain deck they share. Pure functions, no I/O. |
```

Leave the other three rows as they are; they are still accurate.

Then replace the sentence under the table:

```markdown
The rules engines know nothing about sockets, the socket layer knows nothing
about React, and neither knows which game is being played — the room resolves
that through the registry. Which is why the whole thing can be tested without a
browser, and why adding a third game touches no networking code.
```

- [ ] **Step 3: Put the real numbers in `## Commands`**

Run `bun test` and read the counts off the output. Replace the paragraph under the
command block with the true figures in the same shape as the existing sentence:

```markdown
`bun test` runs N engine tests plus M integration tests that drive real WebSocket
clients through a full round of each game, a mid-game disconnect and reconnect, a
forged-token attempt, a stalled Hearts pass, and a bot-only match.
```

- [ ] **Step 4: Split `## Rules` in two**

Keep the existing Daifugō content verbatim under a `### สลาฟ (Daifugō)` heading,
including the tribute subsection. Add beside it:

```markdown
### โพแดง (Hearts)

Four players, a plain 52-card deck, thirteen cards each. Points are bad and the
lowest score wins.

- Before each round you pass **three cards** face down — left in round one, right
  in round two, across in round three, and nothing in round four. Then it repeats.
- The holder of **♣2 leads** the first trick and must lead that card.
- **Follow the led suit** if you can. The highest card of that suit takes the
  trick and leads the next one.
- You cannot **lead a heart** until one has been discarded on another suit. The
  ♠Q does not break hearts.
- The **first trick takes no points** — no heart, no ♠Q — unless your hand holds
  nothing else.
- Each heart is **1 point**, the **♠Q is 13**. Twenty-six a round.
- Take **all twenty-six** and you shoot the moon: you score nothing and the other
  three take 26 each.
- The match ends the moment anyone reaches the target score.
```

- [ ] **Step 5: Split the settings table in two**

Retitle the existing table `#### สลาฟ` and leave its four rows. Add:

```markdown
#### โพแดง

| Setting | Default | Effect |
| --- | --- | --- |
| Turn timer | 30s | 15 / 30 / 60 / off. On expiry you play your lowest legal card, or pass your three highest if the round's pass is still open. |
| Target score | 100 | 50 / 100 / 200. The match ends the moment anyone reaches it. |

The rest of the Hearts rules are fixed. No ♦J, no ♠Q-breaks-hearts, no taking
−26 for the moon — the variants make the game less legible, not more interesting.
```

- [ ] **Step 6: Add one bullet to `## How the multiplayer works`**

Place it directly after the "Server-authoritative" bullet:

```markdown
- **One room layer, two games.** The room resolves rules through a `GameModule`
  looked up from the state's own `game` tag. Reconnect, seat tokens, host
  migration, the turn clock and the bots are the same code in both games, which
  is why fixing one fixes both.
```

- [ ] **Step 7: Extend `## Look` with the Hearts table**

Append two paragraphs to that section:

```markdown
Hearts lays its trick out in a circle rather than a pile: four cards, each sitting
under the player who played it, with the card currently taking the trick ringed in
lemon. A pile would throw away the one thing a Hearts player reads every few
seconds — who is winning this trick and whether it is safe to dump the queen.

The deck's four colours matter more here than in สลาฟ. Daifugō asks you to compare
ranks; Hearts asks whether you are void in a suit, twelve times a round, under a
clock. Grouping the hand club-diamond-spade-heart and colouring all four suits
turns that question into a glance.
```

- [ ] **Step 8: Verify the claims**

Run: `bun test` — confirm the counts you wrote in Step 3 match.
Run: `bun run build` — confirm the documented commands still work.
Run: `bun run check` — the README is not linted, but the tree must be clean.

Read the finished README top to bottom. Any sentence that still says the app plays
one game is a bug.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "docs: two games, one table"
```

---

## Done

At this point the repo plays two games from one landing screen, over one socket
protocol, with one reconnect path. A third game would be: a new folder under
`packages/game/src/`, a `GameModule`, a `views/<game>.ts`, a branch in
`room-screen.tsx`, and an entry in `GAME_INFO`. No networking code.
