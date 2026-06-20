# SA_BLUEPRINT — Combat (Sprint 4)
### D&D Campaign Manager · module 5 of 8 · `/sa` (Stage 2)

> **Canonical input for:** `/uxui` → `UXUI_DESIGN.md`, `/proto` → `mockups/`, `/dev`, `/qa`.
> Reads: [PRD.md](./PRD.md) · Hard constraints: [ARCHITECTURE.md](../../program/ARCHITECTURE.md) · [DATA_MODEL.md](../../program/DATA_MODEL.md) · [DESIGN_SYSTEM.md](../../program/DESIGN_SYSTEM.md).

---

## 1. ER Diagram

```mermaid
erDiagram
    Campaign ||--o{ Encounter : "has"
    Campaign ||--o{ PlayerSession : "has"
    Encounter ||--o{ Combatant : "has"
    Combatant }o--o| Character : "references (nullable)"
    Combatant }o--o| Monster : "soft-ref by slug (nullable)"
    PlayerSession }o--o| Character : "claims"

    Campaign {
        string id PK
        string inviteCode UK
        string dmSessionToken
        string status
        datetime createdAt
        datetime updatedAt
    }

    Encounter {
        string id PK
        string campaignId FK
        string name
        string status
        int round
        int currentTurnIndex
        boolean allowPlayerHpEdit
        datetime createdAt
        datetime updatedAt
    }

    Combatant {
        string id PK
        string encounterId FK
        string campaignId
        string type
        string characterId FK_nullable
        string monsterSlug
        string name
        int initiative_nullable
        int initiativeOrder
        int maxHp
        int currentHp
        string conditionsJson
        boolean removed
        datetime createdAt
        datetime updatedAt
    }

    Character {
        string id PK
        string campaignId FK
        string name
        int maxHp
        int currentHp
    }

    Monster {
        string slug PK
        string name
        int hp
        int ac
    }
```

---

## 2. Database Schema

### 2.1 Migration

Single additive migration named **`combat`** — creates two new tables. No existing table is modified. Must be verified before `prisma migrate dev`:

```
Expected diff = CREATE TABLE "Encounter" + CREATE TABLE "Combatant" ONLY.
No DROP, no ALTER of existing tables.
```

### 2.2 `Encounter` Table

| Column | Type | Prisma Type | Constraints | Notes |
|--------|------|-------------|-------------|-------|
| `id` | String | `String` | PK, `@default(cuid())` | |
| `campaignId` | String | `String` | FK→Campaign `onDelete: Cascade`, `@@index` | multi-tenancy spine |
| `name` | String? | `String?` | nullable, max 80 | optional label, e.g. "Goblin Ambush" |
| `status` | String | `String` | `@default("active")` | `"active"` or `"ended"` |
| `round` | Int | `Int` | `@default(1)`, ≥ 1 | incremented on full cycle |
| `currentTurnIndex` | Int | `Int` | `@default(0)`, ≥ 0 | index into sorted non-removed combatants |
| `allowPlayerHpEdit` | Boolean | `Boolean` | `@default(false)` | DM flag |
| `createdAt` | DateTime | `DateTime` | `@default(now())` | |
| `updatedAt` | DateTime | `DateTime` | `@updatedAt` | |

**Constraints:**
- `@@index([campaignId])` — fast active-encounter lookup per campaign
- Application-level: at most one row with `status = "active"` per `campaignId` (enforced in service, not DB unique — ended encounters are kept for history)

### 2.3 `Combatant` Table

