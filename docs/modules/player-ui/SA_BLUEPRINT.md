# SA_BLUEPRINT — Player UI + Dice + Dashboard (Sprint 6)

> Module base dir: `docs/modules/player-ui/`
> Reads: [PRD.md](./PRD.md) · [ARCHITECTURE.md](../../program/ARCHITECTURE.md) · [DATA_MODEL.md](../../program/DATA_MODEL.md)
> Written to: `docs/modules/player-ui/SA_BLUEPRINT.md`

---

## 1. ER Diagram

```mermaid
erDiagram
    Campaign ||--o{ DiceRoll : "campaignId"
    PlayerSession ||--o{ DiceRoll : "playerSessionId"

    Campaign {
        string id PK
        string name
        string inviteCode
        string dmSessionToken
    }
    PlayerSession {
        string id PK
        string campaignId FK
        string role
        string sessionToken
        string characterId FK_nullable
    }
    DiceRoll {
        string id PK
        string campaignId FK
        string playerSessionId FK
        string formula
        int result
        string rolls_json
        string context_nullable
        string mode
        int keptRoll_nullable
        datetime createdAt
    }
```

> `DiceRoll` is the only NEW table. All other reads use existing entities via Prisma queries (no new tables for search, dashboard, or quick-view).

---

## 2. Database Schema

### 2.1 New Table: `DiceRoll`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | String | PK, `@default(cuid())` | |
| `campaignId` | String | FK→Campaign, `onDelete: Cascade`, indexed | Multi-tenancy scope |
| `playerSessionId` | String | FK→PlayerSession, `onDelete: Cascade`, indexed | Who rolled |
| `formula` | String | max 100 chars (app-validated) | e.g. "2d6+3", "d20" |
| `result` | Int | required | Final total |
| `rolls` | String | JSON `[n, n, ...]`, required | Individual die results |
| `context` | String? | max 80 chars, nullable | e.g. "Attack", "Stealth" |
| `mode` | String | `"normal"` \| `"advantage"` \| `"disadvantage"`, default `"normal"` | |
| `keptRoll` | Int? | nullable | For adv/disadv: the kept d20 value |
| `createdAt` | DateTime | `@default(now())` | |

**Indexes:**
- `@@index([campaignId])` — scope queries
- `@@index([campaignId, createdAt])` — recent feed (ORDER BY createdAt DESC LIMIT 20)

### 2.2 Prisma Model (to add to `schema.prisma`)

```prisma
model DiceRoll {
  id              String   @id @default(cuid())
  campaignId      String
  playerSessionId String
  formula         String   // max 100, app-validated
  result          Int
  rolls           String   // JSON: [n, n, ...]
  context         String?  // max 80
  mode            String   @default("normal") // normal|advantage|disadvantage
  keptRoll        Int?     // kept d20 for adv/disadv
  createdAt       DateTime @default(now())

  campaign       Campaign       @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  playerSession  PlayerSession  @relation(fields: [playerSessionId], references: [id], onDelete: Cascade)

  @@index([campaignId])
  @@index([campaignId, createdAt])
}
```

### 2.3 Migration

Single additive migration: `player_ui`
- `CREATE TABLE "DiceRoll"` — only new DDL
- **Zero DROP/ALTER** on existing tables
- Add back-relation to `PlayerSession` (Prisma-level only, no SQL change) and `Campaign`

---

## 3. API Contracts

### 3.1 REST Endpoints

All endpoints:
- **Auth:** `Authorization: Bearer <sessionToken>` → `resolveSession(req)` → actor derived server-side
- **Multi-tenancy:** `campaignId` always from session, never from query params or body
- **Error codes:** 401 (no session) · 403 (wrong role) · 404 (not found) · 422 (validation)

---

#### `GET /api/dice/recent`

Fetch the last 20 public dice rolls for the session's campaign.

**Auth:** Any authenticated session.

**Response 200:**
```json
{
  "rolls": [
    {
      "id": "cuid1",
      "playerName": "Aria",
      "formula": "2d6+3",
      "result": 11,
      "rolls": [4, 4],
      "context": "Damage",
      "mode": "normal",
      "keptRoll": null,
      "createdAt": "2026-06-21T10:00:00Z"
    }
  ]
}
```

---

#### `GET /api/search?q=<query>`

Global search across all entity types for the campaign.

**Auth:** Any authenticated session. `campaignId` from session token.

**Query params:**
| Param | Required | Constraints |
|-------|----------|-------------|
| `q` | Yes | 2–200 chars; 422 outside range |

