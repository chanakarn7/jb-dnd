# PRD — 5e Reference (Sprint 1)

> โมดูล **Reference / Compendium** ของ D&D Campaign Manager — คลังข้อมูลกฎ 5e (เวท / ไอเทม / มอนสเตอร์) แบบ "อ่านอย่างเดียว" ที่ DM และผู้เล่นเปิดดูระหว่างเล่นได้ทันที
>
> **อ่าน constraint จาก program ก่อน:** [ROADMAP](../../program/ROADMAP.md) (Sprint 1, DoD = ค้นหาและดู statblock/spell) · [DATA_MODEL](../../program/DATA_MODEL.md) (โมดูลนี้ owns `Spell`/`Item`/`Monster`) · [ARCHITECTURE](../../program/ARCHITECTURE.md) (reference = REST route handlers, ไม่ใช่ realtime) · [DESIGN_SYSTEM](../../program/DESIGN_SYSTEM.md) (tactical fantasy console — inherit ทั้งหมด)

---

## 1. Feature Overview & KPIs

### 1.1 ปัญหา & คุณค่า
ระหว่างเล่นบนโต๊ะ DM ต้องเปิดหากฎบ่อยมาก — "เวทนี้ระยะเท่าไหร่", "กobลินมี AC เท่าไหร่", "ดาบยาวทำดาเมจอะไร" การพลิกหนังสือ/เปิดเว็บนอกแอปทำให้เกมสะดุด โมดูลนี้ฝัง **คลังอ้างอิง SRD 5.1** ไว้ในแอปเอง เปิดในแท็บเดียวกับห้องแคมเปญ ค้น/กรอง/อ่านได้ภายในวินาที **ออฟไลน์เต็มรูปแบบ** (ข้อมูล seed อยู่ในเครื่อง ไม่ต้องต่อเน็ต)

นี่คือ **master/reference data** ของทั้งโปรแกรม — โมดูลถัด ๆ ไปจะอ้างถึง (Characters เลือกเวทจาก `Spell`, Inventory ผูก `Item`, Combat ดึง `Monster` เข้า encounter) Sprint นี้สร้าง "คำนาม" เหล่านั้นให้มีอยู่และค้นเจอก่อน

### 1.2 ขอบเขต Sprint นี้ (ทำ / ไม่ทำ)
| ✅ In scope (v1) | ❌ Out of scope (สปรินต์หลัง / future) |
|---|---|
| Seed ข้อมูล SRD 5.1: เวท, ไอเทม/อุปกรณ์, มอนสเตอร์ | แก้ไข/เพิ่ม/ลบ entity ของ SRD (อ่านอย่างเดียว) |
| ค้นหา (search box) ต่อหมวด | Homebrew / custom entry (→ future, ดู §5 ภาคผนวก) |
| กรอง (filter) ตาม attribute หลักของแต่ละหมวด | ผูกเวท/ไอเทมเข้าตัวละคร (Characters=S2, Inventory=S3) |
| ดูรายละเอียดเต็ม: spell card / item card / monster statblock | ดึงมอนสเตอร์เข้า initiative tracker (Combat=S4) |
| โหลด/ว่าง/ไม่พบผล (loading / empty / no-result states) | ทอยเต๋าจากในการ์ด (Dice=S6) |
| Deep-link เปิดการ์ดตรง ๆ ได้ (แชร์ลิงก์ในโต๊ะ) | AI generate statblock (AI=S7) |

### 1.3 KPIs / Success Metrics
- **ค้นเจอเร็ว:** จากพิมพ์คำค้น → เห็นผลกรอง **< 100ms** (client-side filter, ดู §6).
- **ครบตาม DoD:** ผู้ใช้ "ค้นหาและดู statblock & spell" ได้สำเร็จ (เกณฑ์รับงาน Sprint 1).
- **ครอบคลุม SRD:** seed ครบทั้ง 3 หมวดจากชุด SRD 5.1 (≈300+ เวท, ≈300+ มอนสเตอร์, ≈200+ ไอเทม).
- **ออฟไลน์ 100%:** ใช้งานได้โดยไม่ต่ออินเทอร์เน็ต (ยืนยันด้วยการตัดเน็ตแล้วยังค้น/อ่านได้).

---

## 2. Target Platforms & User Roles

### 2.1 แพลตฟอร์ม
Responsive Web (เดสก์ท็อป DM + มือถือผู้เล่นบน LAN เดียวกัน) — Next.js App Router, เสิร์ฟจาก Node host เดียวบนเครื่อง DM ที่ `http://<dm-ip>:3000` เข้าถึง **ภายใน session แคมเปญ** (ต้อง join ห้องก่อน ตาม Foundation)

