# Project Scope — D&D Campaign Manager (multiplayer, local)

> Hand this file to `/roadmap` as the project brief. It pre-answers the triage and most
> sizing/architecture decisions so the orchestrator can move straight to confirming the plan
> and writing `docs/program/`. Treat the "Locked decisions" as already-decided — do not re-ask.

## One-liner
A self-hosted, local-first tool for running tabletop **D&D 5e** campaigns where the **Dungeon
Master and players play together in real time** — the DM prepares and runs the game, each player
drives their own character sheet, and a live combat tracker keeps the whole table in sync.

## Locked decisions (do not re-ask)
- **Players are first-class users**, not just a DM admin tool. Players can join and play live.
- **Hosting: same-room LAN.** The DM runs the server on their machine; players join over the same
  Wi-Fi at `http://<dm-ip>:3000`. No cloud, no paid services. (A future tunnel for remote play is a
  non-goal for v1.)
- **Ruleset: D&D 5e, full.** Character sheets, spells, items, monsters, and conditions follow 5e.
- **Real-time, server-authoritative.** The server holds the source of truth for HP, initiative, and
  turn order; clients are views that sync live. Players cannot silently desync or edit others' state.
- **Lightweight join, not heavy auth.** A campaign has an **invite code**; a player opens the link,
  enters the code, and claims/creates their character. DM has elevated control.
- **This is a multi-module program → use `roadmap`** (confirmed at Gate 0): several distinct domains
  whose data flows together (combat references characters + monsters + items), plus a real-time
  constraint every module depends on.
