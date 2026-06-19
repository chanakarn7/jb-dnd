# TEST_CASES — 5e Reference (Sprint 1)
### D&D Campaign Manager · module 2 of 8 · QA (Stage 8)

> Traceability from [PRD](./PRD.md) §5 (edge cases) and §"Definition of Done" (acceptance criteria 1–7) to automated/manual tests.
> Inputs: [SA_BLUEPRINT](./SA_BLUEPRINT.md), [ARCHITECTURE](../../program/ARCHITECTURE.md), [DATA_MODEL](../../program/DATA_MODEL.md).
> **Status: 76 automated tests pass** (`npm test`, 12 files; +16 added this stage) + live preview verification.

## How to run
| Layer | Command | Notes |
|-------|---------|-------|
| Unit/logic (headless, Prisma mocked) | `npm test` | vitest — deterministic, no DB |
| Seed (real data) | `npm run db:seed` | idempotent upsert; prints `319 spells · 334 monsters · 599 items` |
| Live UI | `npm run dev` → open `/reference` (in a campaign session) | tabs / search / filter / statblock |
| Static gates | `npm run lint` · `npm run typecheck` · `npm run build` | all green |

## Test asset map (this module)
| File | Tests | Covers |
|------|-------|--------|
| `tests/reference-srd.test.ts` | 7 | `crToXp` (full CR table), `formatCr` (fractions), `abilityMod` (signed), `slugify` |
| `tests/reference-parse.test.ts` | 2 | `parseJson` graceful fallback on broken/empty/undefined |
| `tests/reference-filter.test.ts` | 6 | `filterSpells/Monsters/Items` — name match (regex-literal), level/school/class/type/rarity/CR, toggles, AND |
| `tests/reference-transform.test.ts` | 10 | dnd5eapi→schema mapping: spell components/classes/higher-level, monster cr/xp/ac/abilities/saves-vs-skills/traits/actions, item weapon/armor/magic rarity+attunement |
| `tests/reference-repo.test.ts` | 8 | **(new)** lean-list vs full-detail shapes, JSON-column parse, null-on-missing (404 driver), malformed-JSON fallback, **in-memory cache (no re-query)** |
| `tests/reference-gaps.test.ts` | 8 | **(new)** empty-result paths (empty-search vs empty-filter), CR-max inclusive boundary, case-insensitive+trim, transform robustness (no armor/profs/reactions; reactions/legendary kinds; cantrip material; item no-category) |

---

## Edge-case traceability (PRD §5)
| Case | Scenario | Expected | Type | Coverage |
|------|----------|----------|------|----------|
| 5.1 | Search with no match | empty-search state + Clear | unit + manual | ✅ `reference-gaps` "search with no match yields []" drives the state; UI state live-verified |
| 5.2 | Filters reduce to 0 results | empty-filter state + Clear filters | unit + manual | ✅ `reference-gaps` "filter combo with no match yields []"; UI state present in `ReferenceClient` |
| 5.3 | First-load loading | skeleton, not blank | manual | ✅ derived `loading = cache[tab] === undefined` → skeleton rows; live-verified |
| 5.4 | Deep-link to missing slug | themed 404 + back | unit + integ + manual | ✅ `reference-repo` getSpell/getMonster/getItem **return null** → route returns `{error:"not_found"}`+404; detail page renders 404 |
| 5.5 | Optional field empty (e.g. no saves) | hide the row, no "null" | unit + manual | ✅ `reference-gaps` "no armor/profs/reactions" → empty objects; `MonsterStatblock` hides empty lines |
| 5.6 | Malformed JSON column | render what's parseable, no crash | unit | ✅ `reference-parse` + `reference-repo` "malformed traitsJson → [] instead of throwing" |
| 5.7 | Search has regex-special chars | literal text, no throw | unit | ✅ `reference-filter` "matches name… (plain substring, not regex)" — `"("` → `[]` |
| 5.8 | Not in a session | redirect to /join | manual | ✅ `ReferenceClient` guard (no seat + no live state → `router.replace('/join')`); live-verified (seat set → shell loads) |
| 5.9 | Network drops mid-use | unaffected — data is local | structural | ✅ data seeded in SQLite; filter is client-side over the already-fetched list (no per-keystroke request) |
| 5.10 | Mobile narrow screen | filters collapse to drawer; statblock scrolls | manual | ✅ `sm:hidden` filter toggle + `mobileFilters` drawer; statblock single-column |
| 5.11 | Same name across kinds | separated by tab | structural | ✅ each tab queries its own endpoint/dataset; no cross-kind list |

