# Story 4-0: BullMQ Safety Prerequisites

Status: done

## Story

As a **platform operator**,
I want **a workflow execution queue with dead letter routing and idempotency guarantees**,
so that **charged LLM operations have failure recovery, duplicate protection, and admin-visible diagnostics from day one**.

## Acceptance Criteria

1. **AC1: Workflow Execution Queue Registration**
   - Given the `WorkflowExecutionModule` is imported in `AppModule`
   - Then a BullMQ queue named `workflow-execution` is registered with:
     - `attempts: 3`
     - `backoff: { type: 'exponential', delay: 5000 }`
     - `removeOnComplete: 100`
     - `removeOnFail: false` (DLQ handles failed jobs — do NOT auto-remove)
     - `lockDuration: 300000` (5 minutes — LLM calls can be slow)

2. **AC2: DLQ Queue Registration**
   - Given the module is initialized
   - Then a separate BullMQ queue named `workflow-execution-dlq` is registered
   - The DLQ queue has NO processor (jobs are stored for admin inspection, not auto-processed)
   - DLQ queue config: `removeOnComplete: false`, `removeOnFail: false` (preserve all entries)

3. **AC3: Skeleton Execution Processor**
   - Given a job is added to the `workflow-execution` queue with `WorkflowJobPayload` data
   - Then `WorkflowExecutionProcessor` (extending `WorkerHost`) processes it:
     1. Loads `WorkflowRunEntity` by `runId` from job data
     2. Updates `status` to `RUNNING`, sets `startedAt` to current timestamp
     3. Performs a no-op placeholder (logs "Processing workflow run — LLM integration pending Story 4-2/4-3")
     4. Updates `status` to `COMPLETED`, sets `completedAt` and `durationMs`
   - The processor respects `WORKER_CONCURRENCY` env var (default: 100) via `@Processor('workflow-execution', { concurrency: parseInt(process.env.WORKER_CONCURRENCY || '100') })`

4. **AC4: DLQ Event Handler — Failed Job Routing**
   - Given a job in `workflow-execution` exhausts all retry attempts (3 attempts)
   - Then the `failed` event handler:
     1. Adds the full job payload to `workflow-execution-dlq` queue with metadata: `{ originalJobId, failedAt, attemptsMade, errorMessage }`
     2. Updates `WorkflowRunEntity.status` to `FAILED`
     3. Updates `WorkflowRunEntity.errorMessage` with a human-readable message (NOT a raw stack trace). Format: `"Workflow execution failed after {attempts} attempts: {lastErrorSummary}"`
     4. Logs a structured error: `{ message, jobId, runId, tenantId, error, attemptsMade }`
   - The user sees "Failed" status with the error message in their run history (existing UI will consume this via API in Story 4-1)

5. **AC5: Idempotency — Double-Click Prevention**
   - Given a workflow run is submitted with `runId` as the BullMQ `jobId`
   - Then BullMQ rejects duplicate enqueuing (same `jobId` cannot be added twice)
   - The service method that enqueues jobs uses `WorkflowRunEntity.id` as the BullMQ `jobId` directly (no prefix needed — UUIDs are already unique)

6. **AC6: Idempotency — Already-Completed Skip**
   - Given the processor receives a job whose `WorkflowRunEntity.status` is `COMPLETED`
   - Then the processor logs a warning and returns early WITHOUT re-processing
   - This prevents duplicate work if a job is somehow retried after completion

7. **AC7: Idempotency — Stale Lock Recovery**
   - Given the processor receives a job whose `WorkflowRunEntity.status` is `RUNNING` (stale from a previous attempt where lock expired)
   - Then the processor logs a warning: "Recovering stale run {runId} — previous attempt did not complete"
   - The processor resets `startedAt` to current timestamp and proceeds with normal processing
   - This handles the case where a worker crashes mid-processing and BullMQ reassigns the job

8. **AC8: WORKER_CONCURRENCY Env Var**
   - Given the `WORKER_CONCURRENCY` environment variable is set (e.g., `50`)
   - Then the processor uses that value for BullMQ worker concurrency
   - Given the env var is NOT set
   - Then the processor defaults to `100`

