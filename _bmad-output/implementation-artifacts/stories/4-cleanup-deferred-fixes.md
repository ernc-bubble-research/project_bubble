# Story 4-cleanup: Deferred Fixes & Error Path Coverage

Status: done

## Story

As a **developer maintaining the execution engine**,
I want **to resolve all deferred code review findings from Epic 4 stories**,
so that **magic numbers are named, error paths are tested, type safety is enforced, and small correctness bugs are fixed before the Epic 4 retrospective**.

## Context

This story replaces the former "4-test-gaps" grab-bag entry. It consolidates 10 deferred items from 8+ code review passes across Stories 4-RLS-B, 4-GP, 4-fix-browser-imports, 4-5, 4-LT4-3, and 4-5b into a single focused cleanup story.

**Party Mode Decision (2026-02-21):**
- All 10 items are mechanical fixes, small refactors, or targeted test additions
- Total estimated effort: ~4 hours of implementation
- Item 11 (WorkflowRunFormComponent @Input mode tests) was already completed in 4-7b — 6 tests exist at `workflow-run-form.component.spec.ts:265-378`. Dropped from scope.
- No new entities, no new endpoints (except adding `finishReason` field to existing `LLMGenerateResult` interface)
- Risk: LOW — all changes are isolated with existing test coverage around them

**Origin Tracking:**
| Item | Origin Story | Pass/Finding |
|------|-------------|--------------|
| Magic numbers | 4-RLS-B | Pass 2 |
| MIME validation | 4-5 | Pass 1 F8 |
| attemptsMade default | 4-5 | Pass 1 F10 |
| Type enforcement | 4-GP | Pass 3 F7 |
| onFailed catch tests | 4-RLS-B | Pass 2 |
| finishReason | LT4-5 | Live Test Round 4 |
| Tier 3 test skip | 4-5 | Pass 1 |
| DRY findPublishedOne | 4-LT4-3 | Pass 1 A1 |
| lastRetriedAt | 4-5b | Party mode |
| Console.error E2E | 4-fix-browser-imports | Pass 3 F5 |

## Acceptance Criteria

### AC1: Magic Numbers Extracted to Named Constants
**Given** the workflow execution processor (`workflow-execution.processor.ts`)
**When** I review the file
**Then** all hardcoded magic numbers are replaced with named constants:
- `100` → `DEFAULT_WORKER_CONCURRENCY`
- `300000` → `BULLMQ_LOCK_DURATION_MS`
- `3` (retry default at lines 217, 338, 729, 822) → `DEFAULT_JOB_RETRY_ATTEMPTS`
- `4` (token estimation) → `CHARS_PER_TOKEN_ESTIMATE`
- `200` (error truncation at lines 818, 899) → `MAX_ERROR_MESSAGE_LENGTH`
**And** all existing tests still pass without modification (constants are internal)

### AC2: createFromBuffer MIME Type Validation
**Given** `AssetsService.createFromBuffer()` accepts a `mimeType` parameter
**When** the caller passes an invalid MIME type
**Then** the method throws `BadRequestException` with a descriptive message
**And** valid output MIME types are `text/markdown` and `application/json` (workflow output formats)
**And** a unit test verifies rejection of invalid MIME types

### AC3: makeJob() Default attemptsMade Fixed
**Given** the `makeJob()` test helper in `workflow-execution.processor.spec.ts`
**When** called without overrides
**Then** `attemptsMade` defaults to `0` (not `3`)
**And** tests that explicitly need `attemptsMade > 0` pass it via the `overrides` parameter
**And** all existing processor tests still pass

### AC4: GENERATION_PARAM_KEY_MAP Type Enforcement
**Given** `GENERATION_PARAM_KEY_MAP` in `workflow-definition.interface.ts`
**When** a developer adds a new generation parameter to `WorkflowExecution` or `LLMGenerateOptions`
**Then** TypeScript compilation fails if the map is not updated to include the new key
**And** the map keys are constrained to generation-related fields of `WorkflowExecution`
**And** the map values are constrained to keys of `LLMGenerateOptions`

