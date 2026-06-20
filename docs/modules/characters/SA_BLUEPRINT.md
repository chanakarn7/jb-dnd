# SA Blueprint — Characters (Sprint 2)

> แปลง [PRD](./PRD.md) เป็นพิมพ์เขียวพร้อมโค้ด สำหรับ `/dev`
> **Constraints (ล็อกแล้ว ห้ามแก้):** [ARCHITECTURE](../../program/ARCHITECTURE.md) (Next.js 16 App Router + TS · SQLite + Prisma 6 · prep-edit = REST / live = socket · server-authoritative, authz re-derive จาก session · additive migration) · [DATA_MODEL](../../program/DATA_MODEL.md) (โมดูลนี้ owns `Character`/`CharacterSpell` + 6 GLOBAL reference) · มิเรอร์แพทเทิร์น [5e-reference SA](../5e-reference/SA_BLUEPRINT.md)

## หลักการออกแบบ (สรุปการตัดสินใจ)
1. **2 ชั้นข้อมูล:** (ก) **GLOBAL reference** 6 ตาราง (Class/Subclass/ClassLevel/Feature/Race/Background) — ไม่มี `campaignId`, slug natural key, seeded idempotent, อ่านอย่างเดียว (เหมือน Spell/Item/Monster); (ข) **campaign-scoped** 2 ตาราง (Character/CharacterSpell) — มี `campaignId` ทุกแถว, mutable, authz ฝั่ง server.
2. **Hybrid columns (เหมือน Sprint 1):** ฟิลด์ที่กรอง/เรียง/join = คอลัมน์จริง + index (`classSlug`, `level`, `campaignId`, `ownerSessionId`). ฟิลด์ซ้อน/หลายค่า = **JSON string column** (SQLite ไม่มี native JSON/array).
3. **Auto-fill = deterministic code** ใน `lib/characters/rules.ts` (ตาม "hybrid rules engine" ของ ARCHITECTURE) — ไม่เก็บค่า derived ที่คำนวณซ้ำได้ถูก ๆ (features list) แต่ **เก็บค่าที่ override ได้** (maxHp, ac, prof bonus, saves, skills, spellSlots) เป็นคอลัมน์จริง เพราะมันเป็น "ความจริงของตัวละคร" ที่แก้ทับได้.
4. **Override model:** `overridesJson` = `string[]` ของชื่อ field ที่ผู้ใช้แก้เอง → ตอน recompute (เปลี่ยน level/score) ระบบ **ข้าม** field ที่อยู่ใน set นี้ (ไม่ทับค่าที่แก้มือ).
5. **Reference Spell by slug:** `CharacterSpell.spellSlug` → FK `Spell.slug` (slug เสถียรข้าม reseed; id เป็น cuid ที่เปลี่ยนเมื่อ seed ใหม่).
6. **Additive migration `characters`** บน `5e_reference`: 6 GLOBAL reference + Character/CharacterSpell + FK บน `PlayerSession.characterId` ก้อนเดียว (as-built — back-relations บน Campaign/Spell/PlayerSession ผูกกลุ่ม reference เข้ากับ campaign จึง ship รวม). ห้ามแตะ migration เดิม.

---

## 1. ER Diagram

```mermaid
erDiagram
    Campaign  ||--o{ PlayerSession : "has (Foundation)"
    Campaign  ||--o{ Character     : "scopes (S2)"
    PlayerSession |o--o| Character : "claims 1:1 (characterId @unique)"
    Character ||--o{ CharacterSpell : "knows/prepares"
    Spell     ||--o{ CharacterSpell : "referenced by slug"
    Class     ||--o{ Subclass   : "has"
    Class     ||--o{ ClassLevel : "progression 1-20"

    Class      { string slug UK  int hitDie  string savesJson  string spellcastingJson }
    Subclass   { string slug UK  string classSlug  string featuresByLevelJson  string license }
    ClassLevel { string classSlug  int level  int proficiencyBonus  string spellSlotsJson }
    Feature    { string slug UK  string classSlug  string subclassSlug  int level }
    Race       { string slug UK  string parentRaceSlug  string abilityBonusesJson  int speed }
    Background { string slug UK  string skillProficienciesJson  string featureJson }
    Character  { string id PK  string campaignId  string ownerSessionId  bool isNpc  int level  string overridesJson }
    CharacterSpell { string id PK  string characterId  string spellSlug  bool known  bool prepared }
```

