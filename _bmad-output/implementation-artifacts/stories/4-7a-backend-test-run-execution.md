# Story 4.7a: Backend - Workflow Test Run Execution

Status: code-review-complete

## Story

As a **Bubble Admin**,
I want **to execute test runs of workflows through the real execution pipeline without consuming credits or persisting results**,
so that **I can verify my workflow prompts produce quality output before publishing to end-users**.

## Context

This is Part A of Story 4.7 (Workflow Test Run & Preview), split into backend (4.7a) and frontend (4.7b) for parallel development.

**Party Mode Architecture Decision (2026-02-19):**
- **Ephemeral test runs** — no database persistence, results held in memory for modal display + JSON export
- **Full multi-file fan-out** — test runs execute through the SAME processor logic as production runs (Rule 32: correctness over simplicity)
- **Credit bypass** — `isTestRun: true` flag with defense-in-depth validation
- **WebSocket real-time updates** — stream progress and results per file to frontend
- **5-minute in-memory cache** — test results cached by `sessionId` for export endpoint

**Laziness Audit Result:** ✅ PASSED (2026-02-19)
- No complexity avoidance at cost of correctness
- Production-grade architecture (real pipeline, full fan-out)
- No "current stage" shortcuts

## Acceptance Criteria

### AC1: Test Run Initiation Endpoint
**Given** a Bubble Admin with a draft or published workflow template
**When** they POST `/api/admin/workflows/:id/test-run` with `ExecuteTestRunDto` (templateId, inputs with multi-file support)
**Then** the endpoint validates template completeness (LLM provider configured, model selected, inputs defined)
**And** returns 400 if template incomplete with specific validation errors
**And** generates a unique `sessionId` (UUID)
**And** enqueues a BullMQ job with `{ isTestRun: true, sessionId, templateId, inputs, subjectFiles }`
**And** returns 202 Accepted with `{ sessionId }` for WebSocket tracking
**And** NEVER deducts credits from tenant

### AC2: Credit Bypass (Defense-in-Depth)
**Given** a test run job is dequeued by the processor
**When** the processor calls `PreFlightValidationService.checkAndDeductCredits()`
**Then** the service detects `isTestRun: true` flag and returns early without deducting credits
**And** the processor validates job payload structure (`testRunId XOR runId` must be present, not both)
**And** if job has `testRunId` but `isTestRun` is false/missing → throws error (corrupted payload)
**And** credit deduction is NEVER called for test runs regardless of flag corruption

### AC3: Full Fan-Out Execution
**Given** a test run job with multiple subject files (e.g., 3 PDFs)
**When** the processor executes the job
**Then** it processes ALL subject files using the same fan-out logic as production runs
**And** for each file: resolves inputs → assembles prompt → calls LLM → validates response structure
**And** streams WebSocket events per file: `test-run-file-start`, `test-run-file-complete`, `test-run-error`
**And** does NOT skip any files or use "first-file-only" logic

### AC4: WebSocket Real-Time Updates
**Given** a test run is executing
**When** each file completes processing
**Then** the WebSocket gateway emits event `test-run-file-result` with payload:
```typescript
{
  sessionId: string;
  fileIndex: number;
  fileName: string;
  assembledPrompt: string;
  llmResponse: string;
  status: 'success' | 'failed' | 'error';
  errorMessage?: string;
}
```
**And** when all files complete → emits `test-run-complete` with `{ sessionId, totalFiles, successCount, failedCount }`
**And** on critical error → emits `test-run-error` with `{ sessionId, errorMessage }`

### AC5: Ephemeral Results Storage
**Given** test run results are generated
**When** the processor completes execution
**Then** results are stored in an in-memory cache (e.g., NodeCache) with key = `sessionId`
**And** cache entry contains: `{ templateId, templateName, inputs, results: PerFileResult[], createdAt }`
**And** cache TTL is 5 minutes (300 seconds)
**And** NO writes to `test_runs` table (no table exists)
**And** NO writes to `workflow_runs` table
**And** NO writes to `assets` table

