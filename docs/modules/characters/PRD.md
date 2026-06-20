# PRD — Characters (Sprint 2)

> โมดูล **Characters / Character Sheet** ของ D&D Campaign Manager — ผู้เล่นสร้างและแก้ "ตัวละคร 5e ของตัวเอง" โดยเลือก race / class / subclass / background แล้วระบบ **auto-fill ค่าตามกฎ 5e ให้เป็นค่าตั้งต้น** (HP, proficiency bonus, saving throws, skill, spell slots, features ราย level) — แก้ทับได้ทุกช่อง นี่คือ entity ที่หนักที่สุดของทั้งโปรแกรม
>
> **อ่าน constraint จาก program ก่อน:** [ROADMAP](../../program/ROADMAP.md) (Sprint 2, DoD = ผู้เล่นสร้าง/แก้ตัวละครของตัวเอง) · [DATA_MODEL](../../program/DATA_MODEL.md) (โมดูลนี้ owns `Character`/`CharacterSpell` + 6 GLOBAL reference: `Class`/`Subclass`/`ClassLevel`/`Feature`/`Race`/`Background`; reference `Spell` by slug) · [ARCHITECTURE](../../program/ARCHITECTURE.md) (server-authoritative; เขียนตัวละครได้เฉพาะของตัวเอง; reference/prep-edit = REST, mutation ระหว่างเล่น = socket intent; additive migration) · [DESIGN_SYSTEM](../../program/DESIGN_SYSTEM.md) (tactical fantasy console — inherit ทั้งหมด)

---

## 1. Feature Overview & KPIs

### 1.1 ปัญหา & คุณค่า
หัวใจของการเล่น D&D คือ **ตัวละคร** — แต่การสร้างชีตด้วยมือบนกระดาษ/PDF นั้นช้า ผิดกฎง่าย (ลืมโบนัส proficiency, คิด HP ผิด, ไม่รู้ว่าคลาสได้ feature อะไรตอน level นี้) และไม่ sync กับโต๊ะ โมดูลนี้ให้ผู้เล่น **สร้างตัวละครได้ถูกกฎภายในไม่กี่นาที** โดยเลือกจาก dropdown (race/class/subclass/background) แล้ว **ระบบเติมค่า default ตามกฎ 5e ให้อัตโนมัติ** จากคลังอ้างอิงที่ seed ไว้ — ผู้เล่นโฟกัสที่ "การตัดสินใจของตัวละคร" (เลือก skill, เลือก subclass, ตั้งชื่อ) ไม่ใช่เลขคณิต

โมดูลนี้สร้าง 2 ชั้น:
- **ชั้นข้อมูลอ้างอิง (GLOBAL):** Class/Subclass/Race/Background/Feature/ClassLevel — "กติกาของการเป็นตัวละคร" ที่ทุกแคมเปญใช้ร่วมกัน (เหมือน Sprint 1 ที่ทำ Spell/Item/Monster)
- **ชั้นตัวละครจริง (campaign-scoped):** `Character` ที่ผูกกับแคมเปญและเจ้าของ ผูกเวทผ่าน `CharacterSpell`

นี่คือฐานของ Sprint ถัด ๆ ไป: Inventory (S3) ผูกของเข้า `Character`, Combat (S4) ดึง `Character` เข้า initiative, Story (S5) อ้าง NPC

