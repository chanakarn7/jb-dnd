# PRD — Combat (Sprint 4)
### D&D Campaign Manager · module 5 of 8 · `/ba` (Stage 1)

> **Canonical input for:** `/sa` → `SA_BLUEPRINT.md`, `/uxui` → `UXUI_DESIGN.md`, `/proto` → `mockups/`, `/dev`, `/qa`.
> Hard constraints: [ARCHITECTURE.md](../../program/ARCHITECTURE.md) · [DATA_MODEL.md](../../program/DATA_MODEL.md) · [DESIGN_SYSTEM.md](../../program/DESIGN_SYSTEM.md).

---

## 1. Feature Overview & KPIs

### 1.1 Problem
A D&D table runs combat as the most rules-dense, time-pressured part of play. Without tooling, the DM juggles: who goes next, who is at what HP, what status effects are on the troll, whether the rogue is poisoned, and how many rounds have passed — all on paper. Players lose track of their own turn. Combat slows to a crawl.

### 1.2 Solution
A **server-authoritative, real-time combat tracker** that every device at the table sees simultaneously. The DM drives; all clients receive live state. No dice rolling in this sprint — initiative values are entered manually.

### 1.3 Success KPIs
| KPI | Target |
|-----|--------|
| HP broadcast latency (LAN) | ≤ 200 ms |
| Turn-advance round-trip | ≤ 100 ms |
| Reconnect snapshot delivery | ≤ 500 ms |
| Regression gate | 209 + new tests all green |
| Conditions rendered on participant row | 14 / 14 |

### 1.4 Non-Goals (explicitly out of scope for Sprint 4)
- Dice rolling of any kind (dice broadcast → Sprint 6)
- XP awards, loot drops, or encounter rewards
- Multiple simultaneous encounters per campaign
- Spell slot consumption during combat
- Attack/damage resolution
- Homebrew monsters or custom stat blocks
- Initiative roll automation (d20 + DEX) — value entered by DM
- Combat log / history export

---

## 2. Target Platforms & User Roles

### 2.1 Platform
Responsive web app (Next.js), served over LAN from the DM's machine. Primary device: tablet or laptop at the table. Secondary: phone (player view). Dark mode is the primary and default theme.

### 2.2 User Roles & Permissions

