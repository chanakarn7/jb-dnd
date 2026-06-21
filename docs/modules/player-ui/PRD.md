# PRD — Player UI + Dice + Dashboard (Sprint 6)

> Module base dir: `docs/modules/player-ui/`
> Canonical path read by downstream chain: `docs/modules/player-ui/PRD.md`
> Program authorities: [ARCHITECTURE.md](../../program/ARCHITECTURE.md) · [DATA_MODEL.md](../../program/DATA_MODEL.md) · [DESIGN_SYSTEM.md](../../program/DESIGN_SYSTEM.md)

---

## 1. Feature Overview & KPIs

### What & Why
Sprint 6 is the **"reads from everything"** module that closes the player-facing gameplay loop. Sprints 0–5 built the data and mechanics (lobby, reference, characters, inventory, combat, story). Sprint 6 makes them *feel like a game*: dice roll and broadcast to the table, players see their HP/slots at a glance, the DM has a campaign overview, and anyone can search across all content.

### Scope
| Feature | Summary |
|---------|---------|
| **Dice roller + broadcast** | d4–d20+d100, custom formula, advantage/disadvantage, Socket.io broadcast, roll feed, private DM roll |
| **Player quick-view panel** | At-a-glance HP/AC/slots/conditions, quick HP edit, ability/skill/initiative quick-rolls |
| **DM dashboard** | Campaign stats, active quests, roster HP status, last session summary, quick-start CTA |
| **Global search** | Unified search across 5e reference + campaign entities; REST endpoint + client UI |

### KPIs
- A player can roll dice and see their result + others' results within 1 second (LAN)
- DM dashboard loads in <500ms (all data in one aggregated response)
- Global search returns results in <300ms for a 2-character query
- Zero regressions: 501 prior tests remain green

---

## 2. Target Platforms & User Roles

**Platform:** Responsive web (Next.js), LAN-hosted (`http://<dm-ip>:3000`). Desktop primary; tablet secondary; mobile read-only is acceptable (not primary target).

### Actors

| Actor | Permissions |
|-------|-------------|
| **DM** | All read/write. Dice roll (public or private). Access to DM Dashboard. Can see all characters' HP/conditions. |
| **Player** | Dice roll (always public). Player quick-view for **own character only**. Read-only on others. Cannot access DM Dashboard. |
| **Any authenticated session** | See roll feed (last 20 public rolls). Use global search within their campaign. |
| **Unauthenticated** | 401 on all endpoints. |

---

## 3. User Stories & Functional Workflows

### 3.1 Dice Roller + Broadcast

**US-D1:** As any user, I can open the dice panel and tap a die button (d4/d6/d8/d10/d12/d20/d100) to roll it. The result immediately appears in the roll feed for everyone at the table.

**US-D2:** As any user, I can type a custom formula (e.g. `2d6+3`, `d20+5`) and roll it. The parsed total + individual dice are shown.

**US-D3:** As any user, I can toggle **Advantage** or **Disadvantage** before rolling a d20. Both d20 values are shown; the kept value is highlighted.

**US-D4:** As a DM, I can mark a roll **Private** — the result is shown only to me (not persisted, not broadcast).

**US-D5:** As any user, I can add a **context label** to a roll (free text, e.g. "Attack", "Stealth", "Save vs. Poison") before rolling, so the feed shows meaningful labels.

**US-D6:** As any user, I can see the **roll feed** (last 20 public rolls) — player name, formula, result, context label, timestamp. The feed auto-updates in real time via Socket.io.

**Workflow — public roll:**
1. User opens Dice Panel (floating button or sidebar).
2. Selects die or types formula; optionally adds context label.
3. Presses Roll → client sends `dice:roll` over Socket.io.
4. Server validates formula, rolls, persists `DiceRoll`, broadcasts `dice:result` to all sockets in the campaign room.
5. All clients' roll feeds update instantly.

**Workflow — private DM roll:**
1. DM opens Dice Panel, toggles "Private".
2. Rolls → client sends `dice:rollPrivate` over Socket.io.
3. Server validates + rolls; sends result **only to the originating socket** (no persistence, no broadcast).
4. DM sees result inline; others see nothing.

### 3.2 Player Quick-View Panel

**US-P1:** As a player, after joining a campaign and claiming a character, I see a persistent **quick-view panel** showing: current HP / max HP, AC, spell slots by level (used/total), passive perception, and any active conditions from the current Encounter.

**US-P2:** As a player, I can quickly **edit my HP** (+N / -N) directly from the quick-view. Tapping a "+" or "-" button with a number input submits a PATCH to my character.

**US-P3:** As a player, I can click any **ability score** (STR/DEX/CON/INT/WIS/CHA) to auto-roll `d20 + modifier` and broadcast the result labeled "STR Check" etc.

