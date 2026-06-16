# ROADMAP — the living state (where are we)

> This file IS the program's memory. A fresh session re-reads it and knows exactly what to do next.
> Status: ✅ done · 🚧 in-progress · ⬜ todo. Flip to 🚧 when starting a module, ✅ when its Definition of Done is met. Add a **"touched"** note when a sprint changes an already-built module.
> Indexes: this file (work) + the [DATA_MODEL.md](./DATA_MODEL.md) Entity Catalog (data). Read those, not everything.

## At a glance
- **Modules:** 8 · **Sprints:** ~8 (0–7), dependency-ordered.
- **Current:** Sprint 0 **Foundation in progress** (driving `/kickoff`, base dir `docs/modules/foundation/`).
- **Gates signed off:** Gate 0 (multi-module ✅) · Gate 1 (module split + ~8 sprints ✅) · Gate 2 (design tool = `ui-ux-pro-max`; tokens locked in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) ✅) · Gate 3 (stack: Next.js + TS, SQLite/Prisma, Socket.io, Ollama+Import-from-Claude ✅).

## Sprint × module status
| # | Sprint | Module(s) | Status | Definition of Done | Touched |
|---|--------|-----------|--------|--------------------|---------|
| 0 | Foundation | scaffold + lobby + roles + realtime + `LLMProvider` stub | 🚧 in-progress | DM creates a room, player joins by code, state syncs across clients | — |
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
Foundation **docs are done** (PRD, SA_BLUEPRINT, UXUI_DESIGN, prototype). Remaining for Sprint 0: **`/scaffold` then `/dev`**.
- **Recommended:** `/clear`, then re-invoke `/kickoff` for Foundation with scope **Stage 6→7** — it resumes from the existing `docs/modules/foundation/` files.
- Scaffold target (locked stack): Next.js + TS + custom Socket.io server (single Node process, bind 0.0.0.0), SQLite + Prisma with the `foundation_baseline` migration, Tailwind wired to the DESIGN_SYSTEM tokens.
- Dev DoD: DM creates a room → player joins by code → roster syncs live across two browser clients; reconnect-via-token snapshot; rehydrate active campaigns on server restart; `LLMProvider` stub resolves to none.

## Session log
- **2026-06-16 (1)** — Program kickoff from `DND_CAMPAIGN_MANAGER.scope.md`. Gates 0–3 signed off. Wrote `docs/program/` (VISION, ARCHITECTURE, DATA_MODEL skeleton, DESIGN_SYSTEM, ROADMAP).
- **2026-06-16 (2)** — Sprint 0 Foundation `/kickoff`, Stages 1→5 (docs). Wrote `docs/modules/foundation/`: PRD, SA_BLUEPRINT (+ amended program DATA_MODEL: `Campaign`/`PlayerSession` finalized, `foundation_baseline` migration), UXUI_DESIGN, mockups/index.html. Stage 3 (design) skipped — locked at program level. Next: scaffold + dev.
