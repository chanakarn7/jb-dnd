# UXUI_DESIGN — Inventory (Sprint 3)
### D&D Campaign Manager · module 4 of 8 · `/uxui` (Stage 4)

> Inputs: [PRD](./PRD.md), [SA_BLUEPRINT](./SA_BLUEPRINT.md).
> **Design direction = INHERITED, not re-picked.** ทุก color/font/spacing มาจาก [DESIGN_SYSTEM](../../program/DESIGN_SYSTEM.md) ("Tactical fantasy console" — dark, high-contrast, flat). เอกสารนี้ออกแบบ **เฉพาะ screen/layout ของ Inventory** ซึ่งฝังในหน้า character sheet เดิม (`/characters`, Sprint 2) — **ไม่ใช่หน้าใหม่**.

---

## 1. Inherited tokens (อ้างชื่อ semantic เท่านั้น — ห้ามฮาร์ดโค้ด hex ใน component)
| กลุ่ม | token ที่ใช้ในโมดูลนี้ |
|------|------------------------|
| พื้นหลัง/พื้นผิว | `--bg`, `--surface` (การ์ด inventory), `--surface-raised` (row hover, modal, popover) |
| เส้น/ข้อความ | `--border`, `--text`, `--text-muted` (label/ประเภท), `--text-faint` (disabled/hint) |
| accent | `--accent` (CTA "เพิ่มไอเทม", section banner, focus ring), `--accent-hover` |
| semantic | `--arcane` (badge "ต้อง attune" + ไอคอน attuned), `--danger` (ปุ่มลบ, validation ติดลบ), `--warning` (เตือน cap ใกล้เต็ม optional), `--success` (toast บันทึกสำเร็จ) |
| ฟอนต์ | `Cinzel` (หัว section เท่านั้น, sparingly), `Inter` (label/body/ปุ่ม), `JetBrains Mono` + `tabular-nums` (**ทุกตัวเลข**: quantity, currency, counter "X/3", ≈gp) |
| spacing/รัศมี | 4/8 scale; `--r-sm` (badge/ปุ่มเล็ก), `--r-md` (row/input), `--r-lg` (การ์ด/modal) |
| ไอคอน | **Lucide** เท่านั้น (stroke 1.5–2px) — ไม่มี emoji |

---

## 2. Screen inventory (surface ที่ออกแบบ)
| # | Surface | ตำแหน่ง | ไฟล์ปลายทาง (Stage 7) |
|---|---------|---------|------------------------|
| S1 | **Inventory section** | block ในหน้า sheet `/characters` ใต้ Spells | `app/characters/CharactersClient.tsx` (ส่วนใหม่/คอมโพเนนต์ย่อย `InventorySection`) |
| S2 | **Add-item modal** | overlay เหนือ sheet | `AddItemModal` (ในไฟล์เดียวกันหรือ `InventoryModal.tsx`) |
| S3 | **Currency strip** | block เล็กในหัว/ท้าย Inventory section | ส่วนของ `InventorySection` |

> ทุก surface ใช้ token เดิม, ไม่เพิ่ม route ใหม่, ไม่เพิ่มสี/ฟอนต์ใหม่.

---

## 3. S1 — Inventory section

