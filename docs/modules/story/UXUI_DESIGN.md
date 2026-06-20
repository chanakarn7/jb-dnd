# UXUI Design — Story Module (Sprint 5)
### D&D Campaign Manager · Sprint 5 · `/uxui` output · 2026-06-21

Reads: `docs/modules/story/PRD.md` · `docs/modules/story/SA_BLUEPRINT.md`  
Inherits: `docs/program/DESIGN_SYSTEM.md` (do not re-pick — tokens are locked)

---

## Inherited Design System (reference only — do not change)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0B0E14` | app background |
| `--surface` | `#151A23` | cards, panels |
| `--surface-raised` | `#1E2530` | popovers, date badges, hover rows |
| `--border` | `#2A323F` | dividers, card borders |
| `--text` | `#F1F5F9` | primary text |
| `--text-muted` | `#94A3B8` | secondary, labels |
| `--text-faint` | `#64748B` | disabled, hints |
| `--accent` | `#D9A441` | gold — CTAs, active tab, section banner |
| `--accent-hover` | `#E8B95C` | gold hover |
| `--arcane` | `#8B5CF6` | XP badge, faction chip, magic |
| `--danger` | `#EF4444` | delete, dead badge, failed quest |
| `--success` | `#22C55E` | completed quest, save toast |
| `--warning` | `#F59E0B` | warnings |

| Role | Font | Use |
|------|------|-----|
| Display | Cinzel | section titles only |
| UI | Inter | labels, body, buttons |
| Numerics | JetBrains Mono | XP, dates, objective counts |

Icons: **Lucide SVG only** (stroke 1.5–2px). No emoji as icons.

---

## Story Module Screen Specs

### 0. Integration Point

Story module embeds in `/campaign/[id]` as a collapsible section below the existing Roster + CombatTracker sections. The section header uses the same banner style as Combat:

```
┌─────────────────────────────────────────────────────┐
│ 📖  STORY  [Cinzel 20px, --accent]    [▾ collapse]  │
│     Sessions  Quests  NPCs  Journal   [sub-nav tabs] │
└─────────────────────────────────────────────────────┘
```

---

### 1. Story Hub — Sub-nav

**Sub-nav tab bar** (horizontal, below the section banner):

```
[ Sessions ]  [ Quests ]  [ NPCs ]  [ Journal ]
   ▔▔▔▔▔▔▔▔
   (gold 2px underline = active; text-muted = inactive)
```

- Font: Inter 14px 500
- Padding: 8px 16px per tab
- Active: `--accent` underline 2px + `--text` color
- Inactive: `--text-muted` color, no underline; hover → `--text`
- DM: `+ Add` button (gold, right of tab bar) changes label per active tab:
  - Sessions → `+ Log Session`
  - Quests → `+ New Quest`
  - NPCs → `+ Add NPC`
  - Journal → `+ New Entry`
- Player: `+ Add` button hidden

---

### 2. Sessions Sub-tab

#### 2.1 List View

```
┌─────────────────────────────────────────────────────────────────┐
│  [Jun 15]  Session 3 — Thornhaven Arrival          [250 XP]     │
│  ────────  The party arrived in the walled town...  [✏ 🗑]      │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  [Jun 08]  Session 2 — The Barrow Descent           [400 XP]    │
│  ────────  Entering the barrow, the party fought...  [✏ 🗑]     │
└─────────────────────────────────────────────────────────────────┘
```

**Session card anatomy:**
- Container: `--surface` bg, `--border` border 1px, `--r-md` (10px) radius, 16px padding, hover → `--surface-raised`
- Left date badge: `--surface-raised` bg, `--accent` border 1px, 8px radius, JetBrains Mono 12px, `--text-muted`; format `MMM DD`
- Title: Inter 600 16px, `--text`
- XP badge: `--arcane` bg (10% opacity) + `--arcane` text, JetBrains Mono 12px, pill shape (4px radius, 4px 8px padding); e.g. `250 XP`
- Summary excerpt: Inter 14px, `--text-muted`, max 120 chars + `…`
- DM edit controls: pencil + trash icons; visible on card hover (`opacity: 0 → 1`); pencil = `--text-muted`, trash = `--text-muted` hover `--danger`

