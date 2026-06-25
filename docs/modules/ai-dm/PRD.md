# PRD — AI DM Assistant (Sprint 7)

> Module base dir: `docs/modules/ai-dm/`. Companion: [SA_BLUEPRINT](./SA_BLUEPRINT.md) · [UXUI_DESIGN](./UXUI_DESIGN.md).
> Program authorities (hard constraints): [ARCHITECTURE.md](../../program/ARCHITECTURE.md) · [DATA_MODEL.md](../../program/DATA_MODEL.md) · [DESIGN_SYSTEM.md](../../program/DESIGN_SYSTEM.md).

---

## 1. Goal

Give the DM a built-in AI writing assistant that generates **prose drafts** (NPC descriptions, loot flavor, plot hooks, session recaps) from a natural-language prompt. The DM reviews every draft and explicitly **approves** it before anything enters the campaign. AI output is never live, never server-authoritative until the DM acts on it.

## 2. Non-goals (v1)

- AI does **not** do rules math — CR-to-XP, loot dice, spell slots are deterministic code.
- AI output does **not** auto-apply to any entity without DM approval.
- **No Anthropic API adapter** (BYOK/paid); that interface exists in `LLMProvider` for later.
- AI does **not** roll dice or control combat state.
- Players cannot access the AI panel.
- No streaming output (non-goal for simplicity; full response on completion).
- No prompt history or conversation threading (single-turn only).

## 3. Providers

| Provider | How it works | Available when |
|----------|-------------|----------------|
| **Ollama** (default) | Server calls `http://localhost:11434` via REST; no API key needed. Model configurable via `OLLAMA_MODEL` env (default `qwen2.5:14b`; fallback `llama3.1:8b`). | Ollama process is running on the DM's machine. |
| **Import from Claude** | DM pastes text from any external chat (Claude, ChatGPT, etc.) into a textarea; server parses into a structured `AIDraft`. | Always available (offline). |

The app **must run fully with no provider configured** — the AI panel shows a "No AI provider connected" banner but all other modules work normally.

## 4. User stories

**US-1 — Generate NPC draft**
As the DM, I can enter a short description ("a suspicious tiefling merchant, CR 3 area") and receive a prose NPC draft (name, appearance, personality, secret, role) I can edit and approve as a new NPC.

**US-2 — Generate loot flavor**
As the DM, I can specify an encounter CR (or enter a free-form prompt) and receive a loot draft listing magic item names with short flavor text. Quantities and item types come from the deterministic loot rule (no LLM arithmetic). Approving imports the loot into the campaign's award pool (displayed to DM; not yet assigned to characters).

**US-3 — Generate plot hook / quest draft**
As the DM, I can enter a theme or context ("the party just cleared the dungeon, give me a hook for a sea voyage arc") and receive a quest draft (name, giver hint, objectives, reward hint) I can approve as a new Quest.

**US-4 — Generate session recap**
As the DM, I can attach the most recent Session (auto-loaded) and ask for a prose recap/opening-narration draft I can approve and save to that session's recap field.

**US-5 — Import from Claude (paste)**
As the DM, I can paste text from an external Claude (or any) chat response into a textarea, select the target entity type, and the server parses it into a structured `AIDraft`. I can then edit and approve as I would any generated draft.

## 5. Edge cases

| # | Edge | Expected behaviour |
|---|------|-------------------|
| 5.1 | Ollama not running | `isAvailable()` returns false; AI panel shows "Ollama not connected" inline error; Import still works |
| 5.2 | Ollama returns an error / timeout | Route returns `{error:"provider_error", message}` 502; UI shows the message as a toast; draft is NOT saved |
| 5.3 | Ollama responds but output is not parseable to the requested entity type | Server saves raw text as `AIDraft.rawText`; `parsedJson = null`; DM sees "Could not parse — edit manually" state |
| 5.4 | DM submits empty prompt | 422 `prompt_required`; button disabled client-side too |
| 5.5 | DM approves an NPC draft but the campaign has already reached the NPC name limit | 422 `limit_reached`; draft stays in pending state |
| 5.6 | DM approves a quest draft but max quests reached | 422 `limit_reached`; same handling |
| 5.7 | DM rejects a draft | Draft `status` → `rejected`; removed from pending list (still stored in DB for 30 days; no hard delete) |
| 5.8 | DM approves draft → linked entity is later deleted | `AIDraft.approvedEntityId` stays; orphan FK is acceptable (no cascade required) |
| 5.9 | Player navigates to `/campaign/[id]` — can they see AI panel? | AI panel is DM-only; player sees nothing; route returns 403 on any `/api/ai/*` call |
| 5.10 | Two DM tabs: both start generating at the same time | Each generates independently; both drafts persist; DM approves the better one |
| 5.11 | Import paste is empty | 422 `content_required` |
| 5.12 | Import paste is too long (>10 000 chars) | 422 `content_too_long` |
| 5.13 | DM edits an approved draft's `rawText` after approval | Not supported — approved drafts are read-only in UI (edit the actual entity instead) |
| 5.14 | No active session when generating a `session_recap` | 422 `no_active_session`; DM prompted to select a session first |

