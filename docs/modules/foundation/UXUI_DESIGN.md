# UXUI_DESIGN — Foundation (Sprint 0)
### D&D Campaign Manager · module 1 of 8

> Inputs: [PRD](./PRD.md) · [SA_BLUEPRINT](./SA_BLUEPRINT.md). **Design system is LOCKED at program level — this doc only documents how Foundation's screens use it.**
> Source of truth for tokens: [../../program/DESIGN_SYSTEM.md](../../program/DESIGN_SYSTEM.md). Nothing here re-picks colors or fonts.

---

## 0. Inherited design system (reference, not re-defined)
| Aspect | Value (from DESIGN_SYSTEM.md) |
|--------|-------------------------------|
| Theme | Dark "tactical fantasy console" (default & only theme this sprint) |
| Surfaces | `--bg #0B0E14` · `--surface #151A23` · `--surface-raised #1E2530` · `--border #2A323F` |
| Text | `--text #F1F5F9` · `--text-muted #94A3B8` · `--text-faint #64748B` |
| Accent / semantic | `--accent #D9A441` (gold) · `--arcane #8B5CF6` · `--danger #EF4444` · `--success #22C55E` · `--warning #F59E0B` |
| Fonts | **Cinzel** (brand/display only) · **Inter** (UI/body) · **JetBrains Mono** (numerics & invite code, `tabular-nums`) |
| Scale | type 12/14/16/18/20/24/32/48 · spacing 4/8 · radius sm6/md10/lg16 |
| Misc | Lucide icons · no emoji · visible focus rings (2–4px gold) · one gold primary CTA per screen · modal scrim 40–60% |

Tailwind mapping (defined once in `tailwind.config` / CSS vars by `/scaffold`): `bg`, `surface`, `surface-raised`, `border`, `text`, `muted`, `accent`, `arcane`, `danger`, `success`, `warning`. Fonts: `font-display` (Cinzel), `font-sans` (Inter, default), `font-mono` (JetBrains Mono).

---

## 1. Screen inventory (Foundation scope only)
| # | Screen | Route | Role |
|---|--------|-------|------|
| 1 | Landing | `/` | both |
| 2 | Create Campaign | `/create` | DM |
| 3 | Join Campaign | `/join` | player |
| 4 | Lobby — DM view | `/campaign/[id]` (role=dm) | DM |
| 5 | Lobby — Player view | `/campaign/[id]` (role=player) | player |
| — | Global chrome: connection-status pill + toaster | layout | both |

> Out of scope (not designed here): character sheet, combat, dice, reference data, story, AI.

---

## 2. Layout foundations
- **App shell:** full-height `min-h-dvh bg-[var(--bg)] text-[var(--text)] font-sans`. Centered content column `max-w-5xl` for lobby, `max-w-md` for forms/landing cards.
- **Responsive targets:** laptop (≥1024) and tablet (768–1023) are primary; layouts stay single-column and touch-comfortable (targets ≥44px) so a tablet passed around the table works. Breakpoints 375/768/1024/1440.
- **Spacing rhythm:** card padding 24 (`p-6`), stack gap 16 (`gap-4`), section gap 32 (`gap-8`).
- **Brand:** the wordmark "D&D Campaign Manager" uses `font-display` (Cinzel) at 24–32; everything else Inter. Cinzel never used for body or labels.

---

## 3. Screen specs

### 3.1 Landing (`/`)
**Goal:** two unmistakable paths in ≤1 glance (Fitts: big targets, generous spacing).
- Centered card stack on `--bg`. Cinzel wordmark + one-line tagline (`--text-muted`).
- **Two large cards** side-by-side on laptop, stacked on tablet:
  - **Create Campaign** (DM) — gold **primary** card: gold border/accent, `Crown` (Lucide) icon, "I'm the Dungeon Master". → `/create`.
  - **Join Campaign** (player) — secondary surface card: `Users` icon, "I'm a Player". → `/join`.
- Only ONE primary (gold) CTA emphasis = Create; Join is visually subordinate (surface, not gold).

