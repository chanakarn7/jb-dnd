# PRD — Story Module (Sprint 5)
### D&D Campaign Manager · Sprint 5 · `/ba` output · 2026-06-21

---

## 1. Feature Overview & KPIs

### Problem
DMs running a tabletop campaign accumulate a mountain of handwritten notes across sessions: who did the party meet, which quests are active, what happened last Tuesday. There is no single source of truth the whole table can read between sessions — players forget plot threads, DMs repeat themselves, narrative momentum stalls.

### Solution
The **Story module** gives the DM a lightweight campaign wiki embedded in the same app where they run combat. Four inter-linked record types — Session logs, Quests, NPCs, and a Journal — live under the campaign and are visible (read-only) to players between sessions.

### KPIs
| Metric | Target |
|--------|--------|
| DM can create a full session log in < 2 min | ✅ (minimal required fields) |
| Players can read current active quests without asking the DM | ✅ (read-only view) |
| No regression on prior 329 tests after migration | ✅ (additive migration gate) |
| All 4 entity CRUD flows covered by tests | ✅ (DoD gate) |

### In scope
- Session logs, Quests (+ objectives checklist), NPCs, Journal entries
- DM full CRUD; player read-only across all four types
- Markdown text storage + client-side render (textarea + preview toggle; no rich editor)
- Additive migration `story` — no destructive changes to existing tables

### Out of scope (Sprint 5)
- Dice rolls, encounter linking beyond references (Sprint 6)
- AI-generated session recaps (Sprint 7)
- Image uploads for NPCs
- Location entity (stub in DATA_MODEL; built Sprint 6/7 as needed)
- Fog-of-war / per-player visibility control

---

## 2. Target Platforms & User Roles

**Platform:** Responsive web, LAN-hosted Next.js. Desktop-first (DM laptop); player tablet/phone for read-only.

| Role | Permissions |
|------|-------------|
| **DM** | Full CRUD on Session, Quest, Npc, JournalEntry within their campaign |
| **Player** | Read-only — view all records; cannot create, edit, delete, or toggle objectives/alive |
| **Unauthenticated** | 401 on all endpoints |

**Auth rule:** `resolveSession(request)` → `session.role === "dm"` for any write. `campaignId` always taken from the session token, never from the request body or URL param.

---

## 3. User Stories & Functional Workflows

### 3.1 Session Logs

**US-S1 (DM):** After a play session, I want to log what happened so the party has a written recap.
- DM clicks **"+ Log Session"** on the Story tab
- Form: `title` (optional, placeholder "Session N" where N = auto-incremented count), `date` (date-picker, defaults to today), `summary` (markdown textarea), `xpAwarded` (integer input, default 0), `notableLoot` (free text, optional)
- Submit → POST `/api/story/sessions` → record created → redirects to Session detail page
- DM can **edit** (PATCH) and **delete** (DELETE) any session in their campaign

**US-S2 (Player):** I want to read the recap of last session before we play.
- Player navigates to Story tab → Sessions sub-tab
- Sees card list, reverse-chronological; each card: title, date, XP badge, first 120 chars of summary
- Clicks card → detail page: full markdown render + "Quests touched" list + "NPCs mentioned" list (manual cross-links; just text in this sprint, not auto-parsed)

### 3.2 Quests

**US-Q1 (DM):** I want to track active plot threads so nothing falls through the cracks.
- DM clicks **"+ New Quest"** on the Quests sub-tab
- Form: `name` (required, ≤120 chars), `description` (markdown textarea), `giverName` (free text, optional — NPC name), `status` (select: active/completed/failed/abandoned, default active), `objectives` (dynamic list of text items, add/remove, each with checked state — default unchecked), `reward` (free text, optional)
- Submit → POST `/api/story/quests`

**US-Q2 (DM):** I want to check off objectives as the party completes them.
- On Quest detail or list card: each objective row has a checkbox; DM checks/unchecks → PATCH `/api/story/quests/[id]` with updated `objectivesJson`
- Player sees the same checkbox state but cannot toggle it (UI renders checkboxes as disabled, badge shows X/N checked)

**US-Q3 (DM):** I want to mark a quest as completed/failed.
- Status dropdown on Quest edit form or quick-action button on list card → PATCH status field

### 3.3 NPCs

**US-N1 (DM):** I want a roster of NPCs the party has met so I remember who is who.
- DM clicks **"+ Add NPC"**
- Form: `name` (required, ≤100 chars), `role` (occupation / title, optional, ≤80 chars), `faction` (optional, ≤80 chars), `notes` (markdown textarea — bio, personality, what party knows), `isAlive` (toggle, default true)
- Submit → POST `/api/story/npcs`

