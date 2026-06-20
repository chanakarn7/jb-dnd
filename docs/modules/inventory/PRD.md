# PRD — Inventory (Sprint 3)
### D&D Campaign Manager · module 4 of 8 · `/ba` (Stage 1)

> ผู้เล่นจัดการ "ของในกระเป๋า" ของตัวละครตัวเอง: หยิบไอเทม SRD มาใส่ตัวละคร, ตั้งจำนวน, สวมใส่ (equip), ผูกพลัง (attune ภายในเพดาน 3 ชิ้นตามกติกา 5e) และจัดการเงิน (pp/gp/ep/sp/cp).
> **Module นี้ต่อยอดของเดิม — ไม่ออกแบบตารางใหม่ซ้ำ.** `CharacterItem` (join Character↔Item) เป็นของ Inventory; `Character.currency` เป็น additive column. ทุกอย่างผ่าน **additive migration เดียว** บน schema ที่ Sprint 0/1/2 วางไว้.
> Inputs: [DATA_MODEL](../../program/DATA_MODEL.md) (`#character`, `#item`, `#characteritem`), [ARCHITECTURE](../../program/ARCHITECTURE.md), [DESIGN_SYSTEM](../../program/DESIGN_SYSTEM.md).

---

## 1. Feature Overview & KPIs

### 1.1 ปัญหา & คุณค่า
ตอนนี้ตัวละคร (Sprint 2) มี class/race/spells แต่ **ไม่มีของติดตัว** — ไม่มีอาวุธ เกราะ ของวิเศษ หรือเงิน. Inventory เติมส่วนนี้: ผูกไอเทมจาก SRD reference (Sprint 1) เข้ากับตัวละคร ให้เล่นจริงได้ (รู้ว่าถือดาบอะไร ใส่เกราะอะไร AC เท่าไหร่ มีเงินเท่าไหร่).

### 1.2 ขอบเขตแบบสั้น
- **In:** เพิ่ม/ลบไอเทม SRD เข้าตัวละคร, ตั้ง `quantity`, toggle `equipped`, toggle `attuned` (กติกา attunement), จัดการเงิน 5 สกุล. ผู้เล่นทำได้เฉพาะตัวละครของตัวเอง; DM ทำได้ทุกตัวในแคมเปญ (รวม NPC).
- **Out (non-goals):** ดูข้อ §1.4.

### 1.3 KPIs / Success Metrics
| KPI | เป้า |
|-----|------|
| ผูกไอเทม SRD เข้าตัวละครได้ครบทุก type (weapon/armor/gear/tool) | 100% ของ ~599 SRD items เพิ่มได้ |
| Attunement cap บังคับถูกต้อง (ไม่เกิน 3, เฉพาะ item ที่ต้อง attune) | 0 ครั้งที่หลุดกติกา |
| Regression: Foundation + Sprint 1 + Sprint 2 tests | เขียวทั้งหมด (additive migration) |
| Authz: ผู้เล่นแก้ของคนอื่นไม่ได้ | 100% block (403) server-side |

### 1.4 Non-Goals (อยู่นอกขอบเขต v1 — อย่าสร้าง)
1. **Carrying capacity / encumbrance (น้ำหนักแบก).** ดึง `weight` จาก `Item.propertiesJson` มา **แสดงผลรวมน้ำหนักได้ (display-only, stretch)** แต่ **ไม่บังคับกฎ** strength×15 / encumbered variant. ไม่บล็อกการเพิ่มของเพราะหนักเกิน.
2. **Homebrew / custom item** — เพิ่มได้เฉพาะไอเทมที่มีใน SRD `Item` table. ตารางไอเทม campaign-scoped เป็นงานอนาคต (ดู DATA_MODEL `#item` หมายเหตุ).
3. **Auto AC / auto damage จากการ equip** — การ toggle `equipped` เก็บสถานะไว้เฉย ๆ; การคำนวณ AC จากเกราะที่สวมเป็นงาน Combat/Character ภายหลัง (ไม่ recompute `Character.ac` ใน sprint นี้). v1 = บันทึกว่าสวมอะไร.
4. **Buy/sell economy, shop, loot table generation** — เงินแก้มือ; ระบบซื้อขาย/สร้างของจาก loot เป็น AI (Sprint 7) + Story.
5. **Realtime broadcast** — Inventory เป็น prep-time CRUD ผ่าน REST ไม่ใช่ Socket.io intent. การ sync สด ๆ ระหว่างเล่นไม่อยู่ใน sprint นี้.
6. **Container / nested bag (ของในกระเป๋าในกระเป๋า), starting-equipment auto-grant จาก background/class** — ไม่อยู่ใน v1.