```tsx
<main className="min-h-dvh grid place-items-center p-6">
  <div className="w-full max-w-2xl text-center space-y-8">
    <h1 className="font-display text-4xl text-[var(--text)]">D&amp;D Campaign Manager</h1>
    <p className="text-muted">Run your table, live — on this Wi-Fi, no account needed.</p>
    <div className="grid sm:grid-cols-2 gap-4">
      <a href="/create"
         className="rounded-[10px] border-2 border-accent bg-surface p-6 text-left
                    hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-accent outline-none">
        <Crown className="text-accent" /> <span className="block mt-3 text-lg">Create Campaign</span>
        <span className="text-muted text-sm">I'm the Dungeon Master</span>
      </a>
      <a href="/join"
         className="rounded-[10px] border border-border bg-surface p-6 text-left
                    hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-accent outline-none">
        <Users className="text-arcane" /> <span className="block mt-3 text-lg">Join Campaign</span>
        <span className="text-muted text-sm">I'm a Player</span>
      </a>
    </div>
  </div>
</main>
```

### 3.2 Create Campaign (`/create`)
- `max-w-md` card. Fields: **Campaign name** (1–60), **Your DM name** (1–24). Both visible labels (not placeholder-only), required asterisk.
- Submit = gold primary button full-width: "Create & Get Invite Code".
- **Loading:** button shows spinner + disabled (`combat`-free; just async). **Error:** inline below field + toast on server reject.
- On success → navigate to `/campaign/[id]` (DM), token stored in localStorage.

### 3.3 Join Campaign (`/join`)
- `max-w-md` card. Fields:
  - **Invite code** — `font-mono` input, `tabular-nums`, auto-uppercase, auto-format with a dash `K7Q-M2P`, maxLength enforced; large text (20) for legibility.
  - **Display name** — Inter, 1–24.
- **Inline errors (color-not-only — icon + text):**
  - Bad/unknown code → `AlertCircle` + "No campaign found for that code." (`--danger`).
  - Duplicate name → "That name's taken in this campaign — pick another." (`--warning`).
  - Closed campaign → "This campaign has ended."
- Submit = gold primary "Join Table". Loading spinner; on success → `/campaign/[id]` (player).

```tsx
<label className="block text-sm font-medium mb-1">Invite code <span className="text-danger">*</span></label>
<input inputMode="text" autoCapitalize="characters"
  className="w-full font-mono text-xl tabular-nums tracking-widest rounded-[10px]
             bg-surface border border-border px-4 py-3 focus-visible:ring-2 focus-visible:ring-accent outline-none"
  placeholder="K7Q-M2P" aria-describedby="code-err" />
{error && <p id="code-err" className="mt-1 text-sm text-danger flex items-center gap-1">
  <AlertCircle size={14}/> {error}</p>}
```

### 3.4 Lobby — DM view (`/campaign/[id]`, role=dm)
The most important screen for table-legibility. Two zones:

**A. Invite zone (hero) — readable across the room.**
- Campaign name as an **editable** heading (`Pencil` affordance; inline edit → emits `campaign:rename`). Cinzel-free (it's data) — Inter 24, weight 600.
- **BIG invite code:** `font-mono`, **48px**, `tabular-nums`, `letter-spacing` wide, gold `--accent`, centered in a `--surface-raised` panel with a **Copy** button (`Copy` icon → toast "Code copied"). This is the "read aloud across the table" element.
- **Join hint:** `http://<dm-ip>:3000` shown in `font-mono` `--text-muted` with a copy button; small helper "Players join on this Wi-Fi."

**B. Roster zone.**
- Live list of participants. Each row: **presence dot** + name + role chip + (DM-only) remove button.
  - **Presence is color-not-only:** filled green dot **+** "online" label for connected; hollow grey dot **+** "offline" for disconnected. Never dot-color alone.
  - DM row marked with `Crown`; players with `Users`. Role chip uses `--arcane` for player, `--accent` for DM.
  - **Remove** = `UserMinus` icon button (`--danger` on hover) → confirm dialog (scrim 50%) → emits `participant:remove`. DM can't remove self.
- Roster updates **live** on `roster:update` (≤500ms) with a subtle highlight-fade on the changed row (respect `prefers-reduced-motion`).

```tsx
<section className="rounded-[16px] bg-surface-raised border border-border p-6 text-center">
  <p className="text-muted text-sm mb-2">Invite code</p>
  <p className="font-mono tabular-nums text-5xl tracking-[0.15em] text-accent select-all">K7Q-M2P</p>
  <button className="mt-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text
                     focus-visible:ring-2 focus-visible:ring-accent rounded px-2 py-1">
    <Copy size={14}/> Copy code
  </button>
</section>
```

### 3.5 Lobby — Player view (`/campaign/[id]`, role=player)
- Same roster component (read-only: no remove buttons, no editable name, no invite hero — players already joined).
- Campaign name heading + the live roster.
- **Empty/waiting state:** when only the DM (or no encounter yet) — friendly empty panel: `Hourglass` icon + "You're in. Waiting for the DM to start the session." (`--text-muted`). This is the Foundation "playable seat" terminus until Sprint 2+ screens light up.

### 3.6 Global chrome
- **Connection-status pill** (top-right of layout, `font-sans` 12–14, color-not-only with icon):
  - Connected → `Wifi` + "Connected" (`--success`).
  - Reconnecting → spinner + "Reconnecting…" (`--warning`).
  - Offline → `WifiOff` + "Offline" (`--danger`).
- **Toaster** (bottom): join/leave notices, "Code copied", and error toasts. Auto-dismiss 3–5s; `aria-live="polite"`; never steals focus.
- **Kicked:** on `session:kicked`, show a blocking modal "The DM removed you from the campaign." → back to `/`.

---

## 4. System states (required coverage)
| State | Treatment |
|-------|-----------|
| **Loading** (creating/joining) | button spinner + disabled; lobby first paint shows a skeleton roster row until `state:snapshot` arrives |
| **Empty** (player waiting, roster = just DM) | friendly empty panel (§3.5), never a blank screen |
| **Error** (bad code / dup name / unauthorized / malformed) | inline (forms) + toast; typed messages from `error` event; icon+text |
| **Disconnected / reconnecting** | connection pill flips to warning; roster rows of dropped users go to hollow-dot "offline"; on resume, snapshot repaints and pill → connected |
| **Server restarted** | clients auto-`session:resume` via stored token → snapshot repaint; pill briefly "Reconnecting…" then "Connected" |

---

## 5. Accessibility
- All text/background pairs meet **≥4.5:1** (tokens chosen for this: `--text` on `--surface` ≈ 13:1; `--accent` gold on `--bg`/`--surface-raised` passes for large code text).
- **Presence & status never rely on color alone** — every dot/pill pairs an icon **and** a text label.
- Visible **focus rings** (gold, 2px) on every interactive element; tab order matches visual order.
- Invite code is `select-all` + has a copy button (no precise selection needed); announced via `aria-label="Invite code K7Q-M2P"`.
- Forms: `<label for>` per field, required marked, errors via `aria-describedby` + `role="alert"`; first invalid field focused on submit error.
- Respect `prefers-reduced-motion` for the roster highlight-fade.

---

## 6. Component map (for `/proto` and `/dev`)
| Component | Used by | Notes |
|-----------|---------|-------|
| `BrandWordmark` | landing, headers | Cinzel only place |
| `ChoiceCard` | landing | gold (primary) vs surface (secondary) variants |
| `LabeledInput` / `CodeInput` | create, join | CodeInput = mono, tabular, auto-dash/upper |
| `PrimaryButton` (gold) / `GhostButton` | all | one primary per screen |
| `InviteHero` | DM lobby | 48px mono gold code + copy + IP hint |
| `Roster` / `RosterRow` | both lobbies | presence dot+label, role chip, optional remove |
| `PresenceDot` | roster, pill | filled/hollow + label (color-not-only) |
| `ConnectionPill` | layout | connected/reconnecting/offline |
| `Toaster` / `ConfirmDialog` | global | aria-live; scrim 50% |

---

*Next stage: `/proto` reads the 3 docs → builds clickable `docs/modules/foundation/mockups/*.html` (landing, create, join, DM lobby, player lobby) using these tokens, with mock data + simulated roster/presence.*
