# syntax=docker/dockerfile:1
#
# The game server: Elysia on Bun, holding WebSockets and in-memory rooms. It is
# a long-running process, not a serverless function.
#
# Build from the REPO ROOT, not this directory:
#   docker build -f apps/server/Dockerfile -t game-server .
#
# The runtime carries one bundled file and no node_modules. Bundling rather
# than shipping the workspace is what keeps this image ~105MB instead of 1.5GB:
# a workspace install pulls in Next, React, Biome and Vitest, none of which the
# server has any use for.

# ---------------------------------------------------------------- dependencies
FROM oven/bun:1.4.0-alpine AS deps
WORKDIR /repo
# Manifests only, so editing source does not re-download the world.
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/game/package.json packages/game/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------- build
FROM oven/bun:1.4.0-alpine AS build
WORKDIR /repo
COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages
# Bun links workspace packages into each consumer's own node_modules, so the
# whole tree comes across, not just the root one.
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
RUN bun build apps/server/src/index.ts \
      --target=bun \
      --minify \
      --outfile=/out/server.js

# -------------------------------------------------------------------- runtime
FROM oven/bun:1.4.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3001
RUN addgroup -S app && adduser -S -G app app
COPY --from=build --chown=app:app /out/server.js ./server.js
USER app

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["bun", "run", "server.js"]