## 6. Data model additions

### `AIDraft` (new — Sprint 7)

| Column | Type | Notes |
|--------|------|-------|
| `id` | String | PK, cuid |
| `campaignId` | String | FK → Campaign (cascade delete) |
| `entityType` | String | `npc` \| `loot` \| `quest` \| `session_recap` |
| `prompt` | String | original DM prompt (max 2 000 chars) |
| `rawText` | String | full LLM/import text |
| `parsedJson` | String? | nullable JSON string of structured draft |
| `provider` | String | `ollama` \| `import` |
| `status` | String | `pending` \| `approved` \| `rejected` |
| `approvedEntityId` | String? | nullable — ID of the entity created on approval |
| `approvedEntityType` | String? | nullable — mirrors `entityType` for the approved entity |
| `createdAt` | DateTime | default now |

*No `Character.currencyJson`-style JSON blob for loot — a dedicated `parsedJson` stores the structured data per draft.*

### Additive columns / migrations

- No existing tables are modified.
- Single additive migration `ai_dm`: `CREATE TABLE AIDraft`.

## 7. REST API (DM-only, all require role === "dm")

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/ai/generate` | Prompt → LLM → save AIDraft → return draft |
| `POST` | `/api/ai/import` | Paste text → parse → save AIDraft → return draft |
| `GET` | `/api/ai/drafts` | List pending drafts for campaign (newest first) |
| `PATCH` | `/api/ai/drafts/[id]` | Approve (creates entity) or update draft fields |
| `DELETE` | `/api/ai/drafts/[id]` | Reject / soft-delete (status → rejected) |
| `GET` | `/api/ai/status` | Returns `{ollama: boolean, import: boolean}` provider health |

## 8. Prompt templates (deterministic code)

Templates live in `lib/ai/templates.ts` — NOT in the LLM system prompt shipped at runtime. The server assembles a tight, structured prompt from the template + DM input. Templates are versioned in source; never stored in the DB.

| Entity type | Template variables |
|-------------|-------------------|
| `npc` | `{prompt}`, optional `{campaignName}` |
| `loot` | `{cr}`, `{prompt}`, deterministic item list from loot-rules code |
| `quest` | `{prompt}`, optional `{lastSessionRecap}` |
| `session_recap` | `{sessionDate}`, `{encounterNames}`, `{prompt}` |

The LLM is always asked for **JSON output** (`json: true` in `LLMOptions`) with a defined schema. If the response is not parseable JSON, `parsedJson` stays null (edge 5.3).

## 9. Definition of Done

1. [ ] `AIDraft` table created via additive migration `ai_dm` — no DROP/ALTER on existing tables.
2. [ ] `OllamaProvider` implements `LLMProvider`; `isAvailable()` checks `GET /api/tags` on Ollama; gracefully returns `false` when not running.
3. [ ] `ImportProvider` parses pasted text into a structured draft without any network call.
4. [ ] All routes enforce `role === "dm"` via `resolveSession`; players receive 403.
5. [ ] Approved NPC draft → entity saved to `Npc` table (via story repo); approved Quest draft → entity saved to `Quest` table.
6. [ ] UI panel is DM-only; Ollama-unavailable state handled gracefully (Import still works).
7. [ ] All prior tests (512) remain green (regression gate).
8. [ ] `docs/modules/ai-dm/TEST_CASES.md` written with full §5 + DoD traceability.