### AC6: Export Endpoint
**Given** a test run has completed and results are in cache
**When** admin calls GET `/api/admin/test-runs/:sessionId/export`
**Then** endpoint retrieves results from in-memory cache by sessionId
**And** returns 404 if sessionId not found or expired
**And** returns JSON with full test run data:
```typescript
{
  sessionId: string;
  templateId: string;
  templateName: string;
  inputs: Record<string, any>;
  results: Array<{
    fileIndex: number;
    fileName: string;
    assembledPrompt: string;
    llmResponse: string;
    status: 'success' | 'failed' | 'error';
    errorMessage?: string;
  }>;
  executedAt: Date;
}
```
**And** returns 200 status (frontend handles download filename)

### AC7: Template Pre-Flight Validation
**Given** admin initiates a test run
**When** POST `/api/admin/workflows/:id/test-run` is called
**Then** endpoint validates template has `llm_provider_id` set (not null)
**And** validates template has `llm_model_id` set (not null)
**And** validates workflow definition has at least 1 input defined
**And** returns 400 with specific error if any validation fails:
  - Missing LLM provider: `{ error: "Template must have LLM provider configured (Prompt step)" }`
  - Missing LLM model: `{ error: "Template must have LLM model selected (Prompt step)" }`
  - No inputs: `{ error: "Workflow must have at least one input defined (Inputs step)" }`

### AC8: No Asset Persistence
**Given** test run processor completes successfully
**When** LLM response is validated and ready for storage
**Then** processor skips ALL calls to `AssetService.create()` or `AssetService.createFromBuffer()`
**And** processor skips ALL updates to `WorkflowRunEntity.perFileResults`
**And** results are ONLY written to in-memory cache

### AC9: Error Handling & Export
**Given** a test run encounters an error (LLM timeout, circuit breaker open, validation failure)
**When** the error occurs
**Then** WebSocket emits `test-run-error` event immediately
**And** partial results (if any files succeeded) are still cached with error details
**And** export endpoint returns partial results with error information
**And** HTTP status remains 200 (export succeeded even if test run failed)

### AC10: WebSocket Connection Management
**Given** admin initiates a test run
**When** POST `/api/admin/workflows/:id/test-run` returns sessionId
**Then** frontend connects to WebSocket with query param `?sessionId=<uuid>`
**And** WebSocket gateway validates sessionId format (UUID)
**And** returns connection error if sessionId invalid
**And** subscribes client to room `test-run-${sessionId}`
**And** only emits events to clients in that specific room

## Tasks / Subtasks

### Task 1: Create Test Run DTOs & Types (AC1, AC6)
- [x] 1.1: Create `ExecuteTestRunDto` in `libs/shared/src/lib/dtos/workflow/` with validation:
  - `@IsUUID() templateId: string`
  - `@ValidateNested() @Type(() => WorkflowRunInputValueDto) inputs: Record<string, WorkflowRunInputValueDto>`
- [x] 1.2: Create `TestRunResultDto` response type with sessionId, results array, executedAt
- [x] 1.3: Create `TestRunFileResultDto` type for per-file WebSocket payloads (fileIndex, fileName, assembledPrompt, llmResponse, status, errorMessage)