### 1.2 ขอบเขต Sprint นี้ (ทำ / ไม่ทำ)
| ✅ In scope (v1) | ❌ Out of scope (สปรินต์หลัง / future) |
|---|---|
| Seed reference: Class, Subclass, ClassLevel (1–20), Feature, Race, Background (SRD 5.1 + open community pack) | แก้ไข reference SRD ผ่าน UI (อ่านอย่างเดียว เหมือน Sprint 1) |
| สร้างตัวละคร: เลือก race + class + subclass + background + ตั้งค่าพลัง | **Multiclass** (1 ตัว = 1 คลาส ใน v1) |
| **Auto-fill ตามกฎ:** HP, prof bonus, saves, skills, speed, spell slots, features-by-level | ผูกไอเทม/เงิน/attunement เข้าตัวละคร (→ Inventory S3) |
| ค่าพลัง: **Standard array** + **Point-buy** (27 แต้ม) | ทอยค่าพลัง 4d6 / manual entry แบบอิสระ (→ พิจารณาเมื่อ Dice S6 มา) |
| แก้ทับค่าที่ auto-fill ได้ทุกช่อง (default ไม่ใช่ lock) | live combat mutation ของ HP/conditions (→ Combat S4 ผ่าน socket intent) |
| เลือก/เตรียมเวท (known / prepared) จาก `Spell` ของ Sprint 1 | ทอยเต๋าตรวจ/โจมตีจากชีต (→ Dice S6) |
| ผูก `PlayerSession` ↔ `Character` (claim ตัวละคร, FK จริง) | sheet PDF export / print | 
| DM สร้าง NPC (ตัวละครไม่มีเจ้าของผู้เล่น) | AI generate ตัวละคร (→ AI S7) |
| ตั้ง level 1–20, ระบบ recompute ค่าตาม level | image/portrait upload (พิจารณาภายหลัง) |

### 1.3 KPIs / Success Metrics
- **สร้างเร็ว:** จากกดสร้าง → ได้ตัวละครเล่นได้ (มี HP/AC/saves/skills ครบ) **< 3 นาที** สำหรับผู้เล่นที่รู้ว่าจะเล่นอะไร
- **ถูกกฎ default:** ค่าที่ระบบเติม (HP, prof bonus, saves, skill mod, spell slots) **ตรงกับกฎ 5e 100%** สำหรับคลาส/เลเวลที่รองรับ (ยืนยันด้วย unit test เทียบตาราง PHB)
- **ครบตาม DoD:** ผู้เล่น "สร้าง/แก้ตัวละครของตัวเอง" สำเร็จ (เกณฑ์รับงาน Sprint 2)
- **ครอบคลุม reference (seed จริง):** 12 คลาส + progression 1–20 ทุกคลาส + **109 subclass** (12 SRD + 97 community OGL จาก Open5e/Tome of Heroes/Tal’Dorei) + 13 race (+subraces) + **42 background** (1 SRD + 41 community OGL) + 936 features
- **ออฟไลน์ 100%:** สร้าง/แก้ตัวละครได้โดยไม่ต่อเน็ต (reference seed อยู่ในเครื่อง; ตัวละครเก็บใน SQLite)

---

## 2. Target Platforms & User Roles

### 2.1 แพลตฟอร์ม
Responsive Web (เดสก์ท็อป DM + มือถือ/แท็บเล็ตผู้เล่นบน LAN เดียวกัน) — Next.js App Router เสิร์ฟจาก Node host บนเครื่อง DM ที่ `http://<dm-ip>:3000` เข้าถึง **ภายใน session แคมเปญที่ join แล้ว** (บังคับโดย Foundation auth) ชีตต้องอ่าน/กรอกได้ดีบนมือถือ (ผู้เล่นส่วนใหญ่ถือมือถือที่โต๊ะ)

### 2.2 Actors & สิทธิ์ (บังคับฝั่ง server ตาม ARCHITECTURE)
| Role | เห็น / ทำอะไรในโมดูลนี้ |
|------|--------------------------|
| **Player** | สร้าง/แก้/ลบ **ตัวละครของตัวเอง** (1 player session = 1 claimed character); อ่านชีตของตัวเองเต็ม; เห็นชื่อ/ระดับของเพื่อนร่วมปาร์ตี้ (สรุป ไม่ใช่แก้) |
| **DM** | เห็นตัวละครทุกตัวในแคมเปญเต็มรูปแบบ; สร้าง/แก้/ลบ **NPC** (`isNpc=true`, ไม่มีเจ้าของผู้เล่น); แก้ตัวละครผู้เล่นได้ (อำนาจ DM — เช่นแก้ HP/มอบของ) |
| **Anonymous (ยังไม่ join)** | ❌ เข้าไม่ได้ — redirect ไป `/join` |