| Column | Type | Prisma Type | Constraints | Notes |
|--------|------|-------------|-------------|-------|
| `id` | String | `String` | PK, `@default(cuid())` | |
| `encounterId` | String | `String` | FK→Encounter `onDelete: Cascade` | |
| `campaignId` | String | `String` | `@@index` | denormalized for tenant-scoped queries |
| `type` | String | `String` | `"character"` or `"monster"` | determines which ref used |
| `characterId` | String? | `String?` | FK→Character nullable, `onDelete: SetNull` | set iff `type = "character"` |
| `monsterSlug` | String? | `String?` | soft-ref, no FK | set iff `type = "monster"` |
| `name` | String | `String` | max 80 | display name (may differ from source, e.g. "Goblin #2") |
| `initiative` | Int? | `Int?` | nullable, 1–30 app-validated | null = not yet set |
| `initiativeOrder` | Int | `Int` | `@default(0)` | tie-breaker; lower = earlier within same initiative |
| `maxHp` | Int | `Int` | ≥ 1 | snapshotted from source at add time |
| `currentHp` | Int | `Int` | 0–maxHp server-clamped | |
| `conditionsJson` | String | `String` | `@default("[]")` | JSON: `[{name,level?}]` |
| `removed` | Boolean | `Boolean` | `@default(false)` | soft-delete |
| `createdAt` | DateTime | `DateTime` | `@default(now())` | |
| `updatedAt` | DateTime | `DateTime` | `@updatedAt` | |

**Constraints:**
- `@@unique([encounterId, characterId])` — prevents duplicate character in same encounter (only when `characterId` is not null; Prisma handles nullable unique correctly)
- `@@index([encounterId])` — list combatants per encounter
- `@@index([campaignId])` — tenant queries

### 2.4 Prisma Schema Additions

```prisma
model Encounter {
  id                String      @id @default(cuid())
  campaignId        String
  name              String?
  status            String      @default("active")
  round             Int         @default(1)
  currentTurnIndex  Int         @default(0)
  allowPlayerHpEdit Boolean     @default(false)
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  campaign   Campaign    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  combatants Combatant[]

  @@index([campaignId])
}

model Combatant {
  id              String    @id @default(cuid())
  encounterId     String
  campaignId      String
  type            String    // "character" | "monster"
  characterId     String?
  monsterSlug     String?
  name            String
  initiative      Int?
  initiativeOrder Int       @default(0)
  maxHp           Int
  currentHp       Int
  conditionsJson  String    @default("[]")
  removed         Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  encounter  Encounter  @relation(fields: [encounterId], references: [id], onDelete: Cascade)
  character  Character? @relation(fields: [characterId], references: [id], onDelete: SetNull)

  @@unique([encounterId, characterId])
  @@index([encounterId])
  @@index([campaignId])
}
```

Back-relations to add to existing models (additive, no migration change needed for back-relations in Prisma):
```prisma
// In Character model — add back-relation:
combatants  Combatant[]

// In Campaign model — add back-relation:
encounters  Encounter[]
```

### 2.5 `conditionsJson` Shape

Stored as a JSON string in SQLite. Parsed in `lib/combat/rules.ts`.

```typescript
type ConditionEntry =
  | { name: Condition }                        // all non-Exhaustion
  | { name: "Exhaustion"; level: 1|2|3|4|5|6 } // stackable

type Condition =
  | "Blinded" | "Charmed" | "Deafened" | "Exhaustion"
  | "Frightened" | "Grappled" | "Incapacitated" | "Invisible"
  | "Paralyzed" | "Petrified" | "Poisoned" | "Prone"
  | "Restrained" | "Stunned" | "Unconscious"

// examples:
"[]"
'[{"name":"Poisoned"},{"name":"Exhaustion","level":2}]'
```

---

## 3. API Contracts

### 3.1 REST Endpoints (reads / prep-time only)

All REST endpoints are under `app/api/combat/`. All require a valid session token (resolved via `resolveSession`). Mutations go over Socket.io — REST is read-only during active combat.

#### `GET /api/combat/active`
Returns the active encounter for the caller's campaign, or `null`.

**Headers:** `Authorization: Bearer <sessionToken>`

**Response 200:**
```json
{
  "encounter": {
    "id": "cuid",
    "campaignId": "c1",
    "name": "Goblin Ambush",
    "status": "active",
    "round": 3,
    "currentTurnIndex": 1,
    "allowPlayerHpEdit": false,
    "combatants": [
      {
        "id": "cuid",
        "type": "character",
        "characterId": "char1",
        "monsterSlug": null,
        "name": "Aria",
        "initiative": 18,
        "initiativeOrder": 0,
        "maxHp": 45,
        "currentHp": 30,
        "conditions": [{ "name": "Poisoned" }],
        "removed": false
      }
    ]
  }
}
```
`encounter` is `null` (not 404) when no active encounter exists (edge 5.8).