### AC5: onFailed Catch Block Test Coverage
**Given** 3 untested catch blocks in the `onFailed` handler:
1. `catch (statusError)` in writePerFileStatus (line ~753)
2. `catch (updateError)` in recordFanOutFailure (line ~877)
3. `catch (updateError)` in markRunFailed (line ~951)
**When** the inner operation throws an error
**Then** the catch block logs the error and does NOT rethrow (graceful degradation)
**And** each catch block has a dedicated unit test that mocks the inner call to reject

### AC6: finishReason Surfaced from LLM SDK
**Given** Google AI Studio SDK returns `response.candidates[0].finishReason`
**When** the LLM provider processes a generation request
**Then** `LLMGenerateResult` interface includes `finishReason?: string`
**And** `GoogleAiStudioLlmProvider` extracts and returns `finishReason` from the SDK response
**And** `MockLlmProvider` returns `finishReason: 'STOP'` by default
**And** the processor logs `finishReason` when it is not `'STOP'` (truncation warning)
**And** `perFileResults` includes `finishReason` field for downstream display

### AC7: Remaining Cleanup Items
**Given** 4 additional deferred items
**Then** Tier 3 contract tests (`api-contract.spec.ts`, `api-contract-b.spec.ts`) skip gracefully when PostgreSQL is unavailable instead of crashing
**And** `findPublishedOne()` and `findPublishedOneEntity()` share a private helper for template query + visibility validation (DRY refactor, ~30 lines deduplication)
**And** `WorkflowRunEntity` has a `lastRetriedAt` column (`timestamp`, nullable) set by `retryFailed()`
**And** wizard E2E tests (`02-wizard.spec.ts`) capture `console.error` via `page.on('console')` and assert zero errors

## Tasks

### Task 1: Magic Number Extraction
- [x] 1.1 Define constants at top of `workflow-execution.processor.ts`: `DEFAULT_WORKER_CONCURRENCY`, `BULLMQ_LOCK_DURATION_MS`, `DEFAULT_JOB_RETRY_ATTEMPTS`, `CHARS_PER_TOKEN_ESTIMATE`, `MAX_ERROR_MESSAGE_LENGTH`
- [x] 1.2 Replace all 9 hardcoded occurrences with named constants
- [x] 1.3 Run existing processor tests — all 69 pass without changes

### Task 2: MIME Validation + attemptsMade Fix
- [x] 2.1 Add MIME type validation guard in `AssetsService.createFromBuffer()` — allowlist: `['text/markdown', 'application/json', 'text/plain']` for workflow outputs
- [x] 2.2 Add unit test: `createFromBuffer` rejects `'image/png'` with `BadRequestException` [4-CL-UNIT-001]
- [x] 2.3 Change `makeJob()` default `attemptsMade` from `3` to `0` in `processor.spec.ts`
- [x] 2.4 Run full processor test suite — no tests relied on `attemptsMade: 3` default

### Task 3: Type Enforcement for Generation Params
- [x] 3.1 Define `WorkflowExecutionGenerationKey` and `LLMGenerateOptionKey` type aliases
- [x] 3.2 Apply explicit `Readonly<Record<WorkflowExecutionGenerationKey, LLMGenerateOptionKey>>` type annotation
- [x] 3.3 Fixed downstream consumer (`create-llm-model.dto.ts`) — `Set<string>` cast needed for `.has()` with string keys

### Task 4: onFailed Catch Block Tests
- [x] 4.1 Add test: `writePerFileStatus` catch — mock `txManager.run` to reject, verify logger.error called, no rethrow [4-CL-UNIT-002]
- [x] 4.2 Add test: `recordFanOutFailure` catch — mock inner query to reject, verify logger.error called, no rethrow [4-CL-UNIT-003]
- [x] 4.3 Add test: `markRunFailed` catch — mock inner query to reject, verify logger.error called, no rethrow [4-CL-UNIT-004]

### Task 5: Surface finishReason from LLM SDK
- [x] 5.1 Add `finishReason?: string` to `LLMGenerateResult` interface in `llm.provider.ts`
- [x] 5.2 Extract `response.candidates?.[0]?.finishReason` in `GoogleAiStudioLlmProvider`
- [x] 5.3 Return `finishReason: 'STOP'` from `MockLlmProvider`
- [x] 5.4 Log warning in processor when `finishReason !== 'STOP'` (e.g., `MAX_TOKENS`, `SAFETY`)
- [x] 5.5 Add `finishReason` to `PerFileResult` interface and `perFileResults` storage in `recordFanOutSuccess`
- [x] 5.6 Add 3 tests: finishReason extraction [4-CL-UNIT-005], STOP default [4-CL-UNIT-006], missing candidates [4-CL-UNIT-007]

