# Story 4-FIX-A1: RETURNING Engine Fixes

Status: done

## Story

As a **platform operator**,
I want **the critical fan-in RETURNING bug fixed and all RETURNING queries audited**,
so that **workflow runs complete reliably and the execution engine produces correct results**.

## Context

During Live Test Round 1 (2026-02-12), the most critical bug discovered was C1: the fan-in finalization never fires because `manager.query('UPDATE ... RETURNING ...')` returns `[[rows], affectedCount]` (pg driver format) but the code destructures it as `rows[0]`, getting the inner array instead of the row object. This means `completed_jobs`, `failed_jobs`, and `total_jobs` are all `undefined`, so the finalization check never triggers.

This story fixes the RETURNING bug, audits all RETURNING calls across the codebase, adds the required Tier 2 wiring test (Rule 31), updates unit test mocks to match real pg behavior, and cleans up orphaned runs left by the bug.

### Source: Live Test Round 1 Party Mode Triage (2026-02-12)
- C1 (CRITICAL): Fan-in RETURNING result parsing
- Party mode review: team agreed on test-first approach (Tier 2 test → fix → mock updates)

### Pre-Implementation Party Mode Review (2026-02-12)
7 findings incorporated from team review (Murat, Winston, Naz, Amelia, Bob):
1. AC6 cleanup SQL: added COALESCE for NULL counters (HIGH — Murat, Naz)
2. AC1: test both INSERT RETURNING and UPDATE RETURNING patterns (MEDIUM — Murat)
3. AC4: added `knowledge-search.service.ts` + SELECT queries to audit list (MEDIUM — Naz)
4. Out-of-Scope: added `creditsConsumed` correction → Story 4-4 (MEDIUM — Naz)
5. AC2: extract `parseReturningRow<T>()` shared helper (MEDIUM — Winston, Amelia)
6. AC2/AC3: add runtime assertion after destructuring (LOW — Winston)
7. AC4: clarified audit scope includes test files, not just production (LOW — Naz)

## Acceptance Criteria

1. **AC1: Tier 2 Wiring Test for RETURNING Query (Rule 31) — TEST FIRST**
   - Given Rule 31 requires Tier 2 wiring tests for RETURNING queries
   - When a Tier 2 integration test is written against real PostgreSQL
   - Then the test discovers the actual return shape of `manager.query('UPDATE ... RETURNING ...')` AND `manager.query('INSERT ... RETURNING ...')`
   - The test inserts a workflow_run row, executes the exact RETURNING SQL from the processor, and verifies the destructured result contains `completed_jobs`, `failed_jobs`, `total_jobs` as numbers
   - **Must test both UPDATE RETURNING and INSERT RETURNING patterns** — the processor uses UPDATE RETURNING, but `validated-insight.service.ts` uses INSERT RETURNING. Both must be verified to have the same `[[rows], affectedCount]` shape.
   - Uses `project_bubble_wiring_integ_test` database
   - **This task is done FIRST — write the test, see what the real return shape is, then fix the code**

2. **AC2: Fix recordFanOutCompletion RETURNING Destructuring (C1 — CRITICAL)**
   - Given a workflow run with N subject files processes a job successfully
   - When the processor updates `completed_jobs` via `manager.query('UPDATE ... RETURNING ...')`
   - Then the result is correctly destructured based on what AC1's test reveals (expected: `const [[row]] = await manager.query(...)`)
   - And fan-in finalization triggers when `completed_jobs + failed_jobs >= total_jobs`
   - And the run status transitions to `COMPLETED` (or `COMPLETED_WITH_ERRORS` if any failed)
   - **Extract a shared `parseReturningRow<T>(result: unknown): T` helper** that handles `[[row]]` destructuring with runtime validation. Both AC2 and AC3 use this helper — single point of correctness instead of duplicated destructuring.
   - **Runtime assertion required:** After destructuring, assert that the returned fields are the expected types (e.g., `typeof row.completed_jobs === 'number'`). If the pg driver changes behavior in a future version, this produces a clear error instead of silent `undefined` propagation.
   - **File:** `workflow-execution.processor.ts` lines 207-218 (`recordFanOutSuccess`)

3. **AC3: Fix recordFanOutFailure RETURNING Destructuring (C1 — CRITICAL)**
   - Given a workflow run job fails
   - When the processor updates `failed_jobs` via `manager.query('UPDATE ... RETURNING ...')`
   - Then the result is correctly destructured (same pattern as AC2)
   - **File:** `workflow-execution.processor.ts` lines 389-398 (`recordFanOutFailure`)