**Response 401:** `{ "error": "unauthorized" }` — no/invalid session.

---

#### `GET /api/combat/[encounterId]`
Returns a specific encounter by id (for history — any status).

**Response 200:** same shape as above.
**Response 401:** no session.
**Response 404:** encounter not found in this campaign.

---

### 3.2 Socket.io Intent Handlers

Registered in `server/combat.ts`. All handlers follow this pattern:
1. Re-derive session from socket's auth token.
2. Validate role authorization.
3. Validate payload (call `rules.ts`).
4. Mutate DB via `repo.ts`.
5. Broadcast result to `campaignId` room.

**Socket auth:** token passed in `socket.handshake.auth.token`. Validated via `resolveSession` on every intent (no trust in persistent socket state).

#### Intent: `combat:startEncounter`
**Payload:** `{ name?: string }`
**Auth:** DM only
**Guards:** 409 if active encounter exists (edge 5.17)
**Success broadcast:** `combat:encounterStarted { encounter: EncounterSnapshot }`
**Error:** `{ error: "encounter_already_active" | "forbidden" | "unauthorized" }`

---

#### Intent: `combat:endEncounter`
**Payload:** `{ encounterId: string }`
**Auth:** DM only
**Success broadcast:** `combat:encounterEnded { encounterId }`
**Error:** `{ error: "not_found" | "forbidden" | "unauthorized" }`

---

#### Intent: `combat:addCombatant`
**Payload:**
```typescript
| { type: "character"; characterId: string; initiative?: number }
| { type: "monster";   monsterSlug: string; name?: string; initiative?: number }
```
**Auth:** DM only
**Guards:**
- `type=character`: verify `character.campaignId === session.campaignId` → else 404 `character_not_found`
- `@@unique([encounterId, characterId])` violation → 409 `duplicate_combatant` (edge 5.1)
- `type=monster`: look up `Monster` by slug → else 404 `monster_not_found` (edge 5.13)
- `initiative` if provided → `validateInitiative` → 422 `invalid_initiative` (edge 5.11)

**Success broadcast:** `combat:combatantAdded { combatant: CombatantView }`

---

#### Intent: `combat:removeCombatant`
**Payload:** `{ combatantId: string }`
**Auth:** DM only
**Guard:** if combatant is current turn → advance turn first, then remove (edge 5.5)
**Success broadcast:**
1. If turn advanced: `combat:turnAdvanced { ... }`
2. `combat:combatantRemoved { combatantId }`

---

#### Intent: `combat:setInitiative`
**Payload:** `{ combatantId: string; initiative: number }`
**Auth:** DM only
**Guards:** `validateInitiative(initiative)` → 422 `invalid_initiative`
**Success broadcast:** `combat:initiativeSet { combatantId, initiative, sortedOrder: string[] }`

---

#### Intent: `combat:reorderTie`
**Payload:** `{ encounterId: string; orderedIds: string[] }` (full sorted id list within same initiative value)
**Auth:** DM only
**Success broadcast:** `combat:orderUpdated { order: { id, initiativeOrder }[] }`

---

#### Intent: `combat:applyDamage`
**Payload:** `{ combatantId: string; amount: number }`
**Auth:**
- DM: always allowed
- Player: `allowPlayerHpEdit = true` AND `combatant.characterId` = player's claimed character → allowed; else 403 (edges 5.7, 5.18)

**Guards:** `validateHpDelta(amount)` — must be positive integer → 422 `invalid_hp_delta` (edge 5.4)
**Logic:**
```
newHp = max(0, currentHp - amount)         // edge 5.2 clamp
if newHp === 0 && !hasCondition("Unconscious"):
  auto-apply Unconscious
```
**Success broadcast:**
- `combat:hpChanged { combatantId, currentHp: newHp }`
- If Unconscious auto-applied: `combat:conditionsChanged { combatantId, conditions }`

---

