# UXUI_DESIGN — Combat (Sprint 4)
### D&D Campaign Manager · module 5 of 8 · `/uxui` (Stage 4)

> **Design direction inherited from** [DESIGN_SYSTEM.md](../../program/DESIGN_SYSTEM.md) — "tactical fantasy console." No re-picking of colors, fonts, or spacing.
> **Canonical input for:** `/proto` → `mockups/index.html`, `/dev`.

---

## 1. Inherited Design Tokens (reference — do not redefine)

| Token | Hex | Combat use |
|-------|-----|------------|
| `--bg` | `#0B0E14` | App background |
| `--surface` | `#151A23` | Combatant cards, panels |
| `--surface-raised` | `#1E2530` | Active combatant row, popovers |
| `--border` | `#2A323F` | Card borders, dividers |
| `--text` | `#F1F5F9` | Names, primary labels |
| `--text-muted` | `#94A3B8` | Type labels, secondary info |
| `--text-faint` | `#64748B` | Disabled, hints |
| `--accent` | `#D9A441` | Initiative badge border (active), Next Turn CTA, gold left border |
| `--turn-active` | `#D9A441` | Active combatant: 4px left border + glow |
| `--hp` / `--danger` | `#EF4444` | Damage button, HP low, KO badge |
| `--heal` / `--success` | `#22C55E` | Heal button, HP OK |
| `--warning` | `#F59E0B` | HP mid-range, Exhaustion/Frightened/Restrained badges |
| `--arcane` | `#8B5CF6` | Charmed, Invisible badges |

**Fonts:** Cinzel (encounter title only) · Inter (all UI text) · JetBrains Mono (all numbers: HP, initiative, round)
**Icons:** Lucide SVG, stroke 1.5–2px, consistent size 16–20px
**Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48px
**Radius:** `--r-sm 6px` · `--r-md 10px`

---

## 2. Screen Map

```
Campaign Lobby
  └─ [DM only] "Start Combat" button → Encounter Name Modal
        └─ Combat Tracker (full screen panel, overlaid or routed)
              ├─ DM View — full controls
              │     ├─ Encounter Header (name · Round N · End Combat)
              │     ├─ Initiative List (sorted active combatants)
              │     │     └─ Combatant Row (init badge · HP bar · conditions · damage/heal/+condition/×)
              │     ├─ Waiting Section (initiative = null)
              │     ├─ Next Turn sticky bar
              │     └─ Add Combatant slide-in panel
              └─ Player View — read-only
                    ├─ Your Turn! Banner (when active)
                    ├─ Initiative List (same, no controls)
                    └─ Own row: damage/heal inputs (if allowPlayerHpEdit=true)
```

---

## 3. Screen Specifications

### 3.1 Combat Tracker — DM View

**Layout:** full-width panel (replaces or overlays the lobby when an encounter is active). Max-width `max-w-4xl`, centered.

#### Encounter Header
```
┌─────────────────────────────────────────────────────────────────┐
│  ⚔ GOBLIN AMBUSH          [Cinzel, --accent]     Round 3  [End Combat]  │
│  Iron Throne Campaign      [Inter, --text-muted]  [JB Mono]   [danger]  │
└─────────────────────────────────────────────────────────────────┘
```

- **Encounter name:** Cinzel 20px, `--accent` gold
- **Campaign name:** Inter 14px, `--text-muted`, below encounter name
- **Round counter:** `Round 3` — JetBrains Mono 18px, `--text`, right-aligned
- **"End Combat" button:** Inter 14px, border `--danger`, text `--danger`, bg transparent; hover: bg `--danger` 10% opacity; requires confirmation dialog

#### "Next Turn" Sticky Bar (bottom of viewport)
```
┌─────────────────────────────────────────────────────────────────┐
│   Round 3 · Aria's turn                    [  ▶ Next Turn  ]   │
└─────────────────────────────────────────────────────────────────┘
```
- Bar: bg `--surface`, top border `--border`, sticky `bottom: 0`, height 56px, padding 16px
- **"Next Turn" CTA:** bg `--accent`, text `--bg` (near-black), Inter 600 14px, radius `--r-md`, 40px height, min-width 140px; hover `--accent-hover`
- Current turn label: Inter 14px `--text-muted`, left side

#### Initiative List