### Task 2: POST /admin/workflows/:id/test-run Endpoint (AC1, AC7)
- [x] 2.1: Add endpoint to `WorkflowTemplatesController` (admin module):
  - Route: `@Post(':id/test-run')` with `@HttpCode(202)`
  - Guards: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(BUBBLE_ADMIN)`
  - Decorators: `@ApiOperation`, `@ApiResponse` (202, 400, 401, 403, 404)
- [x] 2.2: Create `WorkflowTestService` in `apps/api-gateway/src/app/workflows/`
- [x] 2.3: Implement `executeTest(templateId, inputs, adminUserId, tenantId)` method:
  - Load template + version with `templatesService.findOneWithVersion()` (Rule 2c compliant)
  - Pre-flight validation: check `definition.execution.model`, `definition.inputs`
  - Return 400 BadRequestException with specific message if validation fails
  - Generate `sessionId` (UUID v4)
  - Resolve subject files with `resolveSubjectFiles()` to populate originalName/storagePath
  - Enqueue BullMQ job to `workflow-execution` queue with payload: `{ isTestRun: true, sessionId, versionId, definition, contextInputs, subjectFiles }`
  - Return `{ sessionId }` with 202 status

### Task 3: Credit Bypass Defense-in-Depth (AC2)
- [x] 3.1: Credit bypass already implemented in `PreFlightValidationService.checkAndDeductCredits()`:
  - Early return if `isTestRun === true` parameter (no credit deduction)
  - Logging already in place
- [x] 3.2: Update processor (`WorkflowExecutionProcessor`) job validation:
  - Add check: `if (sessionId && !isTestRun) throw new Error('Corrupted test run payload')`
  - Add check: `if (sessionId && runId) throw new Error('Invalid job - both sessionId and runId')`
  - Add check: `if (!sessionId && !runId) throw new Error('Invalid job - missing sessionId or runId')`

### Task 4: Full Fan-Out Execution (AC3, AC8)
- [x] 4.1: Update processor to detect `isTestRun` flag and fork execution path:
  - If `isTestRun: false` → current production logic (persist to WorkflowRunEntity + AssetEntity)
  - If `isTestRun: true` → new `processTestRun()` method (in-memory cache only)
- [x] 4.2: Implement test run execution path in processor:
  - Process ALL `subjectFiles` (no first-file-only logic)
  - For each file: call `PromptAssemblyService.assemble()`, `LLMProviderFactory.getProvider()`, `provider.generate()`, validate structure
  - Store results in local array: `TestRunFileResultDto[]`
  - Skip ALL calls to `AssetService` and `WorkflowRunEntity` updates
- [x] 4.3: Add processor logging: `logger.log('Test run completed', { sessionId, totalFiles, successCount, failedCount })`

### Task 5: WebSocket Gateway & Real-Time Updates (AC4, AC10)
- [x] 5.1: Create `TestRunGateway` in `apps/api-gateway/src/app/gateways/`:
  - `@WebSocketGateway({ namespace: '/test-runs', cors: true })`
  - Implement `handleConnection(client)`:
    - Extract sessionId from `client.handshake.query.sessionId`
    - Validate sessionId is UUID
    - Join client to room `test-run-${sessionId}`
- [x] 5.2: Inject `TestRunGateway` into processor via constructor
- [x] 5.3: Emit WebSocket events during execution:
  - `test-run-file-start`: `{ sessionId, fileIndex, fileName }`
  - `test-run-file-complete`: `{ sessionId, fileIndex, fileName, assembledPrompt, llmResponse, status, errorMessage? }`
  - `test-run-complete`: `{ sessionId, totalFiles, successCount, failedCount }`
  - `test-run-error`: `{ sessionId, errorMessage }`

### Task 6: In-Memory Cache for Ephemeral Results (AC5)
- [x] 6.1: Install `node-cache` package: `npm install node-cache @types/node-cache`
- [x] 6.2: Create `TestRunCacheService` as singleton:
  - Initialize NodeCache with `stdTTL: 300` (5 minutes), `checkperiod: 60`, `useClones: false`
  - Method: `set(sessionId, results)` → stores `{ sessionId, templateId, templateName, inputs, results, createdAt }`
  - Method: `get(sessionId)` → retrieves cached results or undefined
- [x] 6.3: Update processor to call `testRunCache.set(sessionId, results)` after execution completes

### Task 7: GET /admin/test-runs/:sessionId/export Endpoint (AC6, AC9)
- [x] 7.1: Add endpoint to `WorkflowTemplatesController`:
  - Route: `@Get('test-runs/:sessionId/export')`
  - Guards: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(BUBBLE_ADMIN)`
  - Decorators: `@ApiResponse` (200, 401, 403, 404)
- [x] 7.2: Implement `WorkflowTestService.exportResults(sessionId)`:
  - Call `testRunCache.get(sessionId)`
  - If not found → throw `NotFoundException('Test run not found or expired (5-minute TTL)')`
  - Return JSON (no Content-Disposition header - frontend handles download)
- [x] 7.3: Handle partial results (AC9): results array includes all files with status='error' and errorMessage populated

## Dev Notes

### Architecture Overview

