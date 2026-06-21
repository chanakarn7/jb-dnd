# UXUI_DESIGN — Player UI + Dice + Dashboard (Sprint 6)

> Module base dir: `docs/modules/player-ui/`
> Design system **inherited** from `docs/program/DESIGN_SYSTEM.md` — no re-picking of colors/fonts/spacing.
> Read by: `/proto` (mockups) · `/dev` (implementation).

---

## Design System (inherited — locked at program level)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#0B0E14` | Page background |
| `--surface` | `#151A23` | Cards, panels, sections |
| `--surface-raised` | `#1E2530` | Elevated cards, inputs, die buttons |
| `--border` | `#2A323F` | All borders, dividers |
| `--text` | `#F1F5F9` | Primary text |
| `--text-muted` | `#94A3B8` | Secondary text, labels |
| `--text-faint` | `#64748B` | Timestamps, hints, captions |
| `--accent` | `#D9A441` | Gold CTAs, active states, highlights |
| `--accent-hover` | `#E8B95C` | Gold hover states |
| `--arcane` | `#8B5CF6` | DM chips, XP badges, search type badges |
| `--danger` | `#EF4444` | Errors, delete, HP critical, conditions |
| `--success` | `#22C55E` | HP healthy, success toasts |
| `--warning` | `#F59E0B` | HP low (25–49%), warnings |

**Typography:**
- `Cinzel` — section headers, panel titles, stat card labels (fantasy serif)
- `Inter` — all UI text, labels, descriptions (16px base, 14px secondary, 12px hint)
- `JetBrains Mono` — numbers, dice results, XP values, HP, dates, formulas

**Spacing:** 4px grid. Common: 4 / 8 / 12 / 16 / 24 / 32 / 48px.
**Radius:** 4px (cards), 2px (pills/badges), 8px (modals/panels).
**Icons:** Lucide SVG inline only.

---

## 1. Dice Panel

### 1.1 Floating Trigger Button

```
┌─────────────────────────────────────────────────────┐
│ (campaign page content)                             │
│                                                     │
│                                       ┌──────────┐  │
│                                       │  ⬡ d20   │  │ ← 56×56px floating, bottom-right
│                                       │ (gold)   │  │   position: fixed, z-50
│                                       └──────────┘  │
└─────────────────────────────────────────────────────┘
```

**Spec:**
- `position: fixed; bottom: 24px; right: 24px; z-index: 50;`
- Size: 56×56px, `border-radius: 50%`
- Background: `--accent`; hover: `--accent-hover`
- Icon: d20 polyhedron SVG (Lucide `Dice6` or custom inline), 24×24, white
- Shadow: `0 4px 12px rgba(217, 164, 65, 0.4)` (gold glow)
- Tooltip: "Roll Dice" on hover
- Click: opens Dice Panel slide-out from right

---

### 1.2 Dice Panel (Slide-out)

```
┌──────────────────────────────────────────────────────────────┬────────────────────────┐
│  Campaign content                                            │  ✕  Dice Roller         │  ← Cinzel 16px, --border-l
│                                                              │─────────────────────────│
│                                                              │  ┌────┐ ┌────┐ ┌────┐  │  ← Die buttons: d4 d6 d8
│                                                              │  │ d4 │ │ d6 │ │ d8 │  │    surface-raised bg
│                                                              │  └────┘ └────┘ └────┘  │    gold text, gold border on hover
│                                                              │  ┌────┐ ┌────┐ ┌────┐  │
│                                                              │  │d10 │ │d12 │ │d20 │  │
│                                                              │  └────┘ └────┘ └────┘  │
│                                                              │         ┌────┐          │
│                                                              │         │d100│          │
│                                                              │         └────┘          │
│                                                              │─────────────────────────│
│                                                              │  Formula  [2d6+3  ] Roll│  ← text input + gold button
│                                                              │  Context  [Attack...  ] │  ← optional label input
│                                                              │─────────────────────────│
│                                                              │  [Normal][Adv][Disadv]  │  ← pill mode tabs
│                                                              │     □ Private (DM only) │  ← toggle, hidden from players
│                                                              │─────────────────────────│
│                                                              │            18           │  ← result: JetBrains Mono 48px
│                                                              │       2d6+3 · Attack    │    gold, text-muted hint
│                                                              │  Adv: [18] 5̶  kept: 18  │  ← advantage display
│                                                              │─────────────────────────│
│                                                              │  Recent Rolls           │  ← Cinzel 12px header
│                                                              │  ╔══╗ d20+5  [23] Init  │  ← feed rows
│                                                              │  ║Ar║                   │    player chip (arcane=DM)
│                                                              │  ╚══╝  2 min ago        │
│                                                              │  ╔══╗ 2d6+3  [11] Dmg   │
│                                                              │  ║Bo║  just now          │
│                                                              └──────────────────────────┘
                                                                 ← 320px fixed width, 100vh height
```