9. **AC9: Module Wiring Test**
   - Given `WorkflowExecutionModule` is added to the existing module wiring test suite
   - Then the module compiles with real providers (BullMQ queue, TypeORM, ConfigModule)
   - The processor, service, and both queues are resolvable from the DI container

10. **AC10: Operations Runbook Entry**
    - Given Story 4-0 is complete
    - Then a new file `docs/operations-runbook.md` is created (or appended to) with:
      - Queue names: `workflow-execution`, `workflow-execution-dlq`
      - Log format: structured JSON with fields `jobId`, `runId`, `tenantId`, `error`, `attemptsMade`
      - Env vars: `WORKER_CONCURRENCY` (default 100), `REDIS_HOST`, `REDIS_PORT`
      - DLQ inspection: how to check DLQ depth via `redis-cli` or BullMQ API
      - Failure patterns: what causes jobs to land in DLQ, how to diagnose

11. **AC11: E2E Suite Still Passes**
    - Given all changes are complete
    - Then the existing E2E suite passes (46+ tests)
    - No regressions introduced by the new module

## Tasks / Subtasks

- [x] **Task 1: Create WorkflowExecutionModule** (AC: 1, 2, 8)
  - [x]1.1 Create `apps/api-gateway/src/app/workflow-execution/workflow-execution.module.ts`
  - [x]1.2 Register `workflow-execution` queue with BullModule.registerQueue (attempts: 3, backoff exponential 5s, lockDuration 300000, removeOnFail: false)
  - [x]1.3 Register `workflow-execution-dlq` queue with BullModule.registerQueue (no processor, removeOnComplete: false, removeOnFail: false)
  - [x]1.4 Import TypeOrmModule.forFeature([WorkflowRunEntity])
  - [x]1.5 Add WorkflowExecutionModule to AppModule imports

- [x] **Task 2: Create WorkflowExecutionProcessor** (AC: 3, 6, 7, 8)
  - [x]2.1 Create `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts`
  - [x]2.2 Extend `WorkerHost`, decorate with `@Processor('workflow-execution', { concurrency: parseInt(process.env.WORKER_CONCURRENCY || '100') })`
  - [x]2.3 Inject `TransactionManager` (NOT bare Repository — required for RLS tenant context in background workers)
  - [x]2.4 Implement `process(job: Job<WorkflowJobPayload>)`:
    - Use `txManager.run(job.data.tenantId, async (manager) => ...)` for ALL entity operations
    - Load WorkflowRunEntity by `manager.findOne(WorkflowRunEntity, { where: { id: runId } })`
    - **Idempotency check**: if status === COMPLETED → log warning, return early
    - **Stale lock recovery**: if status === RUNNING → log warning "Recovering stale run", reset startedAt
    - Update status to RUNNING, set startedAt
    - Placeholder: log "Processing workflow run — LLM integration pending Story 4-2/4-3"
    - Update status to COMPLETED, set completedAt and durationMs
  - [x]2.5 Use structured JSON logging for all log entries (jobId, runId, tenantId)
  - [x]2.6 Implement `@OnWorkerEvent('failed')` DLQ handler method on this processor class:
    - Check `job.attemptsMade >= job.opts.attempts` for final failure (not intermediate retry)
    - Inject `@InjectQueue('workflow-execution-dlq')` queue in constructor
    - On final failure: add job payload + metadata to DLQ queue: `{ originalJobId, runId, tenantId, failedAt, attemptsMade, errorMessage }`
    - Use `txManager.run(tenantId, ...)` to update WorkflowRunEntity: status=FAILED, errorMessage=human-readable
    - Format: `"Workflow execution failed after {attemptsMade} attempts: {errorSummary}"`
    - Log structured error: `{ message, jobId, runId, tenantId, error, attemptsMade }`
    - Wrap entity update in try/catch — log error but do NOT re-throw (prevent cascade failure)
    - For intermediate failures (attemptsMade < attempts): log warning only, let BullMQ retry

