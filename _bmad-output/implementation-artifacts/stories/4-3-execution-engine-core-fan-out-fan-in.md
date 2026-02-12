# Story 4.3: Execution Engine Core (Fan-Out/Fan-In)

Status: complete

## Story

As a Creator,
I want my workflow runs to execute reliably in the background using the correct execution pattern,
so that multiple transcripts are analyzed in parallel or consolidated in a single batch.

## Acceptance Criteria

1. **Given** a run submission with N subject files and `execution.processing: "parallel"`, **then** N BullMQ jobs are created (1 per subject file), each receiving ALL context inputs + ONE subject file, and jobs run concurrently up to `execution.max_concurrency` (default: 5).

2. **Given** a run submission with N subject files and `execution.processing: "batch"`, **then** 1 BullMQ job is created with ALL context inputs + ALL subject files concatenated into the prompt.

3. **Given** each fan-out job, **then** it loads the specific workflow definition from `workflow_versions` using the `version_id` (NOT the current tip) — this is already satisfied by the immutable `definition` field in the payload, so no additional DB lookup needed.

4. **Given** a parallel run where some jobs succeed and some fail, **then** the overall run status is `completed_with_errors` and the UI can later offer a "Retry failed files" action.

5. **Given** a run completes (all jobs finished), **then** the `WorkflowRunEntity` stores aggregated `tokenUsage`, `durationMs`, and per-file results.

6. **Given** a run is initiated, **then** the `WorkflowRunsService.initiateRun()` resolves subject-role inputs into `WorkflowJobSubjectFile[]` and passes them to `WorkflowExecutionService`.

7. **Given** a fan-out run, **then** `WorkflowExecutionService` creates N BullMQ jobs with unique job IDs (`{runId}:file:{index}`) and the processor handles each independently.

8. **Given** a workflow with no subject-role input (context-only), **then** 1 job is created with no subject file — backward-compatible with the existing processor behavior.

9. ~~**Given** a fan-out run, **then** per-run `max_concurrency` is enforced via BullMQ's group concurrency feature (jobs grouped by runId, concurrency limited per group).~~ **DEFERRED**: BullMQ group concurrency is a BullMQ Pro feature (paid license). Per-run max_concurrency enforcement deferred to Story 7P-5b (horizontal scaling). System-wide `WORKER_CONCURRENCY` provides global concurrency control for MVP.

10. **Given** a fan-out run where a single job fails after all BullMQ retries, **then** the `onFailed` handler increments `failedJobs` and records the per-file error — it does NOT mark the entire run as FAILED until all jobs have reported.

## Tasks / Subtasks

