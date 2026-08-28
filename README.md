# สลาฟ (Slave)

A multiplayer **Daifugō** (สลาฟ / President) card game, with a Thai interface. Create a room, share
the six-character code, and play 3–6 handed in the browser. Disconnecting never
costs you your seat: while a match is running you can close the tab, come back,
and your hand is still there.

```bash
bun install
bun dev          # web on :3000, game server on :3001
```

Open <http://localhost:3000>, create a room, and either share the invite link or
fill the empty seats with bots.

## Layout

| Package | What it is |
| --- | --- |
| `packages/game` | The rules engine. Pure functions, no I/O, 99 unit tests. |
| `packages/shared` | The wire contract: Zod message schemas, error codes, and the redaction that turns authoritative state into one player's view. |
| `apps/server` | Elysia on Bun. HTTP for room lifecycle, WebSocket for play. |
| `apps/web` | Next.js 16 App Router, Tailwind v4, shadcn/ui on Radix, Motion. |

The rules engine knows nothing about sockets and the socket layer knows nothing
about React, which is why the whole game can be tested without a browser.

## Commands

```bash
bun dev          # both apps
bun run build    # production build of the web app
bun test         # rules engine (Vitest) + server integration (bun test)
bun run check    # Biome lint + format
bun run typecheck
```

`bun test` runs 99 engine tests plus 11 integration tests that drive real
WebSocket clients through a full round, a mid-game disconnect and reconnect, a
forged-token attempt, and a bot-only game.

## Rules

Standard Daifugō on a plain **52-card deck — no jokers**.

- Ranks run `3 < 4 < … < K < A < 2`.
- A play is **1–4 cards of one rank**: single, pair, triple, or quad. You must
  answer with the same shape at a higher rank.
- **Passing locks you out** of the current trick. When everyone but the last
  player to play has passed, the trick clears and that player leads.
- The **♦3 holder** leads the first trick of round one. After that the **Slave**
  leads, which is their compensation for the tribute.
- First out is **เศรษฐี** (President), last is **สลาฟ** (Slave). Points are
  `playerCount − position`, so in a four-player game: 3 / 2 / 1 / 0.

### Between rounds — the tribute

The Slave's **two strongest cards are taken automatically** — that is the whole
point of being the Slave — and the President chooses **any two** to send back.
At five or more players the Vice pair swaps one card on the same terms;
Citizens exchange nothing. If the President stalls, their two weakest cards go
automatically after 30 seconds, so a match can never deadlock behind one idle
player.

### Room settings

| Setting | Default | Effect |
| --- | --- | --- |
| 8-cut | on | Any play containing an 8 ends the trick immediately; the cutter leads next. |
| Revolution | on | A four-of-a-kind inverts the rank order for the rest of the round. A second quad flips it back. |
| Turn timer | 30s | 15 / 30 / 60 / off. On expiry you auto-pass, or shed your lowest card if you were leading. |
| Rounds | 5 | 3 / 5 / 10, or endless until the host ends it. |

## How the multiplayer works

- **Server-authoritative.** Clients send intents; the server runs them through
  the rules engine and pushes back a fresh snapshot. Nothing is optimistic.
- **Redacted snapshots.** Every player receives their own view, in which other
  hands are card *counts*. Other players' cards never travel over the wire, so
  there is nothing to read in devtools.
- **Reconnect is just a snapshot.** Joining, refreshing, and reconnecting all
  take the identical code path, which is why reconnection is hard to break.
- **Seat tokens are HMAC-signed** (`playerId.roomCode.signature`) and stored in
  `localStorage`. A token from one room will not open a seat in another.
- **Seats are held for the whole match.** A disconnected player auto-passes so
  play continues, and reclaims their hand whenever they return. Bots never take
  over a human's seat.
- **The host role migrates** to the longest-connected player, so a vanished host
  cannot stall the table.
- Rooms live in memory behind a `RoomStore` interface and are collected ten
  minutes after the last player disconnects. Swapping in Redis is one
  implementation of that interface.

## Look

Sticker book. Every surface — card, seat, button, panel — is die-cut: a 3px
outline in grape ink (`#2B1B3D`, never black) over a hard offset shadow with no
blur, and buttons drop into their own shadow when pressed. The table is mint
felt, panels are warm cream, and the accents are bubblegum, tangerine and lemon.

The interface is in Thai, which decides the type: Latin display faces have no
Thai glyphs, so all three families cover the script. **Itim** appears only on the
wordmark, the ปฏิวัติ and ตัด 8 flashes, ส่งส่วย and จบเกมแล้ว; **Mali** sets every
other word; **Nunito** with tabular figures handles card counts, scores, timers
and room codes, which have to line up in a column. Body leading is 1.65 and the
display ink stroke is 2px rather than 3px — Thai stacks vowels and tone marks
above and below the line, and a heavier stroke closes them up.

Pointing at a playable card pulls it upright out of the fan, lifts it, and
throws a longer shadow — the hover is gated behind `@media (hover: hover)` so a
phone never gets stuck in it. The card back is built like a real one: an inset
frame, a dotted field, and a crown medallion, because the rank ladder from
เศรษฐี to สลาฟ is what the game is about.

The deck is four-coloured — grape spades, cherry hearts, tangerine diamonds,
leaf clubs. That is not decoration: you scan an 18-card fan for a matching suit
many times a round, and two colours make that slower.

## Sound

Every effect is **synthesised in the browser** with the Web Audio API — there
are no audio files to download or license. The audio context is created on your
first click (browsers require a gesture), and mute plus volume persist locally.

## Configuration

```bash
# apps/web/.env.local
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws

# apps/server
PORT=3001
SESSION_SECRET=change-me-in-production   # signs seat tokens
```

The web app can be deployed anywhere; the game server needs a **long-running
process** (Fly, Railway, a VPS) because it holds WebSockets and in-memory rooms.
It will not work on a serverless target.