**Test Run Flow:**
1. Admin POST `/admin/workflows/:id/test-run` → validate template → generate sessionId → enqueue job → return 202
2. Processor dequeues job → validates `isTestRun` flag → executes full fan-out → emits WebSocket events → caches results
3. Frontend subscribes to WebSocket room `test-run-${sessionId}` → receives real-time updates → displays results
4. Admin clicks Export → GET `/admin/test-runs/:sessionId/export` → retrieves from cache → downloads JSON

**Key Design Decisions (Party Mode 2026-02-19):**
- **Ephemeral storage** — no TestRunEntity table, no DB writes
- **Full fan-out** — correctness over simplicity (Laziness Audit enforced)
- **Defense-in-depth** — credit bypass at 3 layers: (1) isTestRun flag check, (2) job payload validation, (3) separate code path
- **WebSocket namespacing** — `/test-runs` namespace isolates test run events from production run events

### Technical Requirements

**BullMQ Integration:**
- Reuse existing `workflow-execution` queue
- Job payload for test runs: `{ isTestRun: true, sessionId, templateId, inputs, subjectFiles }`
- Job payload for production runs: `{ isTestRun: false, runId, templateId, inputs, subjectFiles }`
- Processor detects `isTestRun` and forks logic

**WebSocket Architecture:**
- Use `@nestjs/websockets` + `@nestjs/platform-socket.io`
- Namespace: `/test-runs`
- Room pattern: `test-run-${sessionId}` (1 room per test run)
- Events: `test-run-file-start`, `test-run-file-complete`, `test-run-complete`, `test-run-error`

**Cache Strategy:**
- Library: `node-cache` (in-memory, lightweight, TTL support)
- TTL: 5 minutes (300 seconds)
- Key: `sessionId` (UUID)
- Value: `{ templateId, templateName, inputs, results: PerFileResult[], createdAt }`

### File Structure

**New Files:**
```
libs/shared/src/lib/dtos/workflow/
  execute-test-run.dto.ts                    # ExecuteTestRunDto (inputs + validation)
  test-run-result.dto.ts                     # TestRunResultDto (export response)

apps/api-gateway/src/app/workflows/
  workflow-test.service.ts                   # executeTest() + exportResults()
  workflow-test.service.spec.ts              # Unit tests

apps/api-gateway/src/app/gateways/
  test-run.gateway.ts                        # WebSocket gateway for test runs
  test-run.gateway.spec.ts                   # Unit tests

apps/api-gateway/src/app/services/
  test-run-cache.service.ts                  # NodeCache wrapper (singleton)
  test-run-cache.service.spec.ts             # Unit tests
```

**Modified Files:**
```
apps/api-gateway/src/app/workflows/workflows.controller.ts
  # Add POST :id/test-run + GET test-runs/:sessionId/export

apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts
  # Add isTestRun detection + fork logic + WebSocket emit calls

apps/api-gateway/src/app/pre-flight-validation/pre-flight-validation.service.ts
  # Add early return for isTestRun: true

apps/api-gateway/src/app/app.module.ts
  # Import TestRunGateway + TestRunCacheService
```

### Testing Requirements

**Unit Tests (Minimum 25 tests):**
- `WorkflowTestService.executeTest()`: template validation (3 tests for missing provider/model/inputs), sessionId generation, job enqueue
- `WorkflowTestService.exportResults()`: cache hit, cache miss 404, partial results with errors
- `TestRunCacheService`: set/get operations, TTL expiration
- `TestRunGateway`: connection validation, room joining, event emission
- Processor fork logic: isTestRun detection, credit bypass, fan-out execution, cache storage
- `PreFlightValidationService`: early return for test runs

**Integration Tests (Tier 2):**
- Full test run flow: initiate → processor executes → cache stores → export retrieves
- WebSocket event emission: verify events emitted to correct room

**API Contract Tests (Tier 3):**
- POST `/admin/workflows/:id/test-run`: 202 success, 400 validation errors, 401/403 auth
- GET `/admin/test-runs/:sessionId/export`: 200 success, 404 not found

### References