- [x] **Task 3: Create WorkflowExecutionService** (AC: 5)
  - [x]3.1 Create `apps/api-gateway/src/app/workflow-execution/workflow-execution.service.ts`
  - [x]3.2 Inject `@InjectQueue('workflow-execution')` queue
  - [x]3.3 Implement `enqueueRun(runId: string, payload: WorkflowJobPayload): Promise<{ jobId: string }>`:
    - Use `runId` as BullMQ `jobId` directly (idempotency via UUID)
    - Add job to queue with `{ jobId: runId }`
    - Return `{ jobId: runId }`
  - [x]3.4 Export service from module (used by Story 4-1 run initiation)

- [x] **Task 4: Unit Tests — Processor** (AC: 3, 4, 6, 7)
  - [x]4.1 Test: process() updates run status QUEUED → RUNNING → COMPLETED
  - [x]4.2 Test: process() sets startedAt, completedAt, durationMs
  - [x]4.3 Test: process() skips already-COMPLETED runs (returns early, logs warning)
  - [x]4.4 Test: process() recovers stale RUNNING runs (resets startedAt, proceeds)
  - [x]4.5 Test: process() throws if WorkflowRunEntity not found (job data has invalid runId)
  - [x]4.6 Test: process() uses TransactionManager.run(tenantId, ...) for all entity operations
  - [x]4.7 Test: DLQ handler moves job to DLQ queue after all retries exhausted
  - [x]4.8 Test: DLQ handler updates WorkflowRunEntity status to FAILED
  - [x]4.9 Test: DLQ handler sets human-readable errorMessage (not raw stack trace)
  - [x]4.10 Test: DLQ handler includes metadata in DLQ job (originalJobId, attemptsMade, failedAt)
  - [x]4.11 Test: DLQ handler does NOT trigger for intermediate failures (attemptsMade < attempts)
  - [x]4.12 Test: DLQ handler logs error but does NOT throw if entity update fails (resilience)
  - [x]4.13 Test: DLQ handler gracefully handles entity-not-found scenario (logs error, still adds to DLQ)

- [x] **Task 5: Unit Tests — Service** (AC: 5)
  - [x]5.1 Test: enqueueRun() adds job with runId as jobId
  - [x]5.2 Test: enqueueRun() returns correct jobId
  - [x]5.3 Test: enqueueRun() passes WorkflowJobPayload as job data

- [x] **Task 6: Module Wiring Test** (AC: 9)
  - [x]6.1 Add WorkflowExecutionModule wiring test to existing `module-wiring.spec.ts`
  - [x]6.2 Verify module compiles with real BullMQ queue registration
  - [x]6.3 Verify WorkflowExecutionProcessor is resolvable
  - [x]6.4 Verify WorkflowExecutionService is resolvable

- [x] **Task 7: Operations Runbook** (AC: 10)
  - [x]7.1 Create `docs/operations-runbook.md` with queue infrastructure section (`docs/` directory already exists)
  - [x]7.2 Document queue names, env vars, log formats, DLQ inspection commands
  - [x]7.3 Document failure patterns and troubleshooting steps

- [x] **Task 8: E2E Regression Check** (AC: 11)
  - [x]8.1 Run full E2E suite (`npx nx e2e web-e2e`)
  - [x]8.2 Verify 46+ tests still pass
  - [x]8.3 No regressions from new module registration

## Dev Notes

### Architecture Pattern — Follow IngestionModule

The existing `IngestionModule` is the authoritative pattern for BullMQ queue setup:

```
apps/api-gateway/src/app/ingestion/
├── ingestion.module.ts          ← Queue registration + module wiring
├── ingestion.processor.ts       ← @Processor extending WorkerHost
├── ingestion.service.ts         ← @InjectQueue + enqueue logic
└── ingestion.controller.ts      ← HTTP endpoint (NOT needed in 4-0)
```

Mirror this structure for `workflow-execution/`:
```
apps/api-gateway/src/app/workflow-execution/
├── workflow-execution.module.ts
├── workflow-execution.processor.ts       ← Includes @OnWorkerEvent('failed') DLQ handler method
└── workflow-execution.service.ts
```

### Key Differences from Ingestion Pattern