#### Intent: `combat:applyHealing`
**Payload:** `{ combatantId: string; amount: number }`
**Auth:** same as `applyDamage`
**Guards:** `validateHpDelta(amount)` → 422 (edge 5.4)
**Logic:** `newHp = min(maxHp, currentHp + amount)` — edge 5.3 clamp (silent)
**Note:** Unconscious NOT auto-removed on heal (DM removes manually)
**Success broadcast:** `combat:hpChanged { combatantId, currentHp: newHp }`

---

#### Intent: `combat:addCondition`
**Payload:** `{ combatantId: string; condition: Condition }`
**Auth:** DM only
**Logic:**
```
if condition === "Exhaustion":
  if already present: level = min(6, level + 1)  // edge 5.9 clamp
  else: add { name: "Exhaustion", level: 1 }
else:
  idempotent: add only if not already present     // edge 5.10
```
**Success broadcast:** `combat:conditionsChanged { combatantId, conditions: ConditionEntry[] }`

---

#### Intent: `combat:removeCondition`
**Payload:** `{ combatantId: string; condition: Condition }`
**Auth:** DM only
**Logic:**
```
if condition === "Exhaustion":
  decrement level; if level reaches 0, remove entirely
else:
  remove from array (no-op if not present)
```
**Success broadcast:** `combat:conditionsChanged { combatantId, conditions }`

---

#### Intent: `combat:nextTurn`
**Payload:** `{ encounterId: string }`
**Auth:** DM only
**Logic:**
```
activeCombatants = sortCombatants(combatants.filter(!removed && initiative != null))
if activeCombatants.length === 0: error 400 "no_active_combatants" (edge 5.19)
nextIndex = (currentTurnIndex + 1) % activeCombatants.length
if nextIndex === 0: round++
update Encounter { currentTurnIndex: nextIndex, round }
```
**Success broadcast:** `combat:turnAdvanced { currentTurnIndex, round, activeCombatantId }`

---

#### Intent: `combat:setTurn`
**Payload:** `{ encounterId: string; combatantId: string }`
**Auth:** DM only
**Logic:** find combatant index in sorted active list; set `currentTurnIndex`; do NOT increment round
**Success broadcast:** `combat:turnAdvanced { currentTurnIndex, round, activeCombatantId }`

---

#### Intent: `combat:requestSnapshot`
**Payload:** `{ encounterId?: string }` — optional; if omitted, returns active encounter
**Auth:** any authenticated session in campaign
**Response (direct to requesting socket only):** `combat:snapshot { encounter: EncounterSnapshot | null }`

---

### 3.3 View Types

```typescript
interface EncounterSnapshot {
  id: string
  campaignId: string
  name: string | null
  status: "active" | "ended"
  round: number
  currentTurnIndex: number
  allowPlayerHpEdit: boolean
  combatants: CombatantView[]   // sorted by initiative desc, then initiativeOrder asc
}

interface CombatantView {
  id: string
  type: "character" | "monster"
  characterId: string | null
  monsterSlug: string | null
  name: string
  initiative: number | null
  initiativeOrder: number
  maxHp: number
  currentHp: number
  conditions: ConditionEntry[]  // parsed from conditionsJson
  removed: boolean
}
```

---

## 4. Security & Authentication

### 4.1 Auth Model (from ARCHITECTURE.md)
- All Socket.io intents carry `socket.handshake.auth.token` (bearer token).
- All REST requests carry `Authorization: Bearer <token>`.
- `resolveSession(token)` → `Session | null` (from `lib/characters/auth.ts`, already built).
- `campaignId` is taken from the resolved session — **never** from the payload.
- Role re-derived on every request: `session.role === "dm"` for DM actions.

### 4.2 Authorization Matrix

