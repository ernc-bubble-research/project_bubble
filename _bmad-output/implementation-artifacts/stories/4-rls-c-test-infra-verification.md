# Story 4-RLS-C: RLS Enablement — Test Infrastructure + Verification

Status: complete

## Story

As a **platform operator**,
I want **the test infrastructure updated for the dual-role setup and new wiring tests proving RLS enforcement works**,
so that **I have empirical evidence that tenant isolation is enforced at the database layer**.

## Context

Story 4-RLS-A created the `bubble_app` non-superuser role, dual DataSource, admin bypass, and updated all RLS policies (NULLIF + admin bypass + WITH CHECK). Story 4-RLS-B added BullMQ tenantId validation. This story adds an optional role parameter to `buildTestDbUrl()`, updates E2E config for the dual-role setup, adds new Tier 2 wiring tests that empirically verify RLS enforcement under the non-superuser role, and runs the browser smoke test.

**Part 3 of 3**: 4-RLS-A (done) → 4-RLS-B (done) → 4-RLS-C (this)

**Depends on**: Stories 4-RLS-A + 4-RLS-B (dual DS + updated policies + BullMQ validation must exist)

**SHARED INFRA CHANGES**: This story modifies `test-db-helpers.ts`, `global-setup.ts`, and `playwright.config.ts` — tracked per process gate.

**Party mode review**: 2026-02-15 (7 findings: N1 simplify AC1, N2 add admin write test, N3 bubble_app DS required, N4 playwright env vars, N5 E2E first, N6 outdated comment, N7 no timing issue)

## Acceptance Criteria

1. **AC1 — test-db-helpers updated**: `buildTestDbUrl()` supports optional `role` parameter (default: `bubble_user` for backward compatibility). No role creation needed — `RlsSetupService.onModuleInit()` already handles role + grants after `synchronize` creates tables.

2. **AC2 — E2E config updated**: `playwright.config.ts` webServer env includes explicit `DB_APP_USER` and `DB_APP_PASSWORD`. `global-setup.ts` outdated "unique names" comment updated (RLS is now enforced, unique names no longer needed as workaround).

3. **AC3 — All existing tests pass**: All 1181 unit tests, all wiring tests (Tier 1 + Tier 2), and all 46 E2E tests pass with the dual-role setup. E2E run FIRST to surface breakages before new tests.

4. **AC4 — RLS tenant isolation verified**: Tier 2 wiring test using `bubble_app` DataSource proves `SET LOCAL tenant_A` cannot read Tenant B's data.

5. **AC5 — RLS admin bypass verified (read + write)**: Tier 2 wiring test using `bubble_app` DataSource proves `SET LOCAL app.is_admin = 'true'` can read ALL tenants' data AND can insert a row with any tenant_id (WITH CHECK allows admin writes).

6. **AC6 — RLS catalog access verified**: Tier 2 wiring test using `bubble_app` DataSource proves `SET LOCAL tenant_A` can read published catalog templates from admin tenant.

