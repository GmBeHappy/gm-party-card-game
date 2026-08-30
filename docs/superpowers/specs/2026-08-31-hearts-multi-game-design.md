# Two games, one table: adding Hearts

**Date:** 2026-08-31
**Status:** approved, not yet implemented

## What we are building

The app plays one game, Daifugō (สลาฟ). It should play two. Hearts (โพแดง) joins
it, following the rules at <https://cardgames.io/hearts/#rules>.

A player picks the game on the landing screen; the host can still change it in
the lobby before the match starts. Everything else about a room — the six-letter
code, the invite link, seat tokens, reconnection, bots, host migration — works
identically whichever game is being played.

### Decisions taken up front

| Question | Decision |
| --- | --- |
| Hearts table size | Exactly 4. The host fills empty seats with bots. |
| Where the game is chosen | Landing screen picks it; the host may change it in the lobby. |
| Hearts rule options | Match the reference. Only the turn timer and the target score are configurable. |

## Why the current shape does not stretch

Three things in the codebase are Daifugō-shaped and have to move before a second
game can exist beside the first.

**The card.** `CardRank` is `3 | 4 | … | 15`, where `15` is the `2`, because that
is Daifugō's order. Hearts wants `A` high and `2` low. A core deck should be a
real deck, so ranks become standard `2..14` and each game supplies its own
ordering.

**The state.** `GameState` names tricks, revolutions, roles and tributes
directly. Hearts has none of those and has four of its own.

**The view.** `RoomView` flattens Daifugō concepts (`revolution`, `canPass`,
`role`, `finishedPlace`) into the top level and into every `SeatView`.

The socket layer is already game-agnostic in substance — join, detach, host
migration, garbage collection and the timer loop never mention a rule. That code
is kept and generalised, not rewritten.

## Architecture

### Package layout

`packages/game` splits three ways. `core/` knows about cards and seats and
nothing else; `slave/` and `hearts/` each own one game's rules.

```
packages/game/src/
  core/
    card.ts      Suit, Rank (2..14), Card, createDeck, shuffle, deal, labels
    rng.ts       unchanged
    player.ts    Player, PlayerId, seat-order walking
    scoring.ts   addScores, standings(scores, seatOrder, direction)
    phase.ts     Phase, RoundResult, BaseState
    module.ts    GameKind, GameModule, Action/ActionResult/EngineContext
  slave/
    order.ts     daifugoOrder, strength, sortHand
    types.ts     SlaveState, SlaveSettings, Play, PlayKind, RoleName
    plays.ts  roles.ts  exchange.ts  scoring.ts  bot.ts  engine.ts
    index.ts     slaveModule
  hearts/
    order.ts     rank order (A high), sortHand by suit then rank
    types.ts     HeartsState, HeartsSettings
    passing.ts   rotation, pass application
    tricks.ts    legalPlays, trickWinner, trickPoints
    scoring.ts   roundScores, shot-the-moon, match end
    bot.ts  engine.ts
    index.ts     heartsModule
  index.ts       GAMES registry, re-exports
```

Package names become `@cards/game` and `@cards/shared`. `@slave/*` as the
namespace for a two-game app is confusing, and the rename is mechanical.

### The card

`Rank` is `2 | 3 | … | 14`, ace high, and a card id is `rank + suit` — `2S`,
`10H`, `14D`. Slave applies its own order:

```ts
// slave/order.ts
export const daifugoOrder = (rank: Rank): number => (rank === 2 ? 15 : rank)
export const strength = (card: Card, revolution: boolean): number =>
  revolution ? -daifugoOrder(card.rank) : daifugoOrder(card.rank)
```

Nothing about Slave's behaviour changes: `3 < 4 < … < K < A < 2` still holds, the
♦3 lead is still `rank === 3 && suit === 'D'`, and 8-cut still tests `rank === 8`.
The visible cost is that card ids in the existing tests move from `15S` to `2S`,
about thirty mechanical edits.

### The module interface