**Response 200:**
```json
{
  "results": {
    "spells": [{ "slug": "fireball", "name": "Fireball", "hint": "Level 3 · Evocation" }],
    "items": [{ "slug": "longsword", "name": "Longsword", "hint": "Weapon" }],
    "monsters": [{ "slug": "goblin", "name": "Goblin", "hint": "CR 1/4 · Humanoid" }],
    "characters": [{ "id": "cuid1", "name": "Aria Moonwhisper", "hint": "Wizard 5" }],
    "quests": [{ "id": "cuid2", "name": "Find the Sunken Temple", "hint": "from Elder Maren" }],
    "npcs": [{ "id": "cuid3", "name": "Elder Maren", "hint": "Town Elder · Thornhaven Council" }],
    "journalEntries": [{ "id": "cuid4", "title": "Thornhaven Lore", "hint": "Session 3" }]
  }
}
```

Each group max 10 results. Empty groups still present (empty array).

---

#### `GET /api/dashboard`

DM-only campaign overview aggregation.

**Auth:** DM only (403 for player).

**Response 200:**
```json
{
  "dashboard": {
    "playerCount": 4,
    "activeQuestCount": 2,
    "sessionCount": 5,
    "totalXp": 1650,
    "activeQuests": [
      {
        "id": "cuid",
        "name": "Find the Sunken Temple",
        "giverName": "Elder Maren",
        "objectivesTotal": 5,
        "objectivesChecked": 2
      }
    ],
    "roster": [
      {
        "characterId": "cuid",
        "characterName": "Aria Moonwhisper",
        "class": "Wizard",
        "level": 5,
        "hpCurrent": 18,
        "hpMax": 32,
        "conditions": ["Poisoned"]
      }
    ],
    "lastSession": {
      "id": "cuid",
      "title": "Thornhaven Arrival",
      "date": "2026-06-15",
      "xpAwarded": 250,
      "summaryExcerpt": "The party arrived in the walled town…"
    }
  }
}
```

**Empty states:** `lastSession: null` when no sessions; `activeQuests: []`, `roster: []` are valid.

---

#### `GET /api/characters/[id]/quickview`

Player quick-view snapshot for a specific character.

**Auth:** Player (own character) or DM. Player accessing another player's character → 403.

**Next.js 16 params:** `const { id } = await params`

**Response 200:**
```json
{
  "quickview": {
    "characterId": "cuid",
    "name": "Aria Moonwhisper",
    "hpCurrent": 18,
    "hpMax": 32,
    "ac": 13,
    "passivePerception": 12,
    "abilityScores": { "str": 8, "dex": 14, "con": 13, "int": 18, "wis": 12, "cha": 10 },
    "abilityModifiers": { "str": -1, "dex": 2, "con": 1, "int": 4, "wis": 1, "cha": 0 },
    "skillBonuses": { "arcana": 6, "history": 6, "investigation": 6, "stealth": 2 },
    "spellSlots": { "1": 4, "2": 3, "3": 2 },
    "spellSlotsUsed": { "1": 1, "2": 0, "3": 0 },
    "conditions": ["Poisoned"],
    "level": 5,
    "className": "Wizard"
  }
}
```

`conditions` comes from the active `Encounter`'s `Combatant` row for this character (empty array if no active encounter or character not in encounter).

---

#### `PATCH /api/characters/[id]/hp`

Quick HP edit — clamps to [0, maxHp].

**Auth:** Player (own character) or DM.

**Request body:**
```json
{ "hpCurrent": 14 }
```

**Response 200:**
```json
{ "hpCurrent": 14, "hpMax": 32 }
```

**422:** if `hpCurrent` is not a non-negative integer.

---

#### `PATCH /api/characters/[id]/spell-slots`

Update spell slots used.

**Auth:** Player (own character) or DM.

**Request body:**
```json
{ "spellSlotsUsed": { "1": 2, "2": 1 } }
```

**422:** if used count for any level exceeds total slots for that level.

**Response 200:**
```json
{ "spellSlotsUsed": { "1": 2, "2": 1 } }
```

---

### 3.2 Socket.io Events (server/dice.ts)

All handlers in `registerDiceHandlers(io, socket)`.

Auth on every handler: call `resolveSession` using socket's stored session token (set during `connection`). On failure → emit `dice:error` to sender only.

#### `dice:roll` (client → server)

Public roll — persisted + broadcast to all campaign participants.

**Payload:**
```json
{
  "formula": "2d6+3",
  "context": "Attack",
  "mode": "normal"
}
```

**Server flow:**
1. `resolveSession(socket)` → get session + campaignId
2. `parseFormula(payload.formula)` → if null → emit `dice:error` to sender
3. `rollFormula(parsed, mode)` → `{ total, rolls, kept? }`
4. `saveDiceRoll(...)` → persists to DB
5. Emit `dice:result` to **entire campaign room** (`io.to(campaignId)`)

**Broadcast payload `dice:result`:**
```json
{
  "id": "cuid",
  "playerName": "Aria",
  "formula": "2d6+3",
  "result": 11,
  "rolls": [4, 4],
  "context": "Attack",
  "mode": "normal",
  "keptRoll": null,
  "createdAt": "2026-06-21T10:00:00Z"
}
```