> **กรรมสิทธิ์ (ownership):** ทุก write intent server จะ re-derive เจ้าของจาก session token ไม่เชื่อ payload — player แก้ได้เฉพาะ `Character.ownerSessionId === ตัวเอง`; DM ผ่านได้ทุกตัวในแคมเปญตัวเอง; ไม่มี query/หรือ write ข้ามแคมเปญ
> **Reference data เป็น GLOBAL:** Class/Subclass/Race/Background/Feature/ClassLevel ใช้ร่วมทุกแคมเปญ (ไม่มี `campaignId`) — แต่เข้าถึงได้เมื่ออยู่ใน session แล้ว (เหมือน Sprint 1)

---

## 3. User Stories & Functional Workflows

### 3.1 User Stories
- **US-1** — ในฐานะผู้เล่น ฉันอยากสร้างตัวละครใหม่โดยเลือก race/class/subclass/background แล้วระบบเติมค่าพื้นฐานให้ เพื่อจะได้เริ่มเล่นเร็วโดยไม่ต้องเปิดกฎทีละหน้า
- **US-2** — ในฐานะผู้เล่น ฉันอยากใส่ค่าพลังด้วย Standard array หรือ Point-buy แล้วเห็น modifier + ค่าที่ผูกกับมัน (saves, skill, AC, HP) อัปเดตทันที
- **US-3** — ในฐานะผู้เล่น ฉันอยากปรับ level ของตัวละคร แล้วเห็น proficiency bonus / spell slots / features ที่ได้ตาม level นั้นเปลี่ยนตาม
- **US-4** — ในฐานะผู้เล่น (caster) ฉันอยากเลือกเวทที่รู้/เตรียม (known/prepared) จากคลังเวทของคลาสฉัน เพื่อใช้อ้างอิงระหว่างเล่น
- **US-5** — ในฐานะผู้เล่น ฉันอยากแก้ค่าที่ระบบเติมมา (เช่น HP สูงสุดที่ DM ให้ทอยเอง, หรือ AC จากเกราะพิเศษ) เพราะกฎที่โต๊ะมี house rule
- **US-6** — ในฐานะ DM ฉันอยากสร้าง NPC เร็ว ๆ (เลือกคลาส/เลเวล แล้วได้ค่าพื้นฐาน) เพื่อใช้เป็นพันธมิตร/ศัตรูมีระดับ
- **US-7** — ในฐานะผู้เล่น ฉันอยาก "claim" ตัวละครเข้า session ของฉัน เพื่อให้ roster ในห้องแสดงว่าฉันเล่นใคร
- **US-8** — ในฐานะผู้ใช้ ฉันอยากสร้าง/แก้ตัวละครได้แม้เน็ตหลุด เพราะข้อมูลกฎอยู่ในเครื่อง

### 3.2 Workflow A — สร้างตัวละคร (wizard หลายขั้น)
```
[เปิด "ตัวละครของฉัน" จาก nav ในห้องแคมเปญ]
  → ยังไม่มีตัวละคร → ปุ่ม "สร้างตัวละคร" → เข้า wizard:

  Step 1 — Race        เลือก race (+ subrace ถ้ามี) → preview: ability bonus, speed, traits, ภาษา
  Step 2 — Class       เลือก class → preview: hit die, saving-throw prof, armor/weapon prof,
                       จำนวน skill ที่เลือกได้ + รายการให้เลือก, spellcasting (ถ้ามี)
  Step 3 — Subclass    เลือก subclass *เมื่อถึง level ที่คลาสนั้นได้ subclass* (เช่น Cleric ที่ 1, Fighter ที่ 3)
                       → แสดงเฉพาะ subclass ที่มีในคลัง (SRD + community); ถ้าคลาสยังไม่ถึง level นั้น = ข้าม
  Step 4 — Background   เลือก background → preview: skill/tool proficiency, feature
  Step 5 — Abilities    เลือกวิธี: Standard array | Point-buy → กรอกค่า → เห็น modifier + เงาที่ race bonus เพิ่ม
  Step 6 — Skills/Choices  เลือก skill proficiency (ตามจำนวนที่ class+background ให้), fighting style ฯลฯ
  Step 7 — Details     ชื่อตัวละคร, alignment, level เริ่ม (default 1), (caster) เลือกเวทเริ่ม
  → กด "สร้าง" → server สร้าง Character (auto-fill ค่า derived) + ผูกกับ PlayerSession (claim)
  → เข้าหน้า Character Sheet
```