### 2.2 Actors & สิทธิ์
| Role | เห็น / ทำอะไรในโมดูลนี้ |
|------|--------------------------|
| **DM** | ค้น/กรอง/อ่านได้ทุกหมวดเต็มรูปแบบ |
| **Player** | ค้น/กรอง/อ่านได้ **เท่ากับ DM** — reference เป็นข้อมูลสาธารณะตามกฎ ไม่มีความลับ DM ในชั้นนี้ |
| **Anonymous (ยังไม่ join)** | ❌ เข้าไม่ได้ — ต้องอยู่ใน session แคมเปญก่อน (บังคับโดย Foundation auth) |

> **หมายเหตุสิทธิ์:** reference data เป็น **global SRD** ใช้ร่วมทุกแคมเปญ (ไม่ scope ด้วย `campaignId`) แต่ "การเข้าถึง" ต้องอยู่ใน session แคมเปญที่ join แล้ว — สอดคล้องกับ ARCHITECTURE (ทุก request ต้องมีตัวตนจาก session)

---

## 3. User Stories & Functional Workflows

### 3.1 User Stories
- **US-1** — ในฐานะ DM ฉันอยากพิมพ์ชื่อเวท "fireball" แล้วเห็นการ์ดเวทเต็ม เพื่ออ่านระยะ/ดาเมจ/คำบรรยายให้ผู้เล่นฟังได้ทันที
- **US-2** — ในฐานะ DM ฉันอยากกรองมอนสเตอร์ตาม CR (เช่น CR 0–2) เพื่อเลือกศัตรูให้เหมาะกับเลเวลปาร์ตี้
- **US-3** — ในฐานะผู้เล่น ฉันอยากค้นเวทตามเลเวลและสำนัก (school) เพื่อดูว่าตอนนี้ร่ายอะไรได้บ้าง
- **US-4** — ในฐานะ DM ฉันอยากกรองไอเทมตามประเภท/ความหายาก (rarity) เพื่อวางของรางวัลในดันเจียน
- **US-5** — ในฐานะผู้ใช้คนใดก็ได้ ฉันอยากเปิดลิงก์การ์ดมอนสเตอร์ตรง ๆ (deep-link) เพื่อแชร์ให้คนอื่นในโต๊ะเปิดดูตรงกัน
- **US-6** — ในฐานะผู้ใช้ ฉันอยากใช้ได้แม้เน็ตหลุด (เล่นในป่า/ที่ไม่มีเน็ต) เพราะข้อมูลอยู่ในเครื่อง

### 3.2 Workflow หลัก — ค้นหา → กรอง → อ่าน
```
[เปิด Reference จาก nav ในห้องแคมเปญ]
   → เลือกแท็บหมวด: Spells | Monsters | Items   (ค่าเริ่ม = Spells)
   → พิมพ์คำค้นในช่อง search (ค้นจากชื่อ; debounce; กรองทันทีฝั่ง client)
   → เลือก filter chips/dropdown ของหมวดนั้น (รวมแบบ AND)
   → รายการอัปเดตทันที + แสดงตัวนับ "พบ N รายการ"
   → คลิกแถว/การ์ด → เปิดหน้า detail (spell card / item card / monster statblock)
   → ปุ่ม Back กลับสู่รายการโดยคงคำค้น+filter เดิม (state คงอยู่)
```

### 3.3 พฤติกรรมต่อหมวด

**A) Spells — เวท**
- ค้นจาก: ชื่อเวท
- Filter: **Level** (Cantrip, 1–9), **School** (Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation), **Class** (Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard), **Ritual** (toggle), **Concentration** (toggle)
- รายการแสดง: ชื่อ · level · school · เวลาร่าย (casting time) · ป้าย ritual/concentration
- เรียงเริ่มต้น: level ↑ แล้วชื่อ A→Z

**B) Monsters — มอนสเตอร์**
- ค้นจาก: ชื่อมอนสเตอร์
- Filter: **CR** (ช่วง: 0, 1/8, 1/4, 1/2, 1, 2, … — ใช้เป็น range slider/min-max), **Type** (aberration, beast, celestial, construct, dragon, … 14 ชนิด), **Size** (Tiny–Gargantuan)
- รายการแสดง: ชื่อ · CR · type · size · HP · AC
- เรียงเริ่มต้น: CR ↑ แล้วชื่อ A→Z

**C) Items — ไอเทม/อุปกรณ์**
- ค้นจาก: ชื่อไอเทม
- Filter: **Type** (weapon, armor, adventuring-gear, tool, …), **Rarity** (common, uncommon, rare, very-rare, legendary; + "mundane" สำหรับของพื้นฐาน), **Requires Attunement** (toggle)
- รายการแสดง: ชื่อ · type · rarity · ราคา/น้ำหนัก (ถ้ามี)
- เรียงเริ่มต้น: ชื่อ A→Z

---

## 4. Data Dictionary & UI Elements