- **AI is free-first and optional.** The DM-assist feature defaults to a **local Ollama** model
  (free, offline) for in-game generation, plus an **"Import from Claude"** paste path for prep-time
  premium content (uses the DM's existing Claude chat subscription, no API cost). A paid in-app
  Anthropic API adapter is explicitly **out of scope for v1**. The app must run fine with no LLM at
  all. Don't design the AI module as API-key-required.

## Users & roles
- **Dungeon Master (DM):** creates the campaign/room, manages NPCs/monsters/encounters, controls the
  live combat tracker, reveals information. Full read/write.
- **Player:** joins via invite code, owns one character, edits their own sheet (HP, spell slots,
  inventory), rolls dice (broadcast to the table), sees initiative/turn order during combat.

## Core gameplay flow (definition of "playable")
1. DM creates a campaign → gets an invite code.
2. Players join with the code, create or claim a 5e character.
3. DM starts a session; everyone sees the shared session screen.
4. DM starts an encounter → live combat tracker: initiative order, HP, conditions, whose turn.
5. Players act on their turn, roll dice (results broadcast), update their HP/resources.
6. DM logs the session, awards loot/XP, advances the story.

## Module map (dependencies)
| Module | Purpose (5e-aware) | Depends on |
|--------|--------------------|------------|
| **Foundation** | scaffold, campaign/room + invite code, roles (DM/player), **WebSocket real-time layer**, server-authoritative state store | — |
| **5e Reference** | spells, items/equipment, monsters/statblocks — seedable from **SRD 5.1** (openly licensed) | Foundation |
| **Characters** | 5e sheet: ability scores, race, class/subclass, skills, proficiency, HP/AC, saving throws, spell slots; **owned by a player** | 5e Reference |
| **Inventory** | equip / attunement / currency; players use their own items | Characters + Items |
| **Combat** ⭐ | initiative, HP, **5e conditions**, turn order — **synced live to every screen** | Characters + Monsters |
| **Story** | session log, quests, NPCs, journal | Combat + Characters |
| **Player UI + Dice + Dashboard** | player's own sheet view, dice roller (broadcast), DM dashboard, global search | all modules |
| **AI DM Assistant** | generate story/NPCs/loot flavor via a pluggable LLM; hybrid rules engine; "Import from Claude" paste path | 5e Reference + Characters + Story (generates into them) |

## Sprint plan (~8, dependency-ordered)
| # | Sprint | Modules | Definition of Done |
|---|--------|---------|--------------------|
| 0 | Foundation | scaffold + lobby + roles + realtime | DM creates a room, player joins by code, state syncs across clients |
| 1 | 5e Reference | spells / items / monsters (SRD seed) | search and view statblocks & spells |
| 2 | Characters | 5e character sheet | player creates/edits their own character |
| 3 | Inventory | equip + currency + attunement | items attach to a character; player manages own gear |
| 4 | Combat ⭐ | live initiative/HP/conditions tracker | run an encounter synced to the whole table |
| 5 | Story | sessions / quests / NPCs / journal | log a session and track plot threads |
| 6 | Player UI + dice + dashboard | player sheet view, dice broadcast, DM dashboard, search | a player can complete a full session end-to-end |
| 7 | AI DM Assistant | pluggable LLM (local default) + hybrid rules + Import-from-Claude | DM generates an NPC/loot/plot draft and approves it into the campaign |

> 5e makes the data model heaviest at **Characters + Spells** (spell slots by level, conditions,
> proficiency, saving throws) — expect sprints 1–2 to carry more schema than a typical app.
> AI is last (Sprint 7) because it generates **into** the 5e/Character/Story entities — those must exist first.

## Architecture constraints (for `docs/program/ARCHITECTURE.md`)
- **Real-time:** self-hosted WebSocket (Socket.io or native `ws`). No cloud realtime services.
- **Authority:** server owns mutable game state (HP, initiative, turn). Clients send intents; server
  validates and broadcasts. This protects table integrity.
- **Join model:** campaign = a room with an invite code; player session = code + claimed character.
  Keep auth minimal (no email/password required for v1; a display name + character claim is enough).
- **Hosting:** single Node process on the DM's machine, reachable on the LAN. Document the IP/port
  flow for players. Offline-capable at the table.
- **Multi-tenancy:** scope everything under a campaign id; one server can host multiple campaigns.
- **Pluggable LLM provider (for the AI assistant):** define one `LLMProvider` interface with adapters —
  `local` (Ollama, default) and `claude` (Anthropic API, optional). The app must run fully with **no
  provider configured** (AI features simply disabled — graceful degrade). Never call any LLM from the
  browser; all calls go through a server route. The interface is set up in Foundation so Sprint 7 only
  adds adapters, not a refactor.

## Data model notes (for `docs/program/DATA_MODEL.md`)
- Shared entities the whole app points at: `Campaign`, `User/PlayerSession`, `Character`, `Item`,
  `Spell`, `Monster`, `Location`.
- Cross-module links that make this a single data model (build additively):
  - `Character` ↔ `Item` (inventory, M:N with quantity/equipped/attuned)
  - `Character` ↔ `Spell` (known/prepared, M:N)
  - `Encounter` → references `Character`(s) + `Monster`(s) + `Location`
  - `Quest` → references NPC giver (`Character`), `Location`, reward `Item`(s)
  - `Session` → references `Encounter`(s), `Quest`(s), NPCs met, loot awarded
- Start `DATA_MODEL.md` with an **Entity Catalog** (table → owner module → purpose → anchor) so later
  modules read only what they touch. Evolve schema via **additive migrations** (e.g. when Inventory
  adds the join table, when Combat adds condition tracking to `Character`).
- **AI provenance (additive, Sprint 7):** add `is_ai_draft` (boolean) and `generated_by` (`null` |
  `"ollama:<model>"` | `"claude"` | `"import"`) columns to generatable entities (`Character`/NPC,
  `Item`, `Monster`, `Quest`). AI output lands as a **draft** the DM approves before it becomes live
  game state — a migration adds these columns to already-built tables (textbook additive change).

## Design direction hints (for `docs/program/DESIGN_SYSTEM.md`)
- **Readability at the table beats theming.** During combat, HP/initiative/turn must be legible at a
  glance across the room. High contrast, large numerics, clear "whose turn" state.
- Dark mode default (game rooms are dim). One consistent design system; player and DM views share it.
- A restrained fantasy accent is fine, but don't let parchment textures hurt legibility.
- (Gate 2 will pick the exact palette/font via the chosen design-direction tool — this is guidance.)

## AI Dungeon Master Assistant (Sprint 7)
The DM should not have to invent everything. The assistant proposes; the DM approves. Three tiers,
designed so **solo play is 100% free** and paid API is an optional convenience later.

1. **In-game, live, automated → local LLM (default, free).** During play the app calls a **local
   Ollama** model for fast, throwaway creative bits: NPC/shop/town names, dropped-item flavor text,
   ambient description, short improv answers, monster flavor. No internet, no cost, no copy-paste.
   - **Target model on the dev machine (RTX 4070 12GB):** default **`qwen2.5:14b`** (fits fully in
     VRAM, fast) or `llama3.1:8b`. 32B is marginal (slow, RAM-limited); 70B is out of reach. Treat the
     model id as configurable.
2. **Prep-time, high-quality → "Import from Claude" (free, manual).** The campaign-defining work
   (story arc with foreshadowing/payoff, important NPCs with consistent voice + secret motives,
   mysteries whose clues must be solvable, balanced boss encounters, cross-session callbacks) is done
   **before** play and is not latency-sensitive — so the DM generates it by hand in their **Claude
   chat / Claude Code subscription** (already paid, flat-rate) and **pastes** the result into an
   **"Import from Claude"** screen. The app parses/validates it (ask Claude for JSON matching the
   entity schema) into draft entities. No API key, no per-token cost.
3. **App-calls-Claude-automatically → Anthropic API (optional, paid, later).** Only if the DM wants
   the premium tasks automated in-app (a button instead of copy-paste). Requires a Console **API key**
   in server env (BYOK) — billed per token, **separate from the chat subscription** (a Pro/Max chat
   plan does NOT authorize app API calls). If/when built, use the official `@anthropic-ai/sdk`,
   model **`claude-opus-4-8`**, adaptive thinking, **structured outputs** (`output_config.format` /
   `messages.parse`) for valid 5e JSON, streaming for long narrative, and prompt-cache the campaign +
   5e-rules system prompt. Out of scope for v1.

**Hybrid rules engine (applies to every tier).** Rules math is **code**, creativity is the **LLM**:
- Code computes 5e mechanics deterministically — encounter XP from CR, loot-table dice, spell-slot
  counts, ability modifiers. Never ask the model to do the arithmetic (it gets it wrong).
- The LLM only writes the prose — e.g. code rolls the loot and the XP, the model writes the item's
  description and a one-line story reason for the award.

**Human-in-the-loop.** All AI/imported output is an `is_ai_draft` record. The DM reviews/edits/accepts
before it touches live, server-authoritative game state. Nothing auto-applies.

## Tech stack (proposal for Gate 3 — confirm before scaffolding)
- **Next.js + TypeScript** (single app serving DM + player UI)
- **SQLite + Prisma** (file DB, perfect for local single-host; migrations from day one)
- **Socket.io** for real-time sync
- **AI:** `LLMProvider` interface → **Ollama** adapter (default, free, local) + **Import-from-Claude**
  paste/parse path. Anthropic `@anthropic-ai/sdk` adapter is optional/later (BYOK).
- `npm run dev` → players open `http://<dm-ip>:3000`

## Non-goals (v1)
- Remote/internet play via tunnel (LAN only for now)
- Accounts/billing/multi-DM permissions beyond DM vs player
- VTT-grade battle maps with grid movement & fog of war (maybe a later sprint)
- Homebrew rules engine beyond 5e
- **Paid Anthropic API integration** — v1 ships local Ollama + Import-from-Claude only (free); the
  in-app API adapter is optional/later
- **Auto-applying AI output** — generated/imported content is always a DM-approved draft, never live
  game state directly
- **LLM doing rules math** — XP/loot/slot calculations are code, not model output

## How to run roadmap on this
From the new project's folder:
```
/roadmap  (then paste or reference this file)
```
roadmap will: confirm Gate 0 (multi-module → yes), present the module map + ~8-sprint plan for
sign-off (Gate 1), lock design direction (Gate 2) and architecture/stack (Gate 3), write
`docs/program/`, then drive `/kickoff` module-by-module starting with Sprint 0.
