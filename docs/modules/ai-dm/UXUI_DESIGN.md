# UXUI_DESIGN — AI DM Assistant (Sprint 7)

> Inherits all tokens from [DESIGN_SYSTEM.md](../../program/DESIGN_SYSTEM.md). Do NOT re-pick colors, fonts, or spacing. Only the screens/layouts for this module are defined here.

---

## 1. Inherited tokens (reference only — no overrides)

| Token | Value | Use in this module |
|-------|-------|--------------------|
| `--bg` | `#0B0E14` | page background |
| `--surface` | `#151A23` | AI panel card / draft card background |
| `--surface-raised` | `#1E2530` | active draft card, textarea, modal scrim |
| `--border` | `#2A323F` | panel borders, dividers |
| `--text` | `#F1F5F9` | primary labels |
| `--text-muted` | `#94A3B8` | metadata (timestamp, entity type badge) |
| `--text-faint` | `#64748B` | disabled state, placeholder |
| `--accent` | `#D9A441` | "Generate" CTA, "Approve" action |
| `--accent-hover` | `#E8B95C` | hover |
| `--arcane` | `#8B5CF6` | provider badge (Ollama = arcane, Import = muted) |
| `--danger` | `#EF4444` | "Reject" action, error banner |
| `--success` | `#22C55E` | "Approved" badge |
| `--warning` | `#F59E0B` | "Ollama not connected" banner |
| Heading | `Cinzel` | "AI DM Assistant" section header only |
| Body / labels | `Inter` | everything else |
| Numerics | `JetBrains Mono` | token count hint, CR input |

---

## 2. Surface inventory

| Surface | ID | Component file (Stage 7) |
|---------|-----|--------------------------|
| AI panel (embedded in campaign page) | S1 | `components/AIDMSection.tsx` |
| Generate form | S2 (inside S1) | inline in `AIDMSection.tsx` |
| Draft card list | S3 (inside S1) | `components/DraftCard.tsx` |
| Import modal | S4 | `components/ImportModal.tsx` |
| Provider status banner | S5 (inside S1) | inline in `AIDMSection.tsx` |

---

## 3. S1 — AI DM Section (panel embedded in campaign page, DM-only)

### Visibility guard
- The entire section is **only rendered when `role === "dm"`**. Players see no AI tab or section.

