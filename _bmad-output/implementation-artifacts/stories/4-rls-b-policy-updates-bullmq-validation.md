# Story 4-RLS-B: RLS Enablement — BullMQ Validation

Status: done

## Story

As a **platform operator**,
I want **the BullMQ workflow execution processor to defensively validate tenantId before any database operation**,
so that **worker jobs fail safely with a clear error when tenant context is missing, instead of silently executing without RLS protection**.

## Context

Story 4-RLS-A created the dual DataSource, updated all RLS policies, and established the admin bypass mechanism. The BullMQ processor already uses `txManager.run(tenantId, callback)` with explicit tenantId from `job.data` — this is correct. However, there is no defensive validation that `tenantId` is present. Under the new non-superuser role, a missing tenantId would mean `SET LOCAL app.current_tenant` is never called, and RLS policies would return zero rows (fail-closed). While fail-closed is safe, a descriptive error is better than silent empty results.

**Part 2 of 3**: 4-RLS-A (done) → 4-RLS-B (this) → 4-RLS-C (test infra + verification)

**Depends on**: Story 4-RLS-A (dual DataSource + policies must exist)

## Acceptance Criteria

1. **AC1 — tenantId validated in process()**: `WorkflowExecutionProcessor.process()` validates `job.data.tenantId` is a non-empty string before any DB call. Missing/empty tenantId throws a descriptive error that includes the jobId for debugging.