Sorted descending by initiative, then by `initiativeOrder` for ties. Combatants with `initiative = null` appear in a separate "Waiting" section below.

**Combatant Row (normal state):**
```
┌──────────────────────────────────────────────────────────────────────────┐
│  [18]  ▲▼  │  🗡 Goblin Shaman       ████████░░  32 / 58   [POI] [GRP]  │  [7] Apply   [5] Heal  [+] [×]  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Combatant Row (active turn state):**
```
╔══════════════════════════════════════════════════════════════════════════╗  ← 4px --accent left border
║  [18]  ▲▼  │  ▶ ARIA'S TURN                                            ║  ← --surface-raised bg
║             │  👤 Aria                ██████████  45 / 45               ║
╚══════════════════════════════════════════════════════════════════════════╝
```

**Row anatomy — 3 columns:**

**Left column (80px fixed):**
- Initiative badge: `[18]` — JetBrains Mono 24px, `--text`, in a 48×48px box with `--border` border (active turn: `--accent` border, gold glow `box-shadow: 0 0 8px rgba(217,164,65,0.4)`)
- ▲▼ reorder buttons: 20×20px each, Lucide `ChevronUp`/`ChevronDown`, `--text-faint`; hover `--text-muted`; hidden if only one combatant at this initiative value

**Center column (flex-grow):**
- Row 1: `[icon] [Name]` — Lucide `Sword` (monster) or `User` (character), 16px `--text-muted`; Inter 16px 600 `--text`
- Row 2: HP bar (animated, 6px height, full width) + HP text
  - Bar fill: > 50% = `--success`; 26–50% = `--warning`; 1–25% = `--danger`; 0% = `--danger` striped
  - HP text: `currentHp / maxHp` — JetBrains Mono 14px, color matches bar tier; at 0 → red + "KO" badge
- Row 3: Condition badges (see §3.4)
- Active combatant: prepend `▶ [NAME]'S TURN` label above row 1 — Inter 12px 600 uppercase `--accent`

**Right column (controls, DM view only):**
```
[___] Apply   [___] Heal   [+]   [×]
```
- Damage input: 56px wide, JetBrains Mono 14px, placeholder `dmg`, border `--border`, bg `--surface`; "Apply" button 56px, bg `--danger` 15%, text `--danger`, radius `--r-sm`
- Heal input: same width; "Heal" button bg `--success` 15%, text `--success`
- `[+]` condition button: 32×32px, Lucide `Plus`, `--text-muted`; hover `--text`; opens Condition Picker
- `[×]` remove button: 32×32px, Lucide `X`, `--text-faint`; hover `--danger`; opens "Remove [Name]?" confirm popover

**Waiting section** (below active list):
```
── WAITING FOR INITIATIVE ──────────────────────────────────────────
│  [--]  ──  │  👤 Thorin          100 / 100   [set initiative: ___]  │
```
- Section label: Inter 11px 500 uppercase `--text-faint`, with `--border` rule
- Initiative badge shows `—` (em dash); no ▲▼ buttons
- Right side: inline initiative input `[___]` + "Set" button instead of damage/heal

#### Add Combatant Panel (slide-in from right, 360px width)

Triggered by "Add Combatant" button (Lucide `UserPlus`, `--accent`) in encounter header.

```
┌──────────────────────────────────┐
│  Add Combatant              [×]  │
│  ┌──────────┬──────────────────┐ │
│  │Characters│   Monsters       │ │  ← tab bar
│  └──────────┴──────────────────┘ │
│  [🔍 Search characters...      ] │
│  ┌────────────────────────────┐  │
│  │ 👤 Aria          Lv5 Rogue │  │ ← clickable row
│  │ 👤 Thorin        Lv5 Fighter│ │
│  │ 👤 Mira (NPC)    —         │  │
│  └────────────────────────────┘  │
│  Initiative: [___]  (optional)   │
│  [+ Add Selected]                │
└──────────────────────────────────┘
```

- Panel: bg `--surface`, left border `--border`, shadow `0 0 24px rgba(0,0,0,0.6)`
- Tabs: Inter 14px; active tab: `--accent` bottom border 2px + `--accent` text
- Search: Lucide `Search` 16px left icon, bg `--surface-raised`, border `--border`, placeholder `--text-faint`
- List rows: hover bg `--surface-raised`; selected: gold left border 2px + bg `--surface-raised`
- "Add Selected" CTA: gold bg `--accent`, text `--bg`, full width