### 3.3 Workflow B — แก้ตัวละคร (Character Sheet)
```
[หน้า Character Sheet ของตัวเอง]
  → ทุกค่าที่ derived มี badge "auto" + ปุ่มดินสอ; กดแก้ = override (เก็บค่าที่ผู้ใช้ตั้ง, เลิก derive ช่องนั้น)
  → เปลี่ยน level → ระบบ recompute prof bonus / spell slots / features ที่ "ยัง auto" (ไม่ทับ override)
  → แท็บ/ส่วน: Core (ability+saves+skills) · Combat (HP/AC/speed/initiative) · Features (ราย level) · Spells (known/prepared)
  → บันทึก = REST PATCH (prep-time edit, ไม่ broadcast); การเปลี่ยน HP ระหว่าง combat จริงเป็นของ Combat S4 (socket)
```

### 3.4 พฤติกรรม Auto-fill (กติกาเติมค่า — สำคัญที่สุด)
> ทุกค่า derived คำนวณด้วย **โค้ด deterministic** จาก reference data (ไม่เดา ไม่ใช้ LLM) — ตรงหลัก "hybrid rules engine" ของ ARCHITECTURE

| ค่าบนชีต | สูตร / แหล่งที่มา |
|---|---|
| Ability modifier | `floor((score − 10) / 2)` |
| ค่าพลังสุทธิ | score (จาก array/point-buy) **+ race ability bonus** |
| Proficiency bonus | จาก `ClassLevel(classSlug, level).proficiencyBonus` (เท่ากันทุกคลาสที่ level เดียวกัน: +2..+6) |
| Saving throw mod | ability mod **+ prof bonus ถ้าคลาส proficient** (saves จาก `Class.savingThrows`) |
| Skill mod | ability mod **+ prof bonus ถ้า proficient** (จาก background/class/ผู้เล่นเลือก) |
| Max HP (level 1) | `hit die สูงสุด + CON mod` |
| Max HP (level >1) | level 1 + ผลรวมต่อ level: **ค่าเฉลี่ย hit die (ปัดขึ้น) + CON mod** (default เฉลี่ย; ผู้เล่น override เพื่อทอยเองได้) |
| Initiative | DEX mod (ค่าเริ่ม; ของจริงไปทอยใน Dice/Combat) |
| AC (ค่าเริ่ม) | `10 + DEX mod` (Unarmored) — เกราะจริงไปคำนวณเต็มใน Inventory S3; override ได้ |
| Speed | จาก `Race.speed` |
| Spell slots | จาก `ClassLevel(classSlug, level).spellSlotsJson` (caster เท่านั้น; non-caster = ไม่มีส่วนนี้) |
| Spells known/prepared (จำนวน) | ตามกฎคลาส (เช่น prepared = ability mod + level สำหรับ Cleric/Wizard/Druid; known คงที่สำหรับ Sorcerer/Bard/Ranger) |
| Features ที่มี | รวมจาก `ClassLevel.featuresJson` (1..level) + `Subclass` features ที่ถึง level + `Race.traits` + `Background.feature` |