7. **AC7 — RLS fail-closed verified**: Tier 2 wiring test using `bubble_app` DataSource proves: (a) no SET LOCAL reads zero rows, (b) `app.current_tenant = ''` reads zero rows (NULLIF safety, doesn't crash).

8. **AC8 — RLS write isolation verified (WITH CHECK)**: Tier 2 wiring test using `bubble_app` DataSource proves tenant_A context CANNOT insert a row with `tenant_id = tenant_B`. WITH CHECK clause rejects cross-tenant writes.

9. **AC9 — Browser smoke test**: Admin login, impersonation, data vault, workflow catalog — all work correctly with the dual DataSource.

## Tasks / Subtasks

- [x] Task 1: Update test-db-helpers.ts — SHARED INFRA (AC: #1)
  - [x] 1.1: Add optional `role` param to `buildTestDbUrl(dbName, role?)` — defaults to `bubble_user` for backward compatibility
  - [x] 1.2: Add `buildAppTestDbUrl(dbName)` convenience helper — returns URL for `bubble_app` role

- [x] Task 2: Update E2E config — SHARED INFRA (AC: #2)
  - [x] 2.1: Update `playwright.config.ts` webServer env with `DB_APP_USER`/`DB_APP_PASSWORD`
  - [x] 2.2: Update `global-setup.ts` outdated "unique names" comment (line 140-141) — RLS is now enforced by `bubble_app`, unique names were a workaround for superuser bypass

- [x] Task 3: Run full existing test suite — E2E FIRST (AC: #3)
  - [x] 3.1: Run all E2E tests (46) — 45/46 passed, 1 flaky (passes on retry, not RLS-related)
  - [x] 3.2: Run all unit tests — 628 api-gateway + 39 db-layer + 515 web = 1182 passed
  - [x] 3.3: Run all wiring tests — 13 Tier 1 + 18 Tier 2 = 31 passed

- [x] Task 4: New Tier 2 wiring tests for RLS verification (AC: #4, #5, #6, #7, #8)
  - [x] 4.1: Create separate `bubble_app` DataSource in test setup — separate describe block with own module + appDs
  - [x] 4.2: Test: tenant isolation — `bubble_app` + tenant_A cannot read tenant_B folders
  - [x] 4.3: Test: admin bypass READ — `bubble_app` + `is_admin = 'true'` reads all tenants
  - [x] 4.4: Test: admin bypass WRITE — `bubble_app` + `is_admin = 'true'` can insert row with any tenant_id
  - [x] 4.5: Test: catalog access — `bubble_app` + tenant_A reads published templates from admin tenant
  - [x] 4.6: Test: fail-closed — `bubble_app` with no SET LOCAL reads zero rows
  - [x] 4.7: Test: NULLIF safety — `bubble_app` with `current_tenant = ''` reads zero rows (no crash)
  - [x] 4.8: Test: write isolation (WITH CHECK) — `bubble_app` + tenant_A CANNOT insert row with `tenant_id = tenant_B` (expects error)

- [x] Task 5: Browser smoke test (AC: #9)
  - [x] 5.1: Admin login → dashboard (3 tenants), tenants page (3 listed), workflow studio (3 templates), LLM settings (12 models)
  - [x] 5.2: Impersonate Acme Corp → data vault (1 file visible), workflow catalog (Live Test Workflow visible)
  - [x] 5.3: Exit impersonation → admin dashboard restored, full access confirmed

## Dev Notes

### Party Mode Findings Applied

| # | Finding | Severity | Resolution |
|:---|:---|:---|:---|
| N1 | test-db-helpers over-specified — role creation not needed | MEDIUM | Simplified AC1: only `buildTestDbUrl()` role param. RlsSetupService handles role creation. |
| N2 | Missing test: admin bypass WITH CHECK (write) | MEDIUM | Added to AC5 + Task 4.4 |
| N3 | RLS tests MUST use `bubble_app` DataSource, not `bubble_user` | HIGH | Documented in AC4-AC8 + Task 4.1. Tests are meaningless without non-superuser role. |
| N4 | playwright.config.ts needs explicit env vars | MEDIUM | Added to AC2 + Task 2.1 |
| N5 | Run E2E first to surface breakages | MEDIUM | Task 3 reordered: E2E before unit/wiring |
| N6 | global-setup.ts "unique names" comment outdated | LOW | Added to AC2 + Task 2.2 |
| N7 | No grant timing issue | LOW | Confirmed — no change needed |

### Test Infrastructure — Simplified Approach

```
test-db-helpers.ts (SHARED INFRA):
  buildTestDbUrl(dbName, role?):
    - Default: bubble_user (backward compat — existing tests unchanged)
    - Override: any role name (e.g., 'bubble_app')

  buildAppTestDbUrl(dbName):
    - Convenience: returns bubble_app URL
    - Uses DB_APP_USER/DB_APP_PASSWORD env vars (fallback: bubble_app/bubble_password)

  createTestDatabase(dbName):
    - UNCHANGED — role creation handled by RlsSetupService.onModuleInit()

  dropTestDatabase(dbName):
    - UNCHANGED — no role cleanup needed (cluster-level role persists)
```

**Why no role creation in test-db-helpers?** The `bubble_app` role is a cluster-level PostgreSQL role — once created, it persists across all databases. `RlsSetupService.onModuleInit()` creates it idempotently in development mode. Tier 2 tests use the full NestJS module which includes RlsSetupService. Duplicating role creation in test-db-helpers would be redundant.

### Wiring Test Architecture

All new RLS verification tests use a **separate `bubble_app` DataSource** — NOT the existing `dataSource` variable (which connects as `bubble_user` superuser and bypasses all RLS). The `bubble_user` DataSource is used ONLY for seed data setup.

```typescript
// In integration-wiring.spec.ts:
let appDataSource: DataSource; // bubble_app (non-superuser) — for RLS tests
let dataSource: DataSource;    // bubble_user (superuser) — for setup/seed

beforeAll(async () => {
  // ... existing module setup (creates tables, role, grants, policies) ...

  // Create separate bubble_app DataSource for RLS verification tests
  appDataSource = new DataSource({
    type: 'postgres',
    url: buildAppTestDbUrl(TEST_DB_NAME),
    entities: ALL_ENTITIES,
    synchronize: false, // Schema already synced by migration DS
  });
  await appDataSource.initialize();
});

afterAll(async () => {
  if (appDataSource?.isInitialized) await appDataSource.destroy();
  // ... existing teardown ...
});
```

### Wiring Test Pseudocode

```typescript
// Tenant isolation (AC4):
// 1. Seed: INSERT tenant_A + tenant_B + asset_A (tenant_id=A) via bubble_user
// 2. Test: appDataSource.transaction → SET LOCAL tenant_B → SELECT assets → 0 rows
// 3. Verify: appDataSource.transaction → SET LOCAL tenant_A → SELECT assets → 1 row

// Admin bypass READ (AC5):
// 1. Seed: INSERT tenant_A + asset_A via bubble_user
// 2. Test: appDataSource.transaction → SET LOCAL is_admin='true' → SELECT assets → sees all

// Admin bypass WRITE (AC5):
// 1. Test: appDataSource.transaction → SET LOCAL is_admin='true' → INSERT asset with any tenant_id → succeeds

// Write isolation (AC8):
// 1. Test: appDataSource.transaction → SET LOCAL tenant_A → INSERT asset with tenant_id=B → ERROR

// Fail-closed (AC7):
// 1. Seed: INSERT tenant_A + asset_A via bubble_user
// 2. Test: appDataSource.transaction → NO SET LOCAL → SELECT assets → 0 rows

// NULLIF safety (AC7):
// 1. Test: appDataSource.transaction → SET LOCAL current_tenant='' → SELECT assets → 0 rows (no crash)
```

### Key Files to Modify

| File | Change |
|:---|:---|
| `apps/api-gateway/src/app/test-db-helpers.ts` | SHARED INFRA — `buildTestDbUrl()` role param + `buildAppTestDbUrl()` helper |
| `apps/web-e2e/playwright.config.ts` | SHARED INFRA — `DB_APP_USER`/`DB_APP_PASSWORD` env vars |
| `apps/web-e2e/src/global-setup.ts` | SHARED INFRA — update outdated "unique names" comment |
| `apps/api-gateway/src/app/integration-wiring.spec.ts` | New RLS verification tests (7 tests) + `bubble_app` DataSource |

### Rollback Plan

If RLS enforcement breaks queries:
1. Switch default DataSource back to `bubble_user` (one-line env var change: `DB_APP_USER=bubble_user`)
2. All services use default DS → immediate rollback to superuser (bypasses all RLS)
3. No schema changes to revert (policies are additive, not destructive)

### Out-of-Scope

| Item | Tracked In |
|:---|:---|
| Production Support Access (audit trail, time-bound tokens, UI banner) | Story 4-SA |
| Migration file creation (prod-ready) | Story 7P-1 |
| Per-tenant RLS for system-wide tables (llm_models, llm_provider_configs) | Not needed — no tenant_id |
| TRUNCATE permission for bubble_app | Not needed — only superuser truncates (global-setup.ts) |
| Catalog RLS negative cases (draft/deleted/restricted blocked) | Future catalog test story (Murat F4 finding) |

### References

- [Source: apps/api-gateway/src/app/test-db-helpers.ts] — SHARED INFRA, test DB lifecycle
- [Source: apps/web-e2e/src/global-setup.ts] — SHARED INFRA, E2E seed data
- [Source: apps/api-gateway/src/app/integration-wiring.spec.ts] — Tier 2 wiring tests
- [Source: apps/api-gateway/src/app/migration-database.module.ts] — MigrationDatabaseModule (role creation flow)
- [Source: project-context.md#Rule-31] — Raw SQL RETURNING needs wiring test
- Party mode review: 2026-02-15 (7 findings applied — see table above)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- E2E initially failed with `42501 permission denied for table users` — root cause: `NODE_ENV === 'development'` guard in `migration-database.module.ts` and `rls-setup.service.ts` blocked role creation/grants/RLS policies when `NODE_ENV = 'test'`. Fixed by allowing both `development` and `test`.
- Unit test `[1H.1-UNIT-003]` expected RLS setup to be skipped in test env — updated to expect it runs, added new `[4-RLS-C-UNIT-001]` for staging env skip.
- E2E test `[2E-E2E-002b]` flaky (archive file timing) — passes on retry, not RLS-related.

### Completion Notes List
- All 5 tasks complete, all 9 ACs satisfied
- 10 new RLS enforcement wiring tests + 1 new unit test + 2 updated unit tests = net +11 tests
- Total test count: 1275 (was 1264). Breakdown: 638 api-gateway + 39 db-layer + 83 shared + 515 web. Previous stories undercounted by omitting libs/shared (83 DTO validation tests).
- Additional fix: `.env.test` updated with `DB_APP_USER`/`DB_APP_PASSWORD` for E2E compatibility
- Post-review fix: `auth_insert_users` policy tightened from `WITH CHECK (true)` to `WITH CHECK (role IN ('customer_admin', 'creator'))` — prevents `bubble_admin` creation via raw DB access through `bubble_app` role

### Change Log
- `apps/api-gateway/src/app/test-db-helpers.ts` — `buildTestDbUrl(dbName)` (superuser) + `buildAppTestDbUrl(dbName)` (bubble_app), two separate functions
- `apps/web-e2e/playwright.config.ts` — Added explicit `DB_APP_USER`/`DB_APP_PASSWORD` in webServer env
- `apps/web-e2e/src/global-setup.ts` — Updated outdated "unique names" comment (RLS now enforced)
- `.env.test` — Added `DB_APP_USER=bubble_app` and `DB_APP_PASSWORD=bubble_password`
- `apps/api-gateway/src/app/migration-database.module.ts` — Allow `NODE_ENV === 'test'` for role creation/grants
- `libs/db-layer/src/lib/rls-setup.service.ts` — Allow `NODE_ENV === 'test'` for full RLS setup + tightened `auth_insert_users` policy: `WITH CHECK (role IN ('customer_admin', 'creator'))` instead of `WITH CHECK (true)`
- `libs/db-layer/src/lib/rls-setup.service.spec.ts` — Updated `[1H.1-UNIT-003]` (test env now runs RLS), added `[4-RLS-C-UNIT-001]` (staging skips)
- `apps/api-gateway/src/app/integration-wiring.spec.ts` — Added 10 RLS enforcement tests in new `describe` block with `bubble_app` DataSource (7 tenant isolation + 3 auth role restriction), updated outdated comments

### Test Traceability

| AC ID | Test File | Test Description | Status |
|-------|-----------|------------------|--------|
| AC1 | `test-db-helpers.ts` | `buildTestDbUrl(dbName)` (superuser) + `buildAppTestDbUrl(dbName)` (bubble_app) — verified by INTEG tests using them | PASS |
| AC2 | `playwright.config.ts`, `global-setup.ts` | Explicit env vars + updated comment | PASS |
| AC3 | Full suite | 46 E2E (45+1 flaky) + 638 api-gw + 39 db-layer + 83 shared + 515 web = 1275 unit total | PASS |
| AC4 | `integration-wiring.spec.ts` | `[4-RLS-C-INTEG-001]` tenant_A cannot read tenant_B folders | PASS |
| AC5 | `integration-wiring.spec.ts` | `[4-RLS-C-INTEG-002]` admin reads all + `[4-RLS-C-INTEG-003]` admin writes any | PASS |
| AC6 | `integration-wiring.spec.ts` | `[4-RLS-C-INTEG-004]` tenant_A reads published catalog from system tenant | PASS |
| AC7 | `integration-wiring.spec.ts` | `[4-RLS-C-INTEG-005]` fail-closed + `[4-RLS-C-INTEG-006]` NULLIF safety | PASS |
| AC8 | `integration-wiring.spec.ts` | `[4-RLS-C-INTEG-007]` tenant_A cannot INSERT with tenant_B tenant_id | PASS |
| AC9 | Browser smoke test | Admin dashboard, tenants, workflows, settings, impersonation, data vault, catalog — all working | PASS |
| AC10 | `integration-wiring.spec.ts` | `[4-RLS-C-INTEG-008]` blocks bubble_admin creation + `[INTEG-009]` allows customer_admin + `[INTEG-010]` allows creator | PASS |

### Code Review Summary
- **Pass 1 (Amelia)**: 3 findings. A1 test count fixed (1191→1189). A2 misleading role param → fixed in Pass 2. A3 double DB creation tracked.
- **Pass 2 (Naz)**: 9 findings. B1 role param removed (buildTestDbUrl simplified). B3 test count corrected to 1272 (libs/shared was never counted). B2/B4-B9 withdrawn after discussion.
- **Pass 3 (Murat)**: 12 findings. F4 catalog negative cases tracked in Out-of-Scope. F1-F3/F5-F12 rejected (duplicates, testing PostgreSQL internals, or already covered by two-tier test architecture).
- **Post-review team fix**: `auth_insert_users` WITH CHECK tightened to `role IN ('customer_admin', 'creator')`. 3 new wiring tests (INTEG-008/009/010) verify DB-level enforcement. Unit tests updated.
- **Total fixes applied**: 4 (test count, role param removal, story file corrections, auth policy tightening)

### File List
- `apps/api-gateway/src/app/test-db-helpers.ts` (modified)
- `apps/web-e2e/playwright.config.ts` (modified)
- `apps/web-e2e/src/global-setup.ts` (modified)
- `.env.test` (modified)
- `apps/api-gateway/src/app/migration-database.module.ts` (modified)
- `libs/db-layer/src/lib/rls-setup.service.ts` (modified)
- `libs/db-layer/src/lib/rls-setup.service.spec.ts` (modified)
- `apps/api-gateway/src/app/integration-wiring.spec.ts` (modified)