> **GLOBAL reference (Class/Subclass/ClassLevel/Feature/Race/Background)** ไม่มี FK กับ Campaign — เป็น master data ที่ `Character` "ชี้มา" ด้วย slug (`classSlug`/`subclassSlug`/`raceSlug`/`backgroundSlug`) แบบ soft reference (ไม่ใช่ DB FK ข้ามชั้น เพราะ reference เป็น global/replaceable; ตรวจความถูกต้องที่ app layer ตอนสร้าง). **Character/CharacterSpell** มี `campaignId` + FK cascade กับ Campaign.

---

## 2. Database Schema Definition

### 2.1 Prisma models — GLOBAL reference (migration `characters`)
```prisma
// ── Characters reference (Sprint 2) ─────────────────────────────────
// GLOBAL 5e build data (SRD 5.1 CC-BY-4.0 + open OGL/CC community packs).
// NO campaignId — shared across all campaigns. Seeded idempotently by slug.
// Per-row source + license (community packs differ from SRD). JSON strings
// for nested/multi-value fields (SQLite has no native array/JSON).

model Class {
  id               String  @id @default(cuid())
  slug             String  @unique          // "fighter", "wizard"
  name             String
  hitDie           Int                       // 6 | 8 | 10 | 12
  primaryAbility   String                    // "str" | "dex" | ... (display/hint)
  savesJson        String                    // JSON string[]: ["str","con"]  (proficient saving throws)
  armorProfJson    String  @default("[]")    // JSON string[]
  weaponProfJson   String  @default("[]")    // JSON string[]
  toolProfJson     String  @default("[]")    // JSON string[]
  skillChoicesJson String  @default("{}")    // JSON: { from: string[], count: number }
  spellcastingJson String?                   // JSON: { ability:"int", type:"prepared"|"known", prepares:bool } | null = non-caster
  subclassLevel    Int     @default(1)       // level at which a subclass is chosen (Cleric 1, Fighter 3, …)
  source           String  @default("SRD 5.1")
  license          String  @default("CC-BY-4.0")

  @@index([name])
}

model Subclass {
  id                 String  @id @default(cuid())
  slug               String  @unique
  classSlug          String                  // soft ref -> Class.slug
  name               String
  flavor             String?                 // 1-line tagline
  description        String?                 // full player-facing explanation (what this subclass plays like)
  featuresByLevelJson String @default("{}")  // JSON: { "3": ["feature-slug"], "7": [...] }
  source             String  @default("SRD 5.1")
  license            String  @default("CC-BY-4.0") // community packs: "OGL-1.0a" | "CC-BY-4.0" | ...

  @@index([classSlug])
  @@index([name])
}

model ClassLevel {
  id               String @id @default(cuid())
  classSlug        String                    // soft ref -> Class.slug
  level            Int                        // 1..20
  proficiencyBonus Int                        // +2..+6 (same per level across classes)
  featuresJson     String @default("[]")     // JSON string[] of Feature slugs gained at this level
  spellSlotsJson   String @default("{}")     // JSON: { "1": 2, "2": 0, ... } (caster only; {} for non-caster)
  classCountersJson String @default("{}")    // JSON: { rages: 2, kiPoints: 0, sorceryPoints: 0, ... }
  source           String @default("SRD 5.1")

  @@unique([classSlug, level])
  @@index([classSlug])
}

model Feature {
  id           String @id @default(cuid())
  slug         String @unique
  name         String
  classSlug    String?                        // soft ref -> Class.slug (null if pure subclass/racial)
  subclassSlug String?                        // soft ref -> Subclass.slug
  level        Int    @default(1)
  description  String
  source       String @default("SRD 5.1")
  license      String @default("CC-BY-4.0")

  @@index([classSlug])
  @@index([subclassSlug])
}

model Race {
  id                String @id @default(cuid())
  slug              String @unique
  name              String
  parentRaceSlug    String?                   // soft ref -> Race.slug for subraces (e.g. "elf" for "high-elf")
  abilityBonusesJson String @default("{}")    // JSON: { str:0, dex:2, ... }
  size              String @default("Medium")
  speed             Int     @default(30)       // walking speed in ft.
  traitsJson        String @default("[]")     // JSON: [{ name, desc }]
  proficienciesJson String @default("{}")     // JSON: { skills:[], weapons:[], ... }
  languagesJson     String @default("[]")     // JSON string[]
  source            String @default("SRD 5.1")
  license           String @default("CC-BY-4.0")

  @@index([parentRaceSlug])
  @@index([name])
}

model Background {
  id                    String @id @default(cuid())
  slug                  String @unique
  name                  String
  skillProficienciesJson String @default("[]") // JSON string[]
  toolProficienciesJson  String @default("[]") // JSON string[]
  languagesJson          String @default("[]") // JSON string[] (or count)
  featureJson            String @default("{}") // JSON: { name, desc }
  startingEquipment      String?
  source                 String @default("SRD 5.1")
  license                String @default("CC-BY-4.0")

  @@index([name])
}
```