### 3.5 พฤติกรรมต่อส่วน (reference areas)
- **Class:** 12 คลาส SRD (Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard) — แต่ละตัวมี hit die, saves, prof, skill choices, spellcasting flag, level ที่ได้ subclass
- **Subclass:** SRD 12 (คลาสละ 1) **+ 97 open community (OGL 1.0a — Open5e/Tome of Heroes/Tal’Dorei)** รวม 109 ตัว (คลาสละ 6–12) — แสดงพร้อมป้าย source/license
- **ClassLevel:** 12 × 20 = 240 แถว progression (prof bonus, features ที่ได้, spell slots) — หัวใจของ auto-fill ตาม level
- **Race:** 9 race SRD (Dwarf, Elf, Halfling, Human, Dragonborn, Gnome, Half-Elf, Half-Orc, Tiefling) + subrace — ability bonus, speed, traits
- **Background:** SRD 5.1 มี 1 ตัว (Acolyte) **+ 41 open community (OGL — Open5e/Tome of Heroes/Tal’Dorei/EN Publishing)** รวม 42 ตัว — skill/tool prof, feature; background เป็น optional ในการสร้าง

---

## 4. Data Dictionary & UI Elements

> Schema สุดท้ายเป็นหน้าที่ `/sa` ที่จะ flesh out + amend [DATA_MODEL](../../program/DATA_MODEL.md) ส่วนนี้ระบุ **ฟิลด์ที่ UI ต้องแสดง/รับเข้า**

### 4.1 Character (ชีตเต็ม — campaign-scoped)
| ฟิลด์ | ตัวอย่าง | บังคับ |
|------|---------|:--:|
| name | "Thorin" | ✓ |
| isNpc / ownerSessionId | false / `<player session id>` (NPC = true / null) | ✓ |
| raceSlug (+ subrace) | "mountain-dwarf" | ✓ |
| classSlug | "fighter" | ✓ |
| subclassSlug | "champion" (อาจ null ถ้า level ยังไม่ถึง) | ถ้ามี |
| backgroundSlug | "soldier" | ✓ |
| level | 1–20 | ✓ |
| ability scores STR..CHA | 15/13/14/8/12/10 (+ modifier) | ✓ |
| proficiencyBonus | +2 (derived) | ✓ |
| maxHp / currentHp / tempHp | 12 / 12 / 0 | ✓ |
| ac / speed / initiative | 12 / 25 ft. / +1 | ✓ |
| saving-throw proficiencies | { str:true, con:true } (derived จากคลาส) | ✓ |
| skill proficiencies | { athletics:true, intimidation:true } (class+background+เลือก) | ✓ |
| spellSlots (caster) | { "1": 2 } by level (derived) | ถ้าเป็น caster |
| features (รวม ราย level) | [{name, level, source, desc}] (derived list) | ✓ |
| conditions | [] (RESERVED — ตั้งโดย Combat S4) | — |
| overrides | บันทึกว่าช่องไหนผู้ใช้ override (เพื่อไม่ให้ recompute ทับ) | ภายใน |

### 4.2 Reference entities (GLOBAL — seeded, อ่านอย่างเดียว)
- **Class:** slug, name, hitDie (6/8/10/12), primaryAbility, savingThrows[], armorProf/weaponProf/toolProf, skillChoices {from[], count}, spellcasting {ability, type} | null, subclassLevel, source, license
- **Subclass:** slug, classSlug, name, flavor, featuresByLevel(JSON), source, license
- **ClassLevel:** classSlug, level, proficiencyBonus, features[](slugs), spellSlots(JSON), classCounters(JSON) — @@unique(classSlug, level)
- **Feature:** slug, name, classSlug?, subclassSlug?, level, description, source, license
- **Race:** slug, name, parentRaceSlug?(subrace), abilityBonuses(JSON), size, speed, traits(JSON), proficiencies, languages, source, license
- **Background:** slug, name, skillProficiencies[], toolProficiencies[], languages, feature{name,desc}, startingEquipment(text), source, license

### 4.3 CharacterSpell (join — campaign-scoped)
| ฟิลด์ | ความหมาย |
|------|---------|
| characterId / spellId | FK→Character / FK→Spell (Sprint 1, by slug) |
| known | รู้เวทนี้ (อยู่ใน spellbook/known list) |
| prepared | เตรียมไว้วันนี้ (caster แบบ prepared) |

