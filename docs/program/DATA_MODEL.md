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
| `Quest` | Story | a quest/plot thread (giver, location, reward, status) | [#quest](#quest) |
| `Location` | Story | a place (town, dungeon, region) entities reference | [#location](#location) |
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
> **Cross-module additive columns** (record here when added): `currency` (Inventory), `conditions` already reserved (Combat), `is_ai_draft` + `generated_by` (AI, Sprint 7).

### CharacterItem
Owner: Inventory (added in Sprint 3 via additive migration). Stub: `id`, `campaignId`, `characterId`, `itemId`, `quantity`, `equipped`, `attuned`.

### CharacterSpell
Owner: Characters. **Finalized (Sprint 2, migration `characters`).** Join Character ↔ Spell. Columns: `id`, `campaignId` (denormalized tenant scope), `characterId` (FK→Character cascade, indexed), **`spellSlug` (FK→`Spell.slug`** — slug, not id, stable across reseed), `known` (Boolean), `prepared` (Boolean). **@@unique([characterId, spellSlug])**.

### Encounter
Owner: Combat. Stub: `id`, `campaignId`, `name`, `locationId?`, `status` (`planned`|`active`|`done`), `round`, `activeCombatantId?`, `createdAt`.

### Combatant
Owner: Combat. Stub: `id`, `campaignId`, `encounterId`, `characterId?`, `monsterId?`, `initiative`, `currentHp`, `maxHp`, `conditions` (JSON), `hasActed`, `order`.

### Session
Owner: Story. Stub: `id`, `campaignId`, `number`, `date`, `title`, `recap`, `xpAwarded`, links to encounters/quests/loot (JSON or join tables, decided in Sprint 5).

### Quest
Owner: Story. Stub: `id`, `campaignId`, `title`, `description`, `giverCharacterId?`, `locationId?`, `rewardItemIds` (JSON), `status` (`open`|`active`|`done`).

### Location
Owner: Story (introduced as a shared reference early if Combat needs it — additive). Stub: `id`, `campaignId`, `name`, `type`, `description`, `parentLocationId?`.

### DiceRoll
Owner: Player UI + Dice. Stub: `id`, `campaignId`, `sessionId?`, `actorSessionId`, `formula` (e.g. `1d20+5`), `result`, `breakdown` (JSON), `context` (e.g. "attack vs Goblin"), `rolledAt`. Broadcast-and-log.

---

## AI provenance (additive, Sprint 7)
When the AI Assistant lands, add to **generatable** entities (`Character`/NPC, `Item`, `Monster`, `Quest`) via one additive migration:
- `is_ai_draft` (boolean, default false) — the row is a DM-approval-pending draft, not live state.
- `generated_by` (`null` | `"ollama:<model>"` | `"claude"` | `"import"`) — provenance.

AI output lands as a **draft** the DM approves before it becomes live game state. This is a textbook additive change to already-built tables — no rewrite.