| Aspect | Ingestion | Workflow Execution |
|--------|-----------|-------------------|
| Queue name | `ingestion` | `workflow-execution` |
| Job ID format | `idx-${uuidv4()}` (random) | `runId` directly (idempotent) |
| removeOnFail | `500` (keep last 500) | `false` (DLQ handles it) |
| lockDuration | Default (30s) | `300000` (5 min for LLM calls) |
| Concurrency | Default (1) | `WORKER_CONCURRENCY` env var (default 100) |
| DLQ | None | Separate `workflow-execution-dlq` queue |
| DB access | TransactionManager | TransactionManager (same — required for RLS in workers) |
| Entity update | None (fire-and-forget) | Updates WorkflowRunEntity status |

### WorkflowRunEntity — Already Exists

Entity at `libs/db-layer/src/lib/entities/workflow-run.entity.ts` already has all needed fields:
- `status`: WorkflowRunStatus enum (QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED)
- `errorMessage`: text, nullable
- `retryHistory`: JSONB array, nullable
- `startedAt`, `completedAt`, `durationMs`: timing fields
- `tenantId`: for RLS and structured logging

**No schema changes needed.** The entity is ready for this story.

### WorkflowJobPayload — Already Defined

Interface at `libs/shared/src/lib/types/workflow-job.interface.ts`:
```typescript
interface WorkflowJobPayload {
  runId: string;
  tenantId: string;
  versionId: string;
  definition: WorkflowDefinition;
  contextInputs: Record<string, WorkflowJobContextInput>;
  subjectFile?: WorkflowJobSubjectFile;
  subjectFiles?: WorkflowJobSubjectFile[];
  knowledgeContext?: string;
}
```

**No interface changes needed.** Use this as the job data type.

### BullMQ Event Handling for DLQ

Use `@OnWorkerEvent('failed')` decorator on the processor class — this handles per-job failure events co-located with the processor logic. Check `job.attemptsMade >= job.opts.attempts` to distinguish final failure from intermediate retry. The DLQ handler is a method on `WorkflowExecutionProcessor`, NOT a separate class or file.

**Important:** The DLQ handler's entity update must be wrapped in try/catch. If the DB update fails (e.g., connection issue), log the error but do NOT re-throw — the job data is already preserved in the DLQ queue.

### Graceful Shutdown

NestJS's `@nestjs/bullmq` integration calls `Worker.close()` automatically on module destroy (SIGTERM/deploy). In-flight jobs complete up to `lockDuration` (5 min); unstarted jobs return to the queue. No custom `onModuleDestroy` shutdown logic is needed.

### Testing Strategy

- **Unit tests**: Mock BullMQ `Queue` and `Job` objects, mock TypeORM repository
- **Module wiring test**: Real BullMQ queue registration (requires Redis), verify DI resolution
- **NO integration tests** needed for queue behavior — BullMQ's own test suite covers that
- **NO E2E tests** for this story — no UI, no HTTP endpoints. E2E regression only.

### Critical: TransactionManager for Tenant Context

Per project-context.md Section 2c (Defense-in-Depth): ALL DB operations on tenant-scoped entities MUST include tenantId. In background workers (no HTTP request context), use `TransactionManager.run(tenantId, ...)` — this sets `app.current_tenant` for RLS. When loading WorkflowRunEntity, use: `txManager.run(job.data.tenantId, async (manager) => manager.findOne(WorkflowRunEntity, { where: { id: runId } }))`.

### Critical: @IsUUID Prohibition

Per project-context.md Rule 27: If any DTOs reference UUIDs, use `@Matches` regex, never `@IsUUID`. (This story has no new DTOs, but note for future reference.)

### Project Structure Notes

- All new files go in `apps/api-gateway/src/app/workflow-execution/`
- No new entities needed (WorkflowRunEntity exists)
- No new DTOs needed (no HTTP endpoints in this story)
- No Angular/frontend changes
- Module registered in `apps/api-gateway/src/app/app.module.ts`
- Wiring test added to existing `apps/api-gateway/src/app/module-wiring.spec.ts`

### Out of Scope (Explicitly)

| Feature | Deferred To | Rationale |
|---------|-------------|-----------|
| `rate_limit_rpm` column on LlmProviderConfigEntity | Story 4-2 | Schema changes ship with code that uses them |
| BullMQ rate limiter setup | Story 4-2 | Tied to LLM provider interface |
| Circuit breaker | Story 4-3 | Tied to execution engine core |
| Credit deduction / refund | Story 4-4 | Pre-flight validation story |
| `is_test_run` flag | Story 4-7 | Test run story |
| HTTP endpoints | Story 4-1 | Catalog + run initiation |
| Any UI changes | Story 4-1+ | No frontend in this story |

