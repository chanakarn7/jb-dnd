# DESIGN_SYSTEM — one look, locked once, every module inherits

> Picked ONCE at program level (Gate 2, via `ui-ux-pro-max`). Every module's `/uxui` **inherits and documents** these tokens — modules must **NOT** re-pick colors/fonts, or the app will look like eight different apps. Only a module's **own screens** are module-level; the system below is shared.

## Design direction
**"Tactical fantasy console" — dark, high-contrast, flat.** Readability at the table beats theming. During combat, HP / initiative / whose-turn must read at a glance across a dim room. A restrained gold/arcane accent gives a fantasy feel without parchment textures or low-contrast ornamentation. Dark mode is the default and primary theme (game rooms are dim); both DM and player views share this exact system.

Guiding rules (from UX intelligence): high-contrast pairs ≥4.5:1 (`color-accessible-pairs`), semantic tokens not raw hex in components (`color-semantic`), **tabular figures for all combat numerics** so columns don't shift (`number-tabular`), 4/8 spacing rhythm (`spacing-scale`), color is never the only signal (`color-not-only`).

## Color tokens (dark theme — primary)
Semantic names; map raw hex only here.

| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#0B0E14` | app background (near-black slate) |
| `--surface` | `#151A23` | cards, panels |
| `--surface-raised` | `#1E2530` | popovers, raised rows, active combat row base |
| `--border` | `#2A323F` | dividers, card borders (visible in dark) |
| `--text` | `#F1F5F9` | primary text (contrast ~15:1 on `--bg`) |
| `--text-muted` | `#94A3B8` | secondary text (≥4.5:1 on surfaces) |
| `--text-faint` | `#64748B` | disabled / hints |
| `--accent` | `#D9A441` | **brand gold** — primary actions, brand, section banners |
| `--accent-hover` | `#E8B95C` | gold hover/active |
| `--arcane` | `#8B5CF6` | secondary accent — magic/spells, info |
| `--hp` / `--danger` | `#EF4444` | HP loss, damage, destructive actions |
| `--heal` / `--success` | `#22C55E` | healing, success, "saved" |
| `--warning` | `#F59E0B` | warnings, low-HP threshold |
| `--turn-active` | `#D9A441` | **whose-turn highlight** — gold ring + subtle glow on the active combatant |

**"Whose turn" treatment (non-color-only):** active combatant gets the gold `--turn-active` left border (4px) **+** a bold "▶ YOUR TURN / [Name]'s turn" label **+** raised surface. Never signal turn by color alone.

**Light theme:** a secondary, derived theme may be added later (Player UI sprint) using lighter tonal variants — do **not** invert; re-verify contrast independently. Dark is the source of truth.

## Typography
Three faces, each with one clear role (heading/body pairing + a functional numeric face per `number-tabular`):

| Role | Font | Use |
|------|------|-----|
| **Display / brand** | `Cinzel` (serif, fantasy) | campaign titles, section banners, splash — **sparingly**, never body |
| **UI / headings / body** | `Inter` (variable sans) | everything functional — labels, body, buttons, tables |
| **Numerics / data** | `JetBrains Mono` (tabular figures) | HP, AC, initiative, dice results, any column of numbers |

- Load with `font-display: swap`. Use `font-variant-numeric: tabular-nums` everywhere numbers align.
- Body base **16px**, line-height **1.5**; headings 600–700 weight, body 400, labels 500.

### Type scale (px)
`12 · 14 · 16 · 18 · 20 · 24 · 32 · 48`
- Body 16 · small/labels 14 · captions 12 · h3 20 · h2 24 · h1 32.
- **Combat HUD numerics 32–48** (large, glanceable across the room) — the one place we go big.

## Spacing & layout
- **4/8 scale:** `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.
- Radius: `--r-sm 6px` · `--r-md 10px` · `--r-lg 16px`.
- Elevation: flat by default; use `--border` + one soft shadow for raised surfaces (`0 4px 16px rgba(0,0,0,.4)`). Consistent scale — no random shadow values.
- Desktop content max-width ~`max-w-7xl`; responsive down to tablet (the table device). Mobile-first breakpoints `375 / 768 / 1024 / 1440`.

## Components & states
- Icons: one SVG set (**Lucide**), consistent stroke (1.5–2px). **No emoji as icons.**
- Every interactive element: visible **focus ring** (2–4px, `--accent`), distinct hover/pressed/disabled (disabled 0.4 opacity). State is never color-only.
- One **primary CTA** per screen (gold `--accent`); secondary actions subordinate. Destructive actions use `--danger` and sit apart from primary.
- Modals/sheets: scrim 40–60% black; dismiss affordance always present.

## What modules inherit vs. define
- **Inherit (do not change):** all tokens above — colors, fonts, scale, spacing, radius, icon set, state treatments.
- **Define per module (`/uxui`):** only that module's *screens & layouts* built from these tokens (e.g. the combat tracker layout, the character sheet layout) — documented under `docs/modules/<module>/`.