4. **AC4: Audit ALL manager.query() RETURNING Calls Across Codebase**
   - Given the C1 bug was caused by incorrect RETURNING result destructuring
   - When a codebase audit is performed (grep for `manager.query` + `RETURNING`)
   - Then ALL instances are identified, verified, and fixed if needed
   - Known locations to audit:
     - `workflow-execution.processor.ts` (2 calls — AC2, AC3)
     - `validated-insight.service.ts` lines 64-78 (INSERT RETURNING)
     - `validated-insight.service.ts` lines 176-182 (UPDATE RETURNING)
     - `knowledge-search.service.ts` line 57 (SELECT, not RETURNING — verify and document as "no fix needed")
     - `validated-insight.service.ts` lines 114, 148 (SELECT queries — verify and document)
     - `web-e2e/src/admin/invitations.spec.ts` lines 70-86 (E2E setup — test file, still fix if wrong)
   - **Scope:** Audit covers ALL `manager.query()` calls — production AND test files. Wrong is wrong regardless of directory.
   - A summary of all audited locations and their status is documented in the Dev Agent Record

5. **AC5: Update Unit Test Mocks for RETURNING Queries**
   - Given existing unit tests mock `manager.query()` to return `[row]` (flat array)
   - When the real behavior is `[[row], affectedCount]`
   - Then all unit test mocks for RETURNING queries are updated to return the real pg format
   - This ensures unit tests catch future RETURNING destructuring regressions
   - **File:** `workflow-execution.processor.spec.ts` line 458 (and any others found in audit)

6. **AC6: Orphaned Run Cleanup**
   - Given the C1 bug left workflow runs stuck in `running` status despite all jobs being complete
   - Then a cleanup SQL is documented in the operations runbook:
     ```sql
     UPDATE workflow_runs
     SET status = 'completed', completed_at = NOW()
     WHERE status = 'running'
     AND COALESCE(completed_jobs, 0) + COALESCE(failed_jobs, 0) >= total_jobs;
     ```
   - **Note:** COALESCE is required because the RETURNING bug prevented counters from updating — orphaned runs likely have NULL values for `completed_jobs` and/or `failed_jobs`
   - The cleanup is executed against the dev database
   - Document in `docs/operations-runbook.md`

## Tasks

- [x] Task 1: Write Tier 2 wiring integration test for RETURNING query — discover actual return shape (AC1)
- [x] Task 2: Extract `parseUpdateReturningRow<T>()` helper with runtime assertion, fix `recordFanOutSuccess` destructuring (AC2)
- [x] Task 3: Fix `recordFanOutFailure` destructuring using `parseUpdateReturningRow` helper (AC3)
- [x] Task 4: Audit all `manager.query()` RETURNING calls across codebase, fix any additional instances (AC4)
- [x] Task 5: Update unit test mocks to match real pg RETURNING behavior (AC5)
- [x] Task 6: Execute orphaned run cleanup SQL and document in operations runbook (AC6)

## Definition of Done

- [x] All tasks completed
- [x] All unit tests passing (551 unit + 10 wiring = 561)
- [x] Tier 2 wiring test passing against real PostgreSQL (10 tests)
- [x] E2E suite still passes (46 tests)
- [x] Story file updated (tasks checked, Dev Agent Record, traceability)
- [x] No lint errors (0 errors, 101 warnings)
- [x] Audit summary documented in Dev Agent Record

## Out-of-Scope