### 3.1 Layout (desktop ≥1024)
```
┌─ การ์ด --surface, --r-lg, border --border ──────────────────────────────┐
│  ⚔ ของในกระเป๋า (Cinzel h3, --text)        Attuned 2/3   [ + เพิ่มไอเทม ] │  ← header row
│  ────────────────────────────────────────────────────────────────────── │
│  [Currency strip — §5]                                                   │
│  ────────────────────────────────────────────────────────────────────── │
│  ▸ row: ชื่อ            [badge type][badge rarity][badge ต้องattune]      │
│         qty [−] 3 [+]   [⛊ Equipped]  [🔗 Attuned]            [🗑]         │
│  ▸ row ...                                                                │
└──────────────────────────────────────────────────────────────────────────┘
```
- **Header:** ไอคอน Lucide `Backpack` + หัวข้อ (Cinzel, 20px) · ตัวนับ **"Attuned 2/3"** (JetBrains Mono, tabular-nums, สี `--text-muted`; ถ้า =3 เปลี่ยนเป็น `--warning`) · ปุ่ม primary CTA **"เพิ่มไอเทม"** (เดียวในการ์ด, gold `--accent`, ไอคอน `Plus`).
- **Item row** (`--surface-raised` เมื่อ hover, `--r-md`, ระยะ 12/16):
  - **ชื่อไอเทม** (Inter 500, `--text`) — คลิกเปิด tooltip/popover รายละเอียด (จาก `propertiesJson`: damage/AC/weight/cost/desc).
  - **badge ประเภท** (`type` เช่น weapon/armor) — `--surface`, border `--border`, `--text-muted`, `--r-sm`.
  - **badge rarity** — mundane = เงียบ (`--text-faint`); ของวิเศษ (uncommon+) = ขอบ `--arcane`.
  - **badge "ต้อง attune"** — แสดง **เฉพาะ** `requiresAttunement=true`: ไอคอน `Sparkles` + ข้อความ, สี `--arcane`.
  - **Quantity stepper:** `[−] N [+]` — N เป็น JetBrains Mono tabular-nums; `−` ที่ N=1 → disabled (ลบใช้ปุ่มถังขยะ); ค่าพิมพ์เองได้ (number input, min 1).
  - **Equipped toggle:** ไอคอน + label — off `Shield`+"สวม", on `ShieldCheck`+"สวมอยู่" (`--success` ring/fill); **ไม่ใช้สีอย่างเดียว** (ไอคอนเปลี่ยน + label เปลี่ยน).
  - **Attuned toggle:** แสดงเฉพาะ attunement item — off `Link2`+"ผูกพลัง", on `Link`+"ผูกอยู่" (`--arcane`); **disabled** เมื่อ `attunedCount===3 && !this.attuned` → opacity 0.4 + tooltip **"attune ได้สูงสุด 3 ชิ้น"**.
  - **ปุ่มลบ:** ไอคอน `Trash2` (`--danger`), **วางแยกขวาสุด** ห่างจาก toggle (กัน mis-tap); กด → confirm dialog ("ลบ [ชื่อ] ออกจากกระเป๋า?").

### 3.2 Empty state
- ไอคอน `Backpack` เส้นจาง (`--text-faint`) + ข้อความ **"ยังไม่มีของในกระเป๋า"** (`--text-muted`) + ปุ่ม CTA "เพิ่มไอเทม" ตรงกลาง. ไม่โชว์ตาราง.

### 3.3 Loading skeleton
- 3 row skeleton (`--surface-raised`, shimmer ตาม pattern เดิม), header counter เป็น `–/3` ระหว่างโหลด. ไม่ layout shift (จองความสูง row).

---

## 4. S2 — Add-item modal
```
scrim 40–60% black ──────────────────────────────
   ┌─ modal --surface, --r-lg, shadow ─────────┐
   │ เพิ่มไอเทม                          [ ✕ ] │  ← Cinzel + ปุ่มปิด (X, dismiss เสมอ)
   │ [🔍 ค้นหาไอเทม...        ]  [type ▾][rarity ▾]│  ← search debounced + filter
   │ ──────────────────────────────────────── │
   │ ▸ Longsword     weapon            [ เพิ่ม ]│
   │ ▸ Ring of Prot. ring  ✦ต้องattune [ เพิ่ม ]│
   │ ▸ ... (reuse reference items list, Sprint1)│
   │ (empty: "ไม่พบไอเทมที่ตรง")               │
   └────────────────────────────────────────────┘
```
- **Search:** input ไอคอน `Search`, debounce ~250ms; reuse `/api/reference/items` (list shape Sprint 1).
- **Filter:** dropdown `type` + `rarity` (ค่าจาก reference) — ไม่บังคับ.
- **ผลลัพธ์แต่ละแถว:** ชื่อ (Inter) + badge type + badge "ต้อง attune" (ถ้ามี) + ปุ่ม **"เพิ่ม"** (secondary, ไม่ใช่ gold — gold สงวนให้ CTA หลักของ section). กดเพิ่ม → optimistic add → toast `--success` "เพิ่ม [ชื่อ] แล้ว"; ของซ้ำ → quantity +1 (edge 5.13), toast บอก "อัปเดตจำนวนเป็น N".
- **Dismiss:** ปุ่ม `X`, คลิก scrim, ปุ่ม Esc — มีครบ.
- **Empty/loading:** "ไม่พบไอเทม" / skeleton list.

