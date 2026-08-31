# เล่นไพ่

Two multiplayer card games in one room: **สลาฟ** (Daifugō / President) and
**โพแดง** (Hearts), with a Thai interface. Pick a game, share the six-character
code, and play in the browser. Disconnecting never costs you your seat: while a
match is running you can close the tab, come back, and your hand is still there.

```bash
bun install
bun dev          # web on :3000, game server on :3001
```

Open <http://localhost:3000>, choose a game, create a room, and either share the
invite link or fill the empty seats with bots.

## Layout

| Package | What it is |
| --- | --- |
| `packages/game` | Two rules engines behind one `GameModule` interface, over the plain deck they share. Pure functions, no I/O, 174 unit tests. |
| `packages/shared` | The wire contract: Zod message schemas, error codes, and the redaction that turns authoritative state into one player's view. |
| `apps/server` | Elysia on Bun. HTTP for room lifecycle, WebSocket for play. |
| `apps/web` | Next.js 16 App Router, Tailwind v4, shadcn/ui on Radix, Motion. |

The rules engines know nothing about sockets, the socket layer knows nothing
about React, and neither knows which game is being played — the room resolves
that through a registry. Which is why the whole thing can be tested without a
browser, and why adding a third game touches no networking code.

## Commands

```bash
bun dev          # both apps
bun run build    # production build of the web app
bun test         # rules engine (Vitest) + server integration (bun test)
bun run check    # Biome lint + format
bun run typecheck
```

`bun test` runs 174 engine tests plus 23 integration tests that drive real
WebSocket clients through a full round of each game, a mid-game disconnect and
reconnect, a forged-token attempt, a stalled Hearts pass, and a bot-only match.

## Rules

Both games use a plain **52-card deck — no jokers**.

### สลาฟ (Daifugō)

3–6 players.

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

### โพแดง (Hearts)

Four players, thirteen cards each. Points are bad and the lowest score wins.

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

### Room settings

#### สลาฟ

| Setting | Default | Effect |
| --- | --- | --- |
| 8-cut | on | Any play containing an 8 ends the trick immediately; the cutter leads next. |
| Revolution | on | A four-of-a-kind inverts the rank order for the rest of the round. A second quad flips it back. |
| Turn timer | 30s | 15 / 30 / 60 / off. On expiry you auto-pass, or shed your lowest card if you were leading. |
| Rounds | 5 | 3 / 5 / 10, or endless until the host ends it. |

#### โพแดง

| Setting | Default | Effect |
| --- | --- | --- |
| Turn timer | 30s | 15 / 30 / 60 / off. On expiry you play your lowest legal card, or pass your three highest if the round's pass is still open. |
| Target score | 100 | 50 / 100 / 200. The match ends the moment anyone reaches it. |

The rest of the Hearts rules are fixed. No ♦J, no ♠Q-breaks-hearts, no taking
−26 for the moon — those variants make the game less legible, not more
interesting.

## How the multiplayer works

- **Server-authoritative.** Clients send intents; the server runs them through
  the rules engine and pushes back a fresh snapshot. Nothing is optimistic.
- **One room layer, two games.** The room resolves rules through a `GameModule`
  looked up from the state's own `game` tag. Reconnect, seat tokens, host
  migration, the turn clock and the bots are the same code in both games, which
  is why fixing one fixes both.
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

Hearts lays its trick out in a circle rather than a pile: four cards, each
sitting under the player who played it, the card currently taking the trick
ringed in lemon, and the trick's running point value at the centre. A pile would
throw away the two things a Hearts player reads every few seconds — who is
winning this, and is it worth taking.

The four colours matter more there than in สลาฟ. Daifugō asks you to compare
ranks; Hearts asks whether you are void in a suit, twelve times a round, under a
clock. Grouping the hand club-diamond-spade-heart and colouring all four suits
turns that question into a glance.

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

## Docker

Two images, both built from the **repository root** and both running on Bun —
there is no Node in either one.

```bash
docker build -f apps/server/Dockerfile -t game-server .
docker build -f apps/web/Dockerfile -t game-web \
  --build-arg NEXT_PUBLIC_SERVER_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_WS_URL=wss://api.example.com/ws .
```

| Image | Size | Runtime |
| --- | --- | --- |
| `server` | ~88 MB | `oven/bun:alpine` plus a single 1.3 MB bundle |
| `web` | ~146 MB | `oven/bun:alpine` plus Next's standalone output |

The server is bundled with `bun build` rather than shipped as a workspace,
because a workspace install drags in Next, React, Biome and Vitest — 1.5 GB of
things the server never loads. Both images share the same base layer, so a host
running both pulls that ~100 MB once.

**`NEXT_PUBLIC_*` are build arguments, not runtime environment.** Next compiles
them into the client bundle, so an image built with the defaults points every
player's browser at their own machine. Pass the real URLs at build time.

Both images run as a non-root user and carry a `HEALTHCHECK`.

**`SESSION_SECRET` is required in production.** It signs the seat tokens that
prove a returning player owns their seat, so anyone who knows it can forge one
for any seat in any room. The server refuses to start when it is missing, empty,
or still the committed development value — `bun dev` keeps falling back to that
value on your own machine, where it costs nothing.

### Compose

```bash
cp .env.compose.example .env    # then put a real SESSION_SECRET in it
docker compose up -d            # http://localhost:3000
```

That runs the published images. The web one has `http://localhost:3001`
compiled into its client bundle, so it works on the machine running compose and
nowhere else. To deploy somewhere real, build it with the URLs players will
actually use:

```bash
PUBLIC_SERVER_URL=https://cards.example.com \
PUBLIC_WS_URL=wss://cards.example.com/ws \
IMAGE_PLATFORM=linux/amd64 \
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build -d
```

Locally built images are tagged `gm-party-card-game/{web,server}:local`, so they
never shadow the published ones and `docker compose pull` cannot quietly replace
them.

Put the API behind a reverse proxy that forwards **WebSocket upgrades** on
`/ws` — play runs entirely over that socket, so a proxy that only forwards HTTP
leaves the lobby working and the game dead. An `https` API needs a `wss` socket
on the same host; the browser blocks the mix otherwise.

CI publishes `linux/amd64`, so on Apple Silicon the published images run under
emulation — fine for this workload. Run the workflow manually with both
platforms, or build locally with `IMAGE_PLATFORM=linux/arm64`, to avoid it.

### CI

`.github/workflows/docker.yml` runs `bun run check`, `bun run typecheck` and
`bun test`, then builds both images and pushes them to GHCR at
`ghcr.io/<owner>/<repo>/web` and `.../server`. Publishing uses the built-in
`GITHUB_TOKEN`, so there is no secret to configure — but set the repository
variables `NEXT_PUBLIC_SERVER_URL` and `NEXT_PUBLIC_WS_URL`, or the published
web image will only work against localhost.

Pull requests build both images to prove the Dockerfiles still work, and
publish nothing. Pushes to `main` and `v*` tags publish, and each published
image is then pulled back and started to confirm it answers.

Builds target `linux/amd64`. Run the workflow manually to add `linux/arm64` —
it goes through QEMU and is considerably slower.