```ts
export type GameKind = 'slave' | 'hearts'

export interface BaseState {
  readonly game: GameKind
  readonly phase: Phase
  readonly players: readonly Player[]
  readonly round: number
  readonly hands: Readonly<Record<PlayerId, readonly Card[]>>
  readonly scores: Readonly<Record<PlayerId, number>>
  readonly currentPlayer: PlayerId | null
  readonly turnDeadline: number | null
  /** Deadline for a simultaneous phase (tribute, passing); null otherwise. */
  readonly phaseDeadline: number | null
  readonly history: readonly RoundResult[]
  readonly version: number
}

export type GameState = SlaveState | HeartsState   // discriminated on `game`

export interface GameModule<S extends BaseState, Settings> {
  readonly kind: GameKind
  readonly minPlayers: number
  readonly maxPlayers: number
  readonly defaultSettings: Settings
  createInitialState(players: readonly Player[], settings: Settings): S
  applySettings(state: S, patch: Partial<Settings>): S
  seatPlayers(state: S, players: readonly Player[]): S
  setConnected(state: S, id: PlayerId, connected: boolean): S
  reduce(state: S, action: Action, ctx: EngineContext): ActionResult<S>
  /** The action a bot in this seat should take, in whatever phase. */
  botAction(state: S, playerId: PlayerId): Action | null
  /** During a simultaneous phase, the seats still to act. */
  waitingOn(state: S): readonly PlayerId[]
}
```

`RoundResult` in `core/phase.ts` narrows to `{ round, points }`, which is all the
scoreboard renders today. Slave's per-round `finishOrder` moves out of shared
history and into `SlaveTable`. `RoomSettings` is renamed `SlaveSettings`, since
it is now one game's settings rather than the room's.

`waitingOn` generalises the exchange-phase special case in `scheduleTimers`, so
the tribute and the Hearts pass share one timer path. `botAction` covers play,
pass, tribute and passing, replacing the two separate bot entry points.

Modules stay free of wire concerns. Redaction remains in `@cards/shared`, which
already depends on the engine, with one view builder per game. That preserves the
invariant the README states: the rules engine knows nothing about sockets.

### Phases

The phase union stays shared and unchanged:

```
lobby | exchange | playing | roundEnd | matchEnd
```

Hearts uses `exchange` for its passing phase, so `room-screen`'s phase routing
and the server's deadline handling need no new cases. A Hearts round with no
pass goes straight to `playing`, exactly as a Citizen-only Slave round already
does.

### The view

The envelope is shared; the game-specific slice hangs off `table`.

```ts
interface RoomView {
  code, hostId, phase, round, version
  game: GameKind
  settings: SlaveSettings | HeartsSettings
  seats: readonly SeatView[]        // id, name, isBot, connected, ready, isHost, handCount, score, isCurrent
  you: YouView | null               // id, hand, playable, isHost, score
  currentPlayerId, turnDeadline
  waiting, youAreWaiting, history, standings
  table: SlaveTable | HeartsTable   // discriminated on `game`
}

type SlaveTable = {
  game: 'slave'
  trick: { cards: readonly Card[] | null; count: number | null; leaderId: PlayerId | null }
  revolution: boolean
  canPass: boolean
  roles: Readonly<Record<PlayerId, RoleName>>
  finishOrder: readonly PlayerId[]
  passedIds: readonly PlayerId[]
  exchange: ExchangeView | null
}

type HeartsTable = {
  game: 'hearts'
  trick: { plays: readonly { seatId: PlayerId; card: Card }[]; leadSuit: Suit | null }
  heartsBroken: boolean
  trickNumber: number               // 1..13
  takenPoints: Readonly<Record<PlayerId, number>>
  passing: PassingView | null       // direction, give, received, waitingOn, deadline
}
```

`you.playable` needs no change — it already means "card ids that are legal right
now", which is as true of following suit as of beating a pile. Slave's
`revolution`, `canPass`, `role`, `finishedPlace` and `passed` move off the top
level and off `SeatView` into `SlaveTable`.

## Hearts rules

Four players, a standard 52-card deck, thirteen cards each.

**Passing.** Round 1 passes three cards left, round 2 right, round 3 across,
round 4 nothing, then the cycle repeats. All four players choose simultaneously;
the phase ends when every seat has chosen. On the deadline an unchosen seat
passes its three highest cards.

**The lead.** The holder of ♣2 leads the first trick and must lead ♣2.

**Following.** You must follow the led suit if you hold it. Hearts may not be
led until hearts are broken — that is, until a heart has been discarded on
another suit. ♠Q does not break hearts. On the first trick you may not play a
heart or ♠Q unless your hand holds nothing else.

**Taking.** The highest card of the led suit wins the trick and leads the next.

**Scoring.** Each heart is 1 point, ♠Q is 13 — twenty-six in a round. Points are
bad. If one player takes all twenty-six, they score 0 and the other three take 26
each.

**The match.** It ends the moment any player's total reaches the target — 50,
100 (default) or 200. Lowest total wins, so `standings` gains a sort direction
and match-end detection moves into the module. Ties break on seat order in both
directions, as they do today.

**Timeouts.** A player out of time in `playing` plays their lowest legal card. A
player out of time in `exchange` passes their three highest cards.