---

## 2. Target Platforms & User Roles

**Platform:** Responsive Web (เดสก์ท็อป + มือถือ) — หน้า inventory ฝังในหน้า character sheet ที่มีอยู่ (`/characters`), inherit DESIGN_SYSTEM tokens.

| Role | สิทธิ์ใน Inventory |
|------|---------------------|
| **Player** | จัดการ inventory + เงิน ของ **ตัวละครที่ตัวเอง claim เท่านั้น** (อ่าน/เขียน). ตัวละครอื่น = อ่านไม่ได้/เขียนไม่ได้ผ่าน API นี้ (อย่างน้อยเขียนไม่ได้ = 403). |
| **DM** | จัดการ inventory + เงิน ของ **ทุกตัวละครในแคมเปญตัวเอง** รวม NPC (`isNpc=true`, `ownerSessionId=null`). |
| **ข้ามแคมเปญ** | ห้ามเด็ดขาด — ทุก query scope ด้วย `campaignId`; ตัวละคร/ไอเทมนอกแคมเปญ = 404. |

> Authz re-derive จาก session token ฝั่ง server เสมอ (`resolveSession` → `canWrite`); ไม่เชื่อ `ownerSessionId`/role ใน payload. Pattern เดียวกับ Sprint 2.

---

## 3. User Stories & Functional Workflows

### 3.1 User Stories
- **US-1 (Player) เพิ่มไอเทม:** ในฐานะผู้เล่น ฉันค้นไอเทมจาก SRD (เช่น "Longsword") แล้วกดเพิ่มเข้าตัวละครฉัน เพื่อให้ sheet แสดงว่าฉันถือมัน.
- **US-2 (Player) ตั้งจำนวน:** ฉันตั้ง `quantity` ของไอเทมที่ stack ได้ (เช่น Arrows ×20, Potion ×3).
- **US-3 (Player) สวมใส่:** ฉัน toggle equip/unequip อาวุธหรือเกราะ เพื่อบอกว่าตอนนี้ถืออะไรอยู่.
- **US-4 (Player) attune:** ฉัน attune ของวิเศษที่ต้องผูกพลัง — ระบบยอมให้ไม่เกิน 3 ชิ้น และเฉพาะของที่ `requiresAttunement=true`.
- **US-5 (Player) ลบไอเทม:** ฉันลบไอเทมออกจากตัวละคร (ทิ้ง/ใช้หมด).
- **US-6 (Player) เงิน:** ฉันตั้ง/ปรับเงิน 5 สกุล (pp/gp/ep/sp/cp) ของตัวละครฉัน.
- **US-7 (DM) จัดการ NPC gear:** ในฐานะ DM ฉันจัดการ inventory/เงินของ NPC หรือของผู้เล่นคนใดก็ได้ในแคมเปญฉัน.

### 3.2 Workflow — เพิ่ม + จัดการไอเทม (happy path)
1. ผู้เล่นเปิด character sheet ตัวเอง → แท็บ/ส่วน **"ของในกระเป๋า" (Inventory)**.
2. กด "เพิ่มไอเทม" → modal ค้น SRD items (debounced search, filter ตาม type/rarity — reuse reference list API).
3. เลือกไอเทม → `POST /api/characters/[id]/items { itemSlug, quantity? }`.
4. Server: `resolveSession` → `canWrite(character)` → validate `itemSlug` มีจริงใน `Item` (ไม่งั้น 404) → upsert `CharacterItem` (ถ้ามี slug เดิม + stackable → เพิ่ม quantity; ดู §5.13) → return inventory ใหม่.
5. UI render รายการ: ชื่อ, type, qty, ปุ่ม equip toggle, ปุ่ม attune toggle (เฉพาะของที่ `requiresAttunement`), ปุ่มลบ.
6. equip/attune/qty → `PATCH /api/characters/[id]/items/[itemId] { equipped?, attuned?, quantity? }`; ลบ → `DELETE`.
7. เงิน → `PATCH /api/characters/[id] { currency: {pp,gp,ep,sp,cp} }` (reuse character update route) หรือ endpoint เฉพาะ — `/sa` ตัดสิน.