**Panel layout (top→bottom, 320px wide, full height):**

```
┌─────────────────────────────────┐
│  [×]      Dice Roller     [pin] │  header, surface bg, --border-b 1px
├─────────────────────────────────┤
│  ┌───┐ ┌───┐ ┌───┐             │  die buttons grid (3-col)
│  │ d4│ │ d6│ │ d8│             │  surface-raised, 48×40px
│  └───┘ └───┘ └───┘             │  JetBrains Mono gold text
│  ┌───┐ ┌───┐ ┌───┐             │
│  │d10│ │d12│ │d20│             │
│  └───┘ └───┘ └───┘             │
│         ┌────┐                  │
│         │d100│                  │
│         └────┘                  │
├─────────────────────────────────┤
│  [___formula input___] [🎲 Roll]│  formula row
│  [___context label________]     │  context row (optional)
├─────────────────────────────────┤
│  [Normal] [Adv] [Disadv]        │  mode pill tabs
│  □ Private  (DM only)           │  toggle switch
├─────────────────────────────────┤
│                                 │
│          ◈ 18                   │  result number, 48px, gold
│       2d6+3  ·  Attack          │  formula + context, text-muted 12px
│    Adv:  18   ~~5~~             │  advantage: both dice (5 strikethrough)
│                                 │
├─────────────────────────────────┤
│  Recent Rolls             [↺]   │  section header (Cinzel 12px) + refresh
│ ─────────────────────────────── │
│  [Ar] d20+5  23  Initiative      │  feed row: chip + formula + result + label
│                    2 min ago    │
│  [Bo] 2d6+3  11  Damage         │
│                    just now     │
│  [DM] d20   14  Perception     │  DM chip = arcane purple
│                    3 min ago    │
│  ...                            │
└─────────────────────────────────┘
```

**Die button spec:**
- Width: 100%; height: 40px; `border-radius: 4px`
- Background: `--surface-raised`; border: `1px solid --border`
- Text: `JetBrains Mono`, `--accent`, 14px font-weight 600
- Hover: border-color `--accent`, background slight gold tint (`rgba(217,164,65,0.08)`)
- Active/press: background `rgba(217,164,65,0.16)`
- Press triggers inline result animation (number cycling 200ms, then settles)

**Roll button:**
- Background: `--accent`; hover: `--accent-hover`; color: `#0B0E14` (dark text on gold)
- Font: Inter 14px, weight 600

**Mode pills:**
- Background: `--surface-raised`; active: `--accent`; active text: `#0B0E14`
- Radius: 999px (pill shape)

**Result display:**
- Number: `JetBrains Mono` 48px, `--accent`
- For advantage/disadvantage: two numbers side by side; dropped value has `text-decoration: line-through; color: --text-faint`; kept value highlighted `--accent`

**Roll Feed row:**
- Player name chip: 28×28px circle, `JetBrains Mono` 11px, initials
  - DM chip: `--arcane` bg, white text
  - Player chip: `--surface-raised` bg, `--text-muted` text
- Formula text: `JetBrains Mono` 13px, `--text-muted`
- Result: `JetBrains Mono` 15px, `--accent`, bold
- Context label: Inter 12px, `--text-faint`
- Time-ago: Inter 11px, `--text-faint`, right-aligned

**Error state (invalid formula):**
- Danger toast slides in below formula input: `background: rgba(239,68,68,0.15); border: 1px solid --danger`
- Message: "Cannot parse '7d0' — use format like 2d6+3" (Inter 13px, danger)
- Auto-dismisses after 3s

---

## 2. Player Quick-View HUD

