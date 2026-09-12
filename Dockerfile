# ═══════════════════════════════════════════════════════════════════════════
# CyberPulse Auditor — Production Container (multi-stage)
# ═══════════════════════════════════════════════════════════════════════════
# Stages:
#   1. deps-core    — install root dependencies (better-sqlite3 needs build tools)
#   2. build-gui    — compile the Next.js GUI (needs core sources via aliases)
#   3. runtime      — slim Node 20 Alpine + only what's needed to serve
#
# The container runs the GUI server (which embeds the audit engine through
# @shared/* aliases) and persists the shared SQLite DB on a mounted volume.

# ── Stage 1: root dependency install ────────────────────────────────────────
FROM node:20-alpine AS deps-core
WORKDIR /app

# build tools for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++ libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && \
    npm rebuild better-sqlite3 --build-from-source

# ── Stage 2: GUI build ───────────────────────────────────────────────────────
FROM node:20-alpine AS build-gui
WORKDIR /app

# better-sqlite3 prebuilt artifacts from stage 1
COPY --from=deps-core /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Core sources are aliased into the GUI build (../src/**)
COPY src ./src
COPY bin ./bin

# GUI build context
WORKDIR /app/gui
COPY gui/package.json gui/package-lock.json ./
RUN npm ci

COPY gui/next.config.js gui/postcss.config.js gui/tailwind.config.js gui/tsconfig.json ./
COPY gui/app ./app
COPY gui/components ./components
COPY gui/lib ./lib

RUN npm run build

# ── Stage 3: runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app/gui

# tini for proper signal handling (PID 1)
RUN apk add --no-cache tini libc6-compat

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# GUI runtime artifacts
COPY --from=build-gui /app/gui/node_modules ./node_modules
COPY --from=build-gui /app/gui/.next ./.next
COPY --from=build-gui /app/gui/package.json ./package.json

# Shared core (the GUI imports @shared/* at runtime through API routes)
COPY --from=build-gui /app/src ../src
COPY --from=build-gui /app/bin ../bin
COPY --from=build-gui /app/node_modules ../node_modules

# SQLite data directory (mount a volume here)
RUN mkdir -p /app/data
ENV CYBERPULSE_DB_PATH=/app/data/cyberpulse.db

EXPOSE 3000

# Healthcheck: the runs endpoint reads the shared DB — verifies both the
# server and the SQLite layer in one probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/runs || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "start"]