#### `dice:rollPrivate` (client → server, DM only)

Private roll — NOT persisted, result sent only to sender.

**Payload:** same as `dice:roll`

**Server flow:**
1. `resolveSession(socket)` → if player → emit `dice:error` ("private_dm_only")
2. `parseFormula` + `rollFormula`
3. Emit `dice:privateResult` to **sender socket only** (no DB write, no broadcast)

#### `dice:feed` (client → server)

Request initial roll feed on reconnect.

**Server flow:**
1. `resolveSession(socket)`
2. `getRecentRolls(campaignId, 20)` → emit `dice:feedResult` to sender

#### `dice:error` (server → client, sender only)
```json
{ "error": "invalid_formula", "message": "Cannot parse '7d0'" }
```

---

## 4. Security & Authentication

### 4.1 Authz Matrix

| Endpoint / Event | DM | Player (own char) | Player (other char) |
|------------------|----|-------------------|---------------------|
| `dice:roll` | ✅ | ✅ | ✅ (N/A — roll is own) |
| `dice:rollPrivate` | ✅ | ❌ 403 | ❌ 403 |
| `GET /api/dice/recent` | ✅ | ✅ | ✅ |
| `GET /api/search` | ✅ | ✅ | ✅ |
| `GET /api/dashboard` | ✅ | ❌ 403 | ❌ 403 |
| `GET /api/characters/[id]/quickview` | ✅ | ✅ | ❌ 403 |
| `PATCH /api/characters/[id]/hp` | ✅ | ✅ | ❌ 403 |
| `PATCH /api/characters/[id]/spell-slots` | ✅ | ✅ | ❌ 403 |

### 4.2 Ownership Check

For character-specific endpoints: `canWriteCharacter(session, character) = session.role === "dm" || character.ownerSessionId === session.id`

`ownerSessionId` is the `PlayerSession.id` that claimed this character (stored in `Character`). Already populated by Characters module.

### 4.3 Formula Safety

Formula validation in `parseFormula` uses regex + numeric bounds — no `eval`, no dynamic code execution.

Regex: `/^(\d+)?d(\d+)([+-]\d+)?$/i` (with die count ≤100, sides ≥2 ≤1000).

---

## 5. Technical Architecture

### 5.1 File Structure

```
lib/player-ui/
  types.ts          — DiceRollView, SearchResult, SearchResultGroup, DashboardSnapshot,
                       RosterEntry, QuickViewSnapshot, ParsedFormula, RollResult interfaces
  dice.ts           — pure: parseFormula, rollFormula, rollAdvantage, rollDisadvantage
  search.ts         — pure: groupSearchResults (formats raw Prisma data into SearchResultGroup)
  repo.ts           — Prisma: saveDiceRoll, getRecentRolls, getDashboardData, getQuickViewData,
                       searchAll, updateCharacterHp, updateSpellSlotsUsed
  service.ts        — orchestrate: rollDiceAction, getRollFeedAction, searchAction,
                       getDashboardAction, getQuickViewAction, updateHpAction,
                       updateSpellSlotsAction

server/
  dice.ts           — registerDiceHandlers(io, socket)

app/api/
  dice/recent/route.ts              — GET
  search/route.ts                   — GET
  dashboard/route.ts                — GET
  characters/[id]/hp/route.ts       — PATCH
  characters/[id]/spell-slots/route.ts — PATCH
  characters/[id]/quickview/route.ts — GET
```

### 5.2 Dice Engine (`lib/player-ui/dice.ts`)

```typescript
export type ParsedFormula = { count: number; sides: number; modifier: number };
export type RollResult = { total: number; rolls: number[]; keptRoll?: number };

// Returns null for invalid formula (7d0, "abc", 200d6 etc.)
export function parseFormula(formula: string): ParsedFormula | null

// Pure roll — Math.random() only
export function rollFormula(parsed: ParsedFormula): RollResult

// Advantage: roll 2×d20, keep highest
export function rollAdvantage(modifier: number): RollResult

// Disadvantage: roll 2×d20, keep lowest
export function rollDisadvantage(modifier: number): RollResult
```

Validation rules in `parseFormula`:
- Regex match required
- `count` (die count): 1–100 (default 1 if omitted); reject 0 or >100
- `sides`: 2–1000 (standard dice: 4, 6, 8, 10, 12, 20, 100); reject 0 or 1

### 5.3 Search Implementation (`lib/player-ui/repo.ts`)

Uses `Promise.all` (not `$transaction` — reads only, no atomicity needed) with 7 parallel Prisma `findMany` calls:

```typescript
const [spells, items, monsters, characters, quests, npcs, journalEntries] = await Promise.all([
  prisma.spell.findMany({ where: { name: { contains: q } }, take: 10, select: { slug, name, level, school } }),
  prisma.item.findMany({ where: { name: { contains: q } }, take: 10, select: { slug, name, type } }),
  prisma.monster.findMany({ where: { name: { contains: q } }, take: 10, select: { slug, name, cr, type } }),
  prisma.character.findMany({ where: { campaignId, name: { contains: q } }, take: 10, select: { id, name, class, level } }),
  prisma.quest.findMany({ where: { campaignId, OR: [{ name: contains q }, { giverName: contains q }, { description: contains q }] }, take: 10 }),
  prisma.npc.findMany({ where: { campaignId, OR: [{ name: contains q }, { faction: contains q }] }, take: 10 }),
  prisma.journalEntry.findMany({ where: { campaignId, OR: [{ title: contains q }, { content: contains q }] }, take: 10 }),
]);
```

SQLite uses case-insensitive LIKE by default for ASCII. `contains` maps to LIKE `%q%`.

### 5.4 Dashboard Aggregation (`lib/player-ui/repo.ts`)

Single function `getDashboardData(campaignId)` using `Promise.all`:

```typescript
const [
  playerCount,
  activeQuestCount,
  sessionCount,
  totalXpAgg,
  activeQuests,
  roster,
  lastSession,
] = await Promise.all([
  prisma.playerSession.count({ where: { campaignId, role: "player" } }),
  prisma.quest.count({ where: { campaignId, status: "active" } }),
  prisma.session.count({ where: { campaignId } }),
  prisma.session.aggregate({ where: { campaignId }, _sum: { xpAwarded: true } }),
  prisma.quest.findMany({ where: { campaignId, status: "active" }, take: 10, orderBy: { createdAt: "asc" } }),
  prisma.playerSession.findMany({
    where: { campaignId, role: "player" },
    include: { character: { select: { id, name, class, level, hpCurrent, hpMax, ownerSessionId } } },
  }),
  prisma.session.findFirst({ where: { campaignId }, orderBy: { date: "desc" } }),
]);
```

Conditions for roster: find active Encounter, then Combatant rows matching characterIds. Assembled server-side (no N+1 — one `Combatant.findMany` with `characterId: { in: [...] }`).

### 5.5 Quick-View (`lib/player-ui/repo.ts`)

```typescript
async function getQuickViewData(campaignId: string, characterId: string)
```

1. `prisma.character.findUnique({ where: { id: characterId, campaignId } })` → 404 if not found
2. Parse `spellSlotsUsed` (JSON), `abilityScores` (JSON)
3. Compute modifiers: `Math.floor((score - 10) / 2)` for each ability
4. Find active Encounter: `prisma.encounter.findFirst({ where: { campaignId, status: "active" } })`
5. If encounter: `prisma.combatant.findFirst({ where: { encounterId: encounter.id, characterId } })` → parse `conditionsJson`
6. Return `QuickViewSnapshot`

### 5.6 Next.js 16 Route Handlers

All `[id]` routes use:
```typescript
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ...
}
```

All routes: `export const dynamic = "force-dynamic";`

### 5.7 Socket.io Integration

`server/dice.ts` exports `registerDiceHandlers(io, socket)`. Called from existing `server/index.ts` in the `io.on("connection", ...)` block, after `registerCombatHandlers`.

Session token stored on socket during connection handshake:
```typescript
socket.data.sessionToken = socket.handshake.auth.token;
```

Each handler calls `resolveSession({ headers: { authorization: `Bearer ${socket.data.sessionToken}` } })`.

---

## 6. Test Plan

| File | Tests | Scope |
|------|-------|-------|
| `tests/dice-rules.test.ts` | ~25 | Pure `lib/player-ui/dice.ts`: parseFormula (valid/invalid/edge cases), rollFormula (bounds, distribution), rollAdvantage/Disadvantage |
| `tests/player-ui-service.test.ts` | ~35 | `lib/player-ui/service.ts` with mocked repo: authz matrix DM/player/null, all PRD §5 edges, search grouping, dashboard aggregation |
| `tests/player-ui-routes.test.ts` | ~20 | All 6 REST routes: 401/403/404/422/200 per endpoint; mocked service + real HTTP layer |
| **Total new** | **~80** | All PRD §5 edge cases covered |
| **Total suite** | **~581** | 501 prior + ~80 new |

---

## 7. DATA_MODEL.md Amendment

After writing this blueprint, amend `docs/program/DATA_MODEL.md`:
- **Entity Catalog**: add `DiceRoll` row (already stub — finalize with Player UI + Dice owner)
- **Entity section `#diceroll`**: add full column table (Sprint 6, migration `player_ui`)
- **`PlayerSession` section**: add note "back-relation `diceRolls DiceRoll[]` added Sprint 6 (Prisma-level only)"
- **`Campaign` section**: same back-relation note