### Task 6: DRY Refactor + lastRetriedAt + Tier 3 Skip
- [x] 6.1 Extract private `findPublishedTemplateWithVisibilityCheck(id, requestingTenantId, manager)` in `workflow-templates.service.ts`
- [x] 6.2 Refactor `findPublishedOne()` and `findPublishedOneEntity()` to call the shared helper
- [x] 6.3 All existing template service tests pass
- [x] 6.4 Add `lastRetriedAt` column (`timestamp`, nullable) to `WorkflowRunEntity`
- [x] 6.5 Set `lastRetriedAt: new Date()` in `retryFailed()` update payload
- [x] 6.6 Add unit test: `retryFailed` sets `lastRetriedAt` timestamp [4-CL-UNIT-008]
- [x] 6.7 Add `dbAvailable` flag + try-catch in `api-contract.spec.ts` and `api-contract-b.spec.ts` — skip suite gracefully if PostgreSQL unavailable

### Task 7: Console.Error E2E Test
- [x] 7.1 Add `page.on('console')` error capture in `02-wizard.spec.ts` via `test.beforeEach`
- [x] 7.2 Assert `consoleErrors.length === 0` via `test.afterEach` [4-CL-E2E-001]
- [x] 7.3 Run full E2E suite — 42 passed, 4 skipped, 1 pre-existing flaky (login redirect timeout)

### Bonus Fix (Pre-existing)
- [x] Add `TestRunCacheService` and `TestRunGateway` mocks to `workflow-execution.processor.spec.ts` — was broken since Story 4-7a

## Out-of-Scope

- Item 11 (WorkflowRunFormComponent @Input mode tests) was already completed in Story 4-7b — excluded.
- E2E suite run (Task 7.3) deferred to code review — requires dev servers stopped + `npx nx e2e web-e2e`.
- Bonus fix: `TestRunCacheService` + `TestRunGateway` mocks added to processor spec (pre-existing break from 4-7a, not part of original 10 items).

## Dev Agent Record

| Field | Value |
|-------|-------|
| Story | 4-cleanup |
| Agent | Amelia |
| Started | 2026-02-21 |
| Completed | 2026-02-21 |
| Tests Added | 10 (8 unit + 1 acceptance + 1 E2E) |
| Total Tests | 1754 (960 api-gateway + 103 shared + 41 db-layer + 650 web) |
| Code Review | Pass 1 Amelia: 0 findings. Pass 2 Naz: 5 findings (N-1 fixed, N-2 fixed, N-3/N-5 verified OK, N-4 dropped by user). Pass 3 Murat: 5 findings (M-1 fixed, M-2 fixed, M-3 fixed, M-4 rejected, M-5 rejected). |
| E2E | 42 passed, 4 skipped, 1 pre-existing flaky (login timeout) |

## Test Traceability

| AC | Test File | Test ID | Status |
|----|-----------|---------|--------|
| AC1 | workflow-execution.processor.spec.ts | existing 69 tests | PASS |
| AC2 | assets.service.spec.ts | [4-CL-UNIT-001], [4-CL-UNIT-001b] | PASS |
| AC3 | workflow-execution.processor.spec.ts | existing 69 tests | PASS |
| AC4 | (compile-time) | TypeScript compilation | PASS |
| AC5 | workflow-execution.processor.spec.ts | [4-CL-UNIT-002..004] | PASS |
| AC6 | google-ai-studio-llm.provider.spec.ts | [4-CL-UNIT-005..007] | PASS |
| AC7a | api-contract.spec.ts, api-contract-b.spec.ts | graceful skip via `dbAvailable` flag | PASS |
| AC7b | workflow-templates.service.spec.ts | existing tests | PASS |
| AC7c | workflow-runs.service.spec.ts | [4-CL-UNIT-008] | PASS |
| AC7d | apps/web-e2e/02-wizard.spec.ts | [4-CL-E2E-001] | PASS |