| Intent / Endpoint | DM | Player (own char, flag=true) | Player (other / flag=false) | No session |
|-------------------|----|------------------------------|------------------------------|------------|
| GET /api/combat/* | ✅ | ✅ | ✅ | 401 |
| `startEncounter` | ✅ | 403 | 403 | 401 |
| `endEncounter` | ✅ | 403 | 403 | 401 |
| `addCombatant` | ✅ | 403 | 403 | 401 |
| `removeCombatant` | ✅ | 403 | 403 | 401 |
| `setInitiative` | ✅ | 403 | 403 | 401 |
| `reorderTie` | ✅ | 403 | 403 | 401 |
| `applyDamage` | ✅ | ✅ | 403 | 401 |
| `applyHealing` | ✅ | ✅ | 403 | 401 |
| `addCondition` | ✅ | 403 | 403 | 401 |
| `removeCondition` | ✅ | 403 | 403 | 401 |
| `nextTurn` | ✅ | 403 | 403 | 401 |
| `setTurn` | ✅ | 403 | 403 | 401 |
| `requestSnapshot` | ✅ | ✅ | ✅ | 401 |

**Player HP edit guard (double gate):**
```typescript
function canEditHp(session: Session, combatant: Combatant, encounter: Encounter): boolean {
  if (session.role === "dm") return true
  if (!encounter.allowPlayerHpEdit) return false
  const playerChar = getClaimedCharacterId(session)  // from PlayerSession
  return combatant.characterId === playerChar
}
```

### 4.3 Error Response Shape (Socket.io)
Errors emitted back to the **requesting socket only** (not broadcast):
```typescript
socket.emit("combat:error", { intent: string; error: ErrorCode; message: string })
```

Error codes: `unauthorized` · `forbidden` · `not_found` · `encounter_already_active` · `duplicate_combatant` · `monster_not_found` · `character_not_found` · `invalid_initiative` · `invalid_hp_delta` · `no_active_combatants`

---

## 5. Code Architecture & File Layout

```
lib/combat/
  rules.ts        — pure deterministic functions (no DB, no socket)
  types.ts        — shared TypeScript interfaces (ConditionEntry, CombatantView, EncounterSnapshot, etc.)
  repo.ts         — Prisma CRUD (createEncounter, getActiveEncounter, addCombatant, updateCombatant, updateEncounter, etc.)
  service.ts      — orchestration: resolveSession → authz → rules → repo → emit

server/
  combat.ts       — Socket.io intent registration; imports service functions

app/api/combat/
  active/
    route.ts      — GET (active encounter snapshot)
  [encounterId]/
    route.ts      — GET (specific encounter by id)
```

### 5.1 `lib/combat/rules.ts` — Pure Functions

```typescript
// Validation
export function validateInitiative(v: unknown): v is number
  // must be integer, 1 ≤ v ≤ 30

export function validateHpDelta(v: unknown): v is number
  // must be positive integer (> 0)

// HP math
export function applyDamage(currentHp: number, amount: number, maxHp: number): number
  // max(0, currentHp - amount)

export function applyHealing(currentHp: number, amount: number, maxHp: number): number
  // min(maxHp, currentHp + amount)

// Condition management
export function applyCondition(conditions: ConditionEntry[], condition: Condition): ConditionEntry[]
  // idempotent for non-Exhaustion; increments/clamps level for Exhaustion

export function removeCondition(conditions: ConditionEntry[], condition: Condition): ConditionEntry[]
  // removes or decrements Exhaustion

export function parseConditions(json: string): ConditionEntry[]
  // JSON.parse with fallback to []

export function shouldAutoUnconsciousOnKO(conditions: ConditionEntry[], newHp: number): boolean
  // newHp === 0 && !hasCondition(conditions, "Unconscious")

// Sort & turn
export function sortCombatants(combatants: CombatantView[]): CombatantView[]
  // filter removed=false, initiative!=null; sort desc initiative, asc initiativeOrder

export function advanceTurn(currentIndex: number, count: number): { nextIndex: number; roundIncrement: boolean }
  // nextIndex = (currentIndex + 1) % count; roundIncrement = nextIndex === 0

export function buildSnapshot(encounter: Encounter, combatants: Combatant[]): EncounterSnapshot
  // join + parse conditions + sort
```

### 5.2 `lib/combat/repo.ts` — Prisma CRUD

```typescript
createEncounter(campaignId, name?): Promise<Encounter>
getActiveEncounter(campaignId): Promise<Encounter & { combatants: Combatant[] } | null>
getEncounterById(campaignId, encounterId): Promise<Encounter & { combatants: Combatant[] } | null>
endEncounter(encounterId): Promise<void>
addCombatant(data: CreateCombatantInput): Promise<Combatant>
updateCombatant(id: string, data: Partial<Combatant>): Promise<Combatant>
removeCombatant(id: string): Promise<void>   // sets removed=true
updateEncounter(id: string, data: Partial<Encounter>): Promise<Encounter>
getCombatant(campaignId: string, combatantId: string): Promise<Combatant | null>
```

### 5.3 `server/combat.ts` — Intent Registration

```typescript
export function registerCombatHandlers(io: Server, socket: Socket): void {
  socket.on("combat:startEncounter",  (payload) => handleStartEncounter(io, socket, payload))
  socket.on("combat:endEncounter",    (payload) => handleEndEncounter(io, socket, payload))
  socket.on("combat:addCombatant",    (payload) => handleAddCombatant(io, socket, payload))
  socket.on("combat:removeCombatant", (payload) => handleRemoveCombatant(io, socket, payload))
  socket.on("combat:setInitiative",   (payload) => handleSetInitiative(io, socket, payload))
  socket.on("combat:reorderTie",      (payload) => handleReorderTie(io, socket, payload))
  socket.on("combat:applyDamage",     (payload) => handleApplyDamage(io, socket, payload))
  socket.on("combat:applyHealing",    (payload) => handleApplyHealing(io, socket, payload))
  socket.on("combat:addCondition",    (payload) => handleAddCondition(io, socket, payload))
  socket.on("combat:removeCondition", (payload) => handleRemoveCondition(io, socket, payload))
  socket.on("combat:nextTurn",        (payload) => handleNextTurn(io, socket, payload))
  socket.on("combat:setTurn",         (payload) => handleSetTurn(io, socket, payload))
  socket.on("combat:requestSnapshot", (payload) => handleRequestSnapshot(io, socket, payload))
}
```

Each handler:
1. Calls `resolveSession(socket.handshake.auth.token)` → null → emit `combat:error { error: "unauthorized" }` + return.
2. Validates authorization.
3. Calls the appropriate `service.ts` function.
4. On success: `io.to(campaignId).emit(broadcastEvent, payload)`.
5. On error: `socket.emit("combat:error", { intent, error, message })`.

### 5.4 Broadcast Scope
All success events are broadcast to the **campaign room**: `io.to(session.campaignId).emit(...)`.
Error events go only to `socket.emit(...)` (the requesting socket).
Snapshot (`combat:snapshot`) goes only to the requesting socket.

---

## 6. Technical Notes & Best Practices

### 6.1 One Active Encounter per Campaign
Enforced in `service.ts` (not DB unique constraint — ended encounters must be preserved):
```typescript
const existing = await repo.getActiveEncounter(campaignId)
if (existing) return { error: "encounter_already_active" }
```

### 6.2 Soft Delete for Combatants
Set `removed = true` rather than DELETE — preserves encounter history for Sprint 5 (Story/journal). The `sortCombatants` function always filters `removed = false`.

### 6.3 `conditionsJson` Parsing Safety
Always parse with a fallback:
```typescript
export function parseConditions(json: string): ConditionEntry[] {
  try { return JSON.parse(json) ?? [] }
  catch { return [] }
}
```

### 6.4 Turn Index Stability
`currentTurnIndex` is an index into the **sorted** active combatant list (non-removed, initiative set). When a combatant is removed, if its index is ≤ `currentTurnIndex`, the index must be decremented by 1 to keep pointing at the same combatant. This logic lives in `service.ts` (`handleRemoveCombatant`).

### 6.5 Reconnect Pattern
On `combat:requestSnapshot`, server calls `repo.getActiveEncounter(campaignId)` and responds with `buildSnapshot(encounter, combatants)`. This is a single DB read — no cache needed for LAN latency.

### 6.6 No In-Memory State Layer (Simplification)
For LAN play with < 10 concurrent connections, SQLite is fast enough that every mutation writes to DB and broadcasts immediately. No Redis, no in-memory map. Keep it simple; revisit only if profiling shows a bottleneck.

### 6.7 additive Migration Verification
Before running `prisma migrate dev --name combat`, verify the generated SQL contains only:
```sql
CREATE TABLE "Encounter" ( ... );
CREATE TABLE "Combatant" ( ... );
```
No `DROP TABLE`, no `ALTER TABLE` on existing tables. If Prisma generates anything else, investigate before applying.

### 6.8 Back-Relations (Prisma — no migration change)
Adding `combatants Combatant[]` to `Character` and `encounters Encounter[]` to `Campaign` in `schema.prisma` generates no SQL migration — Prisma back-relations are metadata only.

---

## 7. Test Plan

### 7.1 `tests/combat-rules.test.ts` — Pure unit tests (no DB, no socket)
| Group | Cases |
|-------|-------|
| `validateInitiative` | accepts 1, 30; rejects 0, 31, 1.5, null, "high" |
| `validateHpDelta` | accepts 1, 100; rejects 0, -1, 1.5, null |
| `applyDamage` | normal; clamp to 0 (edge 5.2) |
| `applyHealing` | normal; clamp to maxHp (edge 5.3) |
| `applyCondition` | non-Exhaustion idempotent (5.10); Exhaustion increment; Exhaustion clamp at 6 (5.9) |
| `removeCondition` | non-Exhaustion remove; Exhaustion decrement; Exhaustion remove at level 1 |
| `shouldAutoUnconsciousOnKO` | HP=0 no Unconscious → true; HP=0 already Unconscious → false; HP>0 → false |
| `sortCombatants` | desc initiative; tie-break initiativeOrder; removed excluded; null-initiative excluded |
| `advanceTurn` | normal advance; wrap to 0 → roundIncrement=true; single combatant |
| `parseConditions` | valid JSON; malformed → []; empty → [] |

### 7.2 `tests/combat-service.test.ts` — Mocked Prisma + mocked socket
| Group | Cases |
|-------|-------|
| `startEncounter` | success; 409 when active exists; 403 player; 401 no session |
| `addCombatant character` | success; 409 duplicate; 404 character not in campaign |
| `addCombatant monster` | success; 404 unknown slug |
| `applyDamage` | DM success; player own char + flag=true; player own char + flag=false → 403; player other char → 403; amount=0 → 422 |
| `applyHealing` | DM success; clamp to maxHp; player authz (same as damage) |
| `addCondition` | non-Exhaustion idempotent; Exhaustion stack; Exhaustion clamp 6; auto-Unconscious on KO |
| `removeCondition` | non-Exhaustion; Exhaustion decrement; Exhaustion at 1 → removed |
| `nextTurn` | advance; wrap + round increment; no active combatants → 400 |
| `removeCombatant` | non-active; active → advance turn first |

### 7.3 `tests/combat-routes.test.ts` — REST route smoke (direct import, no test server)
| Endpoint | Cases |
|----------|-------|
| `GET /api/combat/active` | 401 no session; 200 with encounter; 200 null when none |
| `GET /api/combat/[id]` | 401; 404 wrong campaign; 200 |

### 7.4 Regression
All 209 prior tests must remain green after the `combat` migration and new code.

---

## 8. SA Notes — Decisions Logged

| Decision | Choice | Rationale |
|----------|--------|-----------|
| `conditionsJson` storage | JSON string in SQLite | mirrors `currencyJson` pattern from Inventory; avoids a separate `Condition` table for 15 known values; parsed in `rules.ts` |
| In-memory state | None — DB only | LAN latency < 200 ms; < 10 connections; simplicity wins; no Redis/Map to invalidate |
| One active encounter per campaign | App-level guard in service | DB unique on `(campaignId, status)` would prevent keeping history; service check is simple and correct |
| Combatant removal | Soft-delete (`removed=true`) | Preserves encounter history for Sprint 5 (Story/journal) |
| initiative range 1–30 | 5e practical range | d20 base (1–20) + max DEX modifier realistic ceiling is ~30; out-of-range → 422 |
| Player HP edit | Double gate: flag AND ownership | Flag alone is DM's policy; ownership check prevents cross-player edits even with flag on |
| No dice in Sprint 4 | Initiative entered manually | Dice broadcasting is Sprint 6; keeping Sprint 4 scope tight |