| Item | Tracked In |
|------|-----------|
| Catalog RLS policy + findPublishedOne | Story 4-FIX-A2 |
| Publish/Unpublish UI | Story 4-FIX-A2 |
| Full RLS enablement (non-superuser role) | Story 4-RLS |
| Full run status tracking UI | Epic 5 Story 5-1 |
| `creditsConsumed` correction on orphaned runs (initialized to 0, never updated — fan-in finalization doesn't update it either) | Story 4-4 (Credit Management) |
| PRE-EXISTING Rule 2c: `findOne(WorkflowRunEntity, { where: { id: runId } })` at processor lines ~116, ~306 missing `tenantId` | Story 4-FIX-B (pre-existing, not introduced by this story) |

## Dev Agent Record

- **Agent:** Claude Opus 4.6 (Amelia)
- **Date Started:** 2026-02-12
- **Date Completed:** 2026-02-12
- **Tests Added:** 10 (Tier 2 wiring tests)
- **Tests Modified:** 16 mock updates (12 processor + 4 validated-insight softDelete)
- **Total Test Count:** 561 (551 unit + 10 wiring)

### Key Discovery (AC1)

The Tier 2 wiring test revealed a critical asymmetry in TypeORM/pg driver behavior:

| Query Type | EntityManager.query() Return Shape | DataSource.query() Return Shape |
|-----------|-----------------------------------|--------------------------------|
| UPDATE RETURNING | `[[rows], affectedCount]` | `[[rows], affectedCount]` |
| INSERT RETURNING | `[row, row, ...]` (flat) | `[row, row, ...]` (flat) |

**UPDATE RETURNING** wraps rows in a nested array with an affectedCount.
**INSERT RETURNING** returns a flat array of row objects.
This asymmetry is a TypeORM/pg driver quirk — NOT a PostgreSQL behavior.

### Additional Bug Found (AC4 Audit)

`validated-insight.service.ts:186` — `softDelete()` method used `rows.length === 0` to check for "not found". Since UPDATE RETURNING returns `[[rows], affectedCount]`, `rows.length` is always 2 (outer array), making the NotFoundException check dead code. Fixed by destructuring `const [rows] = result` first.

### Orphaned Run Cleanup (AC6)

Executed cleanup against dev database:
- **3 orphaned runs found** — all from Live Test Round 1 (2026-02-12)
- **All had `completed_jobs: 1, total_jobs: 1`** — counters WERE correctly incremented by the UPDATE SQL, but the RETURNING result was parsed incorrectly, so the fan-in check never triggered
- **COALESCE was not needed** for these specific runs (counters were non-NULL), but remains in the cleanup SQL as a safety measure for any future runs that might have NULL counters
- **3 rows updated** to `status = 'completed'`, 0 remaining

### RETURNING Audit Summary (AC4)

| File | Line | Query Type | Status |
|------|------|-----------|--------|
| `workflow-execution.processor.ts` | 253 | UPDATE RETURNING | FIXED — uses `parseUpdateReturningRow()` |
| `workflow-execution.processor.ts` | 439 | UPDATE RETURNING | FIXED — uses `parseUpdateReturningRow()` |
| `validated-insight.service.ts` | 64 | INSERT RETURNING | OK — INSERT returns flat `[row]`, `rows[0]` is correct |
| `validated-insight.service.ts` | 114 | SELECT (no RETURNING) | OK — returns flat `[row]` |
| `validated-insight.service.ts` | 148 | SELECT (no RETURNING) | OK — returns flat `[row]` |
| `validated-insight.service.ts` | 176 | UPDATE RETURNING | FIXED — destructure `[rows]` from nested result |
| `knowledge-search.service.ts` | 57 | SELECT (no RETURNING) | OK — returns flat `[row]` |
| `invitations.spec.ts` (E2E) | 70 | INSERT RETURNING via `ds.query()` | OK — INSERT returns flat, `result[0].id` correct |
| `integration-wiring.spec.ts` | 332 | SELECT (no RETURNING) | OK — returns flat `[row]` |
| `transaction-manager.ts` | 44 | SET LOCAL (no RETURNING) | OK — no result used |

### File List

| File | Change |
|------|--------|
| `apps/api-gateway/src/app/workflow-execution/returning-wiring.spec.ts` | NEW — 10 Tier 2 wiring tests |
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` | MODIFIED — `parseUpdateReturningRow()` exported helper + 2 call sites fixed |
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts` | MODIFIED — 12 mock return values updated |
| `apps/api-gateway/src/app/knowledge/validated-insight.service.ts` | MODIFIED — `softDelete()` destructuring fix |
| `apps/api-gateway/src/app/knowledge/validated-insight.service.spec.ts` | MODIFIED — 4 mock return values updated |
| `docs/operations-runbook.md` | MODIFIED — orphaned run cleanup section added |
| `scripts/cleanup-orphaned-runs.ts` | DELETED — one-time cleanup script, executed and removed |

## Test Traceability

| AC ID | Test File | Test Description | Status |
|-------|-----------|------------------|--------|
| AC1 | `returning-wiring.spec.ts` | WIRE-001 through WIRE-010 (10 tests) | PASS |
| AC2 | `workflow-execution.processor.spec.ts` | UNIT-016 through UNIT-020 (existing tests with updated mocks) | PASS |
| AC3 | `workflow-execution.processor.spec.ts` | UNIT-027 through UNIT-031 (existing tests with updated mocks) | PASS |
| AC4 | `returning-wiring.spec.ts` | WIRE-007 (E2E pattern), WIRE-008 (INSERT RETURNING), WIRE-009 (UPDATE RETURNING) | PASS |
| AC5 | `workflow-execution.processor.spec.ts`, `validated-insight.service.spec.ts` | All 16 mock values updated to `[[row], affectedCount]` format | PASS |
| AC6 | N/A (operational) | Cleanup executed: 3 orphaned runs fixed, 0 remaining | DONE |