**US-N2 (DM):** I want to mark an NPC as dead.
- Toggle on NPC card / edit form: `isAlive` → false → PATCH. Card gets a "†" badge / dimmed appearance

**US-N3 (Player):** I want to browse NPCs the party has met.
- Player sees NPC grid filtered by faction (filter chips) and alive/dead (toggle)
- All controls disabled; notes rendered as markdown

### 3.4 Journal

**US-J1 (DM):** I want to write private or semi-private campaign notes that I can share with the party.
- DM clicks **"+ New Entry"**
- Form: `title` (optional, ≤200 chars), `content` (markdown textarea, required), `sessionId` (optional select from existing sessions — "Link to session")
- Submit → POST `/api/story/journal`

**US-J2 (DM/Player):** I want to read journal entries in order.
- List: reverse-chronological; each row: title (or "Untitled"), date, linked session name (if any)
- Detail: full markdown render + link back to session

---

## 4. Data Dictionary & UI Elements

### 4.1 Entities

#### `Session`
| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `id` | String | auto | PK cuid | |
| `campaignId` | String | auto | FK→Campaign, cascade | from session token |
| `title` | String | no | ≤120 chars, nullable | default "Session {N}" on display |
| `date` | DateTime | yes | user picks | future dates allowed |
| `summary` | String | no | markdown text, nullable | stored as raw markdown |
| `xpAwarded` | Int | yes | ≥ 0, default 0 | |
| `notableLoot` | String | no | free text, nullable | |
| `createdAt` | DateTime | auto | default now | |
| `updatedAt` | DateTime | auto | @updatedAt | |

#### `Quest`
| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `id` | String | auto | PK cuid | |
| `campaignId` | String | auto | FK→Campaign, cascade | |
| `name` | String | yes | ≤120 chars | |
| `description` | String | no | markdown, nullable | |
| `giverName` | String | no | ≤100 chars, nullable | free text (not FK) |
| `status` | String | yes | `active`/`completed`/`failed`/`abandoned`, default `active` | |
| `objectivesJson` | String | no | JSON: `[{text:string, checked:bool}]`, default `"[]"` | ordered list |
| `reward` | String | no | free text, nullable | |
| `createdAt` | DateTime | auto | | |
| `updatedAt` | DateTime | auto | | |

#### `Npc`
| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `id` | String | auto | PK cuid | |
| `campaignId` | String | auto | FK→Campaign, cascade | |
| `name` | String | yes | ≤100 chars | |
| `role` | String | no | ≤80 chars, nullable | occupation/title |
| `faction` | String | no | ≤80 chars, nullable | |
| `notes` | String | no | markdown, nullable | |
| `isAlive` | Boolean | yes | default true | |
| `characterId` | String | no | FK→Character, set null on delete, nullable | optional link to PC stat block |
| `createdAt` | DateTime | auto | | |
| `updatedAt` | DateTime | auto | | |

#### `JournalEntry`
| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `id` | String | auto | PK cuid | |
| `campaignId` | String | auto | FK→Campaign, cascade | |
| `title` | String | no | ≤200 chars, nullable | |
| `content` | String | yes | markdown, min 1 char | |
| `sessionId` | String | no | FK→Session, set null on delete, nullable | optional link |
| `createdAt` | DateTime | auto | | |
| `updatedAt` | DateTime | auto | | |

### 4.2 REST Endpoints

