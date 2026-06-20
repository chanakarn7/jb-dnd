# TEST_CASES — Inventory (Sprint 3)
### D&D Campaign Manager · module 4 of 8 · `/qa` (Stage 8)

> Traceability matrix: PRD §5 edges (5.1–5.16) × DoD items (1–11) → test evidence.
> All vitest tests run with `npm test`. Live API verification done 2026-06-20 via socket.io + fetch script.
> **Total: 209/209 tests pass** across 20 test files (+75 new: 25 rules + 25 service + 25 routes).

---

## 1. PRD §5 Edge-Case Traceability

| Edge | Description | Test Evidence | Test Location |
|------|-------------|---------------|---------------|
| **5.1** | Attune item with `requiresAttunement=false` → 422 `not_attunable` | `"attune non-attunable item → 422 not_attunable"` · `"422 for not_attunable"` | `inventory-service.test.ts` · `inventory-routes.test.ts` |
| **5.2** | Attune 4th item when 3 already attuned → 422 `attunement_limit` | `"attune 4th item when 3 already attuned → 422 attunement_limit"` · `"422 for attunement_limit"` · `"canAttuneMore false at cap (5.2)"` · `"boundary: exactly cap items → cannot attune (5.2)"` | `inventory-service.test.ts` · `inventory-routes.test.ts` · `inventory-rules.test.ts` (×2) |
| **5.3** | Add item with unknown `itemSlug` → 404 | `"returns not_found when itemSlug not in SRD"` · `"404 when service returns not_found"` | `inventory-service.test.ts` · `inventory-routes.test.ts` |
| **5.4** | `quantity ≤ 0` or non-integer → 422 `invalid_quantity` | `"returns invalid_quantity for qty=0"` · `"returns invalid_quantity for negative qty"` · `"quantity=0 → 422 invalid_quantity"` · `"quantity negative → invalid_quantity"` · `"422 when service returns invalid_quantity"` · `"422 for invalid_quantity"` · `validateQuantity` suite (7 cases) | `inventory-service.test.ts` (×4) · `inventory-routes.test.ts` (×2) · `inventory-rules.test.ts` (7) |
| **5.5** | Player writes another character's inventory → 403 | `"returns forbidden when canWrite false"` · `"canWrite false → 403"` (×3 functions) · `"403 when player reads another character"` · `"403 when service returns forbidden"` · `"403 for forbidden"` (×3 routes) | `inventory-service.test.ts` (×4) · `inventory-routes.test.ts` (×4) |
| **5.6** | Remove last item → inventory empty, no error | `"removes and returns empty inventory"` · `"200 with empty inventory after last item removed"` | `inventory-service.test.ts` · `inventory-routes.test.ts` |
| **5.7** | Set currency with negative value → 422 `invalid_currency` | `"negative value → 422 invalid_currency"` · `"float value → invalid_currency"` · `"422 for invalid_currency — negative value"` · `validateCurrency` suite (reject negative gp/cp, float) | `inventory-service.test.ts` (×2) · `inventory-routes.test.ts` · `inventory-rules.test.ts` (×3) |
| **5.8** | `propertiesJson` malformed on Item → no crash, item still renders | `"parses malformed propertiesJson gracefully"` | `inventory-service.test.ts` |
| **5.9** | DM edits any character in campaign → allowed | `dmSession` fixture in service tests; `canWrite` mock returns true for DM — re-verified by `characters-service.test.ts` `canWrite` suite | `inventory-service.test.ts` (setup) · `characters-service.test.ts` |
| **5.10** | Cross-campaign character → 404 | `"cross-campaign character → not_found"` · `"404 when character not in campaign"` | `inventory-service.test.ts` · `inventory-routes.test.ts` |
| **5.11** | Concurrent attune → cap checked inside `$transaction` (live DB count) | `"attune succeeds when count=2 (cap enforced in tx)"` · `"attune 4th item when 3 already attuned"` — both use `dbMock.$transaction` that runs callback with live count stub | `inventory-service.test.ts` |
| **5.12** | Unattune/unequip already-false item → idempotent, no error | `"unattune is idempotent even if already not attuned"` · `"already attuned + attuned=true is idempotent (no cap error)"` | `inventory-service.test.ts` |
| **5.13** | Add same slug twice → upsert stacks quantity | `"upserts item and returns inventory view on success (edge 5.13 stacking)"` · `repo.upsertItem` called with qty, not overwrite | `inventory-service.test.ts` |
| **5.14** | Character deleted → `CharacterItem` cascade deleted | `onDelete: Cascade` on `CharacterItem.characterId` FK in `schema.prisma` · migration SQL `ON DELETE CASCADE` verified in `20260620150056_inventory/migration.sql` | Schema + migration (structural) |
| **5.15** | Item slug no longer in SRD (reseed) → `missingRef: true`, shows slug as name | `"handles missing item slug gracefully — missingRef=true"` | `inventory-service.test.ts` |
| **5.16** | No session / broken token → 401 | `"401 when no session"` for all 5 endpoints (GET/POST /items, PATCH/DELETE /items/[itemId], PATCH /currency) | `inventory-routes.test.ts` (×5) |

---

## 2. Definition of Done Traceability