2. **AC2 — tenantId validated in onFailed()**: `WorkflowExecutionProcessor.onFailed()` validates `job.data.tenantId` before DB calls. If missing, logs error and skips DB update (don't throw — failed handler must not crash).

3. **AC3 — Unit tests**: New unit tests verify null, undefined, and empty string tenantId rejection in both `process()` and `onFailed()`. All existing tests pass.

## Tasks / Subtasks

- [x] Task 1: BullMQ tenantId validation (AC: #1, #2)
  - [x] 1.1: Add tenantId null/empty check at top of `process()` — throw descriptive error with jobId
  - [x] 1.2: Add tenantId check at top of `onFailed()` — log error and return early (no throw in failed handler)
  - [x] 1.3: Unit tests for null/undefined/empty tenantId in `process()` (expect throw)
  - [x] 1.4: Unit tests for null/undefined/empty tenantId in `onFailed()` (expect early return + log)

- [x] Task 2: Run full unit test suite (AC: #3)
  - [x] 2.1: All existing + new tests pass (1178 total: 625 api-gateway + 515 web + 38 db-layer)

## Dev Notes

### Validation Pattern

```typescript
async process(job: Job<WorkflowJobPayload>): Promise<void> {
  const { runId, tenantId } = job.data;

  // Defensive: fail fast on missing tenantId (N4 from party mode review)
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error(
      `Job ${job.id} has invalid tenantId (${JSON.stringify(tenantId)}) — ` +
      `cannot process workflow run ${runId} without tenant context`
    );
  }

  // ... existing logic
}

@OnWorkerEvent('failed')
async onFailed(job: Job<WorkflowJobPayload>, error: Error): Promise<void> {
  const { runId, tenantId } = job.data;

  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    this.logger.error({
      message: 'Cannot record job failure — missing tenantId',
      jobId: job.id,
      runId,
      originalError: error.message,
    });
    return; // Don't throw in failed handler — would crash the worker
  }

  // ... existing logic
}
```

### Key Files to Modify

| File | Change |
|:---|:---|
| `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` | tenantId validation in process() + onFailed() |

### Out-of-Scope

| Item | Tracked In |
|:---|:---|
| Test infrastructure (test-db-helpers, global-setup) | Story 4-RLS-C |
| New wiring tests for RLS verification | Story 4-RLS-C |
| Browser smoke test | Story 4-RLS-C |
| Production Support Access | Story 4-SA |
| Error-path unit tests (catch block coverage in onFailed) | Story 4-TEST-GAPS |
| Magic number extraction (maxAttempts default `3`) | Story 4-TEST-GAPS |
| Job reconciliation for orphaned runs (cron scan for RUNNING > 1hr, check BullMQ queue, mark FAILED if job missing) | Story 7P-5-RECONCILE |
| Integration test: terminal state vs validation ordering | Story 4-TEST-GAPS |

### References

- [Source: apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts] — BullMQ processor
- Party mode review: 2026-02-14 (Naz N4 — BullMQ tenantId validation)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
None — straightforward implementation, no debugging needed.

### Completion Notes List
- Validation uses triple check: `!tenantId || typeof tenantId !== 'string' || tenantId.trim() === ''` — covers null, undefined, empty string, and whitespace-only.
- `process()` throws (BullMQ will retry/DLQ the job). `onFailed()` logs and returns early (failed handler must not throw — would crash worker).
- `onFailed()` validation runs BEFORE the intermediate/final retry check — if tenantId is bad, skip everything including DLQ routing (we can't meaningfully process the failure without tenant context).
- Validation is intentionally OUTSIDE the `txManager.run()` callback — this is stricter than "before findOne." It prevents even attempting `SET LOCAL app.current_tenant` with a bad value, which is safer than letting the transaction start and failing inside it.

### Change Log

| # | File | Change |
|---|------|--------|
| 1 | `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` | tenantId validation guard in `process()` (throws) and `onFailed()` (logs + early return) |
| 2 | `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts` | 11 new tests: 6 for process() (null, undefined, empty, whitespace, error message, numeric) + 5 for onFailed() (null, undefined, empty, whitespace, numeric) + logger.error assertions |

### Test Traceability

| AC ID | Test File | Test Description | Status |
|-------|-----------|------------------|--------|
| AC1 | `workflow-execution.processor.spec.ts` | `[4-RLS-B-UNIT-001]` null, `[002]` undefined, `[003]` empty, `[004]` whitespace, `[005]` error message content, `[011]` numeric type coercion | PASS |
| AC2 | `workflow-execution.processor.spec.ts` | `[006]` null, `[007]` undefined, `[008]` empty, `[009]` whitespace, `[010]` numeric — all verify no throw + no DB call + no DLQ + logger.error assertion | PASS |
| AC3 | All test suites | 1181 total tests pass (628 api-gateway + 515 web + 38 db-layer) | PASS |

### Code Review — Pass 2 (Naz Adversarial)

| # | ID | Severity | Finding | Verdict |
|---|-----|----------|---------|---------|
| 1 | HIGH-001 | HIGH | DI scope — processor is singleton, validation helper as separate injectable | REJECT — validation is 3 lines, no DI needed |
| 2 | HIGH-002 | HIGH | No integration test for real BullMQ job with bad tenantId | REJECT — covered by unit tests, real BullMQ tested in 4-RLS-C wiring tests |
| 3 | HIGH-003 | HIGH | No UUID format validation before DB call | REJECT — TransactionManager already validates UUID format (line 49) |
| 4 | MEDIUM-004 | MEDIUM | onFailed() return vs throw asymmetry undocumented | **FIX NOW** — added explanatory comment |
| 5 | MEDIUM-005 | MEDIUM | catch block in onFailed not tested | **TRACK** → Story 4-TEST-GAPS |
| 6 | MEDIUM-006 | MEDIUM | Missing structured log fields (attempt count, max attempts) | REJECT — log is for missing-tenantId case, attempt info is irrelevant |
| 7 | MEDIUM-007 | MEDIUM | BullMQ worker crash leaves run stuck in RUNNING forever | **TRACK** → Story 7P-5-RECONCILE (job reconciliation cron) |
| 8 | MEDIUM-008 | MEDIUM | Whitespace test covers tab/space but not other Unicode whitespace | REJECT — production tenantIds are UUIDs, Unicode whitespace is not a realistic threat vector |
| 9 | LOW-009 | LOW | Magic number `3` for maxAttempts default | **TRACK** → Story 4-TEST-GAPS |
| 10 | LOW-010 | LOW | JSON.stringify in error message could leak sensitive data | REJECT — tenantId is a UUID, not sensitive PII |

### Code Review — Pass 3 (Murat Test Architect)

| # | ID | Severity | Finding | Verdict |
|---|-----|----------|---------|---------|
| 1 | HIGH-001 | HIGH | Missing whitespace-only test for onFailed() | **FIX NOW** — added [4-RLS-B-UNIT-009] |
| 2 | HIGH-002 | HIGH | No verification validation happens before DB calls | REJECT — `txManager.run.not.toHaveBeenCalled()` already proves ordering |
| 3 | MEDIUM-003 | MEDIUM | No test for numeric/boolean tenantId (Redis type coercion) | **FIX NOW** — added [4-RLS-B-UNIT-010] + [4-RLS-B-UNIT-011] |
| 4 | MEDIUM-004 | MEDIUM | Test 005 calls process() twice | REJECT — stateless, deterministic, no side effects |
| 5 | MEDIUM-005 | MEDIUM | No error type assertion | REJECT — `.toThrow(/pattern/)` implies Error (regex matches on .message) |
| 6 | MEDIUM-006 | MEDIUM | No integration with terminal state guard ordering | **TRACK** → Story 4-TEST-GAPS |
| 7 | LOW-007 | LOW | Test titles say "returns early" but AC2 says "logs error" | **FIX NOW** — titles updated to "returns early and logs error" |
| 8 | LOW-008 | LOW | No logger.error verification in onFailed tests | **FIX NOW** — added logger.error spy + assertions |
| 9 | LOW-009 | LOW | Magic string "invalid tenantId" not DRY | REJECT — error wording is intentional, testing exact UX |
| 10 | CRITICAL-010 | CRITICAL | AC1 interpretation: validation before txManager.run() | REJECT — intentionally stricter, documented in completion notes |

### File List
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` (MODIFIED)
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts` (MODIFIED)
