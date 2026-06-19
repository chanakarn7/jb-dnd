# UXUI Design — 5e Reference (Sprint 1)

> **Inherit เท่านั้น ไม่ re-pick.** ทุก color/font/spacing มาจาก [DESIGN_SYSTEM.md](../../program/DESIGN_SYSTEM.md) (tactical fantasy console — dark) เอกสารนี้ document **เฉพาะ screens ของโมดูล**
> อินพุต: [PRD](./PRD.md) · [SA_BLUEPRINT](./SA_BLUEPRINT.md)

## Tokens ที่ใช้ (อ้างจาก program — ไม่นิยามใหม่)
| ใช้กับ | Token |
|--------|-------|
| พื้นหลัง / การ์ด / raised row | `--bg` / `--surface` / `--surface-raised` |
| ตัวอักษรหลัก / รอง / จาง | `--text` / `--text-muted` / `--text-faint` |
| brand, action, แท็บ active, statblock rule | `--accent` (gold) / `--accent-hover` |
| เวท/เวทมนตร์ (school chip, spell accent) | `--arcane` (#8B5CF6) |
| ดาเมจ/อันตราย ใน statblock | `--danger` · heal `--success` · warn `--warning` |
| หัวข้อ/แบนเนอร์ | **Cinzel** · UI/body **Inter** · **ตัวเลขทุกตัว = JetBrains Mono + tabular-nums** |
| spacing / radius | 4·8·12·16·24·32 · `--r-sm/md/lg` |
| ไอคอน | **Lucide** (Sparkles=spells, Skull=monsters, Sword=items, Search, SlidersHorizontal=filter) |

---

## 1. Reference Shell (โครงหน้า)

เข้าจาก nav ในห้องแคมเปญ (เพิ่มลิงก์ "Reference" / ไอคอน BookOpen ข้าง ๆ ปุ่ม Leave ใน lobby). ต้องอยู่ใน session — ถ้าไม่มี seat → redirect `/join` (เหมือน lobby guard)

```
┌──────────────────────────────────────────────────────────┐
│ ← Back to campaign           [ Reference ]  (Cinzel, gold) │
│                                                            │
│  ╭─ segmented control (role=tablist) ─────────────╮        │
│  │ ✦ Spells │  ☠ Monsters │  ⚔ Items │            │  ← active=gold underline+text, rest muted
│  ╰──────────────────────────────────────────────╯         │
│                                                            │
│  ⌕ [ Search spells…              ✕ ]   [⚙ Filters (2)]    │  ← search debounce 150ms, ✕ ล้าง; ปุ่ม filter โชว์จำนวนที่ active
│  ┌─ filter bar (desktop: inline / mobile: drawer) ─┐       │
│  │ Level ▾  School ▾  Class ▾  ☐Ritual ☐Concentr.  │       │
│  │                              [ Clear filters ]   │       │
│  └─────────────────────────────────────────────────┘       │
│                                                            │
│  พบ 47 รายการ                          (text-muted, tnum)  │
│  ┌────────────── result list ──────────────┐               │
│  │  …rows…                                  │               │
│  └──────────────────────────────────────────┘             │
│                                                            │
│  ── SRD 5.1 · CC-BY-4.0 attribution footer ──             │
└──────────────────────────────────────────────────────────┘
```

- **Segmented control** = `role="tablist"`, แต่ละแท็บ `role="tab"` + `aria-selected`. Active: ตัวอักษร `--text` + เส้นใต้ 2px `--accent`; inactive: `--text-muted`. คีย์บอร์ด ← → สลับแท็บได้ (a11y).
- เปลี่ยนแท็บ = เปลี่ยน `?tab=` + reset filter ของหมวด แต่คง search box? → **ล้าง search เมื่อเปลี่ยนหมวด** (คนละ dataset) — ชัดเจนกว่า.
- **State อยู่ใน URL**: `?q=fire&level=3&school=Evocation` → back/forward + deep-link แชร์ได้ (PRD US-5/edge 5.4). detail = path `/reference/spells/fireball`.
- โหลด dataset ต่อหมวด **ครั้งเดียว** (`fetch /api/reference/<tab>`) แล้วกรองใน memory (SA §4.2) → ตัวนับ + รายการอัปเดต instant.

---

## 2. Result rows (ต่อหมวด — layout ต่างกันตามข้อมูลที่ DM ต้องสแกน)

แต่ละแถว = `--surface` + `border --border` + radius `--r-md`, hover → `--surface-raised`, คลิกทั้งแถวเปิด detail, focusable (`role="link"`/`<a>`).

**A) Spell row**
```
┌─────────────────────────────────────────────────────────┐
│ ✦ Fireball                          [Lvl 3] [Evocation]  │
│   1 action · 150 ft · V S M           ⟲ritual ◈concentr │
└─────────────────────────────────────────────────────────┘
```
- ชื่อ Inter 16/600. ป้าย **Level** = chip gold; **School** = chip `--arcane`. casting time/range/components บรรทัดสอง `--text-muted` 14. ตัวเลข level = mono tnum. ไอคอน ritual (Repeat) / concentration (Circle-dot) เฉพาะเมื่อ true.