#### 2.2 Detail Expand (click card → inline expand below card)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Jun 15]  Session 3 — Thornhaven Arrival           [250 XP]    │
│  ──────────────────────────────────────────────────────────     │
│  Notable Loot: Healing Potion x2, 50gp                          │
│  ─────────────────────────────────────────────────────────      │
│  ## Summary                                                      │
│  The party arrived in Thornhaven just as the market bell rang... │
│  (full markdown render)                                          │
│                                                                  │
│  Linked Journal Entries (2)                                      │
│  · Thornhaven Lore    · Market District Notes                    │
└─────────────────────────────────────────────────────────────────┘
```

- Full markdown rendered via `react-markdown`; heading styles: h2 `--accent` Cinzel 18px, h3 Inter 600 16px
- `Notable Loot` label: Inter 500 12px `--text-muted`; value: Inter 14px `--text`
- Linked entries: Inter 14px `--arcane` links

#### 2.3 Empty State

```
        [scroll icon, 40px, --text-faint]
        No sessions logged yet
        [Log First Session]  ← gold button, DM only
```

#### 2.4 Create / Edit Form (modal)

```
┌────────────────────────────────────────┐
│  Log Session                           │
│  ─────────────────────────────────     │
│  Title          [________________]     │  (placeholder: "Session 3")
│  Date           [📅 2026-06-15  ]     │
│  XP Awarded     [250           ]       │  (JetBrains Mono input)
│  Notable Loot   [________________]     │
│                                        │
│  Summary        [Write · Preview]      │
│  ┌──────────────────────────────────┐  │
│  │ (markdown textarea, 6 rows)       │  │
│  └──────────────────────────────────┘  │
│                                        │
│           [Cancel]  [Save Session]     │
└────────────────────────────────────────┘
```

---

### 3. Quests Sub-tab

#### 3.1 List View (grouped by status)

```
── ACTIVE QUESTS ──────────────────────── [--accent]

┌─────────────────────────────────────────────────────┐
│  Find the Sunken Temple         [ACTIVE] [2/5 obj]  │
│  from Elder Maren               [✏ ▾status 🗑]      │
└─────────────────────────────────────────────────────┘

── COMPLETED ──────────────────────────── [--success]

┌─────────────────────────────────────────────────────┐
│  Clear the Barrow               [DONE]  [5/5 obj]  │
│  from Village Elder             [✏ ▾status 🗑]      │
└─────────────────────────────────────────────────────┘
```

**Quest card anatomy:**
- Title: Inter 600 15px `--text`
- Giver: Inter 14px `--text-muted` `from [name]`; omit line if no giverName
- Status badge pills:
  - `active` → `--accent` bg 15% + `--accent` text
  - `completed` → `--success` bg 15% + `--success` text
  - `failed` → `--danger` bg 15% + `--danger` text
  - `abandoned` → `--border` bg + `--text-muted` text
- Objectives pill: JetBrains Mono 12px `--surface-raised` bg `--text-muted`; e.g. `2/5 obj`; hidden if objectives empty
- DM controls on hover: pencil icon + status `<select>` dropdown (compact) + trash

#### 3.2 Quest Detail (inline expand)

```
┌─────────────────────────────────────────────────────────────┐
│  Find the Sunken Temple             [ACTIVE]  [2/5 obj]     │
│  ─────────────────────────────────────────────────────      │
│  Description (markdown rendered):                           │
│  Elder Maren believes the **artifact** lies beneath the...  │
│                                                             │
│  Objectives:                                                │
│  ☑  Locate the temple entrance                              │
│  ☑  Defeat the door guardian                               │
│  ☐  Find the inner sanctum                                  │  (DM: clickable)
│  ☐  Retrieve the artifact                                   │
│  ☐  Return to Elder Maren                                   │
│                                                             │
│  Reward: Ancient scroll detailing the temple's history      │
└─────────────────────────────────────────────────────────────┘
```

- Checkboxes: 16px, accent color when checked; DM = interactive; player = `pointer-events:none` + `opacity:0.7`
- Objective rows: Inter 14px, checked items `--text-muted` + strikethrough `text-decoration-line: line-through`
- Reward: Inter 14px italic `--text-muted`

#### 3.3 Create / Edit Form (modal)

```
┌──────────────────────────────────────────────┐
│  New Quest                                   │
│  ──────────────────────────────────────      │
│  Quest Name *   [________________________]   │
│  Quest Giver    [________________________]   │
│  Status         [active              ▾  ]   │
│                                              │
│  Description    [Write · Preview]            │
│  ┌────────────────────────────────────────┐  │
│  │ (markdown textarea, 4 rows)             │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Objectives                                  │
│  ⠿  [Find the temple entrance        ] [×]  │
│  ⠿  [Defeat the door guardian        ] [×]  │
│  [+ Add Objective]                           │
│                                              │
│  Reward         [________________________]   │
│                                              │
│                    [Cancel]  [Save Quest]    │
└──────────────────────────────────────────────┘
```

- Objectives: drag handle `⠿` (`--text-faint`) + text input + `×` delete; "Add Objective" text button in `--arcane`
- Required field `*` marker: `--danger`

---

### 4. NPCs Sub-tab

#### 4.1 Filter Bar

```
[All]  [Alive]  [Dead]   Faction: [____________ ×]
```
- Toggle pills: `--surface-raised` bg, `--border` border; active → `--accent` bg `--bg` text
- Faction text input: `--surface` bg, `--border` border, 8px radius; clear `×` appears when non-empty

#### 4.2 Grid View (3 cols desktop · 2 tablet · 1 mobile)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Elder Maren │  │  Baron Voss  │  │  Kira (†)    │
│  Town Elder  │  │  Villain     │  │  Assassin    │
│ [Thornhaven] │  │  [Blackfang] │  │  [Blackfang] │
│  [👁 ✏ 🗑]   │  │  [👁 ✏ 🗑]   │  │  [☠ ✏ 🗑]   │
└──────────────┘  └──────────────┘  └──────────────┘
```