### 4.4 UI Elements
- **Create wizard:** stepper (7 ขั้น), ปุ่ม Back/Next, ขั้นที่ยังไม่ครบ disabled "สร้าง", preview panel ข้างขวาอัปเดตสด
- **Point-buy widget:** ตัวนับแต้มคงเหลือ (27), ปุ่ม +/− ต่อ ability, กันค่าเกินช่วง 8–15, แดงเมื่อแต้มไม่พอ
- **Standard array widget:** ลาก/เลือก 15/14/13/12/10/8 ลงช่อง, กันใช้ซ้ำ
- **Character sheet:** เลย์เอาต์การ์ดตาม DESIGN_SYSTEM (Cinzel ชื่อ/หัวข้อ, JetBrains Mono ทุกตัวเลข tabular), badge "auto" + ดินสอ override
- **Ability block:** score ใหญ่ + modifier เด่น (สไตล์ statblock); saves/skills เป็นแถวมี dot proficiency (ไม่ใช้สีอย่างเดียว — มี dot + ตัวหนา)
- **Spells section:** กรองเวทตามคลาส/level, toggle known/prepared, ลิงก์ไป spell card (Sprint 1)
- **คำอธิบายประกอบ (helper text/tooltip) — บังคับ:** เพื่อให้ผู้เล่นมือใหม่เข้าใจตอนเลือก
  - **Abilities (6):** แต่ละค่าพลังมีคำอธิบายว่ากำหนดอะไร (เช่น DEX → AC/initiative/finesse) — แสดงในขั้น Abilities (panel กางได้) + tooltip บน ability block ของชีต
  - **Skills (18):** แต่ละ skill บอกค่าพลังที่กำกับ + คำอธิบาย 1 บรรทัด (เช่น Stealth (DEX) — ย่องเงียบ ซ่อนตัว) — แสดงในขั้น Skills ใต้ตัวเลือก + tooltip บนชีต
  - **Subclass:** แต่ละ subclass มีคำอธิบายว่าเล่นแนวไหน (`description`) + ป้ายแหล่ง/license — แสดงในการ์ดเลือก subclass
  - แหล่ง: Ability/Skill = static glossary จาก SRD (`lib/characters/glossary.ts`, CC-BY); Subclass = `Subclass.description` จาก seed
- **License/Attribution footer:** เครดิต SRD 5.1 (CC-BY-4.0) + community pack ที่ใช้ (ตาม license ของแต่ละ pack)

---

## 5. Edge Cases & Exception Handling

