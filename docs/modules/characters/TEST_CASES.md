# TEST_CASES — Characters (Sprint 2)
### D&D Campaign Manager · module 3 of 8 · QA (Stage 8)

> Traceability from [PRD](./PRD.md) §5 (edge cases 5.1–5.15) and §"Definition of Done" (criteria 1–10) to automated/manual tests.
> Inputs: [SA_BLUEPRINT](./SA_BLUEPRINT.md), [ARCHITECTURE](../../program/ARCHITECTURE.md), [DATA_MODEL](../../program/DATA_MODEL.md).
> **Status: 134 automated tests pass** (`npm test`, 17 files; **+41 added this stage**) + live preview verification.

## How to run
| Layer | Command | Notes |
|-------|---------|-------|
| Unit/logic (headless, Prisma mocked) | `npm test` | vitest — deterministic, no DB |
| Seed (real data) | `npm run db:seed` | idempotent upsert; prints `12 classes · 109 subclasses · 936 features · 240 class-levels · 13 races · 42 backgrounds` |
| Live UI | `npm run dev` → open `/characters` (in a campaign session) | list / wizard / sheet / spell picker |
| Static gates | `npm run lint` · `npm run typecheck` · `npm run build` | all green |

## Test asset map (this module)
| File | Tests | Covers |
|------|-------|--------|
| `tests/characters-rules.test.ts` | 17 | pure PHB math: `abilityMod`, `profBonusForLevel`, `maxHpFor`/`avgDie`, `clampHp`, standard-array + point-buy validation, `effectiveAbilities`, `spellSlotsFor`, `derivedSaves`/`derivedSkills`, `featuresFor` |
| `tests/characters-transform.test.ts` | 11 | **(new)** SRD→schema mappers: class saves/prof-split/skill-choices/spellcasting/subclassLevel, classLevel **computed** prof bonus + slot extraction, subclass flavor/description + community license, race ability bonuses + subrace parent, feature, background skill-strip |
| `tests/characters-service.test.ts` | 16 | **(new)** `createCharacter` derive (race bonus → HP/AC/PB/saves/skills, caster slots, NPC unclaimed), **subrace merge fix**, `updateCharacter` **override + recompute + resetAuto + HP clamp**, `canWrite` **authz** (own/other/NPC/DM/cross-campaign), `manageSpell` add/prepare/remove/bad-action |
| `tests/characters-refrepo.test.ts` | 7 | **(new)** JSON-column parse → typed, lean list vs detail, per-row license, malformed-JSON fallback (edge 5.10), null-on-missing → 404 driver, in-memory cache (no re-query) |
| `tests/characters-auth.test.ts` | 7 | **(new)** `bearerToken` (Bearer / x-session-token / none), `resolveSession` token→session, missing/unknown → null, role normalize |

---

## Edge-case traceability (PRD §5)
| Case | Scenario | Expected | Type | Coverage |
|------|----------|----------|------|----------|
| 5.1 | Class has no open subclass | show available + note; subclass may be null | unit + manual | ✅ `refrepo` getSubclasses filters by class; wizard renders Empty state when none; subclass optional in `createCharacter` (null OK) |
| 5.2 | Non-caster (Fighter/Barbarian/…) | hide Spells/slots entirely | unit + manual | ✅ `service` "hides slots for non-caster" (`spellSlots: null`); sheet gates `{c.spellSlots && …}`; live-verified Fighter |
| 5.3 | Level < subclass level | skip subclass step | manual | ✅ wizard shows subclass step note "ปลดล็อก Lv N"; `subclassLevel` from `toClassRow`; live-verified |
| 5.4 | Point-buy over budget / out of range | block + validate | unit + manual | ✅ `rules` `validatePointBuy`/`pointBuyCost`; wizard disables + total counter |
| 5.5 | Standard array incomplete/dup | block until valid | unit + manual | ✅ `rules` `validateStandardArray`; wizard `sameMultiset` gate + dup-disabled `<option>` |
| 5.6 | Player edits someone else's character | 403, server re-derives owner | unit | ✅ `service` `canWrite` (other → false; cross-campaign → false); route returns 403; payload owner ignored |
| 5.7 | Player already has a character | confirm replace / edit existing | manual | ✅ 1:1 claim (`characterId @unique`); list shows "ของฉัน" → edit; create flow distinct |
| 5.8 | Change race/class with overrides present | recompute auto, keep overrides | unit | ✅ `service` "level change does NOT overwrite overridden field"; override set preserved |
| 5.9 | Lower level (had higher slots/features) | recompute down | unit | ✅ `service` recompute uses new level; `featuresFor` filters `level <= lv`; `spellSlotsFor` from new ClassLevel |
| 5.10 | Malformed reference JSON column | render what parses, no crash | unit | ✅ `refrepo` "malformed savesJson → []"; `parseJson` fallback everywhere |
| 5.11 | currentHp negative / tempHp | clamp ≥0, ≤ max+temp | unit | ✅ `service` "currentHp clamped"; `rules` `clampHp` |
| 5.12 | Not in a session | redirect /join | manual | ✅ `CharactersClient` guard (no seat → `router.replace('/join')`); live-verified |
| 5.13 | Network drops mid-create | reference local; save is local | structural | ✅ reference seeded in SQLite; create is a single local REST call |
| 5.14 | Mobile narrow | wizard full-step; sheet accordions | manual | ✅ inherits DESIGN_SYSTEM breakpoints; `grid md:grid-cols` collapses |
| 5.15 | DM deletes a claimed character | unclaim + confirm | unit + manual | ✅ DELETE route `updateMany characterId→null` + FK `onDelete:SetNull`; confirm() dialog |