---

## 5. S3 — Currency strip
```
┌ Currency ───────────────────────────────────────────────┐
│  PP [ 0 ]  GP [ 25 ]  EP [ 0 ]  SP [ 8 ]  CP [ 0 ]   ≈ 25.8 gp │
└───────────────────────────────────────────────────────────┘
```
- 5 ช่อง **pp/gp/ep/sp/cp** เรียงแนวนอน (desktop) — label (Inter 14, `--text-muted`) + number input (JetBrains Mono tabular-nums, `min=0`, `--surface-raised`, `--r-md`).
- **"≈ X gp" total** (display-only, optional) — JetBrains Mono `--text-faint`; แปลง 1pp=10gp, 1ep=0.5gp, 1sp=0.1gp, 1cp=0.01gp.
- **บันทึก:** on-blur หรือปุ่ม "บันทึกเงิน" เล็ก ๆ → `PATCH /currency`; สำเร็จ toast `--success`.
- **Validation ติดลบ:** ขอบ input `--danger` + helper "ค่าต้อง ≥ 0" + ปิดการบันทึก; ไม่ยิง API (และ server 422 เป็นด่านสอง).

---

## 6. State matrix
| Element | default | hover | pressed | disabled | focus | error/validation |
|---------|---------|-------|---------|----------|-------|------------------|
| CTA "เพิ่มไอเทม" | `--accent` | `--accent-hover` | กดยุบเล็กน้อย | 0.4 opacity | ring `--accent` 2–4px | — |
| ปุ่ม "เพิ่ม" (ผลค้น) | secondary (`--surface-raised`+border) | border `--accent` | — | 0.4 (ระหว่างยิง) | ring | — |
| Equipped toggle | `Shield`/`--text-muted` | `--surface-raised` | — | — | ring | — |
| Attuned toggle | `Link2`/`--arcane` | bg จาง arcane | — | **0.4 + tooltip cap** | ring | 422 → toast |
| Quantity stepper | mono tabular | — | — | `−` ที่ N=1 | ring | <1 → reject 422 |
| Currency input | mono tabular | — | — | — | ring `--accent` | ติดลบ → ขอบ `--danger`+helper |
| ปุ่มลบ | `Trash2`/`--danger` | bg จาง danger | — | — | ring | confirm dialog |

**Toast/Error mapping (จาก API §SA):**
- `401 unauthorized` → toast + redirect `/join`.
- `403 forbidden` → toast `--danger` "คุณไม่มีสิทธิ์แก้ตัวละครนี้" (ปกติ UI ซ่อน control ของตัวละครคนอื่นอยู่แล้ว).
- `404 not_found` → toast "ไม่พบไอเทม/ตัวละคร".
- `422 not_attunable` → "ไอเทมนี้ไม่ต้องผูกพลัง" (ปกติซ่อนปุ่มอยู่แล้ว = ด่านสอง).
- `422 attunement_limit` → "attune ได้สูงสุด 3 ชิ้น".
- `422 invalid_quantity` / `invalid_currency` → helper inline + toast.
- ทุก toast แนบ context (ชื่อไอเทม) ได้.

---