- [x] Task 1: Add `COMPLETED_WITH_ERRORS` status to WorkflowRunStatus enum (AC: #4)
  - [x] 1.1 Add `COMPLETED_WITH_ERRORS = 'completed_with_errors'` to the enum in `workflow-run.entity.ts`
  - [x] 1.2 Add `totalJobs`, `completedJobs`, `failedJobs` columns to `WorkflowRunEntity` (int, nullable)
  - [x] 1.3 Add `perFileResults` JSONB column to `WorkflowRunEntity` — stores array of `{ fileName, status, rawLlmResponse?, errorMessage?, tokenUsage? }`
  - [x] 1.4 Generate and run TypeORM migration

- [x] Task 2: Resolve subject files and set totalJobs in `WorkflowRunsService.initiateRun()` (AC: #6, #8)
  - [x] 2.1 Find the subject-role input from `definitionInputs` where `role === 'subject'`
  - [x] 2.2 For `type: 'asset'` → look up each assetId via `TransactionManager.run(tenantId, ...)` with `manager.findOne(AssetEntity, { where: { id, tenantId } })` (defense-in-depth: tenantId in WHERE clause). Single transaction for all assets (no N+1). Note: uploaded files are already converted to AssetEntity records by Story 4-1's ingestion pipeline
  - [x] 2.3 Build `WorkflowJobSubjectFile[]` array from resolved assets
  - [x] 2.4 Set `totalJobs` on the `WorkflowRunEntity` BEFORE calling `enqueueRun()` — this MUST happen in the initial creation transaction to prevent race conditions with fast-completing jobs
  - [x] 2.5 Pass `subjectFiles` array to `WorkflowExecutionService.enqueueRun()`

- [x] Task 3: Implement fan-out in `WorkflowExecutionService` (AC: #1, #7)
  - [x] 3.1 Change `enqueueRun()` signature to accept `subjectFiles: WorkflowJobSubjectFile[]` and `processingMode: 'parallel' | 'batch'` and `maxConcurrency: number`
  - [x] 3.2 For `parallel` mode: create N jobs, one per subject file, each with `subjectFile` set to single file, jobId = `{runId}:file:{index}`
  - [x] 3.3 For `batch` mode: create 1 job with `subjectFiles` set to all files, jobId = `{runId}`
  - [ ] 3.4 ~~For `parallel` mode: enforce per-run concurrency using BullMQ group feature~~ **DEFERRED to 7P-5b**: BullMQ group concurrency requires BullMQ Pro (paid). System-wide `WORKER_CONCURRENCY` is sufficient for MVP
  - [x] 3.5 Handle zero subject files: if no subject-role input exists, create 1 job with no subject file (backward-compat with existing processor)

- [x] Task 4: Update processor for per-file execution (AC: #1, #2, #10)
  - [x] 4.1 Current processor already handles a single job — works for both fan-out (individual file job) and batch (all files job)
  - [x] 4.2 For batch mode: update `PromptAssemblyService.assemble()` to concatenate all `subjectFiles` content into the prompt (use `subjectFiles` array when `subjectFile` is not set)
  - [x] 4.3 Behavioral split for result storage: for fan-out runs (`totalJobs > 1`), write `assembledPrompt`, `rawLlmResponse`, `tokenUsage` to `perFileResults` JSONB array only — do NOT write them to the parent entity columns. For single-job runs (batch or no-subject), write to entity columns directly as today
  - [x] 4.4 Use single SQL statement with `RETURNING` clause for atomic increment + read: `UPDATE workflow_runs SET completed_jobs = completed_jobs + 1 WHERE id = $1 RETURNING completed_jobs, failed_jobs, total_jobs`. Only the worker whose returned values satisfy `completed_jobs + failed_jobs >= total_jobs` triggers finalization
  - [x] 4.5 Update `onFailed` handler: for fan-out jobs (detect via jobId containing `:file:`), increment `failedJobs` atomically (same RETURNING pattern), record per-file error in `perFileResults`, and check completion — do NOT mark the entire run as FAILED. For single jobs (no `:file:` in jobId), keep current behavior (mark run FAILED + DLQ)

- [x] Task 5: Implement run completion aggregation (AC: #4, #5)
  - [x] 5.1 Implement `finalizeRun()` private method on `WorkflowExecutionProcessor` that finalizes a run when all jobs complete (simpler than a separate RunAggregationService — same atomicity guarantees)
  - [x] 5.2 Compute final status: all succeeded → `COMPLETED`, all failed → `FAILED`, mixed → `COMPLETED_WITH_ERRORS`
  - [x] 5.3 Aggregate `tokenUsage` (sum inputTokens, outputTokens, totalTokens across all jobs)
  - [x] 5.4 Set `completedAt` and `durationMs` on the run entity
  - [x] 5.5 Race condition prevention: the atomic `RETURNING` clause in Task 4.4/4.5 guarantees exactly one worker triggers finalization. No additional locking needed

- [x] Task 6: Update `PromptAssemblyService` for batch mode (AC: #2)
  - [x] 6.1 When `payload.subjectFiles` is set (batch mode), concatenate all file contents with `--- File: {originalName} ---` separators
  - [x] 6.2 Set `subject_content` variable to the concatenated text and `subject_name` to comma-joined filenames
  - [x] 6.3 Ensure the single-file path (`payload.subjectFile`) still works unchanged

- [x] Task 7: Unit tests (AC: all)
  - [x] 7.1 `WorkflowExecutionService` tests: parallel creates N jobs, batch creates 1 job, jobId format correct
  - [x] 7.2 `WorkflowExecutionProcessor` tests: per-file result recording, completion check, status aggregation
  - [x] 7.3 `PromptAssemblyService` tests: batch concatenation with separators, single-file backward compat
  - [x] 7.4 `WorkflowRunsService` tests: subject file resolution from asset IDs, subjectFiles passed to execution service
  - [x] 7.5 Run completion aggregation tests: all-success, all-fail, mixed, RETURNING-based atomic finalization
  - [x] 7.6 `onFailed` handler tests: fan-out job failure increments failedJobs (not run FAILED), single job failure marks run FAILED (backward compat)
  - [x] 7.7 Zero subject files test: context-only workflow creates 1 job with no subject file
  - [ ] 7.8 ~~Per-run max_concurrency test: verify BullMQ group concurrency option is set correctly~~ **DEFERRED with AC #9**

## Dev Notes

### Current Codebase State (What Exists)

**Processor** ([workflow-execution.processor.ts](apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts)):
- Processes a single BullMQ job: assemble prompt → resolve LLM provider → generate → store result
- Updates `WorkflowRunEntity` directly with assembled prompt, LLM response, token usage
- Already handles `subjectFile` in prompt assembly (single file path)
- `onFailed` handler routes to DLQ after max retries

**Execution Service** ([workflow-execution.service.ts](apps/api-gateway/src/app/workflow-execution/workflow-execution.service.ts)):
- `enqueueRun(runId, payload)` — adds single job with `jobId: runId`
- Currently 1:1 mapping between run and job

**Runs Service** ([workflow-runs.service.ts](apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts)):
- `initiateRun()` builds `WorkflowJobPayload` with context inputs resolved
- Has explicit comment: `// subjectFile/subjectFiles left undefined — resolved in Story 4-3 (fan-out)`
- Subject-role inputs are NOT processed yet — only context-role inputs are mapped

**Prompt Assembly** ([prompt-assembly.service.ts](apps/api-gateway/src/app/workflow-execution/prompt-assembly.service.ts)):
- Handles `payload.subjectFile` (single file) — resolves via AssetEntity or storagePath
- Sets `{subject_content}` and `{subject_name}` variables
- Does NOT handle `payload.subjectFiles` (batch concatenation) yet

**Job Payload** ([workflow-job.interface.ts](libs/shared/src/lib/types/workflow-job.interface.ts)):
- Already has both `subjectFile?: WorkflowJobSubjectFile` and `subjectFiles?: WorkflowJobSubjectFile[]`
- Both are optional — current processor uses `subjectFile` only

**WorkflowRunEntity** ([workflow-run.entity.ts](libs/db-layer/src/lib/entities/workflow-run.entity.ts)):
- Has `tokenUsage` (JSONB), `assembledPrompt`, `rawLlmResponse`, `durationMs`
- Does NOT have `totalJobs`, `completedJobs`, `failedJobs`, `perFileResults` columns yet
- Status enum: QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED — no COMPLETED_WITH_ERRORS

### Key Design Decisions

**Fan-Out Job IDs:** Use `{runId}:file:{index}` format (e.g., `abc-123:file:0`, `abc-123:file:1`). This preserves idempotency — same runId always produces same job IDs. The existing `jobId: runId` pattern for batch mode remains unchanged.

**Atomic Counter Pattern (CRITICAL — W2):** Use a single SQL statement with `RETURNING` clause for atomic increment + read. Do NOT use the naive two-step pattern of `increment()` then `findOne()` — that has a race condition gap where two workers can both think they're the last one and trigger double-finalization. The correct pattern:
```sql
UPDATE workflow_runs SET completed_jobs = completed_jobs + 1 WHERE id = $1 RETURNING completed_jobs, failed_jobs, total_jobs
```
In TypeORM, use `QueryBuilder` with `.returning(...)` or `manager.query()` raw SQL. Only the worker whose returned values satisfy `completed_jobs + failed_jobs >= total_jobs` triggers the finalization logic.

**Per-File Results Storage:** Store as JSONB array on the run entity rather than creating a separate `WorkflowRunResult` entity. This keeps the schema simple and avoids join overhead. Each entry: `{ index, fileName, status, rawLlmResponse?, errorMessage?, tokenUsage? }`.

**Processor Behavioral Split (W3):** For fan-out runs (`totalJobs > 1`): per-job results (assembledPrompt, rawLlmResponse, tokenUsage) go to the `perFileResults` JSONB array — NOT the parent entity's top-level columns. For single-job runs (batch or no-subject): write to entity columns directly as today. This prevents confusing partial data on the parent entity when N jobs each write different prompts/responses.

**Per-Run Max Concurrency (M1):** Enforced via BullMQ's `group` feature. Fan-out jobs are added with `opts.group = { id: runId, concurrency: maxConcurrency }`. This ensures a run with `max_concurrency: 5` and 20 files only has 5 jobs active at a time, regardless of system-wide `WORKER_CONCURRENCY`.

**Zero Subject Files (W1):** If the workflow definition has no subject-role input (context-only workflow), create 1 job with no subject file. The existing processor handles this — `payload.subjectFile` is already optional.

**Upload-Type Subject Files (A1):** Story 4-1's run form handles file uploads via the ingestion pipeline, which creates `AssetEntity` records before the run is initiated. By the time `initiateRun()` is called, all subject files are referenced by assetId. No separate upload-to-asset resolution needed in this story.

**onFailed Handler Change (A3):** The current `onFailed` handler marks the entire run as FAILED. For fan-out jobs (detected by `:file:` in jobId), the handler must instead: (1) increment `failedJobs` atomically, (2) record per-file error in `perFileResults`, (3) check if all jobs reported. Only when all jobs are done does the aggregation logic determine the final status. For single jobs (no `:file:` in jobId), keep the current FAILED + DLQ behavior.

**Batch Concatenation:** For batch mode, concatenate all files with clear separators: `\n\n--- File: {originalName} ---\n\n{content}`. This gives the LLM context about file boundaries.

### Architecture Constraints

- **TransactionManager.run(tenantId, ...)** for ALL tenant-scoped entity operations
- **System-wide entities** (LlmModelEntity, LlmProviderConfigEntity) use `@InjectRepository` directly
- **BullMQ queue config** is in `workflow-execution.module.ts` — no changes to queue setup needed
- **Guard ordering**: JWT → TenantStatus → Roles on all `/app/` controllers (already set in Story 4-1)
- **200ms rule**: Run initiation must return quickly — all heavy work happens in BullMQ jobs
- **Shared DTOs** in `libs/shared/` — never define interfaces in app code

### Testing Patterns

- Co-located spec files (e.g., `workflow-execution.service.spec.ts`)
- Mock `@InjectQueue` with `{ add: jest.fn() }` — see existing `workflow-execution.service.spec.ts`
- Mock `TransactionManager.run` to return resolved values — see existing processor spec
- Test IDs: `[4.3-UNIT-XXX]` prefix with P0 priority markers
- Use `jest.fn()` for all external dependencies, avoid real DB in unit tests

### Files to Create/Modify

**New files:**
- Migration file for new columns (`totalJobs`, `completedJobs`, `failedJobs`, `perFileResults`, `COMPLETED_WITH_ERRORS` enum value)

**Modified files:**
- `libs/db-layer/src/lib/entities/workflow-run.entity.ts` — add columns + enum value
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.service.ts` — fan-out/fan-in logic
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.service.spec.ts` — new tests
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` — per-file result recording + completion check
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts` — new tests
- `apps/api-gateway/src/app/workflow-execution/prompt-assembly.service.ts` — batch concatenation
- `apps/api-gateway/src/app/workflow-execution/prompt-assembly.service.spec.ts` — new tests
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts` — subject file resolution
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.spec.ts` — new tests
- `libs/shared/src/lib/types/workflow-job.interface.ts` — no changes needed (already has both fields)
- `libs/shared/src/lib/dtos/workflow/workflow-run-response.dto.ts` — expose new fields in API response (totalJobs, completedJobs, failedJobs, perFileResults). Frontend display deferred to Story 4E or later — this story only updates the DTO

### References

- [Source: _bmad-output/implementation-artifacts/retrospectives/epic-4-planning-2026-02-09.md — Topic 6: Fan-Out/Fan-In Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md — Story 4.3 ACs]
- [Source: _bmad-output/implementation-artifacts/stories/4-2-llm-provider-interface-prompt-assembly.md — processor integration]
- [Source: _bmad-output/implementation-artifacts/stories/4-0-bullmq-safety-prerequisites.md — BullMQ patterns]
- [Source: project-context.md — Rules 3, 5, 6, 9, 13, 14, 15, 24, 25]

### Explicit Out-of-Scope (Documented Deferrals)

| Item | Deferred To | Reason |
|------|-------------|--------|
| Credit deduction (`creditsConsumed`) | Story 4-4 (Credit Management) | `creditsConsumed` column exists on entity (initialized to 0) but processor does NOT update it. Credit deduction logic (upfront deduct, refund on failure, `is_test_run` bypass) is entirely Story 4-4's scope. |
| Per-run `max_concurrency` enforcement | Story 7P-5b (Horizontal Scaling) | Requires BullMQ Pro (paid). System-wide `WORKER_CONCURRENCY` is sufficient for MVP. AC #9 deferred. |
| Output asset creation | Story 4-5 (Output Management) | Processor stores `rawLlmResponse` but does not create output `AssetEntity` records. |
| Circuit breaker | Story 4-4 or later | Per-provider circuit breaker deferred per Epic 4 planning doc. |
| WebSocket notifications | Future story | No real-time run status push in this story. |

### Anti-Patterns to Avoid

- **Do NOT** create a separate WorkflowRunResult entity — use JSONB column on existing entity
- **Do NOT** use FlowProducer for fan-out — FlowProducer is for chains (Story 4-6). Fan-out is N independent jobs
- **Do NOT** modify the queue configuration in `workflow-execution.module.ts` — existing retry/backoff settings apply to individual jobs
- **Do NOT** introduce WebSocket notifications in this story — that's a separate concern
- **Do NOT** add circuit breaker logic in this story — that's deferred per planning doc
- **Do NOT** use `@IsUUID()` — use `@Matches(UUID_REGEX)` per Rule 27
- **Do NOT** use two-step `increment()` then `findOne()` for completion counters — race condition. Use single SQL with `RETURNING` clause (see W2 in Key Design Decisions)
- **Do NOT** write `assembledPrompt`/`rawLlmResponse` to parent entity columns for fan-out runs — write to `perFileResults` only
- **Do NOT** set `totalJobs` after enqueueing — set it BEFORE in the creation transaction to prevent race with fast-completing jobs
- **Do NOT** mark entire run as FAILED when a single fan-out job fails — increment failedJobs and let aggregation determine final status

### Previous Story Learnings

- **Story 4-0**: lockDuration goes in @Processor decorator, not defaultJobOptions. Cascade failure resilience: wrap DB updates in try/catch in `onFailed`.
- **Story 4-1**: Comment `// subjectFile/subjectFiles left undefined — resolved in Story 4-3` is the explicit handoff point. ValidateInputRecordConstraint pattern for Record validation.
- **Story 4-2**: Provider factory cache keyed by `providerKey:modelId`. Defense-in-depth token check is a soft gate (primary gate is Story 4-4). `@ValidateIf` pattern for nullable DTO fields.

## AC-to-Test Traceability

| AC | Test ID | Spec File | Description |
|----|---------|-----------|-------------|
| #1 (parallel fan-out) | [4.3-UNIT-053] | execution.service.spec | enqueues N jobs, one per subject file |
| #1 (parallel fan-out) | [4.3-UNIT-054] | execution.service.spec | fan-out jobIds follow {runId}:file:{index} format |
| #1 (parallel fan-out) | [4.3-UNIT-055] | execution.service.spec | each fan-out job carries single subjectFile |
| #1 (parallel fan-out) | [4.3-UNIT-056] | execution.service.spec | fan-out jobs preserve base payload fields |
| #1 (parallel fan-out) | [4.3-UNIT-016] | processor.spec | fan-out job writes PerFileResult via JSONB append |
| #1 (parallel fan-out) | [4.3-UNIT-017] | processor.spec | fan-out job atomically increments completed_jobs with RETURNING |
| #2 (batch mode) | [4.3-UNIT-051] | execution.service.spec | enqueues single job with all subjectFiles (batch) |
| #2 (batch mode) | [4.3-UNIT-052] | execution.service.spec | batch job merges subjectFiles with base payload |
| #2 (batch mode) | [4.3-UNIT-060] | prompt-assembly.spec | batch concatenation with --- File: separators |
| #2 (batch mode) | [4.3-UNIT-061] | prompt-assembly.spec | subject_name is comma-joined filenames |
| #2 (batch mode) | [4.3-UNIT-063] | prompt-assembly.spec | subjectFiles takes precedence over subjectFile |
| #3 (immutable definition) | — | — | Structural: definition passed in payload, no DB lookup needed |
| #4 (COMPLETED_WITH_ERRORS) | [4.3-UNIT-024] | processor.spec | sets COMPLETED_WITH_ERRORS when mixed success/fail |
| #4 (COMPLETED_WITH_ERRORS) | [4.3-UNIT-025] | processor.spec | sets FAILED when all jobs fail |
| #5 (aggregated results) | [4.3-UNIT-026] | processor.spec | aggregates token usage from all perFileResults |
| #5 (aggregated results) | [4.3-UNIT-022] | processor.spec | triggers finalization, sets completedAt |
| #6 (subject file resolution) | [4.1-UNIT-004] | workflow-runs.service.spec | resolves subject files and passes to enqueueRun |
| #7 (unique jobIds) | [4.3-UNIT-054] | execution.service.spec | jobIds follow {runId}:file:{index} format |
| #8 (context-only compat) | [4.3-UNIT-047] | execution.service.spec | enqueueRun adds single job with runId as jobId |
| #8 (context-only compat) | [4.3-UNIT-050] | execution.service.spec | treats empty subjectFiles as context-only |
| #8 (context-only compat) | [4.3-UNIT-064] | prompt-assembly.spec | no subject files → unresolved warnings |
| #8 (context-only compat) | [4.3-UNIT-019] | processor.spec | single-job writes directly to entity columns |
| #9 (group concurrency) | — | — | DEFERRED: BullMQ Pro required. See 7P-5b |
| #10 (fan-out failure) | [4.3-UNIT-027] | processor.spec | fan-out failure increments failed_jobs, writes error PerFileResult |
| #10 (fan-out failure) | [4.3-UNIT-028] | processor.spec | fan-out failure triggers finalization when last job |
| #10 (fan-out failure) | [4.3-UNIT-029] | processor.spec | single-job failure marks run FAILED (backward compat) |
| #10 (fan-out failure) | [4.3-UNIT-030] | processor.spec | fan-out failure does NOT call markRunFailed |
| #10 (fan-out failure) | [4.3-UNIT-032] | processor.spec | intermediate fan-out failure does NOT route to DLQ |
| #1 (parallel fan-out) | [4.3-UNIT-058] | workflow-runs.service.spec | totalJobs=N for parallel mode with N subject files |
| #6 (subject file resolution) | [4.3-UNIT-059] | workflow-runs.service.spec | missing subject asset throws BadRequestException |

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References
- Code review round 1: 8 findings (3H, 3M, 2L) — all fixed
- Code review round 2: 5 findings (2M, 3L) — all fixed
- R1-H1 fix: Added `tenantId` to asset WHERE clause in `resolveSubjectFiles` (defense-in-depth Rule 2c)
- R1-M2 fix: Refactored N+1 queries to single transaction for all asset lookups
- R1-L1 fix: Moved `PerFileResult` interface from db-layer to shared types
- R1-L2 fix: Added `assembledPrompt` field to `PerFileResult` interface and stored it in `recordFanOutSuccess`
- R1-M1 fix: Renamed all test IDs from ad-hoc `4.X`/`5.X` format to `[4.3-UNIT-XXX]` convention
- R1-H2 fix: Updated AC #9 to mark BullMQ group concurrency as DEFERRED (BullMQ Pro required)
- R1-H3 fix: Updated all tasks to checked, added Dev Agent Record, AC-to-test traceability table
- R2-1 fix: Added `tenantId` to 2 AssetEntity lookups in `PromptAssemblyService` (Rule 2c — same violation class as R1-H1)
- R2-2 fix: Replaced sequential `findOne` loop with bulk `find(In(...))` query in `resolveSubjectFiles`
- R2-3 fix: Added test [4.3-UNIT-058] for totalJobs=N and [4.3-UNIT-059] for missing asset error
- R2-4 fix: Updated Task 5.1 description to match actual implementation (finalizeRun method, not separate service)
- R2-5 fix: Added explicit Out-of-Scope table documenting credits, max_concurrency, output assets, circuit breaker, WebSocket deferrals

### Completion Notes List
1. Task 3.4 (BullMQ group concurrency) and Task 7.8 (group concurrency test) DEFERRED — BullMQ Pro is a paid feature. System-wide `WORKER_CONCURRENCY` env var is sufficient for MVP. Tracked as deferred item under 7P-5b.
2. Task 5.1 — finalization logic implemented as `finalizeRun()` private method on `WorkflowExecutionProcessor` rather than a separate `RunAggregationService`. Simpler architecture, same atomicity guarantees.
3. `PerFileResult` interface moved from `libs/db-layer` to `libs/shared` during code review fix (L1). All consumers import from `@project-bubble/shared`.
4. `assembledPrompt` added to `PerFileResult` interface during code review fix (L2) — each fan-out per-file result now stores its assembled prompt for debugging/audit.
5. `resolveSubjectFiles` now uses single transaction with `tenantId` in WHERE clause (code review fixes H1 + M2).

### File List
- `libs/db-layer/src/lib/entities/workflow-run.entity.ts` — COMPLETED_WITH_ERRORS enum, 4 new columns (totalJobs, completedJobs, failedJobs, perFileResults), imports PerFileResult from shared
- `libs/db-layer/src/lib/entities/index.ts` — removed PerFileResult re-export (now in shared)
- `libs/shared/src/lib/types/workflow-job.interface.ts` — added PerFileResult interface with assembledPrompt field
- `libs/shared/src/lib/types/index.ts` — barrel export for PerFileResult
- `libs/shared/src/lib/dtos/workflow/workflow-run-response.dto.ts` — totalJobs, completedJobs, failedJobs, perFileResults (typed) fields
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts` — resolveSubjectFiles (single tx, tenantId in WHERE), totalJobs computation, enqueue options
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.spec.ts` — updated tests 001-003 for new enqueueRun signature, test 004 for subject file resolution
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.service.ts` — 3 modes (context-only, batch, parallel), EnqueueOptions interface
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.service.spec.ts` — 11 tests [4.3-UNIT-047..057]
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` — fan-out behavioral split, recordFanOutSuccess/Failure, finalizeRun, atomic RETURNING pattern
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts` — 38 tests [4.3-UNIT-001..032] + [4.2-UNIT-047..052]
- `apps/api-gateway/src/app/workflow-execution/prompt-assembly.service.ts` — batch concatenation (subjectFiles)
- `apps/api-gateway/src/app/workflow-execution/prompt-assembly.service.ts` — R2-1 fix: added tenantId to 2 AssetEntity WHERE clauses (Rule 2c)
- `apps/api-gateway/src/app/workflow-execution/prompt-assembly.service.spec.ts` — 19 tests [4.2-UNIT-033..046] + [4.3-UNIT-060..064]