### 2.2 Prisma models — campaign-scoped (migration `characters`)
```prisma
// ── Characters (Sprint 2) — campaign-scoped, mutable, authz server-side ──
model Character {
  id             String   @id @default(cuid())
  campaignId     String
  campaign       Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  ownerSessionId String?  // denormalized authz field; mirrors the claim. null = NPC/DM-owned.
  isNpc          Boolean  @default(false)
  name           String

  // Build choices (soft refs to GLOBAL reference by slug)
  raceSlug       String
  subraceSlug    String?
  classSlug      String
  subclassSlug   String?
  backgroundSlug String?
  level          Int      @default(1)   // 1..20

  // Ability scores — EFFECTIVE values (assigned + race bonus), editable truth
  str Int
  dex Int
  con Int
  int Int
  wis Int
  cha Int
  abilityMethod    String @default("standard-array") // "standard-array" | "point-buy"
  baseAbilitiesJson String @default("{}") // JSON: assigned scores pre-race (for recompute on race change)

  // Derived-but-overridable scalars (auto-filled; stay in sync unless overridden)
  proficiencyBonus Int    @default(2)
  maxHp            Int    @default(1)
  currentHp        Int    @default(1)
  tempHp           Int    @default(0)
  ac               Int    @default(10)
  speed            Int    @default(30)
  initiative       Int    @default(0)
  savesJson        String @default("{}")  // JSON: { str:true, con:true } proficiency flags
  skillsJson       String @default("{}")  // JSON: { athletics:true, ... } proficiency flags
  spellSlotsJson   String @default("{}")  // JSON: { "1": 2, ... } (caster only)

  // State / meta
  conditionsJson   String @default("[]")  // RESERVED — set by Combat (S4); not mutated here
  overridesJson    String @default("[]")  // JSON string[]: field names the user manually overrode
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  claimedBy        PlayerSession?          // reverse of PlayerSession.characterId (the 1:1 claim)
  spells           CharacterSpell[]

  @@index([campaignId])
  @@index([ownerSessionId])
}

model CharacterSpell {
  id          String   @id @default(cuid())
  campaignId  String                        // denormalized for tenant-scoped queries
  characterId String
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  spellSlug   String                        // FK -> Spell.slug (stable across reseed)
  spell       Spell     @relation(fields: [spellSlug], references: [slug])
  known       Boolean   @default(true)
  prepared    Boolean   @default(false)

  @@unique([characterId, spellSlug])
  @@index([characterId])
}
```