## Acceptance-criteria traceability (PRD §"Definition of Done")
| # | Expected | Type | Coverage |
|---|----------|------|----------|
| 1 | Seed reference via additive migration (classes/levels/subclasses/races/backgrounds/features) | structural + manual | ✅ migration `characters` (additive); seed → **12 · 109 · 936 · 240 · 13 · 42**; `transform` tests cover mappers |
| 2 | Player creates own character via 7-step wizard | unit + manual | ✅ `service.createCharacter`; live-verified Dwarf Fighter + Wizard via wizard/API |
| 3 | **Auto-fill matches PHB** (HP/PB/saves/skills/speed/slots/features) + overridable | unit + manual | ✅ `rules` (17) + `service` derive vs PHB (Dwarf Fighter HP13/AC11/saves; Wizard L5 slots 4/3/2); override tests |
| 4 | Edit + level change recompute auto, keep overrides | unit + manual | ✅ `service` override/recompute/resetAuto; live: level 3→4 HP 31→40 |
| 5 | Caster selects known/prepared spells; non-caster none | unit + manual | ✅ `service.manageSpell` add/prepare/remove; sheet Spells section + `SpellPicker`; live: Fireball known→prepared |
| 6 | Claim `PlayerSession.characterId`→FK; DM makes NPC | unit + manual | ✅ create claims in tx; NPC unclaimed test; FK in migration |
| 7 | Authz: player only own, DM all in campaign — server-side | unit | ✅ `service` `canWrite` matrix; routes 401/403/404; resolveSession from token only |
| 8 | Empty/loading/validation/404 states; attribution shown | unit + manual | ✅ list empty + loading; wizard validation; route 404; `refrepo` null→404; attribution footer + per-row license |
| 9 | Single-class, level 1–20; responsive; offline | structural + manual | ✅ `clampLevel` 1–20; no multiclass path; reference local (offline) |
| 10 | Additive migration — Foundation + Sprint 1 stay green | structural | ✅ migration `characters` = CREATE + data-preserving PlayerSession redefine; **76 prior tests still pass** in the 134 |

## Architecture / contract checks
| Check | Coverage |
|-------|----------|
| Reference reads = REST route handlers, dynamic + Cache-Control (not force-static) | ✅ `app/api/reference/{classes,races,backgrounds,subclasses}` via `cachedJson` |
| Character writes = REST, authz re-derived from session token | ✅ `auth.resolveSession`; routes never trust body owner/campaign |
| GLOBAL reference (no campaignId) vs campaign-scoped Character | ✅ schema; `charRepo` every query `where:{campaignId}` |
| Deterministic rules math in code (no LLM) | ✅ `rules.ts` pure, PHB-table tested; prof bonus computed in `toClassLevelRow` |
| Community packs OGL/CC only, per-row license | ✅ `refrepo` per-row license; `transform` community source/license; `COMMUNITY-LICENSE.md` Section 15 |

---

## Bugs found & fixed during QA
| Bug | Severity | Fix |
|-----|----------|-----|
| **Picking a subrace directly (High Elf, Hill Dwarf, …) applied only the subrace's delta**, losing the base race's ability bonuses / speed / traits (e.g. High Elf got +1 INT but not Elf's +2 DEX; speed fell back to 30). The UI lists race + subrace flat, so the chosen `raceSlug` was often a subrace. | **Medium** (wrong character stats) | `service.loadRefs` now detects `parentRaceSlug` on the picked race, loads the parent as the base race, and treats the pick as the subrace → `effectiveAbilities` combines both, `speed`/traits from base, `raceName` shows the subrace. Regression test added (`characters-service` "picking a SUBRACE applies BOTH …"). |

## Remaining gaps & recommendations
| Gap | Severity | Recommendation |
|-----|----------|----------------|
| REST route handlers (status codes/headers) not unit-tested in isolation | Low | The repo/service they wrap ARE tested (derive, null→404 driver, authz `canWrite`, manageSpell). Handlers are thin pass-throughs; a Next route integration test could be added in a hardening pass. |
| Real-browser wizard stepping / responsive / keyboard nav | Low | Live-verified manually in preview (create → sheet → level → spell). A Playwright pass could automate later. |
| Subrace selection is implicit (pick the subrace row) rather than a base-race → subrace step | Low | Server now resolves it correctly (bug above). A dedicated subrace sub-step would be clearer UX; deferred — not a correctness issue anymore. |
| Spell list count vs class limits (known/prepared caps) not enforced | Low | v1 lets a caster add any class spell; enforcing exact known/prepared counts per class is a future rules pass. |
| `package.json#prisma` seed config deprecated (Prisma 7) | Low | Works on Prisma 6; migrate to `prisma.config.ts` at the Prisma 7 upgrade. |

These are all **low severity**. The deterministic math, the service (derive/override/recompute/authz/spells), the transform mappers, the repo (parse/cache/null-on-missing), and graceful-degrade edges are unit-covered; the rendered screens + full create→sheet→spell flow were live-verified in preview. **Sprint 2 QA is green: 134 tests pass, 1 real bug found & fixed, regression intact.**