**B) Monster row** (ต้องสแกน CR/HP/AC เร็ว → ตัวเลขชิดขวา คอลัมน์ตรง)
```
┌─────────────────────────────────────────────────────────┐
│ ☠ Goblin                                                 │
│   Small humanoid              CR 1/4 · HP 7 · AC 15      │  ← ตัวเลขทั้งหมด mono tnum, คอลัมน์ขวา
└─────────────────────────────────────────────────────────┘
```
- size/type `--text-muted`. ตัวเลข CR·HP·AC mono tnum ชิดขวา (คอลัมน์ไม่เลื่อนเวลา scroll — เหตุผลเดียวกับ combat).

**C) Item row**
```
┌─────────────────────────────────────────────────────────┐
│ ⚔ Longsword                       [weapon]  [common]     │
│   1d8 slashing · 3 lb · 15 gp              ◈ attunement  │  ← ◈ เฉพาะถ้า requiresAttunement
└─────────────────────────────────────────────────────────┘
```
- rarity chip ใช้สี: mundane/common = `--text-muted` border; uncommon=`--success`; rare=`--arcane`; very-rare=`--accent`; legendary=`--accent` + glow. (สี + ข้อความเสมอ ไม่ใช่สีอย่างเดียว).

---

## 3. Filters

**Desktop:** filter bar inline ใต้ search. Dropdown (Level/School/Class/Type/Rarity) = multi-select popover; toggle (Ritual/Concentration/Attunement) = chip กดติด/ดับ. **Monster CR** = dual-range (min–max) แสดงค่าเป็น mono ("CR 0 – 5").
**Mobile (<768):** filter bar ยุบเป็นปุ่ม `⚙ Filters (n)` → เปิด **bottom sheet/drawer** (scrim 50%) มี filter ทั้งหมด + ปุ่ม "Apply"/"Clear". จำนวน active โชว์บนปุ่ม.
- ทุก filter = **AND**. มี "Clear filters" เสมอเมื่อมี active.
- a11y: dropdown/toggle เข้าถึงด้วยคีย์บอร์ด, focus ring 2–4px `--accent`.

---

## 4. Monster Statblock — **หน้า hero ของสปรินต์** 🎯

สไตล์ statblock 5e คลาสสิก แต่ dark + tabular. desktop การ์ดกว้าง ~720px กลางจอ; mobile เต็มกว้าง scroll เดียว. แถบเส้นคั่น = `--accent` (gold rule) ตามขนบ statblock.

```
┌══════════════════════════════════════════════════┐
│  Goblin                              (Cinzel, gold)│  ← ชื่อ display
│  Small humanoid (goblinoid), neutral evil  (italic │
│                                       text-muted)  │
│ ──────────────── gold rule ─────────────────────── │
│  Armor Class   15 (leather armor, shield)          │  ← label Inter / ตัวเลข mono tnum
│  Hit Points    7 (2d6)                             │
│  Speed         30 ft.                              │
│ ──────────────── gold rule ─────────────────────── │
│  ╭ STR ╮ ╭ DEX ╮ ╭ CON ╮ ╭ INT ╮ ╭ WIS ╮ ╭ CHA ╮ │  ← ability grid 6 ช่อง
│  │  8  │ │ 14  │ │ 10  │ │ 10  │ │  8  │ │  8  │ │
│  │ −1  │ │ +2  │ │ +0  │ │ +0  │ │ −1  │ │ −1  │ │  ← modifier mono, คำนวณ runtime
│  ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ ╰─────╯ │
│ ──────────────── gold rule ─────────────────────── │
│  Skills        Stealth +6                          │  ← ซ่อนถ้าไม่มี (edge 5.5)
│  Senses        darkvision 60 ft., passive Per. 9   │
│  Languages     Common, Goblin                      │
│  Challenge     1/4 (50 XP)                         │  ← CR + XP (XP derived ตอน seed)
│ ──────────────── gold rule ─────────────────────── │
│  Nimble Escape.  The goblin can take the Disengage…│  ← traits (name bold italic + desc)
│                                                    │
│  ▸ ACTIONS                          (gold caps)    │  ← section header
│  Scimitar. Melee Weapon Attack: +4 to hit, reach…  │
│  Shortbow.  Ranged Weapon Attack: +4 to hit…       │
│  ▸ LEGENDARY ACTIONS  (เฉพาะถ้ามี kind=legendary)  │
└══════════════════════════════════════════════════┘
   ← Back to Monsters
```
- **ability grid**: 6 การ์ดเล็ก `--surface-raised`, ตัวเลขคะแนน mono 20, modifier mono 14 `--text-muted`, ป้าย STR.. Inter 12 caps. บนมือถือ grid wrap 3×2.
- ตัวเลขทุกตัว (AC/HP/CR/XP/scores/mods/to-hit/damage) = **JetBrains Mono tabular** → คอลัมน์ไม่ขยับ.
- section header (ACTIONS/REACTIONS/LEGENDARY) = Inter caps + tracking, สี `--accent`, เส้น hairline.
- field ที่ว่าง (saves/skills/immunities/legendary) → **ซ่อนทั้งบรรทัด** (PRD edge 5.5). JSON เสีย → render เท่าที่ได้ (edge 5.6).