### 3.3 Attunement flow (กติกา 5e)
- ปุ่ม attune แสดงเฉพาะไอเทมที่ `requiresAttunement=true`.
- กด attune: ถ้าตอนนี้ attuned < 3 → set `attuned=true`. ถ้า = 3 แล้ว → block + ข้อความ "attune ได้สูงสุด 3 ชิ้น (กำลังผูกอยู่ 3)".
- ตัวนับ "Attuned 2/3" แสดงบนหัวส่วน inventory.
- unattune ได้เสมอ (ลดตัวนับ).

---

## 4. Data Dictionary & UI Elements

> **อ้างอิง [DATA_MODEL](../../program/DATA_MODEL.md) — ไม่ออกแบบซ้ำ.** `/sa` จะ finalize คอลัมน์ + เขียน migration.

### 4.1 `CharacterItem` (ใหม่ — Inventory เป็นเจ้าของ)
| Field | Type | หมายเหตุ |
|-------|------|----------|
| `id` | String | PK cuid |
| `campaignId` | String | denormalized tenant scope (indexed) — pattern เดียวกับ `CharacterSpell` |
| `characterId` | String | FK→Character (onDelete cascade), indexed |
| `itemSlug` | String | **soft-ref → GLOBAL `Item.slug`** (Sprint 1) — slug ไม่ใช่ id (เสถียรข้าม reseed) |
| `quantity` | Int | default 1, ต้อง ≥ 1 |
| `equipped` | Boolean | default false |
| `attuned` | Boolean | default false |

- **@@unique / stacking:** `/sa` ตัดสิน `@@unique([characterId, itemSlug])` (stack รวมแถวเดียว) vs อนุญาตหลายแถว. PRD แนะนำ **unique → stack ด้วย `quantity`** (ดู §5.13) เพราะ UX ง่ายกว่าและตรงกับ 5e (ของชนิดเดียวกันนับรวม). บันทึก rationale ใน SA.

### 4.2 `Character.currency` (additive column)
- เงิน 5 สกุล D&D: **pp** (platinum), **gp** (gold), **ep** (electrum), **sp** (silver), **cp** (copper).
- `/sa` ตัดสิน: **JSON column เดียว** `currencyJson` `{pp,gp,ep,sp,cp}` (แนะนำ — ตรงกับ pattern JSON column ทั้งโปรเจกต์, additive ง่าย, default `{}`/`{pp:0,...}`) vs 5 Int columns. บันทึกใน DATA_MODEL.
- ทุกสกุล ≥ 0 (validate app-side).

### 4.3 ข้อมูลที่ "อ่าน" จากของเดิม (ไม่แก้)
- `Item` (Sprint 1, GLOBAL): `slug`, `name`, `type`, `rarity`, `requiresAttunement`, `propertiesJson` (`{damage, weight, cost, armorClass, …}`), `description`. ใช้ resolve ชื่อ/ประเภท/แสดง weight·cost.
- `Character` (Sprint 2): `id`, `campaignId`, `ownerSessionId` (authz), `isNpc`.

### 4.4 UI elements (ฝังใน character sheet)
- ส่วน **Inventory**: หัวข้อ + ตัวนับ "Attuned X/3" + ปุ่ม "เพิ่มไอเทม".
- รายการไอเทม: ชื่อ (คลิกดู detail/tooltip), badge type/rarity, stepper `quantity`, toggle Equipped, toggle Attuned (เฉพาะ attunement item, disabled+tooltip ถ้าเต็ม cap), ปุ่มลบ (confirm).
- **Add-item modal:** ค้น + filter SRD items (reuse `/api/reference/items` list), แสดง requiresAttunement badge.
- ส่วน **Currency:** 5 ช่อง pp/gp/ep/sp/cp (number input ≥0), แสดง gp รวมโดยประมาณ (display-only, optional).
- States: empty ("ยังไม่มีของในกระเป๋า"), loading, validation, 403/404 toast.

