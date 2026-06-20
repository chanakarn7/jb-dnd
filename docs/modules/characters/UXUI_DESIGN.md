# UXUI Design — Characters (Sprint 2)

> เลย์เอาต์ & หน้าจอ **เฉพาะโมดูล Characters** สร้างจาก design system ที่ล็อกไว้ที่ program
> **Inherit (ห้ามแก้):** [DESIGN_SYSTEM.md](../../program/DESIGN_SYSTEM.md) — tactical fantasy console (dark, Cinzel หัวข้อ, Inter body, **JetBrains Mono ทุกตัวเลข tabular**, gold `--accent`, tokens `--bg/--surface/--surface-raised/--border/--text*/--hp/--heal/--arcane`). เอกสารนี้ **ไม่สร้าง palette/font ใหม่**
> **Input:** [PRD](./PRD.md) · [SA_BLUEPRINT](./SA_BLUEPRINT.md)

## 0. หลักการ UX ของโมดูลนี้
- **ลดภาระคิดเลข:** auto-fill ทำงานเงียบ ๆ; ผู้ใช้เห็นผลลัพธ์ ไม่ใช่สูตร — แต่ทุกค่า derived มี **badge `auto`** + ดินสอ ให้รู้ว่าแก้ทับได้
- **Progressive disclosure:** wizard ทีละขั้น (Miller's Law — ไม่เททุก field พร้อมกัน); sheet จัด section ชัด
- **Glanceable combat numerics:** HP/AC ตัวใหญ่ (32–48px) JetBrains Mono tabular — อ่านข้ามโต๊ะได้ (สืบทอดเหตุผลจาก DESIGN_SYSTEM)
- **color-not-only:** proficiency = **dot ทึบ ● + ตัวหนา** (ไม่ใช่แค่สี); override = **ไอคอนดินสอ + เส้นใต้ประ** ไม่พึ่งสี
- **one primary CTA/จอ:** wizard = "ถัดไป"/"สร้างตัวละคร" (gold); sheet = ปุ่มแก้รอง

---

## 1. Route map (หน้าจอในโมดูล)
| Route | หน้าจอ | ใคร |
|---|---|---|
| `/characters` | รายการตัวละคร (ของฉัน + ปาร์ตี้ + NPC ถ้า DM) / empty state | ทุก seat |
| `/characters/new` | Create wizard (7 ขั้น) | player / DM(NPC) |
| `/characters/[id]` | Character Sheet (อ่าน/แก้ของตัวเอง) | เจ้าของ/DM เต็ม, อื่น ๆ สรุป |

ทุกหน้าอยู่ใต้ session guard เดียวกับ lobby (ไม่มี seat → `/join`).

---

## 2. หน้า `/characters` — รายการ

```
┌─────────────────────────────────────────────┐
│  ⚔ ตัวละคร            [+ สร้างตัวละคร] (gold) │  ← h1 Cinzel
├─────────────────────────────────────────────┤
│  ของฉัน                                       │
│  ┌───────────────────────────────────────┐   │
│  │ ●Thorin   Lv 3  Mountain Dwarf Fighter │   │  ← การ์ด: ชื่อ Cinzel, meta Inter muted
│  │ (Champion)        HP 28/28   AC 16     │   │     ตัวเลข Mono tabular; HP bar เส้นบาง
│  └───────────────────────────────────────┘   │
│                                               │
│  ปาร์ตี้ (อ่านสรุป)                            │
│  • Lyra  Lv 3 Half-Elf Bard          HP 21   │  ← แถวสรุป คลิกดู detail แบบ read
│  • Grix  Lv 2 Half-Orc Barbarian     HP 26   │
│                                               │
│  NPC (เฉพาะ DM)                     [+ NPC]   │
│  • Old Sage  Lv 5 Human Wizard               │
├─────────────────────────────────────────────┤
│  SRD 5.1 (CC-BY-4.0) · +community OGL/CC     │  ← attribution footer
└─────────────────────────────────────────────┘
```
- **การ์ด "ของฉัน"** เด่นสุด (surface-raised + เส้น gold ซ้าย 3px); ปาร์ตี้/NPC เป็นแถว compact
- **HP bar:** เส้นบาง 4px, `--heal`→`--warning`→`--hp` ตามสัดส่วน + ตัวเลข `cur/max` Mono (ไม่พึ่งสีอย่างเดียว — มีเลขกำกับ)
- **Empty state** (ยังไม่มีตัวละคร): ไอคอน Lucide `user-plus` จาง + "ยังไม่มีตัวละคร — สร้างตัวแรกของคุณ" + ปุ่ม gold ปุ่มเดียวกลางจอ

---

## 3. Create Wizard `/characters/new`

### 3.1 โครงเลย์เอาต์ (เดสก์ท็อป — 2 คอลัมน์)
```
┌──────────────────────────────────────────────────────────┐
│ Stepper:  ①Race ②Class ③Subclass ④Background ⑤Abilities  │  ← ขั้นทำแล้ว=gold tick,
│           ⑥Skills ⑦Details                                │     ปัจจุบัน=gold ring, ยัง=faint
├────────────────────────────┬─────────────────────────────┤
│  ฟอร์มขั้นปัจจุบัน (ซ้าย 60%) │  PREVIEW (ขวา 40%, sticky)   │
│                            │  ┌─────────────────────────┐ │
│  [เนื้อหาแต่ละขั้น]          │  │ Thorin (ร่าง)           │ │  ← การ์ดสรุปสด
│                            │  │ Mountain Dwarf · Fighter │ │     อัปเดตทุกครั้งที่เลือก
│                            │  │ HP 12  AC 12  Speed 25  │ │     ตัวเลข Mono
│                            │  │ STR16 DEX13 CON15 …     │ │
│                            │  └─────────────────────────┘ │
├────────────────────────────┴─────────────────────────────┤
│  [← ย้อนกลับ]                         [ถัดไป →] (gold)     │  ← Next disabled จนขั้นนี้ valid
└──────────────────────────────────────────────────────────┘
```
- **Preview panel** = `CharacterSheetMini` ใช้ rules engine คำนวณสดจากที่เลือกไปแล้ว (ค่าที่ยังไม่เลือก = `—`)
- **Stepper** เดินด้วยคีย์บอร์ดได้; ขั้นที่ valid แล้วคลิกย้อนได้

### 3.2 เนื้อหาแต่ละขั้น
| ขั้น | UI | validation gate |
|---|---|---|
| ① Race | grid การ์ด race (+subrace ขยายใต้); การ์ดโชว์ ability bonus chips, speed, 1-line trait | เลือก 1 race |
| ② Class | grid การ์ด 12 คลาส; การ์ดโชว์ hit die (d10), saves (STR/CON), "Spellcaster"/"Martial" tag | เลือก 1 class |
| ③ Subclass | การ์ด subclass ของคลาสนั้น + ป้าย source/license (`SRD` / `OGL`); ถ้า level < subclassLevel → **ข้าม + แบนเนอร์** "ปลดล็อกที่ Lv N" ; ถ้าไม่มี subclass เปิด → empty note | (optional ถ้ายังไม่ถึง level) |
| ④ Background | dropdown/การ์ด; โชว์ skill proficiency ที่จะได้ + feature | เลือก 1 |
| ⑤ Abilities | tab `Standard Array` / `Point-Buy` (ดู §4) | array ครบ 6 / point-buy ใช้ ≤27 |
| ⑥ Skills/Choices | checkbox skill ตามจำนวนที่ได้ (ตัวนับ "เลือก 2/4"); fighting style ฯลฯ ถ้ามี | เลือกครบจำนวน |
| ⑦ Details | ชื่อ (required), alignment, level เริ่ม (default 1, stepper 1–20), caster→เลือกเวทเริ่ม | ชื่อไม่ว่าง |

> **คำอธิบายประกอบ (helper text) ในแต่ละขั้น:** ③ Subclass = การ์ดแสดง `description` (เล่นแนวไหน) ใต้ชื่อ + chip แหล่ง/license · ⑤ Abilities = panel "ℹ️ ค่าพลังแต่ละตัวคืออะไร?" (กางได้) อธิบาย 6 ค่าพลัง · ⑥ Skills = ใต้ checkbox แต่ละ skill มีค่าพลังที่กำกับ (chip) + คำอธิบาย 1 บรรทัด. แหล่ง: Ability/Skill = `lib/characters/glossary.ts` (SRD CC-BY); Subclass = `Subclass.description`.

---

## 4. Abilities widgets (ขั้น ⑤)

### 4.1 Standard Array
```
ค่าให้ใช้:  [15] [14] [13] [12] [10] [8]   ← chip ที่ใช้แล้ว = จาง + ✓
┌────┬────┬────┬────┬────┬────┐
│STR │DEX │CON │INT │WIS │CHA │
│[15▾]│[13▾]│[14▾]│[8▾]│[12▾]│[10▾]│  ← dropdown เลือกจาก pool; กันเลือกซ้ำ
│ +2 │ +1 │ +2 │ -1 │ +1 │ +0 │  ← modifier สด (Mono) + เงา race bonus เช่น "+2(เผ่า)"
└────┴────┴────┴────┴────┴────┘
```
- เลือกซ้ำไม่ได้ (ค่าที่ใช้หายจาก pool ช่องอื่น); ครบ 6 → ขั้น valid

### 4.2 Point-Buy
```
แต้มคงเหลือ:  [ 27 → 5 ]  ← ตัวนับ Mono เด่น; แดง --hp ถ้าติดลบ
┌────┬─────────┬────┐
│STR │ − [15] + │ +2 │  ← ปุ่ม −/+; กันออกนอก 8–15; ปุ่ม + disabled ถ้าแต้มไม่พอ
│DEX │ − [10] + │ +0 │
│ …  │          │    │
└────┴─────────┴────┘
ต้นทุน: 8–13 = ค่าละ1/แต้ม, 14=7, 15=9 (ตาราง PHB)
```
- เกิน budget → ปุ่ม + disabled + ข้อความ "แต้มไม่พอ" (ไม่ปล่อยให้ submit)

---

## 5. Character Sheet `/characters/[id]`

### 5.1 เลย์เอาต์ (เดสก์ท็อป)
```
┌──────────────────────────────────────────────────────────┐
│  Thorin                                  [⚙ แก้] [⋯]      │  ← ชื่อ Cinzel ใหญ่
│  Lv 3 · Mountain Dwarf · Fighter (Champion) · Soldier     │  ← meta muted
├──────────────────────────────────────────────────────────┤
│  COMBAT (แถบ HUD ตัวเลขใหญ่)                                │
│   ┌──────┐ ┌────┐ ┌──────┐ ┌────────┐                     │
│   │  HP  │ │ AC │ │SPEED │ │ INIT   │                     │
│   │28/28 │ │ 16 │ │ 25ft │ │  +1    │  ← Mono 32–48px      │
│   │auto✎ │ │auto│ │ auto │ │ auto   │  ← badge มุมขวาบน    │
│   └──────┘ └────┘ └──────┘ └────────┘                     │
├───────────────────────────┬──────────────────────────────┤
│  CORE                      │  FEATURES (ราย level)         │
│  Ability block (statblock) │  Lv1 · Fighting Style ▸       │
│  ┌────┐┌────┐┌────┐        │  Lv1 · Second Wind ▸          │
│  │STR ││DEX ││CON │        │  Lv2 · Action Surge ▸         │
│  │ 16 ││ 13 ││ 15 │        │  Lv3 · Improved Critical ▸    │ ← จาก subclass
│  │ +3 ││ +1 ││ +2 │        │  (race) Darkvision ▸          │
│  └────┘└────┘└────┘        │  (bg)  Military Rank ▸        │
│  Saves:  ●STR+5 ●CON+4     │                              │
│          ○DEX+1 ○INT-1 …   │  SPELLS (ถ้า caster)          │
│  Skills: ●Athletics +5     │  [ตัวอย่าง: Fighter = ซ่อน]   │
│          ●Intimidation +3  │                              │
│          ○Acrobatics +1 …  │                              │
└───────────────────────────┴──────────────────────────────┘
│  SRD 5.1 (CC-BY-4.0) · community subclasses: OGL/CC        │
```

### 5.2 รายละเอียดส่วนประกอบ
- **Ability block:** การ์ดสไตล์ statblock (สืบทอดจาก MonsterStatblock ของ Sprint 1) — score ใหญ่ Mono + modifier เด่นใต้ + เส้น gold คั่น
- **Saves/Skills rows:** `●` ทึบ = proficient (+ ตัวหนา), `○` กลวง = ไม่ proficient — **dot + weight ไม่พึ่งสี**; mod เป็น Mono tabular ชิดขวาให้คอลัมน์ตรง; **hover/focus = tooltip คำอธิบาย** (ability ทำอะไร / skill คืออะไร) จาก glossary
- **Ability block:** hover แสดง tooltip คำอธิบายค่าพลัง (จาก `ABILITY_INFO`)
- **HP block:** แก้ได้ inline (ดินสอ) — แต่ **หมายเหตุ:** การเปลี่ยน HP ระหว่าง combat จริงเป็นของ Combat S4 (socket); ที่นี่คือ prep-edit (REST PATCH)
- **Features:** accordion ราย item; ป้ายแหล่ง (class/subclass/race/bg) chip เล็ก; คลิกกาง desc
- **Spells:** ตาราง known/prepared toggle; ชื่อเวทลิงก์ไป `/reference/spells/[slug]` (Sprint 1) เปิด spell card

### 5.3 Override affordance (สำคัญ)
- ค่า derived ทุกตัวมี **`auto` badge** (chip จิ๋ว muted) + **ดินสอ** เมื่อ hover/focus
- กดดินสอ → inline edit; เมื่อ override แล้ว: badge เปลี่ยนเป็น **`แก้เอง`** (gold underline ประ) + ปุ่ม **↺ คืนค่าอัตโนมัติ**
- เปลี่ยน level → ค่า `auto` recompute (มี toast "อัปเดตค่าตามเลเวลใหม่"); ค่า `แก้เอง` ไม่ขยับ + เตือนถ้ากฎใหม่ต่างจากที่แก้

---

## 6. System States
| State | UI |
|---|---|
| Loading (sheet/list) | skeleton การ์ด/แถว (เหมือน Sprint 1) ไม่ใช่จอว่าง |
| Empty (ไม่มีตัวละคร) | §2 — ไอคอน + ปุ่มสร้างปุ่มเดียว |
| Validation (point-buy เกิน / array ไม่ครบ / ชื่อว่าง) | inline ใต้ field + ปุ่มถัดไป/สร้าง disabled (ไม่ใช้ toast อย่างเดียว) |
| 403 (แก้ตัวคนอื่น) | หน้า "คุณแก้ตัวละครนี้ไม่ได้ — ดูได้อย่างเดียว" + ปุ่มกลับ |
| 404 (id ไม่มี) | หน้าธีม "ไม่พบตัวละคร" + กลับ `/characters` (เหมือน 404 ของ Sprint 1) |
| Saving | ปุ่ม spinner + optimistic; error → toast `--hp` + rollback |

---

## 7. Responsive
- **มือถือ (375–767):** wizard = **1 ขั้นเต็มจอ**, preview ยุบเป็นแถบสรุปบนสุด (collapsible); stepper เป็น dots; ปุ่ม Back/Next ตรึงล่าง (thumb zone, Fitts's Law)
- **Sheet มือถือ:** COMBAT HUD เป็นแถวบนสุด (scroll แนวนอนได้); CORE/FEATURES/SPELLS เป็น **accordion** เปิดทีละส่วน
- **แท็บเล็ต (768–1023):** wizard 2 คอลัมน์เริ่มทำงาน; sheet 1 คอลัมน์กว้าง
- **เดสก์ท็อป (≥1024):** ตามภาพด้านบน (`max-w-7xl`)

---

## 8. Components ใหม่ของโมดูล (สร้างจาก token เดิม)
| Component | ใช้ที่ | หมายเหตุ |
|---|---|---|
| `Stepper` | wizard | ขั้น tick/active/faint, keyboard nav |
| `AbilityBlock` | sheet + preview | statblock-style score+mod (รียูสแนวจาก Sprint 1) |
| `ProficiencyRow` | saves/skills | dot ●/○ + weight + Mono mod |
| `PointBuyGrid` / `StandardArrayGrid` | wizard ⑤ | ตัวนับ/กันซ้ำ |
| `AutoBadge` + `OverrideControl` | sheet | `auto` ↔ `แก้เอง` + ↺ reset |
| `HpBlock` | sheet + list | ตัวเลขใหญ่ Mono + bar (มีเลขกำกับ) |
| `CharacterCard` / `PartyRow` / `NpcRow` | list | 3 ระดับ density |
| `ReferenceChip` (source/license) | subclass, footer | SRD/OGL/CC |

> ทั้งหมดใช้ tokens `--surface/--surface-raised/--border/--accent/--text*/--hp/--heal/--warning/--arcane` + Cinzel(หัวข้อ)/Inter(body)/JetBrains Mono(เลข) ตาม DESIGN_SYSTEM — ไม่มีสี/ฟอนต์ใหม่