---

### 3.2 Combat Tracker — Player View

Identical layout to DM view with these differences:

- All right-column controls hidden (damage/heal inputs, condition picker +, remove ×, ▲▼ reorder, Set Active button)
- "Add Combatant" button hidden
- "End Combat" button hidden
- **"YOUR TURN!"** banner shown when `activeCombatant.characterId === playerCharacterId`:
  ```
  ╔═══════════════════════════════════════════════════════════════╗
  ║  ⚔  IT'S YOUR TURN, ARIA!   [Dismiss]                       ║  ← --accent bg, --bg text, Cinzel 16px
  ╚═══════════════════════════════════════════════════════════════╝
  ```
  Banner: bg `--accent`, text `--bg`, Cinzel 16px, full-width, 48px height, sticky top

- **Own character row with `allowPlayerHpEdit = true`:** damage/heal inputs appear on own row only
  - Inputs same spec as DM view; "Apply" / "Heal" buttons visible
  - No condition picker, no remove button

- Initiative list is read-only: no ▲▼, no initiative input
- All HP and conditions visible (no fog of war in Sprint 4)

---

### 3.3 "Start Combat" Entry Point

Shown in campaign lobby sidebar (DM only, `session.role === "dm"`). Hidden from players.

```
─── COMBAT ─────────────────────
   No active encounter

   [⚔ Start Combat]
```

"Start Combat" click → modal:

```
┌───────────────────────────────────────┐
│  Start Combat                    [×]  │
│                                       │
│  Encounter Name (optional)            │
│  [Goblin Ambush                    ]  │
│                                       │
│  Players will see combat start.       │
│                                       │
│  [Cancel]          [⚔ Start Combat]  │
└───────────────────────────────────────┘
```

- Modal: bg `--surface`, border `--border`, radius `--r-lg`, max-width 400px, scrim 50% black
- Input: placeholder "Encounter — Round 1", bg `--surface-raised`
- CTA: gold `--accent`, Inter 600 14px, Lucide `Swords` icon left

---

### 3.4 Condition Picker (Popover)

Opens anchored to the `[+]` button on a combatant row. 360px wide, max-height 480px, scrollable.