### The one thing not in the reference

The reference page does not mention the first-trick restriction on point cards.
cardgames.io enforces it in play and it is standard Hearts, so it is specified
above. If it turns out to be unwanted it is a single predicate in
`hearts/tricks.ts`.

## Server

`apps/server` keeps its shape. `room.ts` resolves `GAMES[room.state.game]` and
calls the module rather than importing `reduce` directly. Three concrete changes:

- `POST /rooms` accepts `{ game }` and seeds the room with that module's default
  settings. Omitting it defaults to `slave`.
- `updateSettings` validates against the active game's patch schema, and a new
  `setGame` host action swaps the module in the lobby, resetting settings to that
  game's defaults. Seats beyond the new game's maximum move to the waiting list
  rather than being kicked, so switching a six-player Slave room to Hearts leaves
  two people in the room for the next match instead of ejecting them.
- `scheduleTimers` drives simultaneous phases through `waitingOn` and bots
  through `botAction`, instead of naming the exchange phase.

`GET /rooms/:code` reports the room's `game` and that module's `maxPlayers`, so
the join form can say what it is joining.

### Wire contract

`clientMessageSchema` gains a `setGame` message and splits its settings patch in
two — `slaveSettingsPatchSchema` and `heartsSettingsPatchSchema` — validated
against the room's active game. The `play` payload keeps its shape; Hearts simply
always sends exactly one card id.

`ERROR_CODES` gains the Hearts refusals, each with a Thai message alongside the
existing ones:

| Code | Meaning |
| --- | --- |
| `must-follow-suit` | You hold the led suit and must play it. |
| `must-lead-clubs-two` | The first trick of a round has to open with ♣2. |
| `hearts-not-broken` | Hearts cannot be led until one has been discarded. |
| `no-points-first-trick` | No heart or ♠Q on the first trick while you hold anything else. |
| `wrong-game` | The action does not belong to the game this room is playing. |

`invalid-play`, `not-your-turn`, `card-not-in-hand`, `wrong-phase` and
`wrong-card-count` are reused unchanged; `cannot-beat` and `cannot-pass` stay
Slave-only.

## Web

Shared and untouched: `hand`, `playing-card`, `seat`, `identicon`,
`turn-ring`, `sound-controls`, `reconnect-overlay`, `table-flash`, and the
socket and session hooks.

- **Landing** gains a two-sticker game picker above the existing name and
  create/join form. Each sticker carries its own wordmark — สลาฟ and โพแดง — so
  the app needs no invented umbrella brand.
- **Lobby** gains a host-only game switch and a settings panel that branches on
  `view.game`. Seat limits come from the view rather than the imported
  `MIN_PLAYERS`/`MAX_PLAYERS` constants.
- **Room screen** routes on `(phase, game)`: `exchange` goes to the tribute
  screen or the passing screen, `playing` to one of the two tables.
- **New Hearts components** under `components/game/hearts/`: a passing screen
  (pick exactly three, with the direction named), a table that lays the trick's
  four cards around a centre point anchored to each player's seat direction, and
  a round summary that shows points taken and calls out a shot moon.
- Hearts sorts the hand by suit then rank, not by strength.
- Sound reuses the existing synthesised effects, plus a trick-taken cue and a
  moon-shot sting.

## Testing

The existing 99 Slave tests are what makes this refactor safe. Stages 1 and 2
must leave them green with no changes beyond card ids.

New Hearts unit tests, roughly 60–70: passing rotation across a full cycle, the
♣2 lead requirement, following suit, the hearts-broken gate, the first-trick
restriction and its escape hatch, trick winner selection, round scoring, the moon
shot, match end at each target score, both timeout paths, and bot behaviour.

New server integration tests, mirroring the existing suite: a four-bot Hearts
match driven to `matchEnd`, a mid-round disconnect and reconnect, and a
pass-phase timeout.

## Stages

Each stage ends with a green `bun test`, `bun run check` and `bun run typecheck`.

1. **Core split, rank scheme, rename.** No behaviour change. Slave is still the
   only game.
2. **`GameModule` and plumbing.** The `game` discriminant, the module registry,
   the generic room layer and the split view. Slave is still the only game.
3. **Hearts engine.** Rules and unit tests, headless.
4. **Protocol, view and settings** for Hearts.
5. **Web:** picker, lobby switch, passing screen, table.
6. **Hearts bot** and server integration tests.
7. **Polish:** sound, motion, README.

## Out of scope

Deliberately not in this piece of work: Hearts at any table size but four, rule
variants (♦J, ♠Q breaking hearts, taking −26 for a moon), per-game persistent
statistics, and a third game.