All endpoints are force-dynamic. Auth via `resolveSession(request)`. `campaignId` always from session — never from body or URL.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/story/sessions` | any | list sessions for campaign (reverse-chron) |
| POST | `/api/story/sessions` | DM | create session |
| GET | `/api/story/sessions/[id]` | any | get session detail |
| PATCH | `/api/story/sessions/[id]` | DM | edit session |
| DELETE | `/api/story/sessions/[id]` | DM | delete session; unlinks JournalEntry.sessionId |
| GET | `/api/story/quests` | any | list quests (all statuses) |
| POST | `/api/story/quests` | DM | create quest |
| GET | `/api/story/quests/[id]` | any | get quest detail |
| PATCH | `/api/story/quests/[id]` | DM | edit quest / toggle objectives |
| DELETE | `/api/story/quests/[id]` | DM | delete quest |
| GET | `/api/story/npcs` | any | list NPCs (filterable ?alive=true/false&faction=) |
| POST | `/api/story/npcs` | DM | create NPC |
| GET | `/api/story/npcs/[id]` | any | get NPC detail |
| PATCH | `/api/story/npcs/[id]` | DM | edit NPC / toggle isAlive |
| DELETE | `/api/story/npcs/[id]` | DM | delete NPC |
| GET | `/api/story/journal` | any | list journal entries (reverse-chron) |
| POST | `/api/story/journal` | DM | create entry |
| GET | `/api/story/journal/[id]` | any | get entry detail |
| PATCH | `/api/story/journal/[id]` | DM | edit entry |
| DELETE | `/api/story/journal/[id]` | DM | delete entry |

### 4.3 UI Layout

**Story tab** in campaign page (`/campaign/[id]`) — 4 sub-tabs: Sessions · Quests · NPCs · Journal

Each sub-tab:
- Header with sub-tab name (Cinzel) + "+" button (DM only, hidden for players)
- List/grid area with appropriate card layout
- Empty state: icon + "No [X] yet" message + CTA for DM

Markdown preview: `<ReactMarkdown>` or equivalent — no raw HTML passthrough, only safe markdown elements.

---

## 5. Edge Cases & Exception Handling

| # | Scenario | Expected Behaviour |
|---|----------|--------------------|
| **5.1** | Session date in the future | Allowed — DM may pre-log planned sessions |
| **5.2** | Session XP = 0 | Allowed — milestone XP campaigns |
| **5.3** | Session title empty | Allowed — display "Session {autoN}" in UI |
| **5.4** | Quest with zero objectives | Allowed — `objectivesJson = "[]"`; objective count badge omitted |
| **5.5** | Player POSTs/PATCHes/DELETEs any entity | 403 Forbidden |
| **5.6** | Player PATCHes quest objective (checked toggle) | 403 Forbidden |
| **5.7** | Delete Session that has linked JournalEntries | JournalEntry.sessionId → null (set-null, not cascade delete) |
| **5.8** | Delete NPC referenced as giverName on a Quest | giverName is free text — no FK, no cascade needed |
| **5.9** | NPC's linked Character (characterId) is deleted | characterId → null (set-null on Character delete) |
| **5.10** | Markdown content with `<script>` / HTML tags | Store raw text; render via markdown-only renderer (ReactMarkdown strips raw HTML by default) |
| **5.11** | Quest name empty | 422 Unprocessable — name is required |
| **5.12** | NPC name empty | 422 Unprocessable — name is required |
| **5.13** | JournalEntry content empty | 422 Unprocessable — content is required |
| **5.14** | DM sends mismatched campaignId in body | Ignored — campaignId derived from session token only |
| **5.15** | GET entity from another campaign | 404 (query filtered by campaignId from token — record not found) |
| **5.16** | No session token | 401 Unauthorized |
| **5.17** | PATCH/DELETE non-existent record | 404 Not Found |
| **5.18** | objectivesJson malformed (not valid JSON array) | 422 — validate parse on write; fall back to `[]` on read if DB is corrupt |
| **5.19** | xpAwarded negative | 422 — must be ≥ 0 |
| **5.20** | JournalEntry linked to sessionId from another campaign | 422 — validate sessionId belongs to same campaignId before linking |

---

## 6. Compliance & Non-Functional Requirements

### Security
- All writes re-derive actor from session token (no client-supplied role/campaignId trusted)
- Markdown rendered client-side with sanitization (ReactMarkdown default: no `dangerouslySetInnerHTML`)
- No PII beyond what DM voluntarily enters (NPC names, notes)

### Performance
- All four entity lists paginated or limited to 50 per page (sufficient for a campaign; no infinite-scroll complexity in Sprint 5)
- No Socket.io needed — this is async CRUD; stale-on-refresh is acceptable
- SQLite on LAN: < 50ms for all read queries expected

### Migration
- Single additive migration named `story`
- Creates 4 new tables: `Session`, `Quest`, `Npc`, `JournalEntry`
- No DROP, no ALTER on existing tables
- Regression gate: 329/329 prior tests still pass

### Testing
- `lib/story/rules.ts` — pure validation functions (validateXp, parseObjectives, validateSessionFields, etc.) covered by unit tests
- `lib/story/service.ts` — mocked-Prisma tests for all CRUD + authz matrix (DM vs player, 403 paths)
- Route-level smoke tests — 401/403/404/422/200 for representative endpoints from each entity
- Target: ~80 new tests

### Definition of Done
1. ✅ Additive migration `story` — 4 tables, no DROP/ALTER
2. ✅ 329 prior tests still pass (regression gate)
3. ✅ DM can create/edit/delete Session, Quest, Npc, JournalEntry
4. ✅ Player read-only enforced (403 on all writes)
5. ✅ Markdown renders correctly in UI (no raw HTML passthrough)
6. ✅ Quest objectives check/uncheck (DM only)
7. ✅ NPC alive/dead toggle (DM only)
8. ✅ All endpoints: 401 no-session, 403 player-write, 404 not-found, 422 invalid
9. ✅ No Socket.io required (async REST CRUD only)
10. ✅ DATA_MODEL.md amended: Session, Quest, Npc, JournalEntry finalized