> Schema สุดท้ายเป็นหน้าที่ `/sa` ที่จะ flesh out + amend [DATA_MODEL](../../program/DATA_MODEL.md). ส่วนนี้ระบุ **ฟิลด์ที่ UI ต้องแสดง** (functional requirement) — `/sa` ต้องรองรับครบ

### 4.1 Spell (การ์ดเวทเต็ม)
| ฟิลด์ | ตัวอย่าง | บังคับแสดง |
|------|---------|:--:|
| name | Fireball | ✓ |
| level | 3 (หรือ "Cantrip") | ✓ |
| school | Evocation | ✓ |
| castingTime | 1 action | ✓ |
| range | 150 feet | ✓ |
| components | V, S, M (a tiny ball of bat guano and sulfur) | ✓ |
| duration | Instantaneous | ✓ |
| ritual / concentration | flags | ✓ |
| description | เนื้อหากฎเต็ม (รองรับหลายย่อหน้า) | ✓ |
| higherLevels | "เมื่อร่ายด้วยช่องเวทระดับสูงกว่า…" | ถ้ามี |
| classes | [Sorcerer, Wizard] | ✓ |

### 4.2 Item (การ์ดไอเทม)
| ฟิลด์ | ตัวอย่าง | บังคับแสดง |
|------|---------|:--:|
| name | Longsword | ✓ |
| type | weapon (martial melee) | ✓ |
| rarity | common | ✓ |
| properties (JSON) | { damage: "1d8 slashing", versatile: "1d10", weight: 3, cost: "15 gp" } | ✓ ถ้ามี |
| requiresAttunement | true/false | ✓ |
| description | คำบรรยาย/กฎพิเศษ | ถ้ามี |

### 4.3 Monster (statblock)
| ฟิลด์ | ตัวอย่าง | บังคับแสดง |
|------|---------|:--:|
| name | Goblin | ✓ |
| size / type / alignment | Small humanoid (goblinoid), neutral evil | ✓ |
| cr | 1/4 (+ XP ที่คำนวณได้) | ✓ |
| ac | 15 (leather armor, shield) | ✓ |
| hp | 7 (2d6) | ✓ |
| speed | 30 ft. | ✓ |
| abilityScores (STR..CHA) | 8/14/10/10/8/8 (+ modifier) | ✓ |
| savingThrows / skills | Stealth +6 | ถ้ามี |
| senses / languages | darkvision 60 ft.; Common, Goblin | ถ้ามี |
| damage/condition immunities/resistances | — | ถ้ามี |
| traits (JSON) | Nimble Escape | ถ้ามี |
| actions (JSON) | Scimitar, Shortbow (+ to-hit, damage) | ✓ |

### 4.4 UI Elements
- **Tab/segmented control:** Spells · Monsters · Items
- **Search input:** มี icon แว่นขยาย, ปุ่มล้าง (×), debounce ~150ms
- **Filter bar:** chips/dropdown ตามหมวด + ปุ่ม "Clear filters" + ตัวนับ "พบ N"
- **Result list:** virtualized/หรือ render เร็วได้ถึงหลายร้อยแถว; แต่ละแถวคลิกได้
- **Detail view:** spell card / item card / monster statblock (สไตล์การ์ดตาม DESIGN_SYSTEM — Cinzel หัวข้อ, JetBrains Mono ตัวเลข tabular)
- **License footer:** บรรทัดเครดิต SRD 5.1 (ดู §6.3)

---

## 5. Edge Cases & Exception Handling

| # | กรณี | พฤติกรรมที่ต้องการ |
|---|------|---------------------|
| 5.1 | คำค้นไม่ตรงอะไรเลย | แสดง empty state เป็นมิตร: "ไม่พบ '<คำค้น>' — ลองคำอื่นหรือล้างฟิลเตอร์" + ปุ่ม Clear |
| 5.2 | filter รวมกันจนเหลือ 0 ผล | เหมือน 5.1 แต่ชี้ว่าเกิดจากฟิลเตอร์ + ปุ่ม Clear filters |
| 5.3 | กำลังโหลดข้อมูลครั้งแรก | skeleton/loading state (ไม่ใช่หน้าว่างเปล่า) |
| 5.4 | deep-link ไป id ที่ไม่มี | หน้า 404 ในธีม: "ไม่พบรายการนี้" + ปุ่มกลับ Reference |
| 5.5 | ฟิลด์ optional ว่าง (เช่น มอนสเตอร์ไม่มี saving throws) | ซ่อนหัวข้อนั้น ไม่แสดงบรรทัดว่าง/"null" |
| 5.6 | properties/actions เป็น JSON เสีย/ไม่ครบ | render เท่าที่ parse ได้ ไม่ทำหน้าพัง (graceful) |
| 5.7 | คำค้นมีอักขระพิเศษ/regex | treat เป็น plain text (escape) — ไม่ให้ค้นพัง |
| 5.8 | เข้า Reference ทั้งที่ยังไม่ join แคมเปญ | redirect ไป /join (ตาม Foundation auth) |
| 5.9 | เน็ตหลุดกลางทาง | ไม่กระทบ — ข้อมูลมาจาก seed ในเครื่อง; การค้น/กรองทำฝั่ง client |
| 5.10 | มือถือจอแคบ | filter ยุบเป็น drawer/expandable; statblock อ่านได้ scroll เดียว |
| 5.11 | ชื่อซ้ำข้ามหมวด (เช่น item กับ spell ชื่อคล้าย) | แยกตามแท็บหมวด ไม่ปนกัน |

