# ARCHITECTURE — shared constraints every module obeys

> The "how, shared." Every module's `/sa` and `/dev` reads this as a hard constraint before designing.
> Stable + small on purpose — keep it read-cheap. Companion: [DATA_MODEL.md](./DATA_MODEL.md), [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

## Tech stack (locked at Gate 3)
- **Next.js + TypeScript** — single app serving both DM and player UI (App Router).
- **SQLite + Prisma** — file DB, ideal for a local single-host server. **Migrations from day one** (no destructive schema rewrites; see [DATA_MODEL.md](./DATA_MODEL.md)).
- **Socket.io** — real-time sync over the LAN. No cloud realtime services.
- **AI:** an `LLMProvider` interface (defined in Foundation) with adapters: `local` (Ollama, default) + `import` (paste-from-Claude). `claude` (Anthropic API, BYOK) is an optional/later adapter, not built in v1.
- Run model: `npm run dev` (or a prod `npm start`); players open `http://<dm-ip>:3000`.

## Real-time & authority (the spine of the app)
- **Server-authoritative.** The Node server owns all mutable game state — HP, initiative order, whose turn, conditions. Clients **send intents** ("I take 7 damage", "end my turn"); the server **validates, applies, persists, and broadcasts** the new state. Clients never mutate shared state locally and hope it sticks.
- **Why:** protects table integrity — a player cannot silently desync or edit another player's/monster's state.
- **Transport:** Socket.io rooms keyed by `campaignId`. Every socket joins exactly one campaign room; broadcasts are scoped to that room.
- **State store:** in-memory authoritative state per active campaign, backed by SQLite for durability/restart. The DB is the persistent truth; the in-memory layer is the live working set.
- **Reconnect:** a client that drops rejoins its campaign room and receives a full state snapshot, then resumes deltas.

## Join model & roles (lightweight auth)
- A **campaign is a room** with a short **invite code**.
- A **player session** = invite code + a chosen **display name** + a **claimed character**. No email/password in v1.
- The **DM** holds an elevated session for their campaign (DM-vs-player is the only permission axis). DM can do everything; a player can read shared state and write **only their own** character/resources and broadcast dice.
- Authorization is enforced **server-side** on every intent — never trust a client claim of "I'm the DM."

## Multi-tenancy
- **Everything is scoped under a `campaignId`.** One server process can host multiple campaigns simultaneously; rows, sockets, and broadcasts are all campaign-scoped. No query crosses campaigns.

## Hosting
- A **single Node process on the DM's machine**, reachable on the LAN. Bind to `0.0.0.0` so other devices on the Wi-Fi can reach it; document the IP/port discovery flow for players.
- **Offline-capable at the table** — no internet dependency for core play (only the optional `claude` adapter, if ever added, needs the net).

## Pluggable LLM provider (for the AI Assistant)
- One **`LLMProvider`** interface (set up in **Foundation** so Sprint 7 only adds adapters, not a refactor):
  - `local` — Ollama, **default**, free, offline. Configurable model id (dev target `qwen2.5:14b` on a 12GB GPU; `llama3.1:8b` fallback).
  - `import` — parse/validate text pasted from a Claude chat into draft entities.
  - `claude` — Anthropic API (BYOK), **optional/later, out of scope for v1**.
- **The app must run fully with no provider configured** — AI features simply disable (graceful degrade). Never key core features on the LLM.
- **Never call any LLM from the browser.** All LLM calls go through a server route.
- **Hybrid rules engine:** rules math (XP from CR, loot dice, spell-slot counts, ability modifiers) is **deterministic code**; the LLM only writes prose. Never ask the model to do arithmetic.
- **Human-in-the-loop:** all AI/imported output is an `is_ai_draft` record the DM reviews/edits/accepts before it touches live, server-authoritative state. Nothing auto-applies. (Provenance columns: see [DATA_MODEL.md](./DATA_MODEL.md).)

## Repo layout
- **Monorepo, single Next.js app** (no multi-repo, no service-per-module split — overkill for a single local host).
- Suggested structure (finalized by `/scaffold` in Sprint 0):
  ```
  /app            Next.js routes (DM + player UI)
  /server         Socket.io handlers, authoritative state, intent validation
  /lib            shared domain logic (5e rules math, dice, LLMProvider)
  /prisma         schema.prisma + migrations + SRD seed
  /docs           program + module docs
  ```

## API & event conventions
- **Mutations during play go over Socket.io intents**, not REST, so every change broadcasts. Event names: `domain:action` (e.g. `combat:applyDamage`, `combat:endTurn`, `dice:roll`, `character:update`).
- **REST/Next route handlers** are for non-realtime CRUD and reads (e.g. loading reference data, prep-time edits, LLM calls).
- Every intent payload carries `campaignId`; the server re-derives the actor's role/ownership from the session, never from the payload.