| DoD | Acceptance Criterion | Evidence | Status |
|-----|----------------------|----------|--------|
| **1** | Additive migration `inventory`: `CharacterItem` table (FK cascade, soft-ref slug, `@@unique([characterId,itemSlug])`, indexed `campaignId`) + `Character.currencyJson` (additive). No destructive change. | `prisma/migrations/20260620150056_inventory/migration.sql` — `CREATE TABLE "CharacterItem"` + `ALTER TABLE "Character" ADD COLUMN "currencyJson"` only. No `DROP`. Verified before apply. | ✅ |
| **2** | Regression gate: Foundation + Sprint 1 + Sprint 2 tests green after migration + new code. | **209/209** tests pass. 20 test files. No existing test broken. | ✅ |
| **3** | Player can add SRD item to own character. Unknown slug → 404. | `addItem` happy-path test (stacking) · `not_found` test · POST /items 201/404 route tests · Live API verified 2026-06-20 | ✅ |
| **4** | Set quantity / equip toggle / unequip; `quantity ≤ 0` → 422. | `quantity=0 → 422` · `quantity negative → 422` · equip toggle test · `validateQuantity` 7-case suite | ✅ |
| **5** | Attunement rules: only `requiresAttunement` items (else 422), cap = 3 (4th → 422), unattune always ok, cap checked in `$transaction`. | Edges 5.1/5.2/5.11/5.12 all covered — see §1 above | ✅ |
| **6** | Currency: all 5 denominations (pp/gp/ep/sp/cp), negative → 422 `invalid_currency`. | `setCurrency` suite (saves normalized, negative, float, forbidden) · `validateCurrency` 6 cases · `normalizeCurrency` 3 cases · PATCH /currency route 4 cases | ✅ |
| **7** | Delete item; last item → empty state; character deleted → cascade. | Edge 5.6 tests · `onDelete: Cascade` in schema (5.14 structural) | ✅ |
| **8** | Authz server-side: player own only (else 403), DM any in campaign, cross-campaign 404, no session 401. Re-derived from token. | 401 (×5 routes) · 403 (×4 routes + ×4 service) · 404 cross-campaign · DM via `canWrite` in `characters-service.test.ts` | ✅ |
| **9** | UI states: empty / loading / validation / 403 / 404 toast; attunement counter "X/3"; requiresAttunement badge. | Live-verified 2026-06-20 via running dev server; `InventorySection` renders empty state; counter reads `attunedCount/attunementCap` from `InventoryView` | ✅ |
| **10** | `DATA_MODEL.md` amended: `CharacterItem` finalized + `Character.currencyJson` recorded. | `docs/program/DATA_MODEL.md` updated in Stage 7 (§CharacterItem, §Character additive column) | ✅ |
| **11** | Determinism + tests: inventory rules have unit tests (vitest). No LLM calls. | `inventory-rules.test.ts` (25) + `inventory-service.test.ts` (25) + `inventory-routes.test.ts` (25) = 75 new tests. `lib/inventory/rules.ts` is pure deterministic (no async, no DB, no LLM). | ✅ |

---

## 3. Test Suite Breakdown

| File | Tests | Covers |
|------|-------|--------|
| `tests/inventory-rules.test.ts` | 25 | `ATTUNEMENT_CAP`, `isAttunable`, `validateQuantity` (7), `validateCurrency` (6), `normalizeCurrency` (3), `countAttuned`/`canAttuneMore` (6+boundary) |
| `tests/inventory-service.test.ts` | 25 | `addItem` (5), `setItemFields` attune (5) + qty/equip/authz (5), `removeItem` (3), `setCurrency` (4), `toInventoryView` graceful (2) |
| `tests/inventory-routes.test.ts` | 25 | HTTP status mapping: GET/POST /items (10), PATCH/DELETE /items/[itemId] (11), PATCH /currency (4) |
| **Sprint 0/1/2 (unchanged)** | 134 | Foundation, 5e Reference, Characters — regression gate |
| **Total** | **209** | **20 test files, all green** |

---

## 4. Live API Verification Log (2026-06-20)

Verified end-to-end via `socket.io-client` + `fetch` against dev server (`http://localhost:3000`):

| Scenario | Result |
|----------|--------|
| Create campaign + join as player | ✅ |
| POST /items `{ itemSlug: "longsword" }` → 201, item appears | ✅ |
| POST /items same slug → stacks qty (edge 5.13) | ✅ |
| POST /items `{ itemSlug: "unknown-xyz" }` → 404 (edge 5.3) | ✅ |
| PATCH /items/[id] `{ equipped: true }` → 200 | ✅ |
| PATCH /items/[id] `{ attuned: true }` on non-attunable item → 422 `not_attunable` (edge 5.1) | ✅ |
| PATCH /items/[id] `{ quantity: 0 }` → 422 `invalid_quantity` (edge 5.4) | ✅ |
| Add 3 attunable items, attune all 3, attune 4th → 422 `attunement_limit` (edge 5.2) | ✅ |
| PATCH /currency `{ gp: 50 }` → 200, returns normalized `{pp:0,gp:50,ep:0,sp:0,cp:0}` | ✅ |
| PATCH /currency `{ gp: -10 }` → 422 `invalid_currency` (edge 5.7) | ✅ |
| DELETE /items/[id] last item → 200, `items: []` (edge 5.6) | ✅ |
| Cross-campaign request (wrong campaignId in token) → 404 (edge 5.10) | ✅ |
| No token → 401 (edge 5.16) | ✅ |
| Player reading other character → 403 (edge 5.5) | ✅ |

All 14 scenarios verified. Zero errors.

---

## 5. Non-Goals (not tested — explicitly out of scope per PRD §1.4)

- Carrying capacity / encumbrance enforcement
- Homebrew / custom item creation
- Auto AC / damage calculation from `equipped` state
- Buy/sell economy, shop, loot tables
- Realtime Socket.io broadcast of inventory changes
- Nested containers (bag-in-bag), starting equipment auto-grant
