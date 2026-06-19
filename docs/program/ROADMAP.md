# ROADMAP — the living state (where are we)

> This file IS the program's memory. A fresh session re-reads it and knows exactly what to do next.
> Status: ✅ done · 🚧 in-progress · ⬜ todo. Flip to 🚧 when starting a module, ✅ when its Definition of Done is met. Add a **"touched"** note when a sprint changes an already-built module.
> Indexes: this file (work) + the [DATA_MODEL.md](./DATA_MODEL.md) Entity Catalog (data). Read those, not everything.

## At a glance
- **Modules:** 8 · **Sprints:** ~8 (0–7), dependency-ordered.
- **Current:** Sprint 1 **5e Reference ✅ DONE** (docs + dev + QA; 76 tests, live-verified). Sprint 0 Foundation ✅ done. **Next up: Sprint 2 — Characters.**
- **Gates signed off:** Gate 0 (multi-module ✅) · Gate 1 (module split + ~8 sprints ✅) · Gate 2 (design tool = `ui-ux-pro-max`; tokens locked in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) ✅) · Gate 3 (stack: Next.js + TS, SQLite/Prisma, Socket.io, Ollama+Import-from-Claude ✅).

## Sprint × module status
| # | Sprint | Module(s) | Status | Definition of Done | Touched |
|---|--------|-----------|--------|--------------------|---------|
| 0 | Foundation | scaffold + lobby + roles + realtime + `LLMProvider` stub | ✅ done | DM creates a room, player joins by code, state syncs across clients | — |
| 1 | 5e Reference | spells / items / monsters (SRD 5.1 seed) | ✅ done | search and view statblocks & spells | — |
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
Sprint 1 **5e Reference is ✅ DONE** (all stages: docs 1→5, dev 7, QA 8). **Next: Sprint 2 — Characters** (the heaviest entity; player creates/edits their own 5e character).
- **Recommended:** `/clear`, then re-invoke `roadmap` to start Sprint 2 with fresh context.
- Sprint 2 will: finalize the `Character` entity (DATA_MODEL stub at #character), add `CharacterSpell` join (owns), turn `PlayerSession.characterId` into a real FK→Character (additive migration), and let a player claim/create/edit one character. References Sprint 1 `Spell` (known/prepared) — read by slug, do not redesign reference tables.
- Sprint 1 shipped: migration `5e_reference` (3 GLOBAL tables), SRD seed (319/334/599), `lib/reference/*`, `app/api/reference/*`, `app/reference/*`, Reference nav link, [TEST_CASES.md](../modules/5e-reference/TEST_CASES.md). **76 unit tests pass**, typecheck/lint/build clean, live-verified.
- Run commands: `npm install` → `npm run db:migrate` → `npm run db:seed` → `npm run dev`. Tests: `npm test`.

## Session log
- **2026-06-16 (1)** — Program kickoff from `DND_CAMPAIGN_MANAGER.scope.md`. Gates 0–3 signed off. Wrote `docs/program/` (VISION, ARCHITECTURE, DATA_MODEL skeleton, DESIGN_SYSTEM, ROADMAP).
- **2026-06-16 (2)** — Sprint 0 Foundation `/kickoff`, Stages 1→5 (docs). Wrote `docs/modules/foundation/`: PRD, SA_BLUEPRINT (+ amended program DATA_MODEL: `Campaign`/`PlayerSession` finalized, `foundation_baseline` migration), UXUI_DESIGN, mockups/index.html. Stage 3 (design) skipped — locked at program level.
- **2026-06-16 (3)** — Sprint 0 Foundation Stages 6→7 (scaffold + dev). Commits `0969ec0` (scaffold) + `dba9f86` (features). Realtime lobby/roles/auth/persistence built; 21 unit tests + live DoD smoke all green (roster sync 14ms, restart rehydrates). **Sprint 0 ✅ done.**
- **2026-06-16 (4)** — Sprint 0 Foundation Stage 8 (`/qa`). Wrote `docs/modules/foundation/TEST_CASES.md` (full PRD §5/§7 traceability). Closed gaps: multi-tenancy isolation, invite-code collision retry, payload-size rejection, dup-name DB-race rollback, anon authz, reconnect token-index rebuild, no-LLM degrade. **35 unit tests pass** (was 21). Next: Sprint 1 — 5e Reference.
- **2026-06-17 (1)** — Sprint 1 5e Reference `/kickoff` Stages 1→5 (docs). Wrote `docs/modules/5e-reference/`: PRD, SA_BLUEPRINT (+ amended program DATA_MODEL: `Spell`/`Item`/`Monster` finalized, migration `5e_reference`, GLOBAL tables no `campaignId`, slug natural key), UXUI_DESIGN (statblock = hero screen), mockups/index.html (clickable prototype, client-side filter; node parse-check passed). Stage 3 (design) skipped — locked at program level. Sprint 1 still 🚧. **Next: scaffold/dev (Stage 6→7) + QA (Stage 8).**
- **2026-06-17 (3)** — Sprint 1 5e Reference Stage 8 (`/qa`). Wrote `docs/modules/5e-reference/TEST_CASES.md` (full PRD §5 + DoD traceability). Closed gaps with TDD: **+16 tests** — `reference-repo.test.ts` (JSON-column parse, lean-vs-detail shapes, null-on-missing→404 driver, malformed-JSON fallback, in-memory cache no-re-query; Prisma mocked via `vi.mock("@/lib/db")`) + `reference-gaps.test.ts` (empty-result paths, CR-max inclusive boundary, case-insensitive search, transform robustness for missing armor/profs/reactions). **Bug found+fixed:** statblock action ordering (Legendary before Reactions) → reordered to Actions→Reactions→Legendary, re-seeded. **76 tests pass** (was 60), typecheck/lint/build clean. **Sprint 1 ✅ DONE.** Next: Sprint 2 — Characters.
- **2026-06-17 (2)** — Sprint 1 5e Reference Stage 7 (`/dev`, additive — no scaffold). Migration `5e_reference` (3 GLOBAL tables, no campaignId, slug @unique, filterable scalars indexed). SRD 5.1 seed pipeline: vendored `5e-bits/5e-database` JSON → `prisma/seed/{transform,index}.ts`, idempotent upsert by slug, deterministic xp/crSort; **seeded 319 spells · 334 monsters · 599 items**; CC-BY-4.0 attribution at `prisma/seed/SRD-5.1-CC-BY-4.0.md`. `lib/reference/{types,parse,filter,srd,repo,http}.ts` (in-memory cache; dynamic routes — NOT force-static, since SQLite is seeded at runtime). REST `GET /api/reference/{spells|monsters|items}(/[slug])`. UI `app/reference/` (tabs + debounced search + client filter + list/detail, statblock hero, loading/empty/404, in-session guard, attribution footer) + Reference nav link in lobby. **TDD: +25 reference unit tests (60 total, all pass)**; typecheck clean; lint 0 errors; build clean; live-verified statblock/spell card/list-filter in preview (0 console errors). Sprint 1 DoD (search + view statblocks & spells) met. **Next: Stage 8 QA.** Known: `package.json#prisma` seed config deprecated in Prisma 7 (works on 6; migrate to `prisma.config.ts` at upgrade).
