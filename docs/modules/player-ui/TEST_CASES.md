# TEST_CASES — Player UI + Dice + Dashboard (Sprint 6)
### D&D Campaign Manager · module 7 of 8 · QA (Stage 8)

> Traceability from [PRD](./PRD.md) §5 (edge cases 5.1–5.20) and §6 DoD (1–10) to automated/manual tests.
> Inputs: [SA_BLUEPRINT](./SA_BLUEPRINT.md), [ARCHITECTURE](../../program/ARCHITECTURE.md).
> **Status: 47 automated tests pass** (`npm test`, 3 files) — dice engine + search grouper + service authz/validation.
> *Backfilled in the Sprint 7 QA pass (Stage 8 had been deferred at ship time — only `dice-rules.test.ts` existed).*

## How to run
| Layer | Command | Notes |
|-------|---------|-------|
| Unit/logic (headless, DB mocked) | `npm test` | vitest — 47 Player-UI tests, deterministic |
| Live dice broadcast | `npm run dev`, two browsers in one campaign, roll | public roll appears in both feeds; private DM roll only DM sees |
| Static gates | `npm run lint` · `npm run typecheck` · `npm run build` | all green |

## Test asset map
| File | Tests | Covers |
|------|-------|--------|
| `tests/dice-rules.test.ts` | 11 | `parseFormula` (bare/count/mod, junk, out-of-range) + `rollFromFaces` trust boundary (count/range anti-tamper, adv/disadv) |
| `tests/player-ui-search.test.ts` | 9 | `groupSearchResults` — hint formatting for all 7 kinds (cantrip vs level, quest giver/status, npc faction fallback, journal excerpt) |
| `tests/player-ui-service.test.ts` | 27 | dice authz + private gating + client-face recompute, search bounds, dashboard DM-gate, quick-view/HP/spell-slot ownership + validation |

---

## Edge-case traceability (PRD §5)
| Case | Scenario | Expected | Type | Coverage |
|------|----------|----------|------|----------|
| 5.1 | Invalid formula (`abc`, `""`) | error, helpful message | unit | ✅ dice-rules parseFormula junk + service "rejects an invalid formula" (`invalid_formula`) |
| 5.2 | Die count > 100 | reject (DoS guard) | unit | ✅ dice-rules "rejects … 101d6" |
| 5.3 | Roll before any encounter | allowed (dice independent) | unit | ✅ service rolls succeed with no encounter mocked |
| 5.4 | Private DM roll | not persisted/broadcast | unit | ✅ service "private DM roll is NOT persisted and carries no id" |
| 5.5 | Advantage shows both d20 | both shown, kept highlighted | unit | ✅ dice-rules adv/disadv keep-higher/lower + service "advantage RNG keeps two d20 faces" |
| 5.6 | HP < 0 | clamp to 0 | unit + structural | ✅ repo `updateCharacterHp` `Math.max(0, …)`; service delegates (clamp asserted at repo boundary) |
| 5.7 | HP > maxHp | clamp to maxHp | structural | ✅ repo `Math.min(hp, maxHp)` |
| 5.8 | Spell slot used > total | 422 | unit | ✅ service "rejects used > total at a level" (`slots_exceed_total_at_level_1`) |
| 5.9 | Player edits another's HP | 403 | unit | ✅ service updateHp "forbids a non-owner player" + quick-view/spell-slot ownership tests |
| 5.10 | Player hits dashboard | 403 / redirect | unit | ✅ service getDashboard "forbids a player" |
| 5.11 | Dashboard, zero sessions | empty state, stats 0 | manual | ◑ client empty-state (DashboardSection) — live-verified at ship; `lastSession:null` path in repo |
| 5.12 | Dashboard, zero active quests | empty state | manual | ◑ client empty-state — live-verified |
| 5.13 | Search query < 2 chars | no request | unit | ✅ service "rejects a query shorter than 2 chars" (`query_too_short`) |
| 5.14 | Search query > 200 chars | 422 | unit | ✅ service "rejects a query longer than 200 chars" (`query_too_long`) |
| 5.15 | Search with `%` `_` `'` | parameterized, literal | structural | ✅ Prisma `contains` parameterizes; no raw SQL/`eval` in search.ts/repo.ts |
| 5.16 | Search zero results | empty state, no crash | unit + manual | ✅ groupSearchResults "seven empty groups for empty input"; client empty-state live-verified |
| 5.17 | `dice:roll` from unauth socket | error event, no-op | structural | ✅ socket handler `resolveSession` gate (server/dice.ts); REST mirror = service authz |
| 5.18 | > 20 rolls in campaign | last 20 in feed | structural | ✅ repo `getRecentRolls(campaignId, 20)` `take: 20` |
| 5.19 | Roster, no active encounter | conditions "—" | unit + manual | ✅ repo conditionMap empty when no encounter → `conditions: []`; client renders "—" |
| 5.20 | Quick-view, no character claimed | "No character claimed" prompt | manual | ◑ client guard (PlayerHUD only renders when `myCharacterId` set) — live-verified |

## DoD traceability (PRD §6)
| DoD | Expected | Type | Coverage |
|-----|----------|------|----------|
| 1 | `DiceRoll` migration `player_ui` — CREATE only | structural | ✅ migration `20260621052619_player_ui` (CREATE DiceRoll + additive `Character.spellSlotsUsedJson`); no DROP/ALTER |
| 2 | Prior tests stay green | regression | ✅ full suite green (see program §Regression) |
| 3 | Public roll broadcasts to all | manual | ✅ live two-browser broadcast at ship (commit `9f5709e`) |
| 4 | Private DM roll DM-only, not persisted | unit + manual | ✅ service private-roll test + live |
| 5 | Quick-view HP/AC/slots/conditions | unit + manual | ✅ getQuickViewAction ownership tests; repo builds passivePerception/slots/conditions; live render |
| 6 | HP quick-edit clamps [0, maxHp] | unit + structural | ✅ updateHpAction + repo clamp |
| 7 | Ability/skill/init quick-rolls labeled | unit + manual | ✅ rollDiceAction context (label) truncation + RNG paths; live broadcast |
| 8 | Dashboard stats/quests/roster/last session | unit + manual | ✅ getDashboardAction DM-gate + repo aggregate; live render |
| 9 | Search ≥ 4 entity types | unit | ✅ groupSearchResults covers 7 kinds (spell/item/monster/character/quest/npc/journal) |
| 10 | 401 no-session / 403 wrong-role / 422 invalid | unit | ✅ service authz + validation across dice/search/dashboard/quickview/hp/spell-slots |

Legend: ✅ automated · ◑ automated-partial + manual/live · structural = enforced by code shape (asserted by reading the guarded path).

---

## Notes
- **DB + RNG mocked in unit tests** — `vi.mock("@/lib/db")` + `vi.mock("@/lib/player-ui/repo")` (matches Foundation/Story approach). RNG paths (`rollFormula`/`rollAdvantage`) are exercised through `rollDiceAction` with range assertions, not seeded.
- **Trust boundary** (`rollFromFaces`) is the security-critical piece: the 3D client supplies faces, the server validates range/count and recomputes the total — a forged `[99]` on a d6 is rejected (`invalid_rolls`). Covered in both dice-rules and service tests.
- Client-only empty/guard states (5.11/5.12/5.20) were live-verified at ship time; marked ◑ here rather than driven by a headless DOM test (no component-test harness in this project).