## 7. Responsive behavior (target = แท็บเล็ตที่โต๊ะเล่น)
| Breakpoint | Inventory section | Currency | Add-item modal |
|-----------|-------------------|----------|----------------|
| **≥1024 desktop** | การ์ดเต็ม, row แนวนอนครบทุก control | strip แนวนอน 5 ช่อง + total | modal กลางจอ ~560px |
| **768 tablet** | row ยังแนวนอนได้ แต่ badge ย่อ/ตัด; toggle เป็นไอคอน+label สั้น | strip ยังแนวนอน (ช่องแคบลง) | modal ~90vw |
| **375 mobile** | section **ยุบเป็น accordion** (หัว + counter + CTA เห็นตลอด, รายการพับได้); แต่ละ row เป็น **stacked card** (ชื่อ+badge บรรทัดบน / qty·toggle·ลบ บรรทัดล่าง) | strip **wrap 2 แถว** (pp gp ep / sp cp + total) | modal เต็มจอ (sheet) เลื่อนผลค้น |

- เป้าหมายอุปกรณ์หลัก = แท็บเล็ต (โต๊ะเล่น) — touch target ≥44px; stepper/toggle/ลบ กดง่ายด้วยนิ้ว, ปุ่มลบเว้นระยะกัน mis-tap.

---

## 8. Accessibility notes
- **ไม่พึ่งสีอย่างเดียว (`color-not-only`):** equipped/attuned สื่อด้วย **ไอคอน Lucide ที่เปลี่ยนรูป + label ข้อความ** (Shield→ShieldCheck, Link2→Link) ไม่ใช่แค่เปลี่ยนสี; cap-disabled สื่อด้วย opacity + tooltip ข้อความ ไม่ใช่แค่สีจาง.
- **Tabular figures:** ทุกตัวเลข (quantity, 5 สกุลเงิน, counter "X/3", ≈gp) ใช้ JetBrains Mono + `tabular-nums` → คอลัมน์ไม่ขยับเวลาเลขเปลี่ยน.
- **Contrast ≥4.5:1:** label `--text-muted` บน `--surface`/`--surface-raised` ผ่านเกณฑ์ (ตาม DESIGN_SYSTEM); badge ของวิเศษใช้ขอบ `--arcane` + ข้อความ `--text` ไม่ใช่ข้อความสี arcane จาง.
- **Focus ring:** ทุก control (CTA, toggle, stepper, input, ปุ่มลบ/เพิ่ม, ปุ่มปิด modal) มี ring `--accent` 2–4px มองเห็นชัด.
- **Keyboard:** modal focus-trap + Esc ปิด; toggle เป็น `button[aria-pressed]`; attuned-disabled มี `aria-disabled` + `title`/tooltip อธิบายเหตุผล; stepper เป็น input number มี aria-label.
- **Screen reader:** counter ประกาศ "Attuned 2 จาก 3"; toast เป็น `role="status"` (success) / `role="alert"` (error).
- **Confirm ลบ:** dialog มีปุ่มยกเลิกเป็น default focus (กัน accidental delete).

---

## 9. Component → file map (ส่งต่อ Stage 5/7)
| Component | หน้าที่ |
|-----------|---------|
| `InventorySection` | การ์ด S1 — header+counter+CTA, รายการ row, empty/loading, ฝังใน sheet |
| `InventoryRow` | 1 แถวไอเทม — badge, stepper, equip/attune toggle, ลบ |
| `AddItemModal` | S2 — ค้น/filter reference items + เพิ่ม |
| `CurrencyStrip` | S3 — 5 ช่องเงิน + total + validation |
| (reuse) `Toast`, `ConfirmDialog`, reference items fetch (Sprint 1) | ใช้ของเดิม ไม่สร้างใหม่ |

> ทั้งหมด inherit token จาก DESIGN_SYSTEM; **ไม่มีสี/ฟอนต์ใหม่**. Mockup คลิกได้ = Stage 5 (`/proto`).
