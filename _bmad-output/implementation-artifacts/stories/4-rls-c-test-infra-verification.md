# Story 4-RLS-C: RLS Enablement — Test Infrastructure + Verification

Status: backlog

## Story

As a **platform operator**,
I want **the test infrastructure updated for the dual-role setup and new wiring tests proving RLS enforcement works**,
so that **I have empirical evidence that tenant isolation is enforced at the database layer**.

## Context

Story 4-RLS-A created the `bubble_app` non-superuser role, dual DataSource, admin bypass, and updated all RLS policies (NULLIF + admin bypass + WITH CHECK). Story 4-RLS-B added BullMQ tenantId validation. This story updates the shared test infrastructure (`test-db-helpers.ts`, E2E `global-setup.ts`) to provision the `bubble_app` role, adds new Tier 2 wiring tests that empirically verify RLS enforcement under the non-superuser role, and runs the browser smoke test.

**Part 3 of 3**: 4-RLS-A (done) → 4-RLS-B (done) → 4-RLS-C (this)

**Depends on**: Stories 4-RLS-A + 4-RLS-B (dual DS + updated policies + BullMQ validation must exist)

**SHARED INFRA CHANGES**: This story modifies `test-db-helpers.ts` and `global-setup.ts` — tracked per process gate.

## Acceptance Criteria

1. **AC1 — test-db-helpers updated**: `createTestDatabase()` provisions `bubble_app` role + grants on the test DB. `buildTestDbUrl()` supports optional role parameter.

2. **AC2 — E2E global-setup updated**: Uses `bubble_user` for schema sync + seed, then verifies `bubble_app` can connect. E2E webServer env includes `DB_APP_USER` and `DB_APP_PASSWORD`.

3. **AC3 — All existing tests pass**: All 1244 unit tests, all wiring tests, and all 46 E2E tests pass with the dual-role setup.

4. **AC4 — RLS tenant isolation verified**: Tier 2 wiring test proves `bubble_app` + `SET LOCAL tenant_A` cannot read Tenant B's data.

5. **AC5 — RLS admin bypass verified**: Tier 2 wiring test proves `bubble_app` + `SET LOCAL app.is_admin = 'true'` can read ALL tenants' data.

6. **AC6 — RLS catalog access verified**: Tier 2 wiring test proves `bubble_app` + `SET LOCAL tenant_A` can read published catalog templates from admin tenant.

