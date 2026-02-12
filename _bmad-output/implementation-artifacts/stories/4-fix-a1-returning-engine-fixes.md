# Story 4-FIX-A1: RETURNING Engine Fixes

Status: ready-for-dev

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

## Acceptance Criteria

1. **AC1: Tier 2 Wiring Test for RETURNING Query (Rule 31) — TEST FIRST**
   - Given Rule 31 requires Tier 2 wiring tests for RETURNING queries
   - When a Tier 2 integration test is written against real PostgreSQL
   - Then the test discovers the actual return shape of `manager.query('UPDATE ... RETURNING ...')`
   - The test inserts a workflow_run row, executes the exact RETURNING SQL from the processor, and verifies the destructured result contains `completed_jobs`, `failed_jobs`, `total_jobs` as numbers
   - Uses `project_bubble_wiring_integ_test` database
   - **This task is done FIRST — write the test, see what the real return shape is, then fix the code**

2. **AC2: Fix recordFanOutCompletion RETURNING Destructuring (C1 — CRITICAL)**
   - Given a workflow run with N subject files processes a job successfully
   - When the processor updates `completed_jobs` via `manager.query('UPDATE ... RETURNING ...')`
   - Then the result is correctly destructured based on what AC1's test reveals (expected: `const [[row]] = await manager.query(...)`)
   - And fan-in finalization triggers when `completed_jobs + failed_jobs >= total_jobs`
   - And the run status transitions to `COMPLETED` (or `COMPLETED_WITH_ERRORS` if any failed)
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
     - `web-e2e/src/admin/invitations.spec.ts` lines 70-86 (E2E setup)
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
     AND completed_jobs + failed_jobs >= total_jobs;
     ```
   - The cleanup is executed against the dev database
   - Document in `docs/operations-runbook.md`

## Tasks

- [ ] Task 1: Write Tier 2 wiring integration test for RETURNING query — discover actual return shape (AC1)
- [ ] Task 2: Fix `recordFanOutSuccess` RETURNING destructuring based on test findings (AC2)
- [ ] Task 3: Fix `recordFanOutFailure` RETURNING destructuring (AC3)
- [ ] Task 4: Audit all `manager.query()` RETURNING calls across codebase, fix any additional instances (AC4)
- [ ] Task 5: Update unit test mocks to match real pg RETURNING behavior (AC5)
- [ ] Task 6: Execute orphaned run cleanup SQL and document in operations runbook (AC6)

## Definition of Done

- [ ] All tasks completed
- [ ] All unit tests passing
- [ ] Tier 2 wiring test passing against real PostgreSQL
- [ ] E2E suite still passes (46+ tests)
- [ ] Story file updated (tasks checked, Dev Agent Record, traceability)
- [ ] No lint errors
- [ ] Audit summary documented in Dev Agent Record

## Out-of-Scope

| Item | Tracked In |
|------|-----------|
| Catalog RLS policy + findPublishedOne | Story 4-FIX-A2 |
| Publish/Unpublish UI | Story 4-FIX-A2 |
| Full RLS enablement (non-superuser role) | Story 4-RLS |
| Full run status tracking UI | Epic 5 Story 5-1 |

## Dev Agent Record

_To be filled during implementation_

- **Agent:**
- **Date Started:**
- **Date Completed:**
- **Tests Added:**
- **Total Test Count:**
- **RETURNING Audit Summary:**
  | File | Line | Query Type | Status |
  |------|------|-----------|--------|
  | | | | |

## Test Traceability

| AC ID | Test File | Test Description | Status |
|-------|-----------|------------------|--------|
| AC1 | | | |
| AC2 | | | |
| AC3 | | | |
| AC4 | | | |
| AC5 | | | |
| AC6 | | | |