### Layout
```
┌─ AIDMSection ────────────────────────────────────────────────┐
│  [AI DM Assistant]  (Cinzel h2, --accent)                    │
│  S5: Provider status banner (conditionally rendered)          │
│                                                              │
│  ┌─ S2 Generate form ──────────────────────────────────────┐ │
│  │  [Entity type] selector  [Generate] CTA                 │ │
│  │  [Prompt textarea]                                       │ │
│  │  [CR input / Session selector] (context, conditional)   │ │
│  │  [Import from paste] link → opens S4 ImportModal        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  S3: Draft card list (pending only by default)               │
│  [Show rejected] toggle                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. S2 — Generate Form

### Entity type selector
- Tabs or segmented control: **NPC | Loot | Quest | Session Recap**
- Single active tab at a time; switching clears context fields but keeps the prompt.

### Prompt textarea
- Placeholder: `"Describe what you want (e.g. 'a friendly halfling innkeeper with a secret')"`
- Min-height 80px; max 2 000 chars; char counter shown at 1 800+.
- Required; "Generate" button disabled while empty.

### Context fields (conditional per entity type)
| Entity type | Shown field |
|-------------|-------------|
| NPC | nothing extra |
| Loot | CR number input (1–30; JetBrains Mono; required) |
| Quest | optional "last session" selector (shows Session titles) |
| Session Recap | Session selector (required; shows date + title) |

### Generate button
- Label: "Generate [entity type]" (e.g. "Generate NPC")
- Color: `--accent` background, `--bg` text
- Shows spinner (no skeleton) during fetch; disabled while loading.
- Error toast on 422/502/503.

### "Import from paste" link
- Small text link below the form: "Or import from Claude / ChatGPT ↗"
- Opens S4 ImportModal.

---

## 5. S3 — Draft Card

Each draft card shows:
```
┌─ DraftCard ─────────────────────────────────────────────────┐
│  [entity type badge]  [provider badge]           [timestamp]│
│  Prompt: "a suspicious tiefling merchant…" (1 line, clamp)  │
│  ─────────────────────────────────────────────────────────  │
│  [parsed content preview — 5 lines max, then "Show more"]   │
│  (If parsedJson null: "Could not parse — edit raw text")    │
│  ─────────────────────────────────────────────────────────  │
│  [Edit rawText ▾ expand]              [Reject] [Approve ✓]  │
└─────────────────────────────────────────────────────────────┘
```

### Entity type badge
- NPC: arcane (`--arcane`) · Loot: accent (`--accent`) · Quest: muted · Session Recap: muted
- Short label: "NPC" / "Loot" / "Quest" / "Recap"

### Provider badge
- Ollama: small pill `--arcane` / "Ollama"
- Import: small pill `--text-muted` / "Import"

### Parsed content preview
- NPC: name, appearance (1 line), personality (1 line), secret (hidden behind "Show more")
- Loot: item list (`•` bullets with JetBrains Mono for quantities)
- Quest: name, objectives (first 3)
- Recap: first 3 lines of prose

### Edit raw text
- Accordion ▾ that expands a `<textarea>` with the full `rawText`.
- "Save edits" button inside (PATCH with updated rawText; client does not re-parse).
- Color-not-only: "Save edits" has Inter label, not just icon.

### Approve button
- Label: "Approve ✓"
- Color: `--accent` text + border
- On click: loading spinner → success toast "NPC added to campaign" / "Quest created" / etc. → card removed from list.
- Error: 422 toast if limit reached.

### Reject button
- Label: "Reject"
- Color: `--danger` text + border
- Confirm before action (inline confirmation: "Are you sure? → Reject / Cancel")
- On confirm: card fades out; "Show rejected" toggle reveals rejected cards (dimmed, no actions).

---

## 6. S4 — Import Modal

```
┌─ ImportModal ──────────────────────────────────────────────────┐
│  Import from Claude / ChatGPT                  [✕ dismiss]    │
│  ────────────────────────────────────────────────────────────  │
│  Entity type: [NPC | Loot | Quest | Recap]                    │
│                                                               │
│  Paste the AI response below:                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ (textarea, 10 rows, monospace hint)                    │   │
│  └────────────────────────────────────────────────────────┘   │
│  0 / 10 000 chars                                             │
│                                                               │
│  [Cancel]                        [Parse & Save Draft]         │
└────────────────────────────────────────────────────────────────┘
```

- Scrim: 50% black; click-outside or Esc dismisses.
- "Parse & Save Draft" disabled when textarea empty.
- On success: modal closes, draft appears at top of S3.

---

## 7. S5 — Provider Status Banner

Shown when Ollama is not available. **Never shown to players** (section is DM-only).

```
⚠ Ollama not connected — AI generation disabled.
  Import from Claude / ChatGPT still works. [Set up Ollama ↗]
```

- Background: `--warning` at 10% opacity + `--warning` left border (4px).
- Icon + text — color not the only signal.
- "Set up Ollama ↗" → opens official Ollama docs URL (new tab). This link is user-provided in app config (not hardcoded).
- Banner is absent when Ollama is connected.

---

## 8. State matrix

| Control | Default | Loading | Error | Disabled | Success |
|---------|---------|---------|-------|----------|---------|
| Generate button | --accent bg | spinner | toast | empty prompt / loading | — (draft appears) |
| Approve button | --accent border | spinner | toast | approved/rejected card | card removed |
| Reject button | --danger border | — | toast | approved/rejected card | card fades |
| Import "Parse" | --accent bg | spinner | toast | empty content | modal closes |
| Edit save | --border | spinner | toast | no changes | inline "Saved ✓" |

---

## 9. Responsive behavior

| Breakpoint | Behavior |
|------------|---------|
| ≥ 1024px (desktop) | AI panel in campaign tab beside Story section; generate form + draft list side by side |
| 768px (tablet) | generate form full-width above draft list; single column |
| 375px (mobile) | collapsed into "AI Assistant" accordion; draft cards stack; entity tabs scroll horizontally |

---

## 10. Accessibility notes

- **Color-not-only:** Approve = gold border + "✓ Approve" label; Reject = red border + "Reject" label — never signal only by color.
- **Focus ring:** 2px `--accent` on all interactive elements.
- **Textarea ARIA:** `aria-label="Prompt"` / `aria-describedby` pointing to char counter.
- **Loading state:** `aria-busy="true"` on Generate button while fetching; spinner has `aria-label="Generating…"`.
- **Provider badge:** `title` attribute with full provider name for screen readers.
- **Draft card keyboard:** Tab navigates prompt → Edit ▾ → Reject → Approve in sequence.
- **Modal:** `role="dialog"` + `aria-modal="true"` + focus trap; Esc closes.