---

## 5. Edge Cases & Exception Handling

| # | สถานการณ์ | ผลที่คาดหวัง |
|---|-----------|----------------|
| 5.1 | attune ไอเทมที่ `requiresAttunement=false` | **block** — 422 `{error:"not_attunable"}`; UI ไม่แสดงปุ่ม attune ตั้งแต่แรก |
| 5.2 | attune ชิ้นที่ 4 (มี attuned 3 อยู่แล้ว) | **block** — 422 `{error:"attunement_limit"}`; ข้อความ "สูงสุด 3 ชิ้น" |
| 5.3 | เพิ่มไอเทมที่ `itemSlug` ไม่มีใน SRD | **404** `{error:"not_found"}` — ไม่สร้างแถว |
| 5.4 | `quantity` ≤ 0 หรือไม่ใช่จำนวนเต็ม | **422** `{error:"invalid_quantity"}`; (quantity=0 ผ่าน PATCH → ตีความเป็น "ลบ" ได้ — /sa ตัดสิน, default คือ reject แล้วให้ใช้ DELETE) |
| 5.5 | ผู้เล่นแก้ inventory ของตัวละครคนอื่น | **403** — `canWrite` false; server re-derive owner จาก token ไม่เชื่อ payload |
| 5.6 | ลบไอเทมชิ้นสุดท้าย | สำเร็จ → inventory ว่าง → render empty state (ไม่ error) |
| 5.7 | ตั้งเงินติดลบ (เช่น gp = -5) | **422** `{error:"invalid_currency"}`; clamp ไม่ได้เพราะเจตนาผิด → reject |
| 5.8 | `propertiesJson` / reference column ของ Item พัง (malformed JSON) | render เท่าที่ parse ได้, ไม่ crash (reuse `parseJson` fallback, PRD edge ของ Sprint 1 §5.6) — เพิ่ม/แสดงไอเทมยังทำได้ |
| 5.9 | DM แก้ inventory ผู้เล่น/NPC ในแคมเปญตัวเอง | **อนุญาต** (200) — `canWrite` true สำหรับ DM ทุกตัวในแคมเปญ |
| 5.10 | แก้ inventory ของตัวละครข้ามแคมเปญ (token แคมเปญ A, ตัวละครแคมเปญ B) | **404** (scope mismatch — ไม่เผยว่ามีตัวตน) |
| 5.11 | แก้ไขพร้อมกัน 2 แท็บ (concurrent) — toggle attune ชนกันจนเกิน cap | server ตรวจ cap **ใน transaction ตอนเขียน** (นับ attuned ปัจจุบันใน DB) → แท็บที่ทำให้เกินถูก reject 422; ไม่เชื่อสถานะที่ client ส่งมา |
| 5.12 | unattune/unequip ของที่ไม่ได้ attuned/equipped อยู่แล้ว | idempotent — สำเร็จ (no-op), สถานะคงเดิม |
| 5.13 | เพิ่มไอเทม slug เดิมซ้ำ (stackable) | upsert: รวม `quantity` ในแถวเดิม (ตาม `@@unique`); ไม่สร้างแถวซ้ำ |
| 5.14 | ตัวละครถูกลบ (DM ลบ PC/NPC) | `CharacterItem` ถูกลบตามด้วย FK `onDelete: Cascade` — ไม่มีแถวกำพร้า |
| 5.15 | ไอเทมถูกลบ/เปลี่ยน slug จาก reseed SRD (ทางทฤษฎี) | soft-ref by slug; ถ้า slug หาย ไอเทมในกระเป๋าแสดงชื่อ slug + "(ไม่พบใน reference)" แทน crash — graceful |
| 5.16 | ไม่ได้อยู่ใน session (ไม่มี token / token พัง) | **401** `{error:"unauthorized"}`; UI redirect /join |