### 2.1 Desktop Layout (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Aria Moonwhisper         ❤ 18 / 32  [████████░░░░] ⊕ 13  👁 12   [🎲 Roll Initiative]│
│ Wizard · Lv 5            UNCONSCIOUS (if HP=0)                                       │
│                                                                                      │
│ STR    DEX    CON    INT    WIS    CHA       [●●●○] [●●○] [●○]    ⬡ Poisoned        │
│  8[-1] 14[+2] 13[+1] 18[+4] 12[+1] 10[+0]   Lv1   Lv2   Lv3                       │
│       ↑click any ability to quick-roll                                               │
└──────────────────────────────────────────────────────────────────────────────────────┘
surface bg, --border-b 1px, padding 12px 24px
```

**Sections (left → right on desktop):**

```
[Character ID]          [HP Widget]           [Stats]         [Initiative]
─────────────          ────────────          ────────         ────────────
Cinzel 14px            ❤ 18 / 32            ⊕ AC 13          [🎲 Roll Init]
Inter 12px muted       JetBrains Mono 18px  👁 PP 12          gold button, 36px
"Wizard · Lv 5"        Color bar: 4px tall  surface-raised
                       HP edit [−][18][+]    pill badges

[Ability Scores]                  [Spell Slots]                [Conditions]
────────────────                  ─────────────                ────────────
6 chips in a row                  ●●●○ Lv1 (4 slots, 1 used)  ⬡ Poisoned
Each chip: 52×40px                ●●○  Lv2 (3 slots, 1 used)  ⬡ Exhausted
surface-raised bg                 ●○   Lv3 (2 slots, 0 used)  danger pills
STR·DEX·CON·INT·WIS·CHA          Click pip → toggle used      Read-only
Score (JMono 13px)                Hidden if no spell slots     from Encounter
Mod [+2] (Inter 11px text-faint)  (non-spellcasters)
Click → quick-roll d20+mod
```

**HP Widget detail:**
```
❤ [current] / [max]
[████████░░░░░░░░]  ← 80px wide, 4px height
  ↑ color: ≥50% HP → --success | 25–49% → --warning | <25% → --danger
```

HP Quick-Edit:
```
[−]  [18]  [+]
     ↑ Input, 40px wide, JetBrains Mono
     Blur / Enter → PATCH /api/characters/[id]/hp
     Clamped display — never < 0 or > maxHp
```

**Unconscious state (HP = 0):**
```
❤  0 / 32  ← danger color
[                ]  ← fully red bar
  ● UNCONSCIOUS    ← danger badge, Cinzel 11px, pulsing border animation
```

**Spell slot pips:**
```
Lv1: ● ● ● ○   (3 available, 1 used)
Lv2: ● ● ○      (2 available, 1 used)
     ↑ ● = filled circle, --accent color (available)
     ○ = empty circle, --surface-raised border (used)
     Click → toggle (PATCH spell-slots)
     8px diameter pip, 4px gap
```

### 2.2 Mobile Collapsed (< 768px)

```
┌────────────────────────────────────────┐
│ Aria Moonwhisper  ❤ 18/32  ⊕13  [🎲]  │  ← single bar, no ability scores
│                               [▼ More] │     "More" expands full HUD
└────────────────────────────────────────┘
```

### 2.3 No Character State

```
┌─────────────────────────────────────────────────────────┐
│  ⚠ No character claimed  [→ Claim Character]            │
│    Visit /characters to create or claim your character  │
└─────────────────────────────────────────────────────────┘
--warning text, gold CTA button
```

### 2.4 Loading Skeleton

```
┌────────────────────────────────────────────────────────────────────────┐
│  [████████] [████████████░] [████] [████]                    [███████] │
│  [░░░░░░░]  ←surface-raised pulsing blocks, same heights as real data  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. DM Dashboard Page (`/campaign/[id]/dashboard`)