## Acceptance-criteria traceability (PRD §"Definition of Done")
| # | Expected | Type | Coverage |
|---|----------|------|----------|
| 1 | Seed SRD 5.1 all 3 kinds via additive migration + seed | structural + manual | ✅ migration `5e_reference` (additive: CREATE-only, no DROP/ALTER); `npm run db:seed` → **319/334/599** |
| 2 | Search + filter all 3 kinds | unit + manual | ✅ `reference-filter` + `reference-gaps`; live: monsters "dragon" **334→43** |
| 3 | View full spell card / item card / monster statblock | unit + manual | ✅ `reference-repo` detail shapes; live-verified: Adult Red Dragon statblock (ability grid, gold rules, tabular), Fireball spell card |
| 4 | Empty/loading/no-result/404 states | unit + manual | ✅ 5.1/5.2/5.3/5.4 above |
| 5 | CC-BY-4.0 attribution shown in app | manual | ✅ `Attribution` footer on shell + every detail; live-verified on spell card; `prisma/seed/SRD-5.1-CC-BY-4.0.md` |
| 6 | Client filter <100ms, offline | unit + manual | ✅ in-memory filter over fetched list (`reference-repo` cache: each kind queried once); offline by construction |
| 7 | Responsive (desktop + mobile) | manual | ✅ inherits DESIGN_SYSTEM breakpoints; filter drawer + single-column statblock on mobile |

## Architecture / contract checks
| Check | Coverage |
|-------|----------|
| Reference reads are REST route handlers, NOT socket.io | ✅ `app/api/reference/**` GET handlers; no realtime |
| Reference tables are GLOBAL (no `campaignId`) | ✅ schema + migration have no `campaignId`; matches DATA_MODEL "Finalized (Sprint 1)" |
| Additive migration only (Foundation untouched) | ✅ `5e_reference` migration = CREATE TABLE/INDEX only; `foundation_baseline` unchanged; 36 Foundation tests still pass |
| Routes not `force-static` (runtime-seeded SQLite) | ✅ build shows `/api/reference/*` as ƒ (Dynamic); browser-cached via `Cache-Control` header |
| Deterministic rules math in code | ✅ `crToXp`/`crSort`/`xp` computed at seed (`reference-srd` + `reference-transform`) |

---

## Bugs found & fixed during QA
| Bug | Fix |
|-----|-----|
| Statblock action ordering put Legendary Actions before Reactions | `transform.ts` reordered to statblock convention **Actions → Reactions → Legendary**; re-seeded. (Display was already correct via fixed section order; this keeps the stored array canonical.) |

## Remaining gaps & recommendations
| Gap | Severity | Recommendation |
|-----|----------|----------------|
| Route-handler HTTP layer (status codes/headers) not unit-tested in isolation | Low | The repo functions they wrap ARE tested (null→404 driver, shapes); handlers are 3-line pass-throughs. A Next route integration test could be added in a hardening pass. |
| Real-browser responsive/drawer + keyboard tab nav | Low | Inherits the program design system; verified manually in preview. A Playwright pass could automate it later. |
| `package.json#prisma` seed config deprecated (Prisma 7) | Low | Works on Prisma 6; migrate to `prisma.config.ts` at the Prisma 7 upgrade. |

These are all **low severity**. The pure logic (rules math, filtering, transform), the repo (JSON parsing, caching, null-on-missing), and graceful-degrade edges are unit-covered; the rendered screens were live-verified in preview with **0 console errors**. **Sprint 1 QA is green.**