### References

- [Source: ingestion.module.ts](apps/api-gateway/src/app/ingestion/ingestion.module.ts) — Queue registration pattern
- [Source: ingestion.processor.ts](apps/api-gateway/src/app/ingestion/ingestion.processor.ts) — Processor pattern
- [Source: ingestion.service.ts](apps/api-gateway/src/app/ingestion/ingestion.service.ts) — Enqueue pattern
- [Source: workflow-run.entity.ts](libs/db-layer/src/lib/entities/workflow-run.entity.ts) — Entity schema
- [Source: workflow-job.interface.ts](libs/shared/src/lib/types/workflow-job.interface.ts) — Job payload
- [Source: app.module.ts](apps/api-gateway/src/app/app.module.ts) — Module registration
- [Source: module-wiring.spec.ts](apps/api-gateway/src/app/module-wiring.spec.ts) — Wiring test pattern
- [Source: epic-4-planning-2026-02-09.md](_bmad-output/implementation-artifacts/retrospectives/epic-4-planning-2026-02-09.md) — Planning decisions
- [Source: project-context.md](project-context.md) — Implementation rules

## AC-to-Test Mapping

| AC | Test IDs | Description |
|----|----------|-------------|
| AC1 | 6.1, 6.2 | Queue registration verified in wiring test |
| AC2 | 6.1, 6.2 | DLQ queue registration verified in wiring test |
| AC3 | 4.1, 4.2 | Processor status transitions + timing fields |
| AC4 | 4.7-4.13 | DLQ handler: moves job, updates entity, human-readable error, resilience, entity-not-found |
| AC5 | 5.1-5.3 | Service uses runId as jobId |
| AC6 | 4.3 | Already-completed skip |
| AC7 | 4.4 | Stale lock recovery |
| AC8 | (decorator) | Env var read at processor decorator level — requires app restart to change |
| AC9 | 6.1-6.4 | Module wiring compilation + DI resolution |
| AC10 | (manual) | Operations runbook file created |
| AC11 | 8.1-8.3 | E2E regression check |

## Definition of Done

- [x] All acceptance criteria met
- [x] All unit tests pass (18 unit + 1 wiring = 19 new tests; 1047 total)
- [x] Module wiring test passes (12/12 including MW-1-UNIT-012)
- [x] E2E suite still passes (46 tests — 2 flaky on first run, pass on retry)
- [x] Operations runbook entry created (`docs/operations-runbook.md`)
- [x] No lint errors (0 errors, 75 pre-existing warnings)
- [x] Code review completed (party mode — 3 findings fixed: atomic tx, terminal state guard, import consolidation)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Unit tests: 16 passed (13 processor + 3 service)
- Wiring tests: 12 passed (MW-1-UNIT-012 added for WorkflowExecutionModule)
- Full suite: 1045 tests passed (1028 previous + 17 new)
- E2E: 46 passed (2 flaky on first run — login timeout + folder nav — pass on retry, pre-existing)
- Lint: 0 errors, 75 pre-existing warnings

### Completion Notes List

- TransactionManager used instead of bare Repository per party mode review finding
- DLQ handler co-located on processor class via @OnWorkerEvent('failed') per party mode review
- DLQ handler entity update wrapped in try/catch for cascade failure resilience
- WORKER_CONCURRENCY read via process.env in decorator (static at module load, requires restart)
- lockDuration set in @Processor decorator options (not in defaultJobOptions)

### File List

- `apps/api-gateway/src/app/workflow-execution/workflow-execution.module.ts` (NEW)
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` (NEW)
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.service.ts` (NEW)
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.spec.ts` (NEW)
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.service.spec.ts` (NEW)
- `apps/api-gateway/src/app/app.module.ts` (MODIFIED — added WorkflowExecutionModule import)
- `apps/api-gateway/src/app/module-wiring.spec.ts` (MODIFIED — added MW-1-UNIT-012)
- `docs/operations-runbook.md` (NEW)