### 3.1 Desktop Layout (≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  THORNHAVEN CAMPAIGN          [Dashboard]  [≡ Story]  [⚔ Combat]              🔍│  ← nav
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐                                 │  ← stat cards row
│  │Players │  │Quests  │  │Sessions│  │XP Total│
│  │  4     │  │  2     │  │  5     │  │ 1,650  │
│  └────────┘  └────────┘  └────────┘  └────────┘
│                                                                                  │
│  ┌───────────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │ ▐ Active Quests                      │  │ Party Roster            Cinzel   │ │
│  │                                      │  │─────────────────────────────────│ │
│  │  Find the Sunken Temple              │  │ Aria Moonwhisper  Wizard 5      │ │
│  │  from Elder Maren  ████░░░ 2/5       │  │ ████████░░░░░░░  18/32 HP      │ │
│  │                                      │  │ ⬡ Poisoned                      │ │
│  │  Clear the Barrow (recently active)  │  │─────────────────────────────────│ │
│  │  from Village Council  ████████ 4/4  │  │ Bodrick Stonehammer  Fighter 3  │ │
│  │                                      │  │ ████████████████  28/28 HP      │ │
│  │                   [+ New Quest]      │  │ —                               │ │
│  └───────────────────────────────────── │  │─────────────────────────────────│ │
│                                         │  │ Thorn Quickfingers  Rogue 4     │ │
│  ┌────────────────────────────────────┐ │  │ ██████░░░░░░░░░░  14/36 HP     │ │
│  │ Last Session                       │ │  │ ☠ UNCONSCIOUS                   │ │
│  │─────────────────────────────────── │ │  └─────────────────────────────────┘ │
│  │ Jun 15, 2026                       │ │
│  │ Thornhaven Arrival    [250 XP]     │ │
│  │ The party arrived in the walled... │ │
│  └────────────────────────────────────┘ │
│                                          │
│  [▶ Start Encounter]  [📋 Log Session]   │  ← CTA row
│                                          │
└──────────────────────────────────────────┘
     ← 60% left column                → 40% right column
```

### 3.2 Stat Cards

```
┌──────────────────────┐
│  👥  Players          │  ← Cinzel 11px, ALL CAPS, --text-muted
│       4              │  ← JetBrains Mono 32px, --text
└──────────────────────┘
surface-raised bg, --border 1px, radius 4px, padding 16px

Icon colors:
  Players → --arcane (👥 icon)
  Quests  → --accent (⚔ or map icon)
  Sessions→ --text-muted (scroll icon)
  XP Total→ --success (star/sparkle icon)
```

### 3.3 Active Quests Panel

```
┌──────────────────────────────────────────────────────────┐
│▐ Active Quests                                 ← gold left-border 3px
│──────────────────────────────────────────────────────────│
│  Find the Sunken Temple                  from Elder Maren│  ← Inter 600 + text-muted
│  [████████░░░░░░░░░░░░░░░░░░░░] 2/5 objectives           │  ← progress bar (gold fill)
│──────────────────────────────────────────────────────────│
│                                                          │
│  Empty state (no active quests):                         │
│         🗺  No active quests                             │
│             All caught up!                               │
└──────────────────────────────────────────────────────────┘
Progress bar: height 6px, background --border, fill --accent, radius 3px
"2/5" pill: JetBrains Mono 11px, surface-raised bg
```

### 3.4 Last Session Card

```
┌───────────────────────────────────────────────────┐
│  Last Session                         Cinzel 13px │
│───────────────────────────────────────────────────│
│  ┌──────────────┐  Thornhaven Arrival             │
│  │ JUN 15, 2026 │  ← date badge, JMono, surface   │
│  └──────────────┘  [250 XP]  ← arcane pill        │
│                    The party arrived in the…       │  ← text-muted, 2 lines
│                                             [→]   │
└───────────────────────────────────────────────────┘
Empty state: 📜 No sessions logged yet  [+ Log First Session]
```

### 3.5 Roster Card (per character)

```
┌─────────────────────────────────────────────────────┐
│  Aria Moonwhisper                    Wizard · Lv 5  │
│  ██████████████░░░░░░░░░░░░  18 / 32 HP             │
│     ↑ --success fill (≥50%)  JetBrains Mono 13px    │
│  ⬡ Poisoned  ⬡ Blinded  +2 more                    │  ← danger pills; overflow "+N more"
└─────────────────────────────────────────────────────┘
Unconscious character:
│  Thorn Quickfingers                  Rogue · Lv 4  │
│  [░░░░░░░░░░░░░░░░░░░░░░░░░░]   0 / 36 HP          │  ← full --danger bar
│  ☠ UNCONSCIOUS                                     │  ← Cinzel 11px, --danger, pulsing
```

### 3.6 Quick-Start CTAs

```
[▶  Start Encounter]       [📋  Log Session]
gold bg, dark text         surface-raised bg, --border, --text
Inter 14px, bold           Inter 14px, --text-muted
padding 12px 24px          padding 12px 24px
```

### 3.7 Empty States

Dashboard with no data:
```
┌───────────────────────────────────────────────────┐
│  ⚔  Welcome, Dungeon Master!                      │
│                                                   │
│  Your campaign is empty. Get started:             │
│                                                   │
│  [+ Invite Players]  [📋 Log First Session]       │
│              [⚔ Start Encounter]                  │
└───────────────────────────────────────────────────┘
```

### 3.8 Loading Skeleton

```
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   ← 4 stat card skeletons
│░░░░░░│ │░░░░░░│ │░░░░░░│ │░░░░░░│     surface-raised, pulsing
└──────┘ └──────┘ └──────┘ └──────┘

