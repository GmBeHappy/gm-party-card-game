# syntax=docker/dockerfile:1
#
# The web app: Next.js standalone output, served by Bun. No Node in the image —
# the runtime is the same oven/bun:alpine base the server uses, so a host
# running both pulls that ~100MB layer once.
#
# Build from the REPO ROOT, not this directory:
#   docker build -f apps/web/Dockerfile -t game-web .
#
# NEXT_PUBLIC_* values are compiled into the client bundle, so they are BUILD
# arguments, not runtime environment. An image built with the defaults below
# only talks to a server on localhost — pass the real URLs at build time or the
# deployed app will try to open a socket to the player's own machine.

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
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
COPY package.json bun.lock tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
# Bun links workspace packages into each consumer's own node_modules, so the
# whole tree comes across, not just the root one.
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
RUN bun run --cwd apps/web build

# -------------------------------------------------------------------- runtime
FROM oven/bun:1.4.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S -G app app

# Output tracing is rooted at the workspace, so the server lands under apps/web.
# Static assets and public/ are not traced and have to be carried over by hand.
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

CMD ["bun", "run", "apps/web/server.js"]