---

## 6. Compliance & Non-Functional Requirements

- **Authz (ย้ำ):** ทุก endpoint re-derive actor + ownership จาก session token ฝั่ง server (`resolveSession` → `canWrite`). ไม่มี endpoint ไหนเชื่อ `ownerSessionId`/`role`/`campaignId` ที่ client ส่ง. 401/403/404/422 ตามตาราง §5.
- **Multi-tenancy:** ทุก query ใส่ `where:{campaignId}`; `CharacterItem.campaignId` denormalized เพื่อ scope ตรง ไม่ต้อง join ข้ามเสมอ.
- **Determinism (no LLM):** กติกา attunement (cap 3, requiresAttunement gate), การ validate quantity/currency = **โค้ด deterministic** ใน `lib/`, ทดสอบด้วย vitest. ไม่เรียก LLM.
- **Migration discipline:** **single additive migration** (`inventory`): `CREATE TABLE CharacterItem` + `ALTER TABLE Character ADD currency`. ห้าม destructive rewrite. Foundation/Sprint 1/Sprint 2 schema คงเดิม.
- **Reference reuse:** ค้นไอเทมใช้ reference API/repo เดิม (Sprint 1) — ไม่ทำ index/cache ใหม่.
- **Offline:** ทำงานเต็มรูปแบบโดยไม่ต้องต่อเน็ต (SRD seeded local; REST local).
- **Responsive:** inherit breakpoints จาก DESIGN_SYSTEM; ส่วน inventory ยุบเป็น accordion บนจอแคบ.
- **Privacy:** ไม่มี PII ใหม่; ข้อมูลเป็น game state ใต้ campaign.

---

## Definition of Done (acceptance criteria)
1. **Additive migration `inventory`**: `CharacterItem` table (FK→Character cascade, soft-ref `itemSlug`, `@@unique([characterId,itemSlug])`, indexed `campaignId`) + `Character.currency` (additive). ไม่มี destructive change.
2. **Regression gate:** Foundation + Sprint 1 (5e Reference) + Sprint 2 (Characters) tests **เขียวทั้งหมด** หลัง migration + โค้ดใหม่.
3. **Player เพิ่มไอเทม SRD** เข้าตัวละครตัวเองได้ (ค้น → เลือก → เพิ่ม), ไอเทมที่ไม่มีใน SRD → 404.
4. **ตั้ง quantity / equip / unequip** ได้; quantity ≤ 0 → 422; equip เป็น per-character toggle.
5. **Attunement กติกา 5e ถูกต้อง:** attune เฉพาะ `requiresAttunement` item (อื่น → 422), เพดาน 3 ชิ้น (ชิ้นที่ 4 → 422), unattune ได้เสมอ, cap ตรวจใน transaction (กัน concurrent).
6. **Currency** จัดการได้ครบ 5 สกุล, ค่าติดลบ → 422.
7. **ลบไอเทม** ได้, ลบชิ้นสุดท้าย → empty state, ตัวละครถูกลบ → CharacterItem cascade.
8. **Authz server-side:** player แก้ได้เฉพาะตัวละครตัวเอง (อื่น → 403), DM แก้ได้ทุกตัวในแคมเปญ, ข้ามแคมเปญ → 404, ไม่มี session → 401 — re-derived จาก token ไม่ใช่ payload.
9. **States ครบ:** empty / loading / validation / 403 / 404; attunement counter "X/3"; ของวิเศษมี badge requiresAttunement.
10. **DATA_MODEL.md amended:** `CharacterItem` finalized (จาก stub), `Character.currency` บันทึกเป็น cross-module additive column พร้อมหมายเหตุ Sprint 3.
11. **Determinism + tests:** กฎ inventory (attunement/quantity/currency validation) มี unit test (vitest) ครอบ edge §5; ไม่เรียก LLM.

> **Stretch (ไม่บังคับ DoD):** แสดงน้ำหนักรวม (weight จาก `propertiesJson`) แบบ display-only. ไม่บังคับ encumbrance.