┌──────────────────────┐  ┌─────────────────┐
│ ░░░░░░░░░░░░░░░░░░░  │  │ ░░░░░░░░░░░░░░░ │   ← quest + roster skeletons
│ ░░░░░░░░░░░░░░       │  │ ░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░  │  │ ░░░░░░░░░░░░░░░ │
└──────────────────────┘  └─────────────────┘
```

---

## 4. Global Search

### 4.1 Navbar Integration

```
Campaign nav bar (existing):
┌────────────────────────────────────────────────────────────────────────┐
│  ⚔ THORNHAVEN CAMPAIGN          [Roster] [Combat] [Story]   [🔍]      │
│                                                                        │
│  After click → search expands:                                         │
│  ⚔ THORNHAVEN CAMPAIGN          [______Search campaign_____] [✕]      │
│  ↓ transitions: width: 0 → 280px, opacity: 0 → 1                     │
└────────────────────────────────────────────────────────────────────────┘
Input: surface-raised bg, --border, Inter 14px, height 36px
       placeholder "Search spells, quests, NPCs…" (--text-faint)
       Lucide Search icon (16px, --text-muted) inside input left
```

### 4.2 Results Dropdown

```
┌─────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────┐   │  ← absolute, surface-raised bg
│  │ 🔍  [fireball_____________]  ✕           │   │     --border, shadow, top: 48px
│  ├──────────────────────────────────────────┤   │     max-height: 400px, overflow-y: scroll
│  │  SPELLS          [5e Ref]                │   │  ← Cinzel 11px uppercase, --text-faint
│  │  Fireball                 Level 3 · Evoc │   │     arcane pill: "5e Ref"
│  │  Fire Bolt                Cantrip · Evoc │   │
│  │                                          │   │
│  │  ITEMS           [5e Ref]                │   │
│  │  Fire Arrows              Weapon         │   │
│  │                                          │   │
│  │  QUESTS          [Campaign]              │   │  ← campaign-scoped results
│  │  Find the Sunken Temple   from Elder M.  │   │     green pill: "Campaign"
│  │                                          │   │
│  │  NPCS            [Campaign]              │   │
│  │  Baron Voss               Villain        │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Result row spec:**
- Height: 36px; padding: 8px 12px
- Name: Inter 14px 600, `--text`
- Hint: Inter 12px, `--text-muted`
- Hover: `background: rgba(217,164,65,0.08)`
- Click: navigate + close search

**Type badge spec:**
```
[5e Ref]      → --arcane bg (purple), white 10px, radius 2px
[Campaign]    → --accent bg (gold), dark 10px, radius 2px
```

**Section header:**
```
SPELLS    [5e Ref]
↑ Cinzel 11px uppercase, --text-faint, letter-spacing: 0.1em
```

### 4.3 Loading State

```
┌────────────────────────────────────────────┐
│  SPELLS                                    │
│  [████████████████████░░░░░░░░░░░░░░░░░]  │  ← 3 skeleton rows per section
│  [████████████████░░░░░░░░░░░░░░░░░░░░░]  │    surface-raised, 24px height
│  [████████████████████████░░░░░░░░░░░░░]  │    pulsing opacity animation
│                                            │
│  QUESTS                                    │
│  [████████████████████████░░░░░░░░░░░░░]  │
└────────────────────────────────────────────┘
```

### 4.4 Empty State

```
┌────────────────────────────────────────┐
│                                        │
│       🔍  No results for "xyzzy"       │  ← --text-muted, Inter 14px, centered
│                                        │
└────────────────────────────────────────┘
```