| Action | DM | Player (own character) | Player (other's character) |
|--------|----|-----------------------|---------------------------|
| Create / end encounter | ✅ | ❌ | ❌ |
| Add / remove combatant | ✅ | ❌ | ❌ |
| Set / edit initiative | ✅ | ❌ | ❌ |
| Reorder initiative ties | ✅ | ❌ | ❌ |
| Apply damage to combatant | ✅ | ✅ (if `allowPlayerHpEdit` flag) | ❌ (403) |
| Apply healing to combatant | ✅ | ✅ (if `allowPlayerHpEdit` flag) | ❌ (403) |
| Add / remove condition | ✅ | ❌ | ❌ |
| Advance turn (Next Turn) | ✅ | ❌ | ❌ |
| Jump to specific combatant's turn | ✅ | ❌ | ❌ |
| View entire combat state (read-only) | ✅ | ✅ | ✅ |
| Toggle `allowPlayerHpEdit` flag | ✅ | ❌ | ❌ |

> **Auth rule (from ARCHITECTURE.md):** every socket intent and REST endpoint re-derives the actor's role from their session token server-side. No client payload is trusted for role or campaignId.

---

## 3. User Stories & Functional Workflows

### 3.1 Encounter Lifecycle

**Story DM-1 — Start encounter**
> As DM, I want to open a new encounter so combat can begin.

Flow:
1. DM clicks **"Start Combat"** button (visible only in DM view, lobby or campaign sidebar).
2. Server creates an `Encounter` row (`status: active`, `round: 1`, `currentTurnIndex: 0`) for this campaign.
3. All clients receive `combat:encounterStarted` socket event with the new encounter snapshot.
4. The combat tracker panel opens on every client.

**Story DM-2 — End encounter**
> As DM, I want to end combat so we can return to normal play.

Flow:
1. DM clicks **"End Combat"** (confirmation dialog: "End this encounter?").
2. Server sets `Encounter.status = 'ended'`; broadcasts `combat:encounterEnded`.
3. Combat panel closes / collapses on all clients.
4. Combatants are NOT deleted (preserve history for future log in Sprint 5).

**Constraint:** Only one encounter with `status: 'active'` per campaign at a time. Attempting to start a new one while one is active → 409 Conflict.

---

### 3.2 Adding Participants

**Story DM-3 — Add a Character**
> As DM, I want to add a player's character (or an NPC character) to the encounter.

Flow:
1. DM opens the "Add Combatant" panel.
2. DM selects from a list of `Character` records in this campaign (includes NPC characters).
3. Server creates a `Combatant` row: `type: 'character'`, `characterId`, `name` = character name, `maxHp` = character's current `maxHp`, `currentHp` = character's current `currentHp`, `initiative: null` (unset).
4. Broadcast `combat:combatantAdded`.

**Story DM-4 — Add a Monster**
> As DM, I want to add a monster from the SRD to the encounter.

Flow:
1. DM searches monsters by name in the Add panel.
2. DM selects a monster slug; optionally sets a custom name (e.g., "Goblin #2").
3. Server looks up `Monster` by slug → if not found → 404.
4. Server creates `Combatant` row: `type: 'monster'`, `monsterSlug`, `name`, `maxHp` from monster statblock, `currentHp = maxHp`, `initiative: null`.
5. Broadcast `combat:combatantAdded`.

**Story DM-5 — Remove a Combatant**
> As DM, I want to remove a combatant (fled, killed, not relevant).

Flow:
1. DM clicks remove icon on a combatant row.
2. If it's currently that combatant's turn → server advances turn to next before removing.
3. Server soft-deletes (marks `removed: true`) rather than DB delete (preserve history).
4. Broadcast `combat:combatantRemoved`.

---

### 3.3 Initiative

**Story DM-6 — Set initiative values**
> As DM, I want to type in each combatant's initiative score.

- Initiative is an integer **1–30** (5e practical range: 1 = minimum d20+mods; 30 = theoretical max for high-DEX builds).
- DM can set/edit initiative for any combatant at any time (even mid-combat).
- List always sorted **descending** by initiative; ties displayed in order added (DM can drag or use ▲▼ buttons to reorder within the same initiative value).
- Combatants with `initiative: null` appear at the **bottom** of the list in a "Waiting" section.

**Validation:** initiative not in [1, 30] → 422 `invalid_initiative`.

---

### 3.4 HP Tracking

**Story DM-7 / Player-7 — Apply damage**
> As DM (or player with permission), I want to deal damage to a combatant.

Flow:
1. Actor enters damage amount (positive integer) in the combatant row's damage input.
2. Client emits `combat:applyDamage { combatantId, amount }`.
3. Server validates: amount > 0 (else 422 `invalid_hp_delta`); actor authorized (else 403).
4. Server computes `newHp = max(0, currentHp - amount)`.
5. If `newHp === 0` and combatant does not already have "Unconscious" condition → server auto-applies Unconscious.
6. Server persists, broadcasts `combat:hpChanged { combatantId, currentHp: newHp, conditions }`.

**Story DM-8 / Player-8 — Apply healing**
> As DM (or player with permission), I want to heal a combatant.

Flow similar to damage:
1. Actor enters heal amount (positive integer).
2. Client emits `combat:applyHealing { combatantId, amount }`.
3. Server: `newHp = min(maxHp, currentHp + amount)`.
4. If combatant was Unconscious due to HP=0 and now HP>0 → Unconscious is **NOT** auto-removed (DM removes it manually — they may still be dying, just stabilized).
5. Broadcast `combat:hpChanged`.

**HP display:** always shown as `currentHp / maxHp` in JetBrains Mono, color-coded:
- > 50% maxHp → `--text` (normal)
- 26–50% maxHp → `--warning` (amber)
- 1–25% maxHp → `--danger` (red)
- 0 → `--danger` + "KO" badge

---

### 3.5 Condition Manager

**Story DM-9 — Add a condition**
> As DM, I want to apply a status condition to a combatant.

Flow:
1. DM clicks the "+" conditions button on a combatant row.
2. A condition picker appears (grid of 14+Exhaustion; each with name + icon).
3. DM clicks a condition.
4. Client emits `combat:addCondition { combatantId, condition }`.
5. Server adds condition to `Combatant.conditionsJson` (idempotent — no-op if already present, except Exhaustion).
6. **Exhaustion** — stackable: if already present, increments `exhaustionLevel` (1→2→…→6 max, clamp). If not present, sets level 1.
7. Broadcast `combat:conditionsChanged { combatantId, conditions }`.

**Story DM-10 — Remove a condition**
> As DM, I want to clear a condition when it ends.

1. DM clicks the condition badge on the combatant row.
2. For non-Exhaustion: removes it entirely.
3. For Exhaustion: decrements `exhaustionLevel` by 1; if reaches 0, removes the condition entirely.
4. Broadcast `combat:conditionsChanged`.

**The 14 standard 5e SRD conditions** (all shown as badges; Exhaustion alone is stackable):

| Condition | Badge color | Notes |
|-----------|-------------|-------|
| Blinded | `--text-muted` / grey | |
| Charmed | `--arcane` / purple | |
| Deafened | `--text-muted` / grey | |
| Exhaustion | `--warning` / amber | Stackable 1–6; badge shows level |
| Frightened | `--warning` / amber | |
| Grappled | `--text-muted` / grey | |
| Incapacitated | `--danger` / red | |
| Invisible | `--arcane` / purple | |
| Paralyzed | `--danger` / red | |
| Petrified | `--text-muted` / grey | |
| Poisoned | `--heal` / green (sickly) | |
| Prone | `--text-muted` / grey | |
| Restrained | `--warning` / amber | |
| Stunned | `--danger` / red | |
| Unconscious | `--danger` / red | Auto-applied at HP=0 |

---

### 3.6 Turn Order

**Story DM-11 — Advance turn**
> As DM, I want to move to the next combatant's turn.

Flow:
1. DM clicks **"Next Turn"** button (or keyboard shortcut).
2. Client emits `combat:nextTurn`.
3. Server computes next `currentTurnIndex` among non-removed combatants sorted by initiative.
4. If wrapping from last to first → `round` increments by 1.
5. Server persists `Encounter.currentTurnIndex` and `Encounter.round`.
6. Broadcast `combat:turnAdvanced { currentTurnIndex, round, activeCombatantId }`.
7. Active combatant row highlights with gold left border + "▶ [Name]'s turn" label.

**Story DM-12 — Jump to specific turn**
> As DM, I want to set the active turn to a specific combatant (skip, rewind).

1. DM clicks a combatant row's "Set Active" button (available in DM view only).
2. Emits `combat:setTurn { combatantId }`.
3. Server sets `currentTurnIndex` to that combatant's index; does NOT increment round.
4. Broadcast `combat:turnAdvanced`.

---

### 3.7 Real-time Sync & Reconnect

All state mutations go through Socket.io intents (per ARCHITECTURE.md §API conventions). Naming convention: `combat:<action>`.

**Full event list:**
| Client → Server (intent) | Server → All Clients (broadcast) |
|--------------------------|----------------------------------|
| `combat:startEncounter` | `combat:encounterStarted { encounter }` |
| `combat:endEncounter` | `combat:encounterEnded { encounterId }` |
| `combat:addCombatant` | `combat:combatantAdded { combatant }` |
| `combat:removeCombatant` | `combat:combatantRemoved { combatantId }` |
| `combat:setInitiative` | `combat:initiativeSet { combatantId, initiative, order }` |
| `combat:reorderTie` | `combat:orderUpdated { order }` |
| `combat:applyDamage` | `combat:hpChanged { combatantId, currentHp, conditions }` |
| `combat:applyHealing` | `combat:hpChanged { combatantId, currentHp }` |
| `combat:addCondition` | `combat:conditionsChanged { combatantId, conditions }` |
| `combat:removeCondition` | `combat:conditionsChanged { combatantId, conditions }` |
| `combat:nextTurn` | `combat:turnAdvanced { currentTurnIndex, round, activeCombatantId }` |
| `combat:setTurn` | `combat:turnAdvanced { ... }` |
| `combat:requestSnapshot` | `combat:snapshot { encounter, combatants }` |

**Reconnect:** on socket reconnect, client auto-emits `combat:requestSnapshot`; server responds with full encounter + combatants array.

---

## 4. Data Dictionary & UI Elements

### 4.1 Encounter
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | PK, cuid | |
| `campaignId` | String | FK→Campaign, indexed | multi-tenancy |
| `name` | String | optional, max 80 chars | e.g. "Goblin Ambush" |
| `status` | String | `active` / `ended` | at most 1 `active` per campaign |
| `round` | Int | ≥ 1, default 1 | increments on full initiative cycle |
| `currentTurnIndex` | Int | ≥ 0, default 0 | index into sorted combatant list |
| `allowPlayerHpEdit` | Boolean | default false | DM flag; players can apply damage/heal to own character if true |
| `createdAt` | DateTime | default now | |
| `updatedAt` | DateTime | @updatedAt | |

### 4.2 Combatant
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | String | PK, cuid | |
| `encounterId` | String | FK→Encounter, cascade | |
| `campaignId` | String | indexed | denormalized for multi-tenancy queries |
| `type` | String | `character` / `monster` | determines which reference is used |
| `characterId` | String? | FK→Character, nullable | set if type=character |
| `monsterSlug` | String? | soft-ref→Monster.slug, nullable | set if type=monster |
| `name` | String | max 80 chars | display name (may differ from character/monster name for duplicate monsters) |
| `initiative` | Int? | 1–30 or null | null = not yet set; shown in "Waiting" section |
| `initiativeOrder` | Int | default 0 | tie-breaker; lower = higher in list within same initiative |
| `maxHp` | Int | ≥ 1 | copied from character/monster at add time |
| `currentHp` | Int | 0–maxHp | server-clamped |
| `conditionsJson` | String | JSON array of condition objects | `[{ name: "Poisoned" }, { name: "Exhaustion", level: 2 }]` |
| `removed` | Boolean | default false | soft-delete; excluded from active turn order |
| `createdAt` | DateTime | default now | |
| `updatedAt` | DateTime | @updatedAt | |

> **Uniqueness constraint:** `@@unique([encounterId, characterId])` — prevents adding the same Character twice. Monsters have no uniqueness constraint (multiple Goblin #1, Goblin #2 etc. are allowed via custom name).

### 4.3 UI Elements

**DM Combat View (full control):**
- Encounter header: campaign name · encounter name · **Round N** · `[End Combat]` button
- **Initiative list** (sorted desc): each row = combatant card
  - Left: initiative badge (JetBrains Mono, gold if active turn), ▲▼ reorder buttons
  - Center: name, type icon (sword = monster, person = character), HP bar + `currentHp/maxHp`, condition badges
  - Right: damage/heal input + Apply button, condition picker (+), remove (×)
  - Active combatant: gold `--turn-active` left border (4px) + `▶ [Name]'s turn` label + `--surface-raised` background
- **"Waiting" section**: combatants without initiative, below the sorted list
- **"Next Turn" CTA** (gold, bottom or header)
- **"Add Combatant" panel**: tabs [Characters | Monsters]; search; click to add + set initiative

**Player Combat View (read-only):**
- Same layout, no input controls (damage/heal inputs hidden, condition picker hidden, ▲▼ hidden, Set Active hidden)
- "Your turn" notification when it's the player's character's turn (prominent banner)
- If `allowPlayerHpEdit = true`: damage/heal inputs appear on **own character row only**

---

## 5. Edge Cases & Exception Handling

| # | Edge Case | Trigger | Expected Behaviour |
|---|-----------|---------|-------------------|
| **5.1** | Duplicate character in encounter | DM adds a character already in the encounter | Server returns 409 `duplicate_combatant`; client shows toast "Already in encounter" |
| **5.2** | HP drops below 0 | Damage > currentHp | Server clamps to 0; auto-applies Unconscious; broadcasts both `hpChanged` + `conditionsChanged` |
| **5.3** | HP exceeds maxHp | Healing > (maxHp − currentHp) | Server clamps to maxHp; no error, silently capped |
| **5.4** | Damage/heal with amount ≤ 0 | Actor sends 0 or negative value | 422 `invalid_hp_delta`; no state change |
| **5.5** | Remove combatant on their turn | DM removes active combatant | Server advances turn first, then marks `removed: true`; broadcasts both events |
| **5.6** | End encounter with combatants alive | DM clicks End Combat | Allowed (DM's call); status → `ended`; broadcast; no validation error |
| **5.7** | Player edits another's HP | Player emits `applyDamage` on another's combatant | 403 `forbidden`; no state change |
| **5.8** | No active encounter | Client queries encounter state | GET returns `{ encounter: null }`; not 404 |
| **5.9** | Exhaustion stacked beyond 6 | DM adds Exhaustion when already at level 6 | Clamp to 6; return 200 with `exhaustionLevel: 6`; no error |
| **5.10** | Condition added twice (non-Exhaustion) | DM adds Poisoned when already Poisoned | Idempotent; no duplicate entry; 200 OK |
| **5.11** | Initiative out of range | Initiative < 1 or > 30 | 422 `invalid_initiative` |
| **5.12** | DM disconnects mid-combat | DM's browser closes | Encounter state fully persisted in SQLite; on reconnect, DM receives full snapshot; combat resumes |
| **5.13** | Monster slug not in SRD | DM adds monster with unknown slug | 404 `monster_not_found` |
| **5.14** | Character not in campaign | DM adds character from another campaign | 404 `character_not_found` (server validates `character.campaignId === session.campaignId`) |
| **5.15** | Concurrent rapid HP updates | Two near-simultaneous intents | Socket.io event loop serializes; last-write-wins; server is the authority; no state corruption |
| **5.16** | No session token | Any intent / REST request without valid token | 401 `unauthorized` |
| **5.17** | Second encounter while one is active | DM calls `startEncounter` while `status: active` exists | 409 `encounter_already_active`; client shows "End current combat first" |
| **5.18** | `allowPlayerHpEdit` false but player sends HP intent | Player emits `applyDamage` on own character when flag is false | 403 `forbidden` (same as editing another's) |
| **5.19** | Next turn with all combatants removed | DM removes all combatants then clicks Next Turn | Server gracefully no-ops (no index to advance); returns 400 `no_active_combatants` |
| **5.20** | Combatant with null initiative skipped | Turn advances when some have no initiative | Only combatants with `initiative` set (not null) and `removed: false` participate in the turn cycle |

---

## 6. Compliance & Non-Functional Requirements

### 6.1 Performance
- HP broadcast latency: ≤ 200 ms on a typical home/office LAN (wired or 5 GHz Wi-Fi).
- Turn-advance round-trip: ≤ 100 ms (pure in-memory + Socket.io, no heavy DB join).
- Reconnect snapshot: ≤ 500 ms (single DB query for encounter + combatants).
- Page load for combat view: ≤ 1.5 s on LAN.

### 6.2 Reliability
- All encounter state persisted in SQLite on every mutation; in-memory is a cache only.
- Reconnect path tested explicitly in QA (DoD item).
- Regression gate: all 209 prior tests remain green after this module ships.

### 6.3 Accessibility
- Condition badges must not rely on color alone (`color-not-only` from DESIGN_SYSTEM): each badge shows a 2–3 char abbreviation AND the condition name on hover/tap.
- Active combatant: gold border + text label "▶ [Name]'s turn" (non-color signal).
- HP color tiers (green/amber/red): HP fraction fraction shown numerically as well.
- Focus rings on all interactive elements (2px gold `--accent`).

### 6.4 Security
- Server re-derives actor role from session token on every Socket.io intent and REST request (no trust in payload).
- `campaignId` taken from session, not payload, for all DB queries.
- DM-only actions (start/end encounter, add/remove combatant, set initiative, advance turn, add/remove condition) validated server-side.
- Player HP edits gated by both `allowPlayerHpEdit` flag AND own-character ownership — both must pass.

### 6.5 Definition of Done
| # | DoD Item | Verification |
|---|----------|-------------|
| **1** | Additive migration `combat` — `Encounter` + `Combatant` tables only; no destructive change | Diff verified before apply; existing tables untouched |
| **2** | Regression gate: ≥ 209 prior tests still pass after migration | `npm test` green |
| **3** | DM creates encounter, adds ≥2 combatants (1 character + 1 monster), sets initiative, starts combat | Live-verified on dev server |
| **4** | HP changes broadcast to all clients ≤ 200 ms on LAN | Live-verified |
| **5** | All 14 conditions add/remove correctly; Exhaustion stacks 1–6; auto-Unconscious at HP=0 | Unit tests + live-verify |
| **6** | Turn advances; round counter increments on full cycle; jump-to-turn works | Unit tests + live-verify |
| **7** | All 14 condition badges visible on participant rows | Visual verify |
| **8** | Authz: 403 when player edits another's HP or any condition | Unit tests (route-level) |
| **9** | 401 on all endpoints/intents with no session; 404 on wrong campaign | Unit tests |
| **10** | Reconnecting client receives full encounter snapshot | Live-verify (close + reopen browser tab mid-combat) |
| **11** | `DATA_MODEL.md` amended: `Encounter` + `Combatant` sections finalized | File updated |
