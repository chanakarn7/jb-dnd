# D&D Campaign Manager

Self-hosted, local-first, **real-time multiplayer** tool for running tabletop **D&D 5e** at one table over the LAN. The Dungeon Master and players play together live; the server holds the authoritative game state.

> Multi-module program — planning & shared authorities live in [`docs/program/`](docs/program). This repo is the shared monorepo every module builds on. Current sprint: **0 — Foundation**.

## Stack (locked — see [docs/program/ARCHITECTURE.md](docs/program/ARCHITECTURE.md))
- **Next.js 16 + TypeScript** (App Router) — DM + player UI in one app
- **SQLite + Prisma** — local file DB, migrations from day one
- **Socket.io** — real-time, server-authoritative sync
- **Single Node process** serving the app **and** Socket.io on one HTTP server, bound to `0.0.0.0:3000`
- Pluggable **`LLMProvider`** interface (Ollama / import / Claude adapters added later; app runs fully with none)

## Prerequisites
- Node.js ≥ 22, npm

## Setup
```bash
npm install                 # installs deps + runs `prisma generate`
cp .env.example .env        # (Windows: copy .env.example .env)
npm run db:migrate          # creates the SQLite DB + applies migrations
```

## Run
```bash
npm run dev                 # custom server (Next + Socket.io) on http://0.0.0.0:3000
```
Players on the same Wi-Fi join at `http://<dm-ip>:3000`.

Production:
```bash
npm run build
npm run start
```

## Scripts
| Script | What |
|--------|------|
| `npm run dev` | custom server with hot reload (tsx watch) |
| `npm run build` | Next.js production build |
| `npm run start` | run the custom server in production mode |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:studio` | Prisma Studio |

## Layout
```
app/            Next.js routes (DM + player UI)
server/         custom server: Socket.io, authoritative state, intent handlers
  io.ts         Socket.io setup (rooms keyed by campaignId)
  handlers/     campaign + session intents
  state/        in-memory working set + SQLite persistence / rehydrate
lib/            shared domain logic
  events.ts     Socket.io event contract (types)
  validation.ts Zod schemas per intent
  inviteCode.ts, tokens.ts, db.ts
  llm/          LLMProvider interface + registry (resolves to none in Sprint 0)
prisma/         schema.prisma + migrations
docs/           program authorities + per-module docs
```

## Status
Scaffold complete (Sprint 0). Feature implementation (Create / Join / Lobby / live sync) is the **`/dev`** stage — see [docs/modules/foundation/](docs/modules/foundation).