### 4.5 Mobile Search (< 768px)

Full-screen overlay:
```
┌────────────────────────────────────────┐
│ ✕      [___Search campaign______] 🔍  │  ← full-width input + close
├────────────────────────────────────────┤
│  SPELLS                                │
│  Fireball          Level 3 · Evoc     │
│  Fire Bolt         Cantrip · Evoc     │
│  QUESTS                                │
│  Find the Temple   from Elder Maren   │
│                                        │
│  (scrollable, full-height)             │
└────────────────────────────────────────┘
background: --bg, z-index: 100
```

---

## 5. State Matrix

| Component | State | Visual |
|-----------|-------|--------|
| Dice Panel | Idle | No result shown; die buttons ready |
| Dice Panel | Rolling | Number cycles 0→N (200ms animation), then settles on result |
| Dice Panel | Result | Large gold number + formula hint |
| Dice Panel | Error | Danger inline toast below formula input, 3s auto-dismiss |
| Quick-View | Loading | Skeleton bars, same layout, pulsing opacity |
| Quick-View | No character | Warning bar + "Claim Character" CTA |
| Quick-View | Active | Normal HUD display |
| Quick-View | Unconscious | HP=0, danger bar, pulsing "UNCONSCIOUS" badge |
| Dashboard | Loading | Skeleton per stat card + panels |
| Dashboard | Empty campaign | Welcome card with getting-started CTAs |
| Dashboard | Populated | Full stats + quests + roster + last session |
| Dashboard | Error | Danger toast + retry button |
| Search | Idle | Icon only (input hidden) |
| Search | Expanded, empty | Input visible, placeholder, no dropdown |
| Search | Searching | Dropdown with skeleton rows |
| Search | Results | Grouped dropdown |
| Search | Empty result | "No results for 'X'" centered message |

---

## 6. Responsive Breakpoints

| Breakpoint | Dice Panel | Quick-View | Dashboard | Search |
|------------|-----------|------------|-----------|--------|
| ≥1024px (Desktop) | Right slide-out 320px | Full-width HUD, all sections | 2-col (60/40) | Inline expand in navbar |
| 768–1023px (Tablet) | Bottom sheet, full-width | Scrollable HUD, compact | 1-col stacked | Modal overlay |
| <768px (Mobile) | Bottom sheet (swipe up) | Collapsed bar, "▼ More" expand | 1-col, cards | Full-screen overlay |

---

## 7. Component Interaction Patterns

### Dice Roll Animation
- Duration: 200ms
- Effect: counter cycles from 1 to result (fast then slow, like a slot machine)
- Implementation: `requestAnimationFrame` loop with exponential deceleration
- No external animation library needed

### HP Edit Interaction
- Inline `<input type="number">` always visible, 40px wide
- User types → value shown immediately
- On blur or Enter → PATCH (optimistic update, revert on error)
- `[−]` decrements by 1; `[+]` increments by 1 (Fitts: large enough targets, ≥36px)
- Clamp display: if value < 0 → show 0; if > maxHp → show maxHp (red border flash on clamp)

### Spell Slot Pips
- Click pip → immediate visual toggle (optimistic)
- PATCH `/api/characters/[id]/spell-slots` in background
- On error: revert pip + danger toast "Failed to save"

### Quick-Roll (Ability/Skill)
- Click chip → immediately sends `dice:roll` event via Socket.io
- Result appears in Dice Panel feed for all clients
- No modal required — one tap = one roll

### Search Debounce
- 300ms debounce on input
- Cancel in-flight request if new keystroke < 300ms
- Show loading skeleton immediately on keystroke (before debounce fires) if query ≥ 2 chars

---

## 8. Accessibility Notes

- All interactive elements ≥36px tap target (Fitts's Law)
- Die buttons: `aria-label="Roll d20"` etc.
- HP input: `aria-label="Current HP"`, `min=0`, `max={maxHp}`
- Search: `role="combobox"`, results `role="listbox"`, items `role="option"`
- Dice Panel: `role="dialog"`, `aria-label="Dice Roller"`, ESC closes
- Color is never the only differentiator (HP bar: color + text value; conditions: color + text label)
- Unconscious state: `aria-live="polite"` on HP widget to announce changes