**NPC card anatomy:**
- Card: `--surface` bg, `--border` border 1px, 10px radius, 16px padding
- Name: Inter 600 15px `--text`
- Role: Inter 14px `--text-muted`
- Faction chip: `--arcane` bg 15% + `--arcane` text, 4px radius, 4px 8px padding, Inter 12px; hidden if no faction
- Dead badge `†`: `--danger` bg 15% + `--danger` text pill; dead cards get `opacity: 0.55`
- DM hover controls (bottom row): skull/heart toggle icon + pencil + trash; skull=dead `--danger`, heart=alive `--success`

#### 4.3 NPC Detail (click card → modal on tablet; side panel on desktop)

```
┌──────────────────────────────────────────────────────┐
│  Elder Maren                          [✏ Edit]       │
│  Town Elder · Thornhaven Council                     │
│  ────────────────────────────────────────────────    │
│  **Wise and cautious.** Has lived in Thornhaven       │
│  for 60 years. Knows the location of the temple but  │
│  fears the party isn't ready...                      │
│                                                      │
│  → View Character Sheet  (if characterId set)        │
└──────────────────────────────────────────────────────┘
```

#### 4.4 Create / Edit Form (modal)

```
┌──────────────────────────────────────┐
│  Add NPC                             │
│  ──────────────────────────────      │
│  Name *         [________________]   │
│  Role           [________________]   │  (e.g. "Town Elder")
│  Faction        [________________]   │
│  Alive          [● ON  ]            │  (toggle switch)
│                                      │
│  Notes          [Write · Preview]    │
│  ┌──────────────────────────────┐    │
│  │ (markdown textarea, 5 rows)   │    │
│  └──────────────────────────────┘    │
│                                      │
│              [Cancel]  [Save NPC]    │
└──────────────────────────────────────┘
```

- Alive toggle: green `--success` when ON; `--text-faint` border when OFF

---

### 5. Journal Sub-tab

#### 5.1 List + Detail — Desktop (side-by-side)

```
┌──────────────────────────┬──────────────────────────────────────┐
│  Thornhaven Lore   Jun15 │  Thornhaven Lore                     │
│  ─ Session 3             │  ─────────────────────────────────   │
│  Market District   Jun15 │  ## History                          │
│  ─ Session 3             │  Thornhaven was founded three...     │
│  DM Notes          Jun08 │                                      │
│  (unlinked)              │  [✏ Edit]  [🗑 Delete]               │
└──────────────────────────┴──────────────────────────────────────┘
```

**Journal row anatomy (left panel):**
- Row: Inter 15px `--text` title (or "Untitled" `--text-faint` italic)
- Date: JetBrains Mono 12px `--text-muted` right-aligned
- Session link: Inter 12px italic below title; linked = `--accent`; unlinked = `--text-faint` "—"
- Active/selected row: `--surface-raised` bg + `--accent` left border 2px
- DM: hover row shows pencil + trash at right edge

**Detail panel (right side, desktop):**
- `react-markdown` rendered content; heading styles as §2.2
- If in edit mode: `textarea` left | markdown preview right (50/50 split)
- Write/Preview toggle tabs above textarea (same as Sessions form)

#### 5.2 Mobile — Stacked

List full-width. Tap row → detail slides up full-width. Back button `← Journal`.

#### 5.3 Create / Edit Form (inline panel, not modal)

```
┌──────────────────────────────────────────────────────┐
│  New Journal Entry                                   │
│  ─────────────────────────────────────────────────   │
│  Title          [________________________________]   │
│  Linked Session [Select session…              ▾ ]   │
│                                                      │
│  [Write]  [Preview]                                  │
│  ┌────────────────────────────────────────────────┐  │
│  │ ## My Notes                                     │  │
│  │ Today the party discovered...                   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│                      [Cancel]  [Save Entry]          │
└──────────────────────────────────────────────────────┘
```