7. **AC7 — RLS fail-closed verified**: Tier 2 wiring test proves `bubble_app` with no SET LOCAL reads zero rows. Also: `app.current_tenant = ''` reads zero rows (NULLIF safety, doesn't crash).

8. **AC8 — RLS write isolation verified (WITH CHECK)**: Tier 2 wiring test proves `bubble_app` + tenant_A context CANNOT insert a row with `tenant_id = tenant_B`. WITH CHECK clause rejects cross-tenant writes.

9. **AC9 — Browser smoke test**: Admin login, impersonation, data vault, workflow catalog — all work correctly with the dual DataSource.

## Tasks / Subtasks

- [ ] Task 1: Update test-db-helpers.ts — SHARED INFRA (AC: #1)
  - [ ] 1.1: After `CREATE DATABASE`, create `bubble_app` role + grants on new DB
  - [ ] 1.2: Add optional role param to `buildTestDbUrl()` (default: `bubble_app`)
  - [ ] 1.3: Ensure `dropTestDatabase()` handles role cleanup gracefully

- [ ] Task 2: Update E2E global-setup.ts — SHARED INFRA (AC: #2)
  - [ ] 2.1: Schema sync DataSource uses `bubble_user` (superuser, synchronize: true)
  - [ ] 2.2: After sync, verify `bubble_app` can connect to the test DB
  - [ ] 2.3: Update playwright.config.ts webServer env with `DB_APP_USER`/`DB_APP_PASSWORD`
  - [ ] 2.4: Add `DB_APP_USER` and `DB_APP_PASSWORD` to `.env.test` (or document in dev notes if no .env.test exists)

- [ ] Task 3: Run full existing test suite (AC: #3)
  - [ ] 3.1: Run all unit tests (1244) — must pass
  - [ ] 3.2: Run all wiring tests (Tier 1 + Tier 2) — must pass
  - [ ] 3.3: Run all E2E tests (46) — must pass

- [ ] Task 4: New Tier 2 wiring tests for RLS verification (AC: #4, #5, #6, #7, #8)
  - [ ] 4.1: Test: tenant isolation — `bubble_app` + tenant_A cannot read tenant_B assets
  - [ ] 4.2: Test: admin bypass — `bubble_app` + `is_admin = 'true'` reads all tenants
  - [ ] 4.3: Test: catalog access — `bubble_app` + tenant_A reads published templates
  - [ ] 4.4: Test: fail-closed — `bubble_app` with no SET LOCAL reads zero rows
  - [ ] 4.5: Test: NULLIF safety — `bubble_app` with `current_tenant = ''` reads zero rows
  - [ ] 4.6: Test: write isolation (WITH CHECK) — `bubble_app` + tenant_A CANNOT insert row with `tenant_id = tenant_B` (expects error)

- [ ] Task 5: Browser smoke test (AC: #9)
  - [ ] 5.1: Admin login → dashboard → tenants, users, workflow templates, LLM settings
  - [ ] 5.2: Impersonate tenant → data vault, workflow catalog
  - [ ] 5.3: Return to admin → verify full access restored

## Dev Notes

### Test Infrastructure Changes

```
test-db-helpers.ts (SHARED INFRA):
  createTestDatabase(dbName):
    1. CREATE DATABASE (existing)
    2. NEW: CREATE ROLE bubble_app IF NOT EXISTS
    3. NEW: GRANT SELECT/INSERT/UPDATE/DELETE ON ALL TABLES
    4. NEW: GRANT USAGE/SELECT ON ALL SEQUENCES

  buildTestDbUrl(dbName, role?):
    - Default: bubble_app (for app-level tests)
    - Override: bubble_user (for setup/sync)
```

### Wiring Test Strategy

New tests go in `integration-wiring.spec.ts` (Tier 2) because they need real PostgreSQL with RLS enforcement. They use `bubble_app` (non-superuser) to verify policies are actually enforced.

```typescript
// Pseudocode for tenant isolation test (AC4):
// 1. Connect as bubble_app (non-superuser)
// 2. BEGIN transaction
// 3. SET LOCAL app.current_tenant = 'tenant-a-id'  ← MUST be before INSERT
// 4. INSERT INTO assets (..., tenant_id = 'tenant-a-id')
// 5. COMMIT
// 6. BEGIN new transaction
// 7. SET LOCAL app.current_tenant = 'tenant-b-id'
// 8. SELECT * FROM assets → expect 0 rows (tenant A's asset is invisible to tenant B)
// 9. COMMIT

// Pseudocode for write isolation test — WITH CHECK (AC8):
// 1. Connect as bubble_app (non-superuser)
// 2. BEGIN transaction
// 3. SET LOCAL app.current_tenant = 'tenant-a-id'
// 4. INSERT INTO assets (..., tenant_id = 'tenant-b-id')  ← cross-tenant write
// 5. EXPECT ERROR — WITH CHECK clause rejects tenant_id != current_tenant
// 6. ROLLBACK
```

### Key Files to Modify

| File | Change |
|:---|:---|
| `apps/api-gateway/src/app/test-db-helpers.ts` | SHARED INFRA — bubble_app provisioning |
| `apps/web-e2e/src/global-setup.ts` | SHARED INFRA — dual role setup |
| `apps/web-e2e/playwright.config.ts` | SHARED INFRA — env vars |
| `apps/api-gateway/src/app/integration-wiring.spec.ts` | New RLS verification tests |

### Rollback Plan

If RLS enforcement breaks queries:
1. Switch default DataSource back to `bubble_user` (one-line env var change)
2. All services use default DS → immediate rollback
3. No schema changes to revert (policies are additive, not destructive)

### Out-of-Scope

| Item | Tracked In |
|:---|:---|
| Production Support Access (audit trail, time-bound tokens, UI banner) | Story 4-SA |
| Migration file creation (prod-ready) | Story 7P-1 |
| Per-tenant RLS for system-wide tables (llm_models, llm_provider_configs) | Not needed — no tenant_id |

### References

- [Source: apps/api-gateway/src/app/test-db-helpers.ts] — SHARED INFRA, test DB lifecycle
- [Source: apps/web-e2e/src/global-setup.ts] — SHARED INFRA, E2E seed data
- [Source: apps/api-gateway/src/app/integration-wiring.spec.ts] — Tier 2 wiring tests
- [Source: project-context.md#Rule-31] — Raw SQL RETURNING needs wiring test
- Party mode review: 2026-02-14 (Naz N5 test infra cascade, Murat test matrix)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### Change Log

### Test Traceability

| AC ID | Test File | Test Description | Status |
|-------|-----------|------------------|--------|
| AC1 | | | |
| AC2 | | | |
| AC3 | | | |
| AC4 | | | |
| AC5 | | | |
| AC6 | | | |
| AC7 | | | |
| AC8 | | | |
| AC9 | | | |

### File List
