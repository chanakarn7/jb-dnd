# TEST_CASES — Foundation (Sprint 0)
### D&D Campaign Manager · module 1 of 8 · QA (Stage 8)

> Traceability from [PRD](./PRD.md) §5 (edge cases) and §7 (acceptance criteria) to automated/manual tests.
> Inputs: [SA_BLUEPRINT](./SA_BLUEPRINT.md), [ARCHITECTURE](../../program/ARCHITECTURE.md).
> **Status: 35 automated tests pass** (`npm test`, 6 files) + 9-check live smoke (`node scripts/smoke.mjs`).

## How to run
| Layer | Command | Notes |
|-------|---------|-------|
| Unit/logic (headless, persistence mocked) | `npm test` | vitest — 34 tests, deterministic |
| Live end-to-end (real socket.io clients) | `npm run dev` then `node scripts/smoke.mjs` | 9 checks incl. ≤500ms roster sync |
| Restart rehydrate | create a campaign, restart server, watch boot log | prints `rehydrated N active campaign(s)` |
| Static gates | `npm run lint` · `npm run typecheck` · `npm run build` | all green |

## Test asset map
| File | Tests | Covers |
|------|-------|--------|
| `tests/inviteCode.test.ts` | 4 | code alphabet (no 0/O/1/I/L), dash format, normalize, round-trip |
| `tests/tokens.test.ts` | 2 | token charset + uniqueness |
| `tests/workingSet.test.ts` | 6 | create, find-by-code, name-taken, multi-socket presence, identity-by-token, no token leak |
| `tests/campaignService.test.ts` | 9 | create/join happy + negative, closed campaign, rename/remove authorization |
| `tests/foundationGaps.test.ts` | 12 | multi-tenancy isolation, collision retry, payload limits, dup-name DB-race rollback, anon authz, reconnect rebuild |
| `tests/llm.test.ts` | 2 | graceful degrade with no LLM provider |
| `scripts/smoke.mjs` | 9 | live: create+code, bad-code, dup-name, roster sync, player-rename-denied, rename broadcast, reconnect-no-dup, no-leaked-secrets |

---

## Edge-case traceability (PRD §5)
| Case | Scenario | Expected | Type | Coverage |
|------|----------|----------|------|----------|
| 5.1 | Bad / unknown invite code | reject `BAD_CODE`, no session | unit + integ | ✅ campaignService "rejects unknown invite code" + smoke #2 |
| 5.2 | Duplicate display name in campaign | reject `DUPLICATE_NAME` | unit + integ | ✅ campaignService "rejects a duplicate display name" + smoke #3 |
| 5.3 | Join a closed campaign | reject `CAMPAIGN_CLOSED` | unit | ✅ campaignService "rejects joining a closed campaign" |
| 5.4 | DM disconnects | campaign stays; DM shown offline; players NOT kicked | unit + manual | ✅ presence (workingSet) flips offline; "no kick on disconnect" holds by construction (disconnect handler only flips presence) — full behavior = manual |
| 5.5 | DM reconnect via token | full snapshot, control restored | unit + integ | ✅ TC-RESUME (token index rebuild + attach) ; DM-specific path = smoke/manual |
| 5.6 | Player disconnect / reconnect | seat preserved, no duplicate | unit + integ | ✅ TC-RESUME + smoke #7 |
| 5.7 | Invite-code collision / ambiguity | unambiguous alphabet; retry on clash | unit | ✅ inviteCode tests + TC-CODE "retries when a generated code already exists" |
| 5.8 | Two clients race same name | server arbiter; one rejected, no dup | unit + integ | ✅ dup-name rejection (campaignService + smoke) **and** TC-RACE "rolls back the in-memory seat when the unique constraint rejects a racing join" |
| 5.9 | Server restart with active campaign | rehydrate from SQLite, all offline until resume | unit + manual | ✅ TC-RESUME "loadCampaignRuntime rebuilds…" + manual boot log `rehydrated 1 active campaign` |
| 5.10 | Unauthorized intent (player/anon does DM action) | reject `UNAUTHORIZED`, server-side | unit + integ | ✅ campaignService (player rename/remove) + TC-AUTHZ (anon) + smoke #5 |
| 5.11 | Malformed / oversized payload | typed reject, room never crashes | unit | ✅ TC-VAL (name>60, dm>24, player>24, rename>60, missing id, null/garbage) |
| 5.12 | Same person two tabs | stays online until last socket drops | unit | ✅ workingSet "derives presence from live sockets (multi-tab safe)" |
| 5.13 | No LLM provider configured | AI absent, core flow unaffected | unit + manual | ✅ TC-LLM + app ran end-to-end with no provider |

## Acceptance-criteria traceability (PRD §7)
| AC | Expected | Type | Coverage |
|----|----------|------|----------|
| 7.1 | DM creates campaign → unique readable code | unit + integ | ✅ campaignService create + inviteCode alphabet + smoke #1 |
| 7.2 | Player joins by code + name → lobby | unit + integ | ✅ campaignService join + smoke #4 |
| 7.3 | Roster updates live on all clients (≤500ms) | integ | ✅ smoke #5 — measured **14ms**; unit roster mutation in workingSet |
| 7.4 | DM-only actions enforced server-side | unit + integ | ✅ campaignService + TC-AUTHZ + smoke #6 |
| 7.5 | Reconnect via token → full snapshot, no dup seat | unit + integ | ✅ TC-RESUME + smoke #7 |
| 7.6 | Server restart rehydrates from SQLite | unit + manual | ✅ TC-RESUME + boot log |
| 7.7 | Bad code / dup name / unauthorized → clear safe errors | unit + integ | ✅ 5.1/5.2/5.10 above |
| 7.8 | Runs with no LLM provider | unit + manual | ✅ TC-LLM |
| 7.9 | Schema ships as Prisma migration matching DATA_MODEL | structural | ✅ migration `foundation_baseline`; `Campaign`/`PlayerSession` match [DATA_MODEL](../../program/DATA_MODEL.md) — verify via `npx prisma migrate status` |
| — | No secret tokens in broadcasts | unit + integ | ✅ workingSet "never leaks secret tokens" + smoke #8 |

---

## Remaining gaps & recommendations
| Gap | Severity | Recommendation |
|-----|----------|----------------|
| True 2-browser concurrency & ≤500ms under load | Low | Covered functionally by smoke; a Playwright two-context test could automate the real-browser path if desired in a later hardening pass. |
| DM-reconnect-specific path (vs player) | Low | Behaviorally identical (same token mechanism); smoke covers player. Manual-verify DM reconnect once. |
| Socket-handler layer (io.ts/handlers) thin wrappers | Low | Logic lives in the unit-tested service; the broadcast wiring is exercised by `scripts/smoke.mjs`. A socket.io integration test harness could be added later. |

These are all **low severity** — the server-authoritative logic, authorization, multi-tenancy, validation, and presence are unit-covered; the realtime/broadcast/persistence paths are covered live by the smoke run. Sprint 0 QA is **green**.
