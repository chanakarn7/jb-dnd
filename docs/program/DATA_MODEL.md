# DATA_MODEL — the single source of truth for the schema

> Every module's `/sa` **reads the Entity Catalog first**, **reuses** existing entities (never a second `characters`/`items` table), then **amends** this file with its new tables / additive columns. A change to a shared table is a **program-level decision recorded here**, applied via an **additive migration** — never a destructive rewrite. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the migration discipline.

This is a **skeleton**: shared entities + relationships are locked; per-entity column detail is filled in **just-in-time** when each module's sprint starts. Read **only the entity sections this module touches** (its own tables + any shared table it FK-references).

---

## Entity Catalog (the index — read this, not the whole file)
| Entity | Owner module | Purpose | Anchor |
|--------|--------------|---------|--------|
| `Campaign` | Foundation | the room/tenant; holds invite code; everything scopes under it | [#campaign](#campaign) |
| `PlayerSession` | Foundation | a joined participant (DM or player): display name, role, claimed character | [#playersession](#playersession) |
| `Spell` | 5e Reference | SRD 5.1 spell (level, school, components, slot mechanics) | [#spell](#spell) |
| `Item` | 5e Reference | SRD 5.1 item/equipment (weapon/armor/gear, properties) | [#item](#item) |
| `Monster` | 5e Reference | SRD 5.1 monster/statblock (CR, HP, AC, actions) | [#monster](#monster) |
| `Class` | Characters | GLOBAL 5e class (hit die, saves, proficiencies, spellcasting); auto-fill source | [#class](#class) |
| `Subclass` | Characters | GLOBAL subclass under a `Class` (SRD + open community); grants features by level | [#subclass](#subclass) |
| `ClassLevel` | Characters | GLOBAL per-class 1–20 progression row (prof bonus, features, spell slots) | [#classlevel](#classlevel) |
| `Feature` | Characters | GLOBAL class/subclass feature text, keyed to class/subclass + level | [#feature](#feature) |
| `Race` | Characters | GLOBAL 5e race/subrace (ability bonuses, speed, traits, proficiencies) | [#race](#race) |
| `Background` | Characters | GLOBAL 5e background (skill/tool proficiencies, starting equipment) | [#background](#background) |
| `Character` | Characters | a player-owned 5e PC (or DM-owned NPC); the heaviest entity | [#character](#character) |
| `CharacterItem` | Inventory | join: Character ↔ Item (quantity, equipped, attuned) | [#characteritem](#characteritem) |
| `CharacterSpell` | Characters | join: Character ↔ Spell (known / prepared) | [#characterspell](#characterspell) |
| `Encounter` | Combat | a combat instance: participants + initiative + turn state | [#encounter](#encounter) |
| `Combatant` | Combat | a row in an encounter: a Character or Monster with live HP/conditions/initiative | [#combatant](#combatant) |
| `Session` | Story | a play session log (date, recap, what happened) | [#session](#session) |
| `Quest` | Story | a quest/plot thread (giver, objectives checklist, status) | [#quest](#quest) |
| `Npc` | Story | narrative NPC record (name, role, faction, notes, alive/dead) | [#npc](#npc) |
| `JournalEntry` | Story | free-form markdown journal entry, optionally linked to a Session | [#journalentry](#journalentry) |
| `Location` | Story | a place (town, dungeon, region) — stub, not built Sprint 5 | [#location](#location) |
| `DiceRoll` | Player UI + Dice | a broadcast roll (formula, result, who, context) | [#diceroll](#diceroll) |

> **Ownership rule:** the *owner module* is responsible for that table's shape. Other modules **reference** it (FK) and may **add** columns via additive migration with a note here — they do not redesign it.

---

## Relationships (what makes this ONE data model)
- `Campaign` 1—N everything (every row carries `campaignId`; multi-tenancy spine).
- `PlayerSession` 0..1—1 `Character` (a player claims exactly one character; DM sessions claim none).
- `Character` N—M `Item` via **`CharacterItem`** (quantity / equipped / attuned).
- `Character` N—M `Spell` via **`CharacterSpell`** (known / prepared).
- `Encounter` 1—N `Combatant`; each `Combatant` references **either** a `Character` **or** a `Monster`.
- `Encounter` N..1 `Location`.
- `Quest` references an NPC giver (`Character`), a `Location`, and reward `Item`(s).
- `Session` references `Encounter`(s), `Quest`(s), NPCs met (`Character`), loot awarded (`Item`).

```
Campaign ──┬── PlayerSession ──(claims)── Character ──┬── CharacterItem ── Item
           │                                          └── CharacterSpell ── Spell
           ├── Encounter ── Combatant ──> Character | Monster
           ├── Quest ──> Character(NPC) , Location , Item(reward)
           ├── Session ──> Encounter , Quest , Character , Item
           └── Location
```

---

## Entity sections (filled in just-in-time per sprint)

> Each section starts as a stub; the owning module's `/sa` fleshes out columns when its sprint begins, and later modules append additive columns with a dated note.

### Campaign
Owner: Foundation. **Finalized (Sprint 0 baseline migration `foundation_baseline`).** Tenant root.
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | String | PK, cuid |
| `name` | String | 1–60 chars (app-validated) |
| `inviteCode` | String | **@unique**, indexed |
| `dmSessionToken` | String | secret — DM reconnect identity, never broadcast |
| `status` | String | `active`/`closed`, default `active` (SQLite has no enum) |
| `createdAt` | DateTime | default now |
| `updatedAt` | DateTime | @updatedAt |
1—N `PlayerSession` (cascade delete). See [SA_BLUEPRINT](../modules/foundation/SA_BLUEPRINT.md).

### PlayerSession
Owner: Foundation. **Finalized (Sprint 0 baseline migration `foundation_baseline`).**
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | String | PK, cuid |
| `campaignId` | String | FK→Campaign, cascade, indexed |
| `displayName` | String | 1–24 chars; **@@unique([campaignId, displayName])** (unique per campaign, not global) |
| `role` | String | `dm`/`player` |
| `sessionToken` | String | secret — reconnect identity, never broadcast |
| `characterId` | String? | **Finalized (Sprint 2, touched):** now **@unique FK→Character** (1:1 claim), `onDelete: SetNull`. Was a bare reserved String? in Foundation — additive migration `characters` adds the unique index + FK (column already existed & nullable, so no data impact). |
| `isConnected` | Boolean | default true — live presence for roster |
| `connectedAt` | DateTime | default now |
| `lastSeenAt` | DateTime | default now — updated on heartbeat/disconnect |

### Spell
Owner: 5e Reference. **Finalized (Sprint 1, migration `5e_reference`).** GLOBAL SRD reference — **no `campaignId`** (shared across all campaigns). Seeded read-mostly; idempotent upsert by `slug`. See [SA_BLUEPRINT](../modules/5e-reference/SA_BLUEPRINT.md).
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | String | PK, cuid |
| `slug` | String | **@unique**, indexed — natural key + deep-link param |
| `name` | String | indexed |
| `level` | Int | 0 = cantrip … 9; **indexed** (filter) |
| `school` | String | **indexed** (filter) |
| `castingTime` | String | |
| `range` | String | |
| `duration` | String | |
| `components` | String | JSON `{ v, s, m }` |
| `ritual` | Boolean | default false (filter toggle) |
| `concentration` | Boolean | default false (filter toggle) |
| `description` | String | full rules text |
| `higherLevels` | String? | "At Higher Levels" text |
| `classesJson` | String | JSON `string[]` (filter by class, client-side) |
| `source` | String | default "SRD 5.1" |

### Item
Owner: 5e Reference. **Finalized (Sprint 1, migration `5e_reference`).** GLOBAL SRD reference — **no `campaignId`**. (Homebrew/loot campaign-scoped copies are OUT of v1 — a future module may add a separate campaign-scoped table; this one stays global.)
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | String | PK, cuid |
| `slug` | String | **@unique**, indexed |
| `name` | String | indexed |
| `type` | String | weapon/armor/adventuring-gear/tool/…; **indexed** (filter) |
| `rarity` | String | default "mundane"; **indexed** (filter) |
| `requiresAttunement` | Boolean | default false (filter toggle) |
| `propertiesJson` | String | JSON `{ damage, versatile, weight, cost, armorClass, … }` |
| `description` | String? | |
| `source` | String | default "SRD 5.1" |

### Monster
Owner: 5e Reference. **Finalized (Sprint 1, migration `5e_reference`).** GLOBAL SRD reference — **no `campaignId`**. Combat (Sprint 4) `Combatant` will reference this via additive migration; do not redesign here.
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | String | PK, cuid |
| `slug` | String | **@unique**, indexed |
| `name` | String | indexed |
| `size` | String | Tiny…Gargantuan; **indexed** (filter) |
| `type` | String | 14 creature types; **indexed** (filter) |
| `alignment` | String | |
| `cr` | String | display ("1/4", "0", "5") |
| `crSort` | Float | numeric CR for range filter/sort; **indexed** |
| `xp` | Int | derived from CR at seed (deterministic) |
| `ac` | Int | |
| `acNote` | String? | "(natural armor)" |
| `hp` | Int | |
| `hpFormula` | String? | "2d6" |
| `speed` | String | |
| `abilityScores` | String | JSON `{ str,dex,con,int,wis,cha }` |
| `savesJson` | String | JSON `{ dex:"+2", … }` |
| `skillsJson` | String | JSON `{ stealth:"+6", … }` |
| `senses` | String? | |
| `languages` | String? | |
| `immunitiesJson` | String | JSON `{ damage:[], condition:[] }` |
| `resistancesJson` | String | JSON `string[]` |
| `traitsJson` | String | JSON `[{ name, desc }]` |
| `actionsJson` | String | JSON `[{ name, desc, kind }]` (action/legendary/reaction) |
| `source` | String | default "SRD 5.1" |

### Class
Owner: Characters. **Finalized (Sprint 2, migration `characters`).** **GLOBAL reference — no `campaignId`**, `slug` @unique, seeded (SRD 5.1 + open community), idempotent upsert. Same pattern as `Spell`/`Item`/`Monster`.
| Column | Type | Notes |
|--------|------|-------|
| `id`/`slug` | String | PK cuid / **@unique** ("fighter") |
| `name` | String | indexed |
| `hitDie` | Int | 6/8/10/12 |
| `primaryAbility` | String | hint |
| `savesJson` | String | JSON `string[]` — proficient saving throws |
| `armorProfJson`/`weaponProfJson`/`toolProfJson` | String | JSON `string[]` |
| `skillChoicesJson` | String | JSON `{ from:[], count }` |
| `spellcastingJson` | String? | JSON `{ ability, type }` · **null = non-caster** |
| `subclassLevel` | Int | level subclass is chosen (Cleric 1, Fighter 3…) |
| `source`/`license` | String | per-row provenance |

### Subclass
Owner: Characters. **Finalized (Sprint 2, `characters`).** **GLOBAL — no `campaignId`**, `slug` @unique, `classSlug` (soft ref, indexed). Columns: `name`, `flavor?` (1-line), `description?` (full player-facing explanation, shown in the create wizard), `featuresByLevelJson` (JSON `{ "3":[slug] }`), `source`, `license`. **Coverage:** SRD = 12 (1/class); open-licensed community packs (OGL/CC) add more — `license` per row. Copyrighted PHB-only subclasses excluded.

> **Ability/Skill glossary (not a table):** the 6 ability scores and 18 skills are a fixed SRD set (not user-editable) — their explanatory text lives in static `lib/characters/glossary.ts` (CC-BY-4.0), not the DB. Shown as helper text/tooltips in the character wizard & sheet. No migration.

### ClassLevel
Owner: Characters. **Finalized (Sprint 2, `characters`).** **GLOBAL — no `campaignId`**. One row per (`classSlug`, `level` 1–20), **@@unique([classSlug, level])**. Columns: `proficiencyBonus` (computed `2+floor((lvl-1)/4)`), `featuresJson` (feature slugs gained), `spellSlotsJson` (by spell level, casters), `classCountersJson` (rages/ki/sorcery points…). Drives level-based auto-fill.

### Feature
Owner: Characters. **Finalized (Sprint 2, `characters`).** **GLOBAL — no `campaignId`**, `slug` @unique. Columns: `name`, `classSlug?`, `subclassSlug?`, `level`, `description`, `source`, `license`. Rendered on the sheet as features-by-level.

### Race
Owner: Characters. **Finalized (Sprint 2, `characters`).** **GLOBAL — no `campaignId`**, `slug` @unique. Columns: `name`, `parentRaceSlug?` (subrace, indexed), `abilityBonusesJson`, `size`, `speed` (Int ft.), `traitsJson`, `proficienciesJson`, `languagesJson`, `source`, `license`. Auto-fill source for speed/ability bonuses/traits.

### Background
Owner: Characters. **Finalized (Sprint 2, `characters`).** **GLOBAL — no `campaignId`**, `slug` @unique. Columns: `name`, `skillProficienciesJson`, `toolProficienciesJson`, `languagesJson`, `featureJson` (`{name,desc}`), `startingEquipment?`, `source`, `license`. Auto-fill source for background skill proficiencies.

### Character
Owner: Characters. **Heaviest entity. Finalized (Sprint 2, migration `characters` — campaign-scoped).** Editable truth; derived scalars stay auto-synced unless listed in `overridesJson`.
| Column | Type | Notes |
|--------|------|-------|
| `id` | String | PK cuid |
| `campaignId` | String | FK→Campaign cascade, **indexed** (tenant) |
| `ownerSessionId` | String? | **denormalized authz field, indexed** (not a relation); mirrors the claim; null = NPC/DM-owned |
| `isNpc` | Boolean | default false |
| `name` | String | |
| `raceSlug`/`subraceSlug?`/`classSlug`/`subclassSlug?`/`backgroundSlug?` | String(?) | **soft refs** to GLOBAL reference (validated app-side, not DB FK) |
| `level` | Int | 1–20, single-class v1 |
| `str…cha` | Int | **effective** scores (assigned + race bonus), editable |
| `abilityMethod` | String | `standard-array` \| `point-buy` |
| `baseAbilitiesJson` | String | assigned pre-race scores (for recompute) |
| `proficiencyBonus`/`maxHp`/`currentHp`/`tempHp`/`ac`/`speed`/`initiative` | Int | derived-but-overridable |
| `savesJson`/`skillsJson` | String | JSON proficiency flags |
| `spellSlotsJson` | String | JSON by level (caster only) |
| `conditionsJson` | String | **RESERVED — set by Combat (S4)** |
| `overridesJson` | String | JSON `string[]` — fields the user manually overrode (recompute skips them) |
| `notes` | String? | |
| `createdAt`/`updatedAt` | DateTime | |
> **Auto-fill:** `lib/characters/rules.ts` derives defaults from the GLOBAL reference (HP from hit die, prof bonus + spell slots from `ClassLevel`, saves from `Class`, speed/bonuses from `Race`, skills from `Background`/`Class`) — deterministic code, not LLM. Default ≠ lock: every scalar is editable; `overridesJson` stops recompute from clobbering manual edits.
> **Claim:** 1:1 with `PlayerSession` via `PlayerSession.characterId @unique` (the single relation); `ownerSessionId` kept consistent in the same tx. See [SA_BLUEPRINT](../modules/characters/SA_BLUEPRINT.md) §2.3.
> **Cross-module additive columns** (record here when added): **`currencyJson`** (Inventory, **Sprint 3, migration `inventory`** — `String @default("{}")`, JSON `{pp,gp,ep,sp,cp}`, all ≥0; single JSON col chosen over 5 Int cols to match the project's JSON-column convention; read via `parseJson(currencyJson,{pp:0,gp:0,ep:0,sp:0,cp:0})`); `conditionsJson` already reserved (Combat); `is_ai_draft` + `generated_by` (AI, Sprint 7).

### CharacterItem
Owner: Inventory. **Finalized (Sprint 3, migration `inventory`).** Join Character ↔ Item — campaign-scoped, mirrors `CharacterSpell`. Columns: `id`, `campaignId` (denormalized tenant scope), `characterId` (FK→Character **cascade**, indexed), **`itemSlug` (real relation → `Item.slug`** — slug not id, stable across reseed; `Item` is GLOBAL so RESTRICT on delete — seed upserts, never deletes), `quantity` (Int @default 1, app-validated ≥1), `equipped` (Boolean), `attuned` (Boolean). **@@unique([characterId, itemSlug])** → same item stacks via `quantity` (simpler UX, matches 5e same-item stacking). **@@index([characterId])**. Back-relations added (additive, no column change): `Character.items`, `Item.characterItems`. **5e rules (deterministic, `lib/inventory/rules.ts`):** attunement cap = 3 per character; only `requiresAttunement` items attunable; cap enforced in a `$transaction` reading the live DB count (concurrency-safe). See [SA_BLUEPRINT](../modules/inventory/SA_BLUEPRINT.md).

### CharacterSpell
Owner: Characters. **Finalized (Sprint 2, migration `characters`).** Join Character ↔ Spell. Columns: `id`, `campaignId` (denormalized tenant scope), `characterId` (FK→Character cascade, indexed), **`spellSlug` (FK→`Spell.slug`** — slug, not id, stable across reseed), `known` (Boolean), `prepared` (Boolean). **@@unique([characterId, spellSlug])**.

### Encounter
Owner: Combat. **Finalized (Sprint 4, migration `combat`).** One active encounter per campaign at a time (app-enforced); ended encounters kept for history (Sprint 5 Story).
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String | PK, cuid | |
| `campaignId` | String | FK→Campaign cascade, **@@index** | multi-tenancy spine |
| `name` | String? | max 80, nullable | optional label e.g. "Goblin Ambush" |
| `status` | String | default `"active"` | `"active"` \| `"ended"` |
| `round` | Int | default 1, ≥ 1 | increments on full initiative cycle |
| `currentTurnIndex` | Int | default 0, ≥ 0 | index into sorted non-removed combatants |
| `allowPlayerHpEdit` | Boolean | default false | DM flag — when true, players may apply damage/healing to their own combatant |
| `createdAt` | DateTime | default now | |
| `updatedAt` | DateTime | @updatedAt | |
1—N `Combatant` (cascade delete on Encounter delete). See [SA_BLUEPRINT](../modules/combat/SA_BLUEPRINT.md).

### Combatant
Owner: Combat. **Finalized (Sprint 4, migration `combat`).** One row per participant in an encounter — either a `Character` (FK) or a `Monster` (soft-ref by slug). Soft-deleted (`removed=true`) rather than DB-deleted to preserve history.
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String | PK, cuid | |
| `encounterId` | String | FK→Encounter cascade, **@@index** | |
| `campaignId` | String | **@@index** | denormalized for tenant-scoped queries |
| `type` | String | `"character"` \| `"monster"` | determines which reference is used |
| `characterId` | String? | FK→Character nullable, `onDelete: SetNull`, **@@unique([encounterId,characterId])** | set iff `type="character"`; unique prevents duplicate character in same encounter |
| `monsterSlug` | String? | soft-ref→Monster.slug, nullable, no FK | set iff `type="monster"`; soft-ref allows multiple of same monster slug with different names |
| `name` | String | max 80 | display name (may differ from source; e.g. "Goblin #2") |
| `initiative` | Int? | nullable, app-validated 1–30 | null = not yet set; shown in "Waiting" section below sorted list |
| `initiativeOrder` | Int | default 0 | tie-breaker within same initiative value; lower = higher in list |
| `maxHp` | Int | ≥ 1 | snapshotted from Character/Monster at add time |
| `currentHp` | Int | 0–maxHp server-clamped | |
| `conditionsJson` | String | default `"[]"` | JSON `ConditionEntry[]`: `[{name},{name:"Exhaustion",level:2}]`; parsed by `lib/combat/rules.ts` |
| `removed` | Boolean | default false | soft-delete; excluded from active turn order |
| `createdAt` | DateTime | default now | |
| `updatedAt` | DateTime | @updatedAt | |
See [SA_BLUEPRINT](../modules/combat/SA_BLUEPRINT.md).

### Session
Owner: Story. **Finalized (Sprint 5, migration `story`).** A play-session log — narrative record, not a Combat Encounter.
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String | PK cuid | |
| `campaignId` | String | FK→Campaign CASCADE, **@@index** | |
| `title` | String? | nullable, ≤120 | display "Session N" if null |
| `date` | DateTime | required | future dates allowed (pre-logging) |
| `summary` | String? | nullable | raw markdown |
| `xpAwarded` | Int | default 0, ≥0 | 0 = milestone XP campaign |
| `notableLoot` | String? | nullable | free text |
| `createdAt` | DateTime | default now | |
| `updatedAt` | DateTime | @updatedAt | |
1—N `JournalEntry` (SET NULL on Session delete — entries are not deleted with session).

### Quest
Owner: Story. **Finalized (Sprint 5, migration `story`).** A plot thread / mission tracked by DM; players read-only.
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String | PK cuid | |
| `campaignId` | String | FK→Campaign CASCADE, **@@index** | |
| `name` | String | required, ≤120 | |
| `description` | String? | nullable | markdown |
| `giverName` | String? | nullable, ≤100 | free text — NOT a FK to Npc (avoids cascade complexity) |
| `status` | String | default `"active"` | `active`\|`completed`\|`failed`\|`abandoned` |
| `objectivesJson` | String | default `"[]"` | JSON `[{text:string, checked:boolean}]` — same pattern as `conditionsJson` in Combat |
| `reward` | String? | nullable | free text |
| `createdAt` | DateTime | default now | |
| `updatedAt` | DateTime | @updatedAt | |

### Npc
Owner: Story. **Finalized (Sprint 5, migration `story`).** Narrative NPC record (narrative data, NOT a full PC stat block — that's `Character`).
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String | PK cuid | |
| `campaignId` | String | FK→Campaign CASCADE, **@@index** | |
| `characterId` | String? | nullable FK→Character **SET NULL** on Character delete | optional link to a Character stat block |
| `name` | String | required, ≤100 | |
| `role` | String? | nullable, ≤80 | occupation/title |
| `faction` | String? | nullable, ≤80 | |
| `notes` | String? | nullable | markdown |
| `isAlive` | Boolean | default true | death toggle (DM only) |
| `createdAt` | DateTime | default now | |
| `updatedAt` | DateTime | @updatedAt | |
Back-relation: `Character.npcs Npc[]` (additive — no SQL column change; FK lives on `Npc`).

### JournalEntry
Owner: Story. **Finalized (Sprint 5, migration `story`).** Free-form markdown campaign journal entry; optionally linked to a Session.
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String | PK cuid | |
| `campaignId` | String | FK→Campaign CASCADE, **@@index** | |
| `sessionId` | String? | nullable FK→Session **SET NULL** on Session delete | optional link |
| `title` | String? | nullable, ≤200 | |
| `content` | String | required, min 1 char | markdown |
| `createdAt` | DateTime | default now | |
| `updatedAt` | DateTime | @updatedAt | |

### Location
Owner: Story (stub — not built in Sprint 5). Stub: `id`, `campaignId`, `name`, `type`, `description`, `parentLocationId?`.

### DiceRoll
Owner: Player UI + Dice. Stub: `id`, `campaignId`, `sessionId?`, `actorSessionId`, `formula` (e.g. `1d20+5`), `result`, `breakdown` (JSON), `context` (e.g. "attack vs Goblin"), `rolledAt`. Broadcast-and-log.

---

## AI provenance (additive, Sprint 7)
When the AI Assistant lands, add to **generatable** entities (`Character`/NPC, `Item`, `Monster`, `Quest`) via one additive migration:
- `is_ai_draft` (boolean, default false) — the row is a DM-approval-pending draft, not live state.
- `generated_by` (`null` | `"ollama:<model>"` | `"claude"` | `"import"`) — provenance.

AI output lands as a **draft** the DM approves before it becomes live game state. This is a textbook additive change to already-built tables — no rewrite.