---

## 5. Spell card & Item card

**Spell card** (accent = `--arcane`):
```
✦ Fireball                                   (Cinzel)
Level 3 Evocation · (ritual? / concentration?)  ← arcane subtitle
─────────────── arcane rule ───────────────
Casting Time   1 action
Range          150 feet
Components      V, S, M (a tiny ball of bat guano and sulfur)
Duration       Instantaneous
─────────────────────────────────────────────
A bright streak flashes from your pointing finger…   ← description (Inter 16/1.5, multi-para)

At Higher Levels.  When you cast this spell using a   ← higherLevels (เฉพาะถ้ามี), เน้น label
spell slot of 4th level or higher…
─────────────────────────────────────────────
Classes:  Sorcerer · Wizard                          ← chips arcane
← Back to Spells
```
labels Inter 500 `--text-muted`, ค่าฝั่งขวา/บรรทัดเดียว; ตัวเลข (range/level) mono.

**Item card** (accent = gold; rarity เป็นตัวกำหนดสี chip):
```
⚔ Longsword                                  (Cinzel)
Weapon (martial melee) · common · (◈ requires attunement?)
─────────────── gold rule ───────────────
Damage     1d8 slashing  (versatile 1d10)    ← mono dice
Weight     3 lb
Cost       15 gp
Properties Versatile
─────────────────────────────────────────────
<description ถ้ามี>
← Back to Items
```
properties render จาก `propertiesJson` แบบ key→label; key ที่ไม่รู้จัก → แสดง key เป็น Title Case (graceful, edge 5.6).

---

## 6. System States

| State | ดีไซน์ |
|-------|--------|
| **Loading (โหลด dataset ครั้งแรก)** | skeleton rows 8–10 แถว (กล่อง `--surface` + shimmer จาง) — ไม่ใช่หน้าว่าง (PRD 5.3) |
| **Empty — ไม่พบจาก search** | ไอคอน SearchX (`--text-faint`) + "ไม่พบ \"<q>\" — ลองคำอื่น" + ปุ่ม **Clear search** (PRD 5.1) |
| **Empty — filter เหลือ 0** | ไอคอน FilterX + "ไม่มีรายการตรงกับฟิลเตอร์" + ปุ่ม **Clear filters** (PRD 5.2) |
| **404 deep-link เสีย** | การ์ดกลางจอ: "ไม่พบรายการนี้" + ปุ่มกลับหมวดนั้น (PRD 5.4) |
| **Error fetch** | toast `--danger` (ใช้ Toaster เดิมจาก providers) + ปุ่ม retry |

ทุกหน้ามี **footer attribution** (PRD 6.3): `--text-faint` 12px —
> *"This work includes material from the System Reference Document 5.1 by Wizards of the Coast LLC, available under CC-BY-4.0."*

---

## 7. Responsive & a11y (สรุป)
- **DM desktop**: filter inline, list 1 คอลัมน์กว้าง, detail การ์ดกลาง max ~720px. **Player mobile**: แท็บเต็มกว้าง, filter → drawer, statblock scroll เดียว, ability grid 3×2.
- breakpoints 375/768/1024 (ตาม DESIGN_SYSTEM).
- คีย์บอร์ด: tablist ← →, filter เปิด/เลือกด้วย Enter/Space, ทุกแถวเป็น `<a>` tab ได้, focus ring `--accent`.
- คอนทราสต์ AA (token ผ่านอยู่แล้ว); chip ใช้ **สี + ข้อความ** เสมอ (color-not-only).
- ตัวเลข statblock **tabular-nums** ทุกที่ (number-tabular).

## 8. ส่งต่อ
`/proto` (Stage 5) ทำ mockups/*.html: หน้า shell+spell list, monster statblock (hero), spell card, item card, + empty/loading states — ใช้ token ชุดนี้ตรง ๆ