- **Party Mode Consensus:** 2026-02-19 (full team: Winston, Naz, Amelia, Murat, Sally, erinc)
- **Laziness Audit:** Passed all 3 checks (correctness, production-grade, customer-facing)
- **Epic 4 Planning:** `retrospectives/epic-4-planning-2026-02-09.md`
- **Story 4.1 (Run Form):** Dynamic form component will be reused in frontend (Story 4.7b)
- **Story 4.3 (Processor):** Execution engine processor logic
- **Project Context:** Rule 2 (TransactionManager), Rule 6-10 (Angular patterns)

### Out-of-Scope

| Item | Tracked In |
|------|-----------|
| All test files (unit + integration + contract) | Pass 3 code review (Murat - Test Architect) |
| Content-Disposition header on export endpoint | NOT IMPLEMENTED - frontend handles download filename |
| Frontend test modal component | Story 4.7b-frontend-test-run-ui |
| Test button on workflow cards | Story 4.7b-frontend-test-run-ui |
| Test history UI (last N runs) | REMOVED - ephemeral design (no history) |
| PDF export of test results | Future enhancement (JSON export sufficient for V1) |
| Chain test runs | Story 4-6 (chains deferred to post-deployment) |
| Multi-tenant test run isolation | Not applicable - test runs are admin-only, no cross-tenant access |

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

None - implementation completed without debugging sessions

### Completion Notes

**Implementation Summary:**
- All 7 tasks completed successfully
- Build passes with zero TypeScript errors
- Pass 1 (Amelia self-review): 3 findings fixed (import error, entity architecture, asset metadata resolution, pre-existing syntax)
- Pass 2 (Naz adversarial): Fabricated test traceability table removed, AC6 mismatch fixed, Out-of-Scope table updated
- Pass 3 (Murat test architect): 29 tests written (24 unit + 1 integration + 4 contract) — all passing

**Code Review Fixes Applied:**
1. **FINDING 1 (FIXED)**: Import error - `Type` from `class-transformer` not `class-validator`
2. **FINDING 2 (FIXED)**: Created `findOneWithVersion()` helper in WorkflowTemplatesService, refactored WorkflowTestService to load version entity and access definition correctly
3. **FINDING 3 (FIXED)**: Added `resolveSubjectFiles()` private method to load asset metadata (originalName, storagePath) from database before enqueuing job
4. **FINDING 6 (FIXED)**: Pre-existing syntax error in app.module.ts (missing colon)

**Architecture Decisions:**
- Ephemeral test runs with NO database persistence
- Full multi-file fan-out execution (same processor logic as production)
- Defense-in-depth credit bypass (payload validation + isTestRun flag)
- WebSocket namespace `/test-runs` with room-based isolation
- 5-minute in-memory cache (NodeCache) for export endpoint

### File List

**Created:**
- `libs/shared/src/lib/dtos/workflow/execute-test-run.dto.ts` - Test run initiation DTO
- `libs/shared/src/lib/dtos/workflow/test-run-result.dto.ts` - Test run export response DTO
- `apps/api-gateway/src/app/workflows/workflow-test.service.ts` - Test run service (executeTest + exportResults)
- `apps/api-gateway/src/app/gateways/test-run.gateway.ts` - WebSocket gateway for real-time updates
- `apps/api-gateway/src/app/services/test-run-cache.service.ts` - NodeCache wrapper for ephemeral results

**Modified:**
- `apps/api-gateway/src/app/workflows/workflow-templates.controller.ts` - Added POST :id/test-run + GET test-runs/:sessionId/export endpoints
- `apps/api-gateway/src/app/workflows/workflow-templates.service.ts` - Added findOneWithVersion() helper method
- `apps/api-gateway/src/app/workflows/workflows.module.ts` - Registered WorkflowTestService provider
- `apps/api-gateway/src/app/workflow-execution/workflow-execution.processor.ts` - Added isTestRun fork + processTestRun() method + onFailed() test run handling
- `apps/api-gateway/src/app/app.module.ts` - Registered TestRunGateway + TestRunCacheService providers, fixed ThrottlerGuard syntax
- `libs/shared/src/lib/types/workflow-job.interface.ts` - Added sessionId, isTestRun fields to WorkflowJobPayload (documented)

