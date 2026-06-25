# TEST_CASES — AI DM Assistant (Sprint 7)
### D&D Campaign Manager · module 8 of 8 · QA (Stage 8)

> Traceability from [PRD](./PRD.md) §5 (edge cases) and §9 (Definition of Done) to automated/manual tests.
> Inputs: [SA_BLUEPRINT](./SA_BLUEPRINT.md), [ARCHITECTURE](../../program/ARCHITECTURE.md), [DATA_MODEL](../../program/DATA_MODEL.md).
> **Status: 100 automated tests pass** (`npm test`, 4 files) + live API smoke (running server + real DB).

## How to run
| Layer | Command | Notes |
|-------|---------|-------|
| Unit/logic (headless, DB + LLM mocked) | `npm test` | vitest — 100 AI tests, deterministic |
| Live API end-to-end (real server + DB) | `npm run dev` then drive `/api/ai/*` with a bearer token | verified auth gating + approve→entity + reject→soft-delete |
| Ollama graceful-degrade | start server with Ollama **off** | boot log: `✦ AI: Ollama not reachable — generation disabled (Import still works)` |
| Static gates | `npm run lint` · `npm run typecheck` · `npm run build` | all green; 5 AI routes compiled |

## Test asset map
| File | Tests | Covers |
|------|-------|--------|
| `tests/ai-rules.test.ts` | 27 | validatePrompt/ImportContent/EntityType/Cr, isValidStatus, tryParseJson + extractJsonBlock (fence/prose/nested), lootTierForCr, parseLootDraft (deterministic xp/rarity/count) |
| `tests/ai-templates.test.ts` | 11 | buildNpc/Loot/Quest/Recap + buildPrompt dispatch; SYSTEM_BASE forbids model arithmetic |
| `tests/ai-service.test.ts` | 43 | DM-only authz, all §5 edges, provider 502/503, parsed-null, deterministic loot, full approve/reject/edit lifecycle |
| `tests/ai-routes.test.ts` | 19 | all 5 routes — status-code forwarding (401/403/422/502/503/200/201), PATCH approve vs edit, DELETE reject, status DM-gate |
| live API smoke (manual) | 10 | 401/403, status, generate 503/422, import 201/422, approve→Npc created, reject→soft-delete |

---

## Edge-case traceability (PRD §5)
| Case | Scenario | Expected | Type | Coverage |
|------|----------|----------|------|----------|
| 5.1 | Ollama not running | `isAvailable()`→false; generate→503; Import still works | unit + manual | ✅ ai-service "503 when no provider" / "503 when unavailable"; live boot log + import-with-no-provider test |
| 5.2 | Ollama error / timeout | 502 `provider_error`; draft NOT saved | unit | ✅ ai-service "502 when provider.generate throws … draft NOT saved" (asserts `createDraft` not called) + ai-routes 502 forward |
| 5.3 | Output not parseable | save rawText, `parsedJson=null`, "edit manually" | unit | ✅ ai-rules tryParseJson null cases + ai-service "unparseable model output → parsedJson null but draft still saved" |
| 5.4 | Empty prompt | 422 `prompt_required` | unit | ✅ ai-rules validatePrompt + ai-service + ai-routes 422 |
| 5.5 | NPC limit on approve | 422 `limit_reached`, draft stays pending | unit | ✅ ai-service "422 limit_reached when NPC cap hit" (createNpc not called) |
| 5.6 | Quest limit on approve | 422 `limit_reached` | unit | ✅ ai-service "422 limit_reached when Quest cap hit" |
| 5.7 | Reject draft | status→`rejected`, removed from pending, retained in DB | unit + manual | ✅ ai-service rejectDraft (softDeleteDraft) + live reject→200 soft-delete |
| 5.8 | Approved entity later deleted | `approvedEntityId` stays; orphan FK acceptable | structural | ✅ no cascade on `approvedEntityId` (schema has no FK on it); covered by design |
| 5.9 | Player hits `/api/ai/*` | DM-only; 403 | unit | ✅ ai-service 403 on every action (player) + ai-routes 403 + status route 403 + live player→403 |
| 5.10 | Two DM tabs generate at once | independent drafts, both persist | unit | ✅ each `generateDraft`/`createDraft` is stateless & independent (no lock) — ai-service generate tests |
| 5.11 | Empty import | 422 `content_required` | unit | ✅ ai-rules validateImportContent + ai-service + live import-empty→422 |
| 5.12 | Import too long (>10 000) | 422 `content_too_long` | unit | ✅ ai-rules "accepts exactly IMPORT_MAX, rejects +1" (boundary) |
| 5.13 | Edit/approve an approved draft | not supported; approved drafts read-only | unit | ✅ ai-service approve "422 not_pending" + edit "422 not_pending when locked" |
| 5.14 | No session for recap | 422 `no_active_session` | unit | ✅ ai-service "no_active_session" (missing + cross-tenant) + approve "no_active_session when sessionId missing" |

## Definition-of-Done traceability (PRD §9)
| DoD | Expected | Type | Coverage |
|-----|----------|------|----------|
| 1 | `AIDraft` via additive migration `ai_dm` — no DROP/ALTER | structural | ✅ `prisma/migrations/20260625170141_ai_dm/migration.sql` = `CREATE TABLE "AIDraft"` + 2 indexes only |
| 2 | `OllamaProvider.isAvailable()` checks `/api/tags`, false when down | unit + manual | ✅ provider mocked in ai-service availability tests; live boot probe logged "not reachable" |
| 3 | `ImportProvider` parses paste, no network | unit | ✅ ai-service "parses pasted JSON … no provider needed" (registry returns null) |
| 4 | Routes enforce `role==="dm"`; players 403 | unit + manual | ✅ ai-service 403 matrix + ai-routes 403 + live player→403 |
| 5 | Approved NPC→`Npc` table; approved Quest→`Quest` table | unit + manual | ✅ ai-service approve npc/quest (storyRepo.createNpc/createQuest called) + live approve→Npc "Borin Ashforge" row created |
| 6 | UI DM-only; Ollama-unavailable handled gracefully | manual + structural | ✅ `AIDMSection` self-guards `role==="dm"`; provider banner on `ollama=false`; Import path independent. Live: status→`{ollama:false,import:true}` |
| 7 | All prior tests (512) remain green | regression | ✅ full suite green (see §Regression) |
| 8 | `TEST_CASES.md` written | doc | ✅ this file |

## Hybrid-rules determinism (ARCHITECTURE guard)
| Invariant | Coverage |
|-----------|----------|
| LLM never computes XP — `crToXp` is code | ✅ ai-rules "computes xp deterministically from crToXp"; ai-service loot test asserts `xp === crToXp(5)` |
| Loot rarity + count from CR tier, not the model | ✅ ai-rules lootTierForCr brackets + parseLootDraft truncation/rarity tests |
| Prompt templates forbid model arithmetic | ✅ ai-templates SYSTEM_BASE "do not compute" + loot "set by the system" |

---

## Notes / known scope
- **Loot approval is display-only** — no `LootAward` table in this app (loot items come from the SRD `Item` table); approving loot flips the draft to `approved` and creates no entity (asserted in ai-service).
- **Recap sessionId** is stashed inside `parsedJson` at generate time (no dedicated column) so approve knows which `Session.summary` to patch.
- **No real Ollama/DB in unit tests** — provider + Prisma fully mocked (matches Foundation/Story test approach); live behavior covered by the API smoke pass.