```
┌─────────────────────────────────────────┐
│  Conditions                        [×]  │
│                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ 👁 BLI   │ │ 💜 CHR ✓ │ │ 🔇 DEA  ││  ← 3-col grid
│  │Blinded   │ │Charmed   │ │Deafened  ││
│  │Can't see │ │Adv on DM │ │Can't hear││
│  └──────────┘ └──────────┘ └──────────┘│
│  ┌──────────────────────────────────┐   │
│  │ ⚡ EXH  Level 2 / 6  [−] [+]    │   │  ← Exhaustion expanded
│  │Exhaustion: disadvantage on checks│   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Condition card (non-Exhaustion):**
- 110px × 72px, bg `--surface-raised`, radius `--r-md`, border `--border`
- Icon: Lucide 20px (color per badge spec below)
- 3-char abbreviation: JetBrains Mono 11px `--text-muted`
- Full name: Inter 12px 600 `--text`
- 1-line effect: Inter 10px `--text-faint`
- **Active (condition applied):** gold border 1px + checkmark overlay (Lucide `Check` 12px `--accent`) top-right
- Click: toggle on/off (DM); emits `addCondition` or `removeCondition`

**Exhaustion card (full-width, expanded):**
- Shows `Level X / 6`; `[−]` and `[+]` buttons (32×32px) to increment/decrement
- Level display: JetBrains Mono 18px `--warning`
- Not present / level 0: shows as an addable card like the others

**Condition badge colors** (used both on picker cards and combatant row badges):

| Condition | Color token | Lucide icon |
|-----------|-------------|-------------|
| Blinded | `--text-muted` (grey) | `EyeOff` |
| Charmed | `--arcane` (purple) | `Heart` |
| Deafened | `--text-muted` | `VolumeX` |
| Exhaustion | `--warning` (amber) | `Zap` |
| Frightened | `--warning` | `AlertTriangle` |
| Grappled | `--text-muted` | `Grip` |
| Incapacitated | `--danger` (red) | `Ban` |
| Invisible | `--arcane` | `Ghost` |
| Paralyzed | `--danger` | `Lock` |
| Petrified | `--text-muted` | `Mountain` |
| Poisoned | `--success` (sickly green) | `Droplets` |
| Prone | `--text-muted` | `ArrowDown` |
| Restrained | `--warning` | `Link` |
| Stunned | `--danger` | `Zap` |
| Unconscious | `--danger` | `Moon` |

**Condition badge on combatant row:**
- Pill shape: 24px height, padding 4px 8px, radius `--r-sm`
- 3-char text: JetBrains Mono 10px, color per table above
- Background: 15% opacity of the badge color
- Border: 1px solid badge color at 40% opacity
- Hover tooltip: full condition name + effect summary
- Color is NOT the only signal: 3-char abbreviation always shown (`BLI`, `CHR`, `EXH 2`, etc.) per `color-not-only` rule

---

### 3.5 HP Bar & Color System

```
HP > 50%:   ████████████████░░░░  45 / 45  [--success green]
HP 26–50%:  ████████░░░░░░░░░░░░  26 / 58  [--warning amber]
HP 1–25%:   ████░░░░░░░░░░░░░░░░   9 / 45  [--danger red]
HP = 0:     ░░░░░░░░░░░░░░░░░░░░   0 / 45  [--danger + striped pattern + KO badge]
```

- Bar track: bg `--border`, 6px height, radius 3px, full width
- Bar fill: animated `transition: width 300ms ease`, color per tier
- HP text: JetBrains Mono 13px, right-aligned, same color as bar tier
- KO badge: `KO` in JetBrains Mono 10px, bg `--danger` 20%, text `--danger`, pill shape, shown inline next to HP text
- Row opacity at 0 HP: `opacity: 0.6` (dimmed but present)

---

## 4. State Matrix

| State | DM View | Player View |
|-------|---------|-------------|
| No active encounter | "Start Combat" CTA + empty state | "No combat active · Waiting for DM" |
| Loading | Skeleton rows (3 rows, shimmer animation) | Same skeleton |
| Active, not my turn | Normal initiative list | Read-only list, "[Name]'s turn" in sticky bar |
| Active, my turn (player) | Normal list (DM never gets "your turn" banner) | Full-width gold "IT'S YOUR TURN!" banner |
| Active, `allowPlayerHpEdit` on | — | Damage/Heal inputs on own row |
| Combatant at 0 HP | Row dimmed, KO badge, Unconscious auto-applied | Same (fully visible) |
| Empty combatant list | "No combatants yet — use Add Combatant to begin" | "Waiting for DM to add combatants" |
| Add Combatant panel open | Slide-in panel from right | Panel not available |
| Condition picker open | Popover anchored to `[+]` | Not available |

---

## 5. Component Specs

### 5.1 Initiative Badge

```
┌────────┐
│  18    │  JetBrains Mono 24px, --text
│        │  48×48px box
└────────┘
  normal:  border --border 1px
  active:  border --accent 2px + box-shadow: 0 0 8px rgba(217,164,65,0.4)
  waiting: shows "—", border --border 1px dashed