| # | กรณี | พฤติกรรมที่ต้องการ |
|---|------|---------------------|
| 5.1 | คลาสไม่มี subclass เปิด (เฉพาะกรณี community pack ไม่ครอบคลุม) | แสดง subclass เท่าที่มีในคลัง + โน้ต "subclass อื่นเป็นลิขสิทธิ์ ไม่รวมในชุดเปิด"; ถ้าว่างจริงให้ปล่อย subclass = null (เลือกภายหลังได้) |
| 5.2 | คลาส non-caster (Fighter/Barbarian/Rogue/Monk) | ซ่อนส่วน Spells/spell slots ทั้งหมด ไม่แสดง "0 slots" รก ๆ |
| 5.3 | level < level ที่ได้ subclass (เช่น Fighter level 1–2) | ข้าม step Subclass; โชว์ป้าย "ปลดล็อก subclass ที่ level 3" |
| 5.4 | Point-buy ใช้แต้มเกิน 27 / ตั้งค่านอกช่วง 8–15 | กันที่ UI (disable +) + validate ฝั่ง server; error ชัดเจน ไม่ให้บันทึก |
| 5.5 | Standard array เลือกค่าซ้ำ/ไม่ครบ 6 ช่อง | กันที่ UI; "สร้าง" disabled จนครบ |
| 5.6 | ผู้เล่นพยายามแก้ตัวละครคนอื่น (ยิง intent ตรง) | server ปฏิเสธ (403) — re-derive ownership จาก session ไม่เชื่อ payload |
| 5.7 | ผู้เล่นมีตัวละครอยู่แล้วแล้วกดสร้างอีก | v1: 1 player session = 1 claimed character → ถามยืนยัน "แทนที่ตัวเดิม?" หรือชี้ไปแก้ตัวเดิม (ไม่สร้างซ้ำเงียบ ๆ) |
| 5.8 | เปลี่ยน race/class หลังสร้างแล้ว (ค่าที่ override ไว้) | recompute เฉพาะช่อง "ยัง auto"; ช่องที่ override เตือน "ค่านี้ถูกแก้เอง — อัปเดตจากกฎใหม่?" ให้ผู้ใช้ตัดสิน |
| 5.9 | ลด level ลง (เคยได้ feature/slot สูง) | recompute ลด features/slots ที่ derived ตาม level ใหม่; ถ้าเคยเลือกเวทเกิน slot เตือนแต่ไม่ลบให้เงียบ |
| 5.10 | reference JSON เสีย/ไม่ครบ (featuresJson/spellSlots) | parse เท่าที่ได้, ช่องนั้นว่างแทนพัง (graceful, เหมือน edge 5.6 ของ Sprint 1) |
| 5.11 | currentHp ติดลบ / temp HP | clamp currentHp ≥ 0 (ตาย/หมดสติเป็นเรื่อง Combat S4); tempHp ไม่รวมใน max |
| 5.12 | เข้าหน้า Characters ทั้งที่ยังไม่ join | redirect `/join` (เหมือน Sprint 1) |
| 5.13 | เน็ตหลุดกลางสร้าง | reference อยู่ในเครื่อง สร้างต่อได้; การบันทึกลง DB เป็น local — ไม่กระทบ |
| 5.14 | มือถือจอแคบ | wizard เป็น step เต็มจอ; ชีตยุบเป็น section accordion อ่าน scroll เดียว |
| 5.15 | DM ลบตัวละครที่ผู้เล่น claim อยู่ | ปลด claim (`PlayerSession.characterId=null`) + ยืนยันก่อนลบ; ไม่ทำ roster พัง |

**ภาคผนวก — Future (ไม่ทำ v1):** Multiclass, ทอยค่าพลัง 4d6/ทอย HP ในแอป (รอ Dice S6), homebrew class/subclass editor, feat (นอก ASI), PDF export, portrait upload, inspiration tracker

---

## 6. Compliance & Non-Functional Requirements

### 6.1 Performance
- Reference seed อยู่ในเครื่อง → โหลด list (class/race/background/subclass) **ครั้งเดียวต่อชนิด** ผ่าน REST แล้ว cache (เหมือน `lib/reference` ของ Sprint 1)
- Auto-fill recompute เป็น pure function ในหน่วยความจำ — เปลี่ยน level/score เห็นผล **< 50ms**
- บันทึกชีต (PATCH) ตอบ < 200ms บน local host

### 6.2 Architecture alignment (บังคับ)
- **prep-time CRUD ของตัวละคร = REST/Next route handlers** (สร้าง/แก้นอก combat ไม่ต้อง broadcast); การเปลี่ยน state ระหว่างเล่น (HP/conditions) เป็นของ **Combat S4 ผ่าน socket intent** — โมดูลนี้เตรียม field ไว้ ไม่ทำ live mutation
- **Reference 6 ตัวเป็น GLOBAL ไม่ scope `campaignId`**; **Character/CharacterSpell scope `campaignId`** เสมอ
- **Authorization ฝั่ง server:** re-derive owner/role จาก session — player เขียนเฉพาะตัวเอง, DM เขียนได้ทุกตัวในแคมเปญตัวเอง, ไม่มี cross-campaign
- **Additive migration เท่านั้น:** `characters_reference` (6 GLOBAL tables) + `characters` (Character/CharacterSpell + เปลี่ยน `PlayerSession.characterId` เป็น FK) — ห้ามแก้ `foundation_baseline`/`5e_reference` เดิม; Foundation/Sprint 1 tests ต้องยังเขียว (regression)
- **Rules math = deterministic code** (modifier, prof bonus, HP, slots) — ไม่ใช้ LLM ทำเลข
- Seed ผ่าน prisma seed script เพิ่มจากของ Sprint 1 (idempotent upsert by slug)

