# ROADMAP — the living state (where are we)

> This file IS the program's memory. A fresh session re-reads it and knows exactly what to do next.
> Status: ✅ done · 🚧 in-progress · ⬜ todo. Flip to 🚧 when starting a module, ✅ when its Definition of Done is met. Add a **"touched"** note when a sprint changes an already-built module.
> Indexes: this file (work) + the [DATA_MODEL.md](./DATA_MODEL.md) Entity Catalog (data). Read those, not everything.

## At a glance
- **Modules:** 8 · **Sprints:** ~8 (0–7), dependency-ordered.
- **Current:** Sprint 0 **Foundation ✅ DONE** (docs + scaffold + dev, DoD verified live). Next up: Sprint 1 — 5e Reference.
- **Gates signed off:** Gate 0 (multi-module ✅) · Gate 1 (module split + ~8 sprints ✅) · Gate 2 (design tool = `ui-ux-pro-max`; tokens locked in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) ✅) · Gate 3 (stack: Next.js + TS, SQLite/Prisma, Socket.io, Ollama+Import-from-Claude ✅).

## Sprint × module status
| # | Sprint | Module(s) | Status | Definition of Done | Touched |
|---|--------|-----------|--------|--------------------|---------|
| 0 | Foundation | scaffold + lobby + roles + realtime + `LLMProvider` stub | ✅ done | DM creates a room, player joins by code, state syncs across clients | — |
| 1 | 5e Reference | spells / items / monsters (SRD 5.1 seed) | ⬜ todo | search and view statblocks & spells | — |
| 2 | Characters | 5e character sheet | ⬜ todo | player creates/edits their own character | — |
| 3 | Inventory | equip + currency + attunement | ⬜ todo | items attach to a character; player manages own gear | — |
| 4 | Combat ⭐ | live initiative / HP / conditions tracker | ⬜ todo | run an encounter synced to the whole table | — |
| 5 | Story | sessions / quests / NPCs / journal | ⬜ todo | log a session and track plot threads | — |
| 6 | Player UI + dice + dashboard | player sheet view, dice broadcast, DM dashboard, search | ⬜ todo | a player can complete a full session end-to-end | — |
| 7 | AI DM Assistant | pluggable LLM (local default) + hybrid rules + Import-from-Claude | ⬜ todo | DM generates an NPC/loot/plot draft and approves it into the campaign | — |

## Why this order
Foundation first (everything needs realtime + auth + the LLM interface stub). Master/reference data (5e Reference) before the things that point at it. Characters before Inventory/Combat (both reference a character). Combat ⭐ once Characters + Monsters exist. Story after Combat (sessions log encounters). Player UI/Dice/Dashboard reads from everything, so it's late. AI last — it generates **into** the 5e/Character/Story entities, which must exist first.

> 5e makes schema heaviest at **Characters + Spells** (slots by level, conditions, proficiency, saves) — expect Sprints 1–2 to carry more schema than a typical app.

## Per-module docs
Produced just-in-time by `/kickoff` when each sprint starts, under `docs/modules/<module>/` (`PRD.md`, `SA_BLUEPRINT.md`, `UXUI_DESIGN.md`, …). Shared truth stays in `docs/program/`.

## Next action
Foundation is complete. Start **Sprint 1 — 5e Reference** via `/kickoff` (base dir `docs/modules/5e-reference/`).
- **Recommended:** `/clear`, then re-invoke `roadmap` (or `/kickoff` directly) — it resumes from this file.
- Module owns `Spell`, `Item`, `Monster` (see DATA_MODEL Entity Catalog). Seed from **SRD 5.1** (openly licensed). Additive migration on top of `foundation_baseline`.
- Reads as constraints: ARCHITECTURE (REST route handlers for reference reads — not realtime), DATA_MODEL (own the 3 reference entities), DESIGN_SYSTEM (inherit tokens; build search/list/statblock screens).
- DoD: search and view statblocks & spells.
- Run commands for the built app: `npm install` → `npm run db:migrate` → `npm run dev` (players join `http://<dm-ip>:3000`). Tests: `npm test`. Live smoke: `node scripts/smoke.mjs` (server must be running).

## Session log
- **2026-06-16 (1)** — Program kickoff from `DND_CAMPAIGN_MANAGER.scope.md`. Gates 0–3 signed off. Wrote `docs/program/` (VISION, ARCHITECTURE, DATA_MODEL skeleton, DESIGN_SYSTEM, ROADMAP).
- **2026-06-16 (2)** — Sprint 0 Foundation `/kickoff`, Stages 1→5 (docs). Wrote `docs/modules/foundation/`: PRD, SA_BLUEPRINT (+ amended program DATA_MODEL: `Campaign`/`PlayerSession` finalized, `foundation_baseline` migration), UXUI_DESIGN, mockups/index.html. Stage 3 (design) skipped — locked at program level.
- **2026-06-16 (3)** — Sprint 0 Foundation Stages 6→7 (scaffold + dev). Commits `0969ec0` (scaffold) + `dba9f86` (features). Realtime lobby/roles/auth/persistence built; 21 unit tests + live DoD smoke all green (roster sync 14ms, restart rehydrates). **Sprint 0 ✅ done.**
- **2026-06-16 (4)** — Sprint 0 Foundation Stage 8 (`/qa`). Wrote `docs/modules/foundation/TEST_CASES.md` (full PRD §5/§7 traceability). Closed gaps: multi-tenancy isolation, invite-code collision retry, payload-size rejection, dup-name DB-race rollback, anon authz, reconnect token-index rebuild, no-LLM degrade. **35 unit tests pass** (was 21). Next: Sprint 1 — 5e Reference.