- Session dropdown: lists sessions as `MMM DD — [Title]`, sorted newest first; "No link" as first option
- Write/Preview tabs: active tab `--accent` underline, inactive `--text-muted`

---

### 6. Shared UI Patterns

#### 6.1 Modal Structure

```
[scrim: rgba(0,0,0,0.6)]
┌──────────────────────────────── [max-w 520px, --surface, 16px radius] ─┐
│  Modal Title  [Cinzel 20px --accent]                              [×]   │
│  ─────────────────────────────────────────────────────────────────      │
│  (form content)                                                          │
│                                                                          │
│  ────────────────────────────────────────────────────────────────       │
│  [Cancel text link, --text-muted]         [Save (gold, primary CTA)]    │
└──────────────────────────────────────────────────────────────────────────┘
```

- Close `[×]`: top-right; `--text-muted` hover `--text`
- Modal max-height 90vh + internal scroll for long forms

#### 6.2 Delete Confirm Dialog

```
┌──────────────────────────────┐
│  Delete "Elder Maren"?       │
│  This cannot be undone.      │
│                              │
│  [Cancel]  [Delete]←danger   │
└──────────────────────────────┘
```

- Compact modal, max-w 360px
- Delete button: `--danger` bg, `--text` text

#### 6.3 Loading State — Skeleton Rows

```
┌──────────────────────────────────────────────────────┐
│  [███ ██]  [████████████████████]      [████ ██]     │  ← pulsing
│  ────────  [████████████████████████████]            │
└──────────────────────────────────────────────────────┘
```

- Skeleton: `--surface-raised` bg, 6px radius, `opacity: 0.7 → 1` pulsing (CSS `@keyframes pulse`)
- 3 skeleton cards shown on load; same height as real cards

#### 6.4 Toast Notifications (top-right, 2s auto-dismiss)

```
[✓] Session saved successfully        ← --success bg, --bg text, 10px radius
[✕] Failed to load quests. Retry      ← --danger bg, --bg text
```

- Position: fixed top-4 right-4
- Width: max 320px
- Font: Inter 14px

#### 6.5 Markdown Textarea + Preview Toggle

```
  [Write] [Preview]
  ┌──────────────────────────────────────┐
  │ ## Summary                            │
  │ The party arrived in Thornhaven...    │  ← textarea (Write mode)
  └──────────────────────────────────────┘
```

- `Write` tab active: shows `<textarea>` with monospace hint (Inter 14px)
- `Preview` tab active: hides textarea, renders `<ReactMarkdown>` in same box with `--surface` bg
- Min height: 6 rows; no max (auto-grows)
- Border: `--border` 1px, 8px radius; focus ring `--accent` 2px

---

### 7. Responsive Behaviour

| Breakpoint | Sessions | Quests | NPCs | Journal |
|------------|----------|--------|------|---------|
| Desktop 1024px+ | Card list + inline expand | Status-grouped cards | 3-col grid | Side-by-side list+detail |
| Tablet 768px | Card list + detail modal | Same, compact cards | 2-col grid | List full-width, detail modal |
| Mobile 375px | Stack cards, no hover controls (⋮ menu) | Stack cards | 1-col stack | List rows, tap→full detail |

**DM mobile controls:** edit/delete icons collapsed into `⋮` overflow menu per card/row. Tap ⋮ → mini dropdown (Inter 14px, `--surface-raised`, `--border`): `Edit` · `Delete`.

---

### 8. State Matrix Summary

| State | Sessions | Quests | NPCs | Journal |
|-------|----------|--------|------|---------|
| Loading | 3 skeleton cards | 3 skeleton cards | 6 skeleton cards (grid) | 4 skeleton rows |
| Empty (DM) | Scroll icon + "Log First Session" CTA | Map icon + "Create First Quest" CTA | User icon + "Add First NPC" CTA | Book icon + "Write First Entry" CTA |
| Empty (Player) | Same icon + "No sessions yet" (no CTA) | Same, no CTA | Same, no CTA | Same, no CTA |
| Error | Danger toast + Retry | Same | Same | Same |
| Success save | Green toast 2s | Same | Same | Same |
| Delete | Confirm dialog | Same | Same | Same |

---

### 9. Accessibility Notes

- All interactive elements: 44px minimum touch target (Fitts's Law)
- Focus ring: 2px `--accent` outline on all focusable elements
- Color is never the only signal: status badges have text labels in addition to color; dead NPCs have `†` text not just dimmed color
- Markdown rendered content uses semantic heading hierarchy (h2, h3, p)
- Form fields have `<label>` associations; required fields have both `*` visual and `aria-required="true"`
- Checkboxes in quest objectives: `aria-disabled="true"` for player view
- Skeleton loaders: `aria-busy="true"` on container + `aria-label="Loading [entity]"`