### 6.3 Licensing & Attribution (สำคัญ)
- **SRD 5.1** ภายใต้ **CC-BY-4.0** (เหมือน Sprint 1) — class/race/background/subclass SRD ทั้งหมด
- **Community subclass pack** ต้องเป็นแหล่ง **เปิดถูกกฎหมายเท่านั้น** (OGL 1.0a หรือ CC) เช่น open5e — เก็บ `source` + `license` ราย row และแสดงเครดิตตามที่แต่ละ license กำหนด (OGL ต้องแนบ Section 15 / CC ต้อง attribution)
- **ห้าม** นำเข้า subclass/เนื้อหาลิขสิทธิ์ WotC ที่ไม่อยู่ใน SRD (Assassin, Arcane Trickster, Way of Shadow ฯลฯ) — ไม่มีแหล่งเปิด
- เก็บไฟล์ไลเซนส์ของทุกแหล่งในรีโป (เช่น `prisma/seed/SRD-5.1-CC-BY-4.0.md` + `prisma/seed/<pack>-LICENSE.md`) — `/sa` ระบุที่เก็บจริง

### 6.4 a11y & UX (inherit DESIGN_SYSTEM)
- คอนทราสต์ AA, focus ring ชัด, ทุกตัวเลขบนชีตใช้ tabular-nums (JetBrains Mono)
- proficiency แสดงด้วย dot + น้ำหนักตัวอักษร (ไม่พึ่งสีอย่างเดียว — `color-not-only`)
- wizard เดินด้วยคีย์บอร์ดได้; ชีตมี heading hierarchy ที่ screen reader อ่านรู้เรื่อง

### 6.5 Privacy
- ตัวละครเป็นข้อมูลในเกม ผูกกับ display name (ไม่ใช่ PII จริง) — ไม่มีประเด็น PDPA/GDPR เพิ่มจาก Foundation

---

## ✅ Definition of Done (เกณฑ์รับงาน Sprint 2)
1. Seed reference ครบผ่าน additive migration `characters_reference`: 12 Class + ClassLevel 1–20 ทุกคลาส + Subclass (SRD 12 + community) + Race + Background + Feature — idempotent upsert by slug
2. ผู้เล่นสร้างตัวละครของตัวเองได้ครบ wizard (race/class/subclass/background/abilities[array+point-buy]/skills/details) — DoD หลัก
3. **Auto-fill ถูกกฎ 5e:** HP, proficiency bonus, saves, skill mods, speed, spell slots, features-by-level เติมตรงตามกฎ (ยืนยันด้วย unit test เทียบตาราง) และ **override ได้ทุกช่อง**
4. แก้ตัวละคร + เปลี่ยน level แล้ว recompute ค่าที่ยัง auto (ไม่ทับ override)
5. caster เลือก known/prepared spells จาก `Spell` (Sprint 1) ได้; non-caster ไม่มีส่วนเวท
6. ผูก `PlayerSession.characterId` → FK→Character (claim); DM สร้าง NPC ได้
7. Authorization: player แก้ได้เฉพาะตัวเอง, DM ทุกตัวในแคมเปญ — บังคับฝั่ง server (มี test)
8. Empty/loading/validation/404 states ครบ (§5); attribution license แสดงในแอป
9. Single-class only, level 1–20; responsive เดสก์ท็อป+มือถือ; ออฟไลน์ได้
10. Additive migration — Foundation + Sprint 1 tests ยังเขียวทั้งหมด (regression)