**US-P4:** As a player, I can click any **skill** (from my character's skill list) to auto-roll `d20 + total bonus` and broadcast labeled with the skill name.

**US-P5:** As a player, I can click **"Roll Initiative"** to roll `d20 + DEX modifier` and broadcast it labeled "Initiative".

**US-P6:** As a player, I can click **spell slots** to mark a slot as used (filled circle → empty) or recovered. This updates the character's `spellSlotsUsed` field via PATCH.

**Workflow — quick HP edit:**
1. Player sees HP widget: `[−] [12 / 20 HP] [+]`.
2. Taps `−` → enters delta (e.g. 4) → taps Confirm.
3. PATCH `/api/characters/[id]` with `{ hpCurrent: clamp(current - delta, 0, maxHp) }`.
4. Panel updates. If `hpCurrent` hits 0, panel shows "Unconscious" badge.

### 3.3 DM Dashboard

**US-DM1:** As a DM, when I open the campaign, I see a **Dashboard page** (or tab) showing the campaign's current state at a glance.

**US-DM2:** The dashboard shows **campaign stats** row: total players, active quests count, sessions logged, total XP awarded (sum of all Session.xpAwarded).

**US-DM3:** The dashboard shows an **active quests panel**: list of all quests with status=active, each card showing name, giver, X/N objectives checked, progress bar.

**US-DM4:** The dashboard shows a **roster panel**: all characters in the campaign — character name, class, level, current HP / max HP (color-coded: green≥50%, amber 25–49%, red<25%, skull=0), and current conditions from the active Encounter (if any).

**US-DM5:** The dashboard shows a **last session card**: most recent Session's title, date, XP, and summary excerpt.

**US-DM6:** The dashboard has quick-start CTAs: "▶ Start Encounter" (scrolls/navigates to Combat tracker) and "📋 Log Session" (opens Story > Sessions > Log form).

**US-DM7:** If a player navigates to the dashboard URL directly → they are redirected to their player quick-view (or shown a 403 page).

### 3.4 Global Search

**US-S1:** As any authenticated user, I can type in a **search box** (in the navbar) to search across the whole campaign.

**US-S2:** Results are grouped by type: **Spells**, **Items**, **Monsters**, **Characters**, **Quests**, **NPCs**, **Journal Entries**. Each result shows a type badge, name, and a one-line hint.

**US-S3:** Clicking a result navigates to the relevant page/entity detail (e.g. Spell statblock, Character sheet, Quest detail in Story).

**US-S4:** Search is triggered at ≥2 characters, debounced 300ms, via `GET /api/search?q=<query>` with Authorization header.

**US-S5:** 5e Reference results (Spells/Items/Monsters) are global; Character/Quest/NPC/Journal results are filtered by `campaignId` from the session token.

---

## 4. Data Dictionary & UI Elements

### 4.1 New Entity: `DiceRoll`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String (cuid) | PK | |
| `campaignId` | String | FK→Campaign, required | Multi-tenancy scope |
| `playerSessionId` | String | FK→PlayerSession, required | Who rolled |
| `formula` | String | max 100 chars, required | e.g. "2d6+3", "d20" |
| `result` | Int | required | Final total |
| `rolls` | String | JSON `[n, n, …]`, required | Individual die results |
| `context` | String? | max 80 chars | e.g. "Attack", "Stealth" |
| `mode` | String | "normal"\|"advantage"\|"disadvantage", default "normal" | Roll mode |
| `keptRoll` | Int? | nullable | For adv/disadv: the kept d20 value |
| `createdAt` | DateTime | auto | |

Private rolls are **not persisted** (server handles, result returned only to sender — no DB write).

### 4.2 Spell Slot Tracking

Player's character already stores `spellSlotsUsed` as JSON (from Characters module). Quick-view reads this and PATCHes it via existing `PATCH /api/characters/[id]`. No new entity needed.

### 4.3 UI Components

**Dice Panel** (floating or sidebar):
- Die buttons: d4 / d6 / d8 / d10 / d12 / d20 / d100 (gold icons on dark surface)
- Formula input: text field + Roll button
- Context label input: short text, placeholder "Attack, Skill, Save…"
- Mode toggle: Normal / Advantage / Disadvantage
- Private toggle (DM only): off by default

**Roll Feed** (sidebar panel, shared):
- Last 20 rolls, reverse-chrono
- Each row: player name chip + die icon + formula + result (large, gold) + context label + time-ago
- Advantage rows: show both dice, strikethrough the dropped value

**Player Quick-View Panel** (persistent, bottom or right sidebar for own character):
- HP widget: current / max + color bar + Unconscious badge at 0
- AC badge
- Passive Perception
- Spell slots grid (level 1–9, tappable pips)
- Ability score row (click-to-roll)
- Skill list (click-to-roll, collapsible)
- "Roll Initiative" CTA button
- Conditions strip (from active Encounter, read-only display)

**DM Dashboard page** (new route `/campaign/[id]/dashboard`):
- Stats row: 4 stat cards (players / active quests / sessions / total XP)
- Active Quests panel: scrollable card list
- Roster panel: table/card grid
- Last Session card
- Quick-start CTA buttons

**Global Search** (in existing nav header):
- Input with magnifier icon, expands inline
- Dropdown results panel (max-h scroll)
- Grouped sections per entity type
- Empty state + loading skeleton

---

## 5. Edge Cases & Exception Handling

| # | Scenario | Expected behaviour |
|---|----------|-------------------|
| **5.1** | Dice formula is invalid (e.g. `"7d0"`, `"abc"`, `""`) | Socket.io handler returns error event to sender; 422 if via REST fallback; helpful message shown in UI |
| **5.2** | Dice formula die count > 100 (e.g. `200d6`) | 422 — reject to prevent DoS / loop |
| **5.3** | Player rolls before any active encounter | Allowed — dice are independent of encounters |
| **5.4** | Private DM roll | Not persisted, not broadcast; result shown only in DM's panel |
| **5.5** | Advantage roll — show both d20 values | Both displayed; dropped value has strikethrough; kept value highlighted gold |
| **5.6** | HP delta would push `hpCurrent` < 0 | Clamp to 0; show "Unconscious" badge |
| **5.7** | HP delta would push `hpCurrent` > `maxHp` | Clamp to `maxHp` |
| **5.8** | Spell slot level used > character's slots for that level | 422 — "No slots remaining at level N" |
| **5.9** | Player tries to edit another player's HP via PATCH | 403 — `canWrite` only passes for own character or DM |
| **5.10** | Player navigates to `/campaign/[id]/dashboard` | Redirect to their quick-view or 403 page |
| **5.11** | DM Dashboard with zero sessions logged | "No sessions yet" empty state card; stats show 0 |
| **5.12** | DM Dashboard with zero active quests | Active quests panel shows empty state |
| **5.13** | Global search query < 2 chars | No request sent; prompt "Type at least 2 characters" |
| **5.14** | Global search query > 200 chars | 422 — reject |
| **5.15** | Global search with SQL metacharacters (`%`, `_`, `'`) | Prisma parameterized queries prevent injection; treated as literals |
| **5.16** | Global search returns zero results | "No results for 'X'" empty state — no crash |
| **5.17** | Socket.io `dice:roll` from unauthenticated socket | Handler checks `resolveSession`; emits error event, does nothing |
| **5.18** | Roll Feed — more than 20 rolls in campaign | Only last 20 shown in feed; full history in `DiceRoll` table |
| **5.19** | Roster panel — character with no active Encounter | Conditions column shows "—" (no Encounter yet) |
| **5.20** | Player quick-view with no character claimed | Shows "No character claimed" prompt with link to /characters |

---

## 6. Compliance & Non-Functional Requirements

### Security
- All REST endpoints: `resolveSession` → re-derive actor; no role/campaignId from payload
- Socket.io handlers: same authz gate via `resolveSession` on each event
- PATCH character HP: `canWrite(session) || isOwnCharacter(session, characterId)` — players own their character
- Global search: campaignId always from session token, never query param
- DiceRoll formula: validated server-side before rolling (no `eval`)

### Performance
- Roll broadcast latency < 1s on LAN (Socket.io in same room = <50ms typical)
- DM Dashboard: single aggregated REST response < 500ms (no N+1 queries — use Prisma `include` / `_count`)
- Global search: < 300ms; search is full-text LIKE on indexed columns (Prisma `contains` with `mode: 'insensitive'` or raw LIKE)
- Roll feed: server keeps last 20 rows in memory per campaign room (no re-query on new roll)

### Determinism
- All dice rolling: **deterministic server-side RNG** (`Math.random()` is sufficient — no LLM, no external API)
- Formula parsing: pure function in `lib/player-ui/dice.ts` — testable with vitest

### Regression Gate
- **501 prior tests must remain green** after adding this module

### Tech Constraints
- **No new external CDN dependencies** (3D dice lib deferred: UX decision — browser `@3d-dice/dice-box` requires canvas/WebGL; for v1 use **2D animated result numbers** instead, keeping JS bundle small and LAN-friendly)
- Socket.io dice events added to existing `server/index.ts` (or a new `server/dice.ts` registered in `registerHandlers`)
- Additive migration: `player_ui` (CREATE TABLE DiceRoll only — no DROP/ALTER)

### DoD Checklist
1. `DiceRoll` migration `player_ui` — CREATE TABLE only, no DROP/ALTER on existing tables
2. 501 prior tests still pass (regression gate)
3. Public dice roll broadcasts to all campaign participants via Socket.io
4. Private DM roll visible only to DM (not persisted)
5. Player quick-view shows HP/AC/slots/conditions for own character
6. Player HP quick-edit works (clamp to [0, maxHp])
7. Ability/skill/initiative quick-rolls broadcast correctly labeled results
8. DM dashboard shows stats / active quests / roster / last session
9. Global search returns results from ≥4 entity types
10. All REST/socket endpoints: 401 no-session, 403 wrong-role, 422 invalid input