### 2.3 แก้ตารางเดิม (additive — backward compatible)
```prisma
model PlayerSession {
  // ... fields เดิมทั้งหมดคงไว้ ...
  characterId String?    @unique            // CHANGED: เพิ่ม @unique + เป็น FK จริง (เดิมเป็น String? เปล่า)
  character   Character? @relation(fields: [characterId], references: [id], onDelete: SetNull)
}

model Campaign {
  // ... fields เดิม ...
  characters Character[]                     // ADDED back-relation (ไม่มีคอลัมน์ใหม่ใน DB)
}

model Spell {
  // ... fields เดิม ...
  characterSpells CharacterSpell[]           // ADDED back-relation (ไม่มีคอลัมน์ใหม่ใน DB)
}
```
> **หมายเหตุ relation เดียว (สำคัญ):** ความสัมพันธ์ session↔character เป็น **1:1 เดียว** บน `PlayerSession.characterId @unique` (claim). `Character.ownerSessionId` เป็น **denormalized authz string ไม่ใช่ relation** (กันการมี relation ซ้อน 2 เส้นระหว่าง 2 ตาราง) — server เซ็ต `ownerSessionId` กับ claim **พร้อมกันใน transaction เดียว** ให้ตรงกันเสมอ. ได้ authz O(1) (`character.ownerSessionId === session.id`) โดยไม่ต้อง join + ได้ roster integrity จาก FK.

### 2.4 Migration (as-built: ก้อนเดียว `characters`)
> แผนเดิมระบุ 2 migration (reference / campaign แยกกัน) แต่ **as-built ship เป็นก้อนเดียว `20260619163354_characters`** เพราะ back-relations (`Campaign.characters`, `Spell.characterSpells`, `PlayerSession.character`) ผูกกลุ่ม reference เข้ากับกลุ่ม campaign ใน schema diff เดียว — ยังเป็น additive 100%.

| ในก้อน `characters` | เนื้อหา | แตะของเดิม? |
|---|---|---|
| 6 GLOBAL reference | `CREATE TABLE` Class/Subclass/ClassLevel/Feature/Race/Background + index/unique | ❌ ตารางใหม่ล้วน |
| 2 campaign-scoped | `CREATE TABLE` Character/CharacterSpell + index | ❌ ตารางใหม่ล้วน |
| FK บน PlayerSession | table-redefine: copy ทุก row → drop → rename (เพิ่ม `@unique` + FK→Character SET NULL) | เฉพาะ `PlayerSession` — **data-preserving** (INSERT…SELECT ครบทุกคอลัมน์) |