```

### 5.2 "Next Turn" Button

- Size: height 40px, min-width 140px, padding 0 24px
- BG: `--accent` (#D9A441); hover: `--accent-hover` (#E8B95C)
- Text: `--bg` (#0B0E14), Inter 600 14px
- Left icon: Lucide `ChevronRight` 16px
- Disabled (no active combatants): opacity 0.4, cursor not-allowed

### 5.3 Damage / Heal Inputs

- Width: 64px; height: 32px
- Font: JetBrains Mono 13px, text-center
- BG: `--surface-raised`; border: `--border`; radius `--r-sm`
- Focus: border `--accent` (damage) or `--success` (heal)
- Spin buttons hidden (`input[type=number]::-webkit-outer-spin-button { display: none }`)
- Adjacent button: 64px wide, 32px height, radius `--r-sm`
  - Damage "Apply": border `--danger`, text `--danger`, bg `--danger` at 0%/hover 15%
  - Heal "Heal": border `--success`, text `--success`, bg `--success` at 0%/hover 15%

### 5.4 Skeleton Loading (3 rows)

```
┌──────────────────────────────────────────────────────┐
│  [████]  ─  │  [████████████]  [██████░░]  [██] [██] │
└──────────────────────────────────────────────────────┘
```
- Shimmer animation: `background: linear-gradient(90deg, --surface 25%, --surface-raised 50%, --surface 75%)`, `background-size: 200% 100%`, `animation: shimmer 1.5s infinite`
- Radius matches actual component sizes

### 5.5 Toast Notifications

| Type | Color | Example |
|------|-------|---------|
| Error | `--danger` left border | "Goblin #1 is already in this encounter" |
| Warning | `--warning` left border | "Encounter already active — end it first" |
| Success | `--success` left border | "Aria added to initiative order" |
| Info | `--arcane` left border | "Thorin's turn" |

- Position: bottom-right, 16px margin
- Width: 320px max; padding: 12px 16px
- BG: `--surface-raised`; border-left: 3px solid (type color); radius `--r-md`
- Auto-dismiss: 4s; manual close `×`
- Stacks up to 3 toasts

---

## 6. Responsive Breakpoints

### Desktop (≥ 1024px) — Primary (DM laptop/monitor)
- Full layout: initiative list + slide-in panel side by side
- All controls visible in a single row per combatant
- Max-width 1024px, centered

### Tablet (768–1023px) — Secondary (tablet on table)
- Controls collapse: damage/heal become icon buttons (`[💥]` / `[❤️]`) that expand inline on tap
- Condition picker as full-width bottom sheet instead of popover
- Slide-in panel becomes a bottom sheet (80% viewport height)
- Round counter + "Next Turn" in sticky bar (always visible)

### Mobile (375–767px) — Player view only (phone at table)
- All edit controls hidden (player view enforced at this breakpoint regardless of role)
- Each combatant is a **stacked card** instead of a table row:
  ```
  ┌─────────────────────────────┐
  │  [18]  👤 ARIA           ▶  │  ← initiative + name + active indicator
  │  ████████████░░  45 / 45    │  ← HP bar full width
  │  [POI] [CHR]               │  ← condition badges
  └─────────────────────────────┘
  ```
- Card: full width, bg `--surface`, border `--border`, radius `--r-md`, padding 12px, margin-bottom 8px
- Active card: 4px gold left border + `--surface-raised` bg
- If `allowPlayerHpEdit` = true: damage/heal inputs appear below HP bar on own card only, full-width

---

## 7. Accessibility Notes

- **Color is never the only signal** (per DESIGN_SYSTEM rule `color-not-only`):
  - Conditions: 3-char abbreviation in JetBrains Mono on every badge
  - Active turn: gold border + "▶ [Name]'s turn" text label + row background change
  - HP tiers: numeric value always shown alongside color bar
- **Focus rings:** 2px `--accent` on every interactive element (inputs, buttons, badges, rows)
- **ARIA labels:**
  - Damage input: `aria-label="Damage amount for [name]"`
  - Heal input: `aria-label="Healing amount for [name]"`
  - `[+]` button: `aria-label="Add condition to [name]"`
  - `[×]` button: `aria-label="Remove [name] from encounter"`
  - Initiative badge: `aria-label="Initiative: 18"`
- **Keyboard navigation:** Tab order follows visual layout; Enter submits damage/heal inputs; Escape closes panels/popovers
- **Condition tooltips:** full condition name + 1-line effect on hover/focus (not just abbreviation)

---

## 8. Animation & Motion

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| HP bar fill change | `width` transition | 300ms | `ease` |
| Active combatant row change | Background + border color transition | 200ms | `ease-out` |
| Add Combatant slide-in | `transform: translateX(0)` | 250ms | `ease-out` |
| Toast appear | `opacity + translateY` | 200ms | `ease-out` |
| Toast dismiss | `opacity` | 150ms | `ease-in` |
| "Your Turn" banner | Fade in + scale 0.95→1 | 300ms | `ease-out` |
| Skeleton shimmer | `background-position` loop | 1.5s | `linear` |
| Condition picker popover | `opacity + scale 0.95→1` | 150ms | `ease-out` |

**Motion rule:** animations are functional, not decorative. No bounce, no spin, no dramatic entry. Keep it tactile and fast.