**ภาคผนวก — Future (ไม่ทำ v1):** Homebrew CRUD (entity ที่ scope ด้วย `campaignId`, แก้ไขได้), bookmark/favorite, ค้นข้ามหมวดพร้อมกัน (global search), ทอยจากการ์ด

---

## 6. Compliance & Non-Functional Requirements

### 6.1 Performance
- ข้อมูล seed อยู่ในเครื่อง → โหลดชุดของแต่ละหมวด **ครั้งเดียว** (ผ่าน REST route handler) แล้ว **ค้น/กรองฝั่ง client** ทั้งหมด → ผลกรอง **< 100ms** แม้มีหลายร้อยแถว
- ไม่ยิง request ต่อ keystroke (filter ใน memory); debounce เฉพาะ input
- รายการยาวต้อง render ลื่น (พิจารณา virtualization ถ้าเกิน ~500 แถว/หมวด)

### 6.2 Architecture alignment (บังคับ)
- **อ่านผ่าน REST/Next route handlers เท่านั้น** ไม่ใช้ socket.io — reference เป็น read-mostly ไม่ต้อง broadcast (ตาม ARCHITECTURE §API conventions)
- ข้อมูล **global ไม่ scope `campaignId`** (SRD ใช้ร่วมทุกแคมเปญ) แต่เข้าถึงได้เมื่ออยู่ใน session แล้ว
- Schema เพิ่มผ่าน **additive migration บน `foundation_baseline`** — ห้ามแก้ migration เดิม (ตาม DATA_MODEL discipline)
- Seed ทำผ่าน prisma seed script จากไฟล์ข้อมูล SRD 5.1 ในรีโป (เช็คอินได้ตามไลเซนส์)

### 6.3 Licensing & Attribution (สำคัญ)
- ใช้ **SRD 5.1** ภายใต้ **Creative Commons Attribution 4.0 (CC-BY-4.0)** — เผยแพร่/แก้/แจกได้ ตราบใดที่ให้เครดิต
- ต้องมี **บรรทัดเครดิตในแอป** (footer หน้า Reference) เช่น: *"This work includes material from the System Reference Document 5.1 by Wizards of the Coast LLC, available under the Creative Commons Attribution 4.0 International License."*
- เก็บไฟล์ไลเซนส์/แหล่งที่มาไว้ในรีโป (เช่น `prisma/seed/SRD-5.1-CC-BY-4.0.md` หรือ note ใน seed) — `/sa` ระบุที่เก็บจริง
- **เฉพาะเนื้อหา SRD 5.1** เท่านั้น (เนื้อหานอก SRD ไม่เปิดสิทธิ์ — ไม่นำเข้า)

### 6.4 a11y & UX (inherit DESIGN_SYSTEM)
- คอนทราสต์ผ่าน AA, โฟกัสคีย์บอร์ดชัด, ตัวเลข statblock ใช้ tabular-nums (JetBrains Mono)
- แท็บ/ฟิลเตอร์เข้าถึงด้วยคีย์บอร์ดได้; detail มี heading hierarchy ที่ screen reader อ่านรู้เรื่อง

### 6.5 Privacy
- ไม่มีข้อมูลส่วนบุคคลในโมดูลนี้ (เป็นข้อมูลกฎเกม) — ไม่มีประเด็น PDPA/GDPR เพิ่มจาก Foundation

---

## ✅ Definition of Done (เกณฑ์รับงาน Sprint 1)
1. Seed SRD 5.1 ครบ 3 หมวด (spells/items/monsters) เข้า DB ผ่าน additive migration + seed script
2. ผู้ใช้ใน session ค้นหา + กรอง ได้ครบทั้ง 3 หมวดตาม §3.3
3. เปิดดูได้: spell card, item card, monster statblock เต็มรูปแบบตาม §4
4. Empty/loading/no-result/404 states ครบตาม §5
5. เครดิต CC-BY-4.0 แสดงในแอป (§6.3)
6. ค้น/กรอง < 100ms, ออฟไลน์ได้ (§6.1)
7. ทำงานบนเดสก์ท็อปและมือถือ (responsive)