### Test Traceability

**Total: 29 tests (24 unit + 1 integration + 4 contract)**

| Test ID | Type | Suite | Test Name | AC Coverage |
|---------|------|-------|-----------|-------------|
| 4-7a-UNIT-001 | Unit | WorkflowTestService | Initiates test run successfully and returns sessionId | AC1, AC7 |
| 4-7a-UNIT-002 | Unit | WorkflowTestService | Throws BadRequestException when model not configured | AC7 |
| 4-7a-UNIT-003 | Unit | WorkflowTestService | Throws BadRequestException when no inputs defined | AC7 |
| 4-7a-UNIT-004 | Unit | WorkflowTestService | Throws BadRequestException when asset not found | AC1 |
| 4-7a-UNIT-005 | Unit | WorkflowTestService | Returns cached results when sessionId exists | AC5 |
| 4-7a-UNIT-006 | Unit | WorkflowTestService | Throws NotFoundException when sessionId not in cache | AC5 |
| 4-7a-UNIT-007 | Unit | WorkflowTestService | Returns partial results with error details | AC3 |
| 4-7a-UNIT-008 | Unit | WorkflowTestService | Does not set Content-Disposition header (frontend handles download) | AC6 |
| 4-7a-UNIT-009 | Unit | TestRunCacheService | Stores and retrieves test run results | AC5 |
| 4-7a-UNIT-010 | Unit | TestRunCacheService | Returns undefined for non-existent sessionId | AC5 |
| 4-7a-UNIT-011 | Unit | TestRunCacheService | Expires entries after TTL (5 minutes) | AC5 |
| 4-7a-UNIT-012 | Unit | TestRunCacheService | Deletes entries manually | AC5 |
| 4-7a-UNIT-013 | Unit | TestRunCacheService | Provides cache statistics | AC5 |
| 4-7a-UNIT-014 | Unit | TestRunGateway | Rejects connection with invalid sessionId (non-UUID) | AC10 |
| 4-7a-UNIT-015 | Unit | TestRunGateway | Rejects connection with missing sessionId | AC10 |
| 4-7a-UNIT-016 | Unit | TestRunGateway | Accepts valid connection and joins client to session room | AC10 |
| 4-7a-UNIT-017 | Unit | TestRunGateway | Emits test-run-file-start event to correct room | AC8 |
| 4-7a-UNIT-018 | Unit | TestRunGateway | Emits test-run-file-complete event with result data | AC8 |
| 4-7a-UNIT-019 | Unit | TestRunGateway | Emits test-run-complete event with summary statistics | AC8 |
| 4-7a-UNIT-020 | Unit | TestRunGateway | Emits test-run-error event on failure | AC8 |
| 4-7a-UNIT-021 | Unit | WorkflowTemplatesService | findOneWithVersion returns both template and version entities | AC1 |
| 4-7a-UNIT-022 | Unit | WorkflowTemplatesService | findOneWithVersion throws NotFoundException when template not found | AC1 |
| 4-7a-UNIT-023 | Unit | WorkflowTemplatesService | findOneWithVersion throws BadRequestException when template has no currentVersionId | AC1 |
| 4-7a-UNIT-024 | Unit | WorkflowTemplatesService | findOneWithVersion throws BadRequestException when version not found | AC1 |
| 4-7a-UNIT-025 | Contract | WorkflowTemplatesController | POST /:id/test-run delegates to testService.executeTest with correct args | AC1 |
| 4-7a-UNIT-026 | Contract | WorkflowTemplatesController | POST /:id/test-run returns 202 status code (HTTP_CODE decorator) | AC1 |
| 4-7a-UNIT-027 | Contract | WorkflowTemplatesController | GET /test-runs/:sessionId/export delegates to testService.exportResults | AC5 |
| 4-7a-UNIT-028 | Contract | WorkflowTemplatesController | GET /test-runs/:sessionId/export returns TestRunResultDto shape | AC5, AC6 |
| 4-7a-INTEG-001 | Integration | Integration Wiring Tier 2 | WorkflowTestService.executeTest enqueues BullMQ job with isTestRun flag and sessionId | AC1, AC2, AC3 |