> `foundation_baseline` และ `5e_reference` **ไม่ถูกแก้**. ✅ ตรวจแล้ว: migration SQL = CREATE 8 ตาราง + table-redefine PlayerSession แบบคัดลอกข้อมูลครบ; Foundation + Sprint 1 (93 tests รวม) ยังเขียว (regression gate, DoD #10).

---

## 3. Seed Pipeline (ต่อจาก Sprint 1)

### 3.1 แหล่งข้อมูล (vendor ลงรีโป — offline)
| ไฟล์ปลายทาง | แหล่ง | License |
|---|---|---|
| `prisma/seed/data/Classes.json` | 5e-bits/5e-database `src/2014/en/5e-SRD-Classes.json` | CC-BY-4.0 |
| `prisma/seed/data/Subclasses.json` | `5e-SRD-Subclasses.json` (12 ตัว) | CC-BY-4.0 |
| `prisma/seed/data/Features.json` | `5e-SRD-Features.json` | CC-BY-4.0 |
| `prisma/seed/data/Levels.json` | `5e-SRD-Levels.json` (progression + spell slots ราย level) | CC-BY-4.0 |
| `prisma/seed/data/Races.json` | `5e-SRD-Races.json` | CC-BY-4.0 |
| `prisma/seed/data/Subraces.json` | `5e-SRD-Subraces.json` | CC-BY-4.0 |
| `prisma/seed/data/Backgrounds.json` | `5e-SRD-Backgrounds.json` | CC-BY-4.0 |
| `prisma/seed/data/community-subclasses.json` | **open community pack เปิดสิทธิ์** (OGL 1.0a / CC เช่น open5e) — subclass นอก SRD ที่เปิดถูกกฎหมาย | OGL-1.0a / CC (เก็บราย row) |
| `prisma/seed/SRD-5.1-CC-BY-4.0.md` | (มีแล้วจาก Sprint 1) | — |
| `prisma/seed/COMMUNITY-LICENSE.md` | **ใหม่** — ตัวบท OGL 1.0a Section 15 + attribution ของ pack ที่ใช้ | — |

> **ข้อบังคับ licensing:** community pack ต้องเป็นแหล่งเปิดเท่านั้น; เก็บ `source` + `license` ลงทุกแถว Subclass/Feature ที่มาจาก pack. **ห้าม** vendor subclass ลิขสิทธิ์ WotC ที่ไม่อยู่ใน SRD. ถ้า pack แนบ OGL ต้อง reproduce Section 15.

### 3.2 Transform (`prisma/seed/transform-characters.ts` — pure, testable)
mappers (mirror สไตล์ `transform.ts` ของ Sprint 1):
- `toClassRow(src)` → hitDie, savesJson (จาก `saving_throws`), proficiencies → armor/weapon/tool, skillChoicesJson (จาก `proficiency_choices`), spellcastingJson (จาก `spellcasting` → `{ability,type}` หรือ null), subclassLevel (จาก `subclasses`/`Levels` ที่ feature subclass โผล่)
- `toSubclassRow(src, license)` → classSlug, `flavor` (1-line) + `description` (เก็บจาก SRD `desc[]` join), featuresByLevelJson
- `toClassLevelRow(srcLevel)` → 1 แถวต่อ (class, level); `proficiencyBonus = profBonusForLevel(level)` (คำนวณ ไม่เชื่อ source), `spellSlotsJson` จาก `spellcasting` ของ level นั้น, `classCountersJson` จาก `class_specific`
- `toFeatureRow(src)` → classSlug/subclassSlug/level/description
- `toRaceRow(src)` / `toSubraceRow(src)` → abilityBonusesJson (จาก `ability_bonuses`), speed, traitsJson, proficienciesJson, languagesJson
- `toBackgroundRow(src)` → skill/tool proficiencies, featureJson, startingEquipment
- slug: ใช้ `index` ของ source ถ้ามี ไม่งั้น `slugify(name)` (ใช้ `slugify` เดิมจาก `lib/reference/srd.ts`)

### 3.3 Seed runner (ต่อ `prisma/seed/index.ts`)
- อ่านไฟล์จาก `process.cwd()/prisma/seed/data/*.json` (เหมือน Sprint 1)
- merge subclasses: SRD 12 + community pack → dedupe by slug (SRD ชนะถ้าซ้ำ)
- idempotent `upsert({ where:{ slug }, create, update })` ต่อ entity; ClassLevel upsert by `@@unique([classSlug,level])` (`upsert` ด้วย compound `where: { classSlug_level: {classSlug, level} }`)
- ห่อ `$transaction` แบ่ง batch (เหมือน Sprint 1)
- พิมพ์สรุป: `12 classes · 240 class-levels · N subclasses · M features · K races · 13 backgrounds`

### 3.4 Deterministic derived (คำนวณใน seed/rules — ไม่เดา)
- `profBonusForLevel(level) = 2 + floor((level - 1) / 4)` → +2(1-4) +3(5-8) +4(9-12) +5(13-16) +6(17-20)
- spell slots: เอาจาก `Levels.json` ของ SRD โดยตรง (เป็นตารางทางการ) — ไม่คำนวณเอง
- hit die → ใช้ตอน derive HP ของ Character (ไม่เก็บใน reference เกินจำเป็น)

---

## 4. Rules Engine (`lib/characters/rules.ts` — pure, deterministic, TDD ตอน dev)

> หัวใจ auto-fill — pure functions ทั้งหมด รับ reference + character input คืนค่า derived. **ไม่มี side effect, ไม่แตะ DB** → unit test เทียบตาราง PHB ได้ตรง (DoD #3).

```ts
export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);
export const profBonusForLevel = (level: number): number => 2 + Math.floor((clampLevel(level) - 1) / 4);

// HP: level1 = maxHitDie + conMod; ต่อ level = avg(hitDie)+conMod  (avg = floor(d/2)+1)
export function maxHpFor(hitDie: number, level: number, conMod: number): number;

// spell slots: lookup จาก ClassLevel.spellSlotsJson (reference) — engine แค่ parse/return
export function spellSlotsFor(classLevel: ClassLevelRef): Record<string, number>;

// proficiency flags + final modifier
export function derivedSaves(cls: ClassRef, abilities: Abilities, profBonus: number): SaveResult;
export function derivedSkills(cls: ClassRef, bg: BackgroundRef, chosen: string[], abilities, profBonus): SkillResult;

// รวม features ที่มี ณ level: class(1..level) + subclass(ถึง level) + race + background
export function featuresFor(opts: { classLevels, subclass, race, background, level }): FeatureView[];

// apply ability scores: assigned + race bonus
export function effectiveAbilities(base: Abilities, race: RaceRef, subrace?: RaceRef): Abilities;

// ability-score generators (validation)
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export function validateStandardArray(assigned: number[]): boolean; // ใช้ครบ 6 ค่าพอดี
export function pointBuyCost(score: number): number;                // 8→0..15→9 (ตาราง PHB)
export function validatePointBuy(assigned: number[], budget = 27): boolean;
```
**Composition:** `deriveCharacter(input, refs) → DerivedCharacter` รวมทุกอย่าง แล้ว apply `overridesJson` (ข้าม field ที่ override). ใช้ทั้งตอน create (เติมค่าแรก) และ recompute (เปลี่ยน level/score).

### 4.1 Glossary (คำอธิบาย Ability/Skill — static, ไม่ใช่ DB)
> Ability scores (6) และ Skills (18) เป็น **ชุดคงที่ตาม SRD** — ไม่ user-editable, ไม่ต้องมีตาราง DB/migration. เก็บเป็น `lib/characters/glossary.ts` (vendored จาก SRD `5e-SRD-Ability-Scores.json` + `5e-SRD-Skills.json`, **CC-BY-4.0**) เพื่อแสดง "คำอธิบายเพิ่ม" ใน wizard (ขั้น Abilities/Skills) และ tooltip บนชีต.
```ts
export const ABILITY_INFO: Record<AbilityKey, { name: string; desc: string }>;   // str..cha
export const SKILL_INFO:   Record<string,     { ability: AbilityKey; desc: string }>; // 18 skills → governing ability + 1-line
```
- ใช้ที่ UI ฝั่ง client (offline) — ไม่ต้องผ่าน API; เป็น CC-BY content จึงนับรวมใน attribution footer.
- **Subclass description:** มาจากตาราง `Subclass.description`/`flavor` (seed เก็บจาก SRD `desc` ของแต่ละ subclass) — แสดงในขั้น Subclass ของ wizard.

---

## 5. API Contracts

### 5.1 Reference reads (REST GET — แพทเทิร์น Sprint 1, GLOBAL, cache แรง)
| Method | Endpoint | ผลลัพธ์ |
|---|---|---|
| GET | `/api/reference/classes` | `ClassListItem[]` |
| GET | `/api/reference/classes/[slug]` | `ClassDetail` (+ levels progression embedded) |
| GET | `/api/reference/subclasses?class=<slug>` | `SubclassListItem[]` (กรองตามคลาส) |
| GET | `/api/reference/subclasses/[slug]` | `SubclassDetail` |
| GET | `/api/reference/races` | `RaceListItem[]` (รวม subrace, มี parentRaceSlug) |
| GET | `/api/reference/races/[slug]` | `RaceDetail` |
| GET | `/api/reference/backgrounds` | `BackgroundListItem[]` |
| GET | `/api/reference/backgrounds/[slug]` | `BackgroundDetail` |

- **dynamic + Cache-Control** (เหมือนบทเรียน Sprint 1 — **ไม่ใช้ `force-static`** เพราะ SQLite seed ตอน runtime; ใช้ `cachedJson()` helper เดิมจาก `lib/reference/http.ts`)
- in-memory module cache ใน `lib/characters/refRepo.ts` (เหมือน `lib/reference/repo.ts`)
- 404 → `{ error: "not_found" }` (slug ไม่มี)

### 5.2 Character CRUD (REST — prep-time, authz ฝั่ง server)
| Method | Endpoint | Auth | ผลลัพธ์ |
|---|---|---|---|
| GET | `/api/characters` | ต้องอยู่ใน session | `CharacterListItem[]` ของ **แคมเปญตัวเอง** (player เห็นสรุปทุกตัว + ของตัวเองเต็ม; DM เห็นทุกตัว) |
| GET | `/api/characters/[id]` | session + (เจ้าของ \| DM \| สมาชิกแคมเปญดูสรุป) | `CharacterDetail` |
| POST | `/api/characters` | session | สร้าง: server derive ค่าแรก + เซ็ต `ownerSessionId`=ตัวเอง (player) หรือ `isNpc`+null (DM); claim ผ่าน `PlayerSession.characterId` ใน tx เดียว |
| PATCH | `/api/characters/[id]` | **เจ้าของ \| DM** | แก้ field; ถ้าแก้ derived field → เพิ่มชื่อลง `overridesJson`; ถ้าเปลี่ยน level/score → recompute (ข้าม overrides); reset-to-auto → ลบออกจาก overrides แล้ว recompute |
| DELETE | `/api/characters/[id]` | **เจ้าของ \| DM** | ลบ + ปลด claim (`PlayerSession.characterId` → SetNull ผ่าน FK) |

**Authz (re-derive จาก session — ห้ามเชื่อ payload):**
- ดึง session จาก cookie/token (กลไก Foundation) → ได้ `{ sessionId, campaignId, role }`
- ทุก endpoint: ตรวจ `character.campaignId === session.campaignId` (กัน cross-tenant) ไม่งั้น **404** (ไม่บอกว่ามีอยู่)
- write: ต้อง `role === "dm" || character.ownerSessionId === session.sessionId` ไม่งั้น **403**
- payload **ห้ามมี** `ownerSessionId`/`campaignId`/`isNpc(player)` — server กำหนดเอง

### 5.3 Response types (`lib/characters/types.ts`)
```ts
export interface CharacterListItem {
  id: string; name: string; isNpc: boolean; ownedByMe: boolean;
  raceName: string; className: string; subclassName: string | null; level: number;
  currentHp: number; maxHp: number; ac: number;
}
export interface CharacterDetail extends CharacterListItem {
  raceSlug: string; subraceSlug: string | null; classSlug: string;
  subclassSlug: string | null; backgroundSlug: string | null;
  abilities: Abilities; abilityMods: Abilities; abilityMethod: string;
  proficiencyBonus: number; tempHp: number; speed: number; initiative: number;
  saves: Record<string, { proficient: boolean; mod: number }>;
  skills: Record<string, { proficient: boolean; mod: number }>;
  spellSlots: Record<string, number> | null;   // null = non-caster
  features: { name: string; level: number; source: string; desc: string }[];
  spells: { slug: string; name: string; level: number; known: boolean; prepared: boolean }[];
  conditions: string[]; overrides: string[]; notes: string | null;
}
```

---

## 6. Repository / cache layer
- `lib/characters/refRepo.ts` — `getClasses()/getClass(slug)/getSubclasses(classSlug?)/getRaces()/getBackgrounds()/…` อ่าน Prisma + parse JSON columns → typed (module-level cache เหมือน `lib/reference/repo.ts`; reference static หลัง seed)
- `lib/characters/charRepo.ts` — CRUD ตัวละคร ผ่าน Prisma singleton (`lib/db.ts`); **ทุก query มี `where: { campaignId }`** (tenant scope); ไม่มี cache (mutable). คืน entity ดิบ → service layer derive
- `lib/characters/service.ts` — รวม charRepo + refRepo + rules → `createCharacter` / `updateCharacter` (จัดการ override + recompute + claim ใน tx) / `toDetail` (parse + derive features/mods สำหรับ response)

---

## 7. Security & Auth
- **เข้าถึงเมื่ออยู่ใน session** (เหมือน Sprint 1): หน้า `/characters/*` เป็น client page ใต้ provider เดียวกับ lobby; ไม่มี seat → redirect `/join`
- **Reference reads:** ข้อมูลสาธารณะ (กฎเกม) ไม่ผูก campaign → ไม่ authz ระดับแถว
- **Character writes:** authz เต็มตาม §5.2 — re-derive owner/role จาก session, tenant-scoped, payload ไม่ถูกเชื่อ
- **License compliance (functional):** หน้า Characters/wizard แสดง attribution (SRD CC-BY-4.0 + community pack license); เก็บไฟล์ไลเซนส์ใน `prisma/seed/`

---

## 8. การ amend `docs/program/DATA_MODEL.md`
- เติมคอลัมน์ฉบับ finalized ของ 8 entity (Class/Subclass/ClassLevel/Feature/Race/Background/Character/CharacterSpell) + mark **"Finalized (Sprint 2, migration `characters`)"**
- บันทึก `PlayerSession.characterId` → **FK→Character (@unique, SetNull)** ใน section PlayerSession (touched note)
- คง Entity Catalog เดิม (เพิ่ม 6 entity ไปแล้วตอน roadmap) — ทำทันทีหลังไฟล์นี้

## 9. Technical Notes / Best Practices
- **JSON columns:** ใช้ `parseJson<T>(s, fallback)` เดิม (`lib/reference/parse.ts`) — กัน JSON เสีย (PRD edge 5.10)
- **soft ref by slug:** `classSlug`/`raceSlug` ฯลฯ ไม่เป็น DB FK (reference เป็น global/replaceable, ไม่อยากให้ reseed ทำ FK พัง) → validate ที่ service ตอน create/patch (slug ต้องมีจริงในคลัง)
- **override discipline:** `overridesJson` เป็น allow-list ของ field ที่ "หยุด auto" — recompute อ่าน set นี้แล้วข้าม; "reset to auto" = ลบชื่อออก + recompute
- **non-caster:** `spellcastingJson = null` → service คืน `spellSlots: null`, ไม่สร้าง CharacterSpell section (PRD edge 5.2)
- **HP average rule:** avg ของ dN = `floor(N/2)+1` (d6→4, d8→5, d10→6, d12→7) ตามกฎ PHB; level1 = max die
- **clamp:** `currentHp = clamp(0, maxHp+tempHp)`; level clamp 1..20
- **test seam:** repo/service ผ่าน Prisma singleton → mock เหมือน Foundation/Sprint 1 (`vi.mock("@/lib/db")`); rules.ts เป็น pure → ทดสอบตรง
- **regression:** หลัง migrate `characters` ต้องรัน Foundation + Sprint 1 suite ให้เขียว (DoD #10)

---

## ✅ พร้อมส่งต่อ
ครบ: 8 Prisma models + 2 additive migrations + seed pipeline (vendor SRD + community pack, idempotent, deterministic prof bonus/HP) + rules engine spec + REST contracts (reference reads + character CRUD พร้อม authz 403/404) + repo/service/cache + override model. ถัดไป: amend DATA_MODEL → `/uxui` (Stage 4) → `/proto` (Stage 5) → [pause] → dev/qa.
