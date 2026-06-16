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
| `characterId` | String? | **nullable, RESERVED for Sprint 2** — becomes a real FK→Character via additive migration when Characters lands |
| `isConnected` | Boolean | default true — live presence for roster |
| `connectedAt` | DateTime | default now |
| `lastSeenAt` | DateTime | default now — updated on heartbeat/disconnect |

### Spell
Owner: 5e Reference. Stub: SRD 5.1 fields — `id`, `name`, `level`, `school`, `castingTime`, `range`, `components`, `duration`, `description`, `classes`. Seeded read-mostly reference.

### Item
Owner: 5e Reference. Stub: `id`, `name`, `type` (weapon/armor/gear/…), `rarity`, `properties` (JSON), `weight`, `cost`, `description`. Seeded reference (campaign-scoped copies allowed for homebrew/loot).

### Monster
Owner: 5e Reference. Stub: SRD 5.1 statblock — `id`, `name`, `cr`, `hp`, `ac`, `speed`, `abilityScores`, `actions` (JSON), `traits`, `conditionImmunities`. Seeded reference.

### Character
Owner: Characters. **Heaviest entity.** Stub: `id`, `campaignId`, `ownerSessionId?` (player owner; null/dm-owned = NPC), `isNpc`, `name`, `race`, `class`, `subclass`, `level`, ability scores (`str…cha`), `proficiencyBonus`, `maxHp`, `currentHp`, `tempHp`, `ac`, `speed`, saving-throw & skill proficiencies (JSON), `spellSlots` (JSON by level), `conditions` (JSON, set during Combat).
> **Cross-module additive columns** (record here when added): `currency` (Inventory), `conditions` (Combat), `is_ai_draft` + `generated_by` (AI, Sprint 7).

### CharacterItem
Owner: Inventory (added in Sprint 3 via additive migration). Stub: `id`, `campaignId`, `characterId`, `itemId`, `quantity`, `equipped`, `attuned`.

### CharacterSpell
Owner: Characters. Stub: `id`, `campaignId`, `characterId`, `spellId`, `known`, `prepared`.

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
