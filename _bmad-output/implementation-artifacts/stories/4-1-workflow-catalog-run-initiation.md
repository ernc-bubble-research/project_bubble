# Story 4-1: Workflow Catalog & Run Initiation

Status: done

## Story

As a **Creator**,
I want **to browse available workflows and submit a run with a dynamically generated input form**,
so that **I can execute published workflows by providing the exact files, assets, and text inputs each workflow requires**.

## Acceptance Criteria

1. **AC1: Catalog Card Grid**
   - Given I navigate to `/app/workflows`
   - Then I see a card grid of published workflows accessible to my tenant
   - Each card shows: name, description, tags, credits per run badge
   - Each card has a "Run" button
   - All interactive elements have `data-testid` attributes

2. **AC2: Catalog Detail for Run Form**
   - Given I click "Run" on a workflow card
   - Then I navigate to `/app/workflows/run/:templateId`
   - The page loads the template's current version definition (includes `inputs[]`)

3. **AC3: Dynamic Run Form — Asset Picker**
   - Given an input has `source: ["asset"]`
   - Then an asset picker dropdown renders showing tenant Data Vault files
   - The picker filters by the input's `accept.extensions` if specified

4. **AC4: Dynamic Run Form — File Upload**
   - Given an input has `source: ["upload"]`
   - Then a file dropzone renders respecting `accept.extensions` and `max_size_mb`
   - Uploaded files are saved to the data vault first (via `POST /app/assets`), then referenced as asset IDs

5. **AC5: Dynamic Run Form — Text Area**
   - Given an input has `source: ["text"]`
   - Then a text area renders with `text_config.placeholder` and `text_config.max_length`

6. **AC6: Dynamic Run Form — Mixed Source Toggle**
   - Given an input has `source: ["asset", "upload"]`
   - Then both options render with a toggle to switch between them

7. **AC7: Subject Multi-File Selection**
   - Given a subject input (role: "subject")
   - Then the UI supports selecting multiple files (each becomes a separate parallel job)

8. **AC8: Required Field Validation**
   - Given the form has required inputs
   - Then the submit button is disabled until all required inputs are provided
   - Validation messages appear for empty required fields on submit attempt

9. **AC9: Run Initiation API**
   - Given I submit the run form with valid inputs
   - Then `POST /app/workflow-runs` creates a `WorkflowRunEntity` with status=QUEUED
   - The entity's `inputSnapshot` captures the full definition + user inputs
   - The run is enqueued via `WorkflowExecutionService.enqueueRun()`
   - The API returns the created run (id, status, createdAt)

10. **AC10: Asset Validation**
    - Given the run request references asset IDs
    - Then the backend validates each asset exists in the tenant's data vault
    - Returns 400 if any asset ID is invalid or doesn't belong to the tenant

11. **AC11: credits_per_run Column**
    - Given `WorkflowTemplateEntity` has a `credits_per_run` column (integer, default 1)
    - Then the catalog cards display the cost per run
    - The wizard Metadata step allows editing this field (Bubble Admin only)
    - The response DTO includes `creditsPerRun`

12. **AC12: Module Wiring Test**
    - Given `WorkflowRunsController` and `WorkflowRunsService` are added
    - Then module wiring tests verify DI resolution for the new providers

13. **AC13: E2E Regression**
    - Given all changes are complete
    - Then the existing E2E suite (46+ tests) still passes

## Tasks / Subtasks

- [x] **Task 1: Add `credits_per_run` to WorkflowTemplateEntity** (AC: 11)
  - [x] 1.1 Add `@Column({ name: 'credits_per_run', type: 'int', default: 1 })` to `WorkflowTemplateEntity`
  - [x] 1.2 Add `creditsPerRun` to `WorkflowTemplateResponseDto` with `@ApiProperty({ example: 1, default: 1 })`
  - [x] 1.3 Update `WorkflowTemplatesService.toResponse()` to include `creditsPerRun`
  - [x] 1.4 Add `creditsPerRun` to `CreateWorkflowTemplateDto` and `UpdateWorkflowTemplateDto` (optional, default 1)
  - [x] 1.5 Export updated DTO from `libs/shared`

- [x] **Task 2: Add Catalog Detail Endpoint** (AC: 2)
  - [x] 2.1 Add `GET /app/workflow-templates/:id` to `WorkflowCatalogController`
  - [x] 2.2 Reuse `WorkflowTemplatesService.findOne()` which already loads `currentVersion.definition`
  - [x] 2.3 Add `@ApiOperation`, `@ApiResponse` decorators
  - [x] 2.4 Add `@Param('id')` with UUID validation via `ParseUUIDPipe`

- [x] **Task 3: Create WorkflowRunsController + Service + DTOs** (AC: 9, 10)
  - [x] 3.1 Create `InitiateWorkflowRunDto` in `libs/shared/src/lib/dtos/workflow/`:
    ```typescript
    {
      templateId: string;  // @Matches UUID regex
      inputs: Record<string, {
        type: 'asset' | 'text';
        assetIds?: string[];
        text?: string;
      }>;
    }
    ```
  - [x] 3.2 Create `WorkflowRunResponseDto` in `libs/shared/src/lib/dtos/workflow/`:
    ```typescript
    {
      id: string;
      tenantId: string;
      versionId: string;
      status: string;
      startedBy: string;
      creditsConsumed: number;
      createdAt: Date;
    }
    ```
  - [x] 3.3 Create `WorkflowRunsService` at `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts`:
    - Inject `TransactionManager`, `WorkflowExecutionService`
    - `initiateRun(dto, tenantId, userId)`:
      1. Load template + current version (verify published, verify has definition)
      2. Validate required inputs against definition's `inputs[]`
      3. Validate asset IDs exist in tenant's data vault
      4. Create `WorkflowRunEntity` (status=QUEUED, startedBy=userId, versionId, inputSnapshot)
      5. Build `WorkflowJobPayload` from definition + inputs (translate DTO `type: 'asset'` → payload `type: 'file'` in contextInputs; leave subjectFile/subjectFiles undefined)
      6. Call `WorkflowExecutionService.enqueueRun(runEntity.id, payload)`
      7. Return `WorkflowRunResponseDto`
  - [x] 3.4 Create `WorkflowRunsController` at `apps/api-gateway/src/app/workflow-runs/workflow-runs.controller.ts`:
    - `@Controller('app/workflow-runs')`
    - `@UseGuards(JwtAuthGuard, TenantStatusGuard, RolesGuard)` — **Order: JWT → TenantStatus → Roles**
    - `@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)`
    - `POST /` — `initiateRun(@Body() dto, @Request() req)`
    - Full Swagger: `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` (201, 400, 401, 403)
  - [x] 3.5 Create `WorkflowRunsModule` — imports [WorkflowsModule, AssetsModule, WorkflowExecutionModule], exports nothing (controller only)
  - [x] 3.6 Register `WorkflowRunsModule` in `AppModule`

- [x] **Task 4: Frontend — WorkflowCatalogService** (AC: 1, 2, 9)
  - [x] 4.1 Create `apps/web/src/app/core/services/workflow-catalog.service.ts`
  - [x] 4.2 Methods: `listPublished()`, `getById(id)`, `submitRun(dto)`
  - [x] 4.3 Return `Observable<T>` from all methods (Rule 9)
  - [x] 4.4 Import shared DTOs from `@project-bubble/shared`

- [x] **Task 5: Frontend — WorkflowCatalogComponent** (AC: 1)
  - [x] 5.1 Create `apps/web/src/app/app/workflows/workflow-catalog.component.ts`
  - [x] 5.2 Card grid layout: name, description, tags (chips), credits badge, "Run" button
  - [x] 5.3 Call `WorkflowCatalogService.listPublished()` on init
  - [x] 5.4 "Run" button navigates to `/app/workflows/run/:templateId`
  - [x] 5.5 Empty state: "No workflows available" message
  - [x] 5.6 `data-testid` on: each card, each Run button, empty state container
  - [x] 5.7 Use `takeUntilDestroyed(this.destroyRef)` on all subscriptions (Rule 13)

- [x] **Task 6: Frontend — WorkflowRunFormComponent** (AC: 2-8)
  - [x] 6.1 Create `apps/web/src/app/app/workflows/workflow-run-form.component.ts`
  - [x] 6.2 Load template detail on init from route param `:templateId`
  - [x] 6.3 Parse `inputs[]` from `currentVersion.definition` to build dynamic form
  - [x] 6.4 For `source: ["asset"]` — render asset picker (dropdown calling existing `GET /app/assets`)
  - [x] 6.5 For `source: ["upload"]` — render file dropzone (upload via `POST /app/assets`, store returned asset ID)
  - [x] 6.6 For `source: ["text"]` — render textarea with placeholder/maxlength from `text_config`
  - [x] 6.7 For mixed sources `["asset", "upload"]` — render both with a toggle switch
  - [x] 6.8 Subject inputs (role: "subject") allow multi-file selection
  - [x] 6.9 Required field validation — disable submit until all required inputs filled
  - [x] 6.10 Submit builds `InitiateWorkflowRunDto`, calls `WorkflowCatalogService.submitRun()`
  - [x] 6.11 On success: show inline success message, navigate back to catalog after brief delay (no toast system — project doesn't have one)
  - [x] 6.12 On error: show error message (400 validation, 404 template not found)
  - [x] 6.13 `data-testid` on: every form field, submit button, error messages, toggle switches
  - [x] 6.14 Register any new Lucide icons needed in `app.config.ts`

- [x] **Task 7: Route Updates** (AC: 1, 2)
  - [x] 7.1 Update `app.routes.ts`: replace `ComingSoonComponent` at `/app/workflows` with `WorkflowCatalogComponent`
  - [x] 7.2 Add route `/app/workflows/run/:templateId` → `WorkflowRunFormComponent`
  - [x] 7.3 Both routes lazy-loaded via `loadComponent`

- [x] **Task 8: Backend Unit Tests** (AC: 1-11)
  - [x] 8.1 `WorkflowRunsService` tests (15):
    - initiateRun creates entity with status QUEUED
    - initiateRun calls enqueueRun with correct payload
    - initiateRun validates template is published (400 if not)
    - initiateRun validates template has currentVersion (400 if not)
    - initiateRun validates required inputs present (400 if missing)
    - initiateRun validates asset IDs exist in tenant vault (400 if not found)
    - initiateRun validates input types match definition (400 if mismatch)
    - initiateRun snapshots definition + inputs into inputSnapshot
    - initiateRun returns WorkflowRunResponseDto with correct fields
    - initiateRun uses TransactionManager.run(tenantId) for all operations
  - [x] 8.2 `WorkflowRunsController` tests (2):
    - POST / delegates to service
    - POST / returns 201 with run response
  - [x] 8.3 `WorkflowCatalogController` detail endpoint tests (2):
    - GET /:id returns template with currentVersion
    - GET /:id returns 404 for non-existent template
  - [x] 8.4 DTO validation tests — deferred (class-validator tested via integration; unit coverage via service validation tests)

- [x] **Task 9: Frontend Component Tests** (AC: 1-8)
  - [x] 9.1 `WorkflowCatalogComponent` tests (8):
    - Renders card grid from service data
    - Shows name, description, tags, credits badge on cards
    - Run button navigates to run form route
    - Empty state shown when no workflows
    - Loading state shown initially
    - Error state shown on failure
    - Tag extraction from definition metadata
    - data-testid attributes present
  - [x] 9.2 `WorkflowRunFormComponent` tests (10):
    - Renders asset picker for source: ["asset"] inputs
    - Renders file dropzone for source: ["upload"] inputs
    - Renders textarea for source: ["text"] inputs
    - Renders toggle for mixed source inputs
    - Submit disabled when required inputs empty
    - Submit calls service with correct DTO
    - Credits info displayed
    - Error state on template load failure
    - Source toggle helper methods
    - Template detail loading

- [x] **Task 10: Module Wiring + E2E Regression** (AC: 12, 13)
  - [x] 10.1 Add WorkflowRunsModule wiring test to `module-wiring.spec.ts`
  - [x] 10.2 Run full unit test suite — API 497 tests (46 suites), Web 482 tests (52 suites) — all pass
  - [x] 10.3 Run lint — 0 errors (both projects)
  - [x] 10.4 Run E2E suite — 46+ tests pass

## Dev Notes

### Architecture — New Module: WorkflowRuns

```
apps/api-gateway/src/app/workflow-runs/
├── workflow-runs.module.ts         ← Imports WorkflowExecutionModule
├── workflow-runs.controller.ts     ← POST /app/workflow-runs
├── workflow-runs.service.ts        ← Business logic: validate + create + enqueue
└── workflow-runs.service.spec.ts   ← Unit tests
    workflow-runs.controller.spec.ts
```

This is SEPARATE from `workflow-execution/` (Story 4-0). The execution module handles queue processing; the runs module handles HTTP request → entity creation → enqueue.

### Existing Code to Reuse — DO NOT REINVENT

| Component | Location | Usage |
|-----------|----------|-------|
| `WorkflowCatalogController` | `apps/api-gateway/src/app/workflows/workflow-catalog.controller.ts` | Add `GET /:id` detail endpoint |
| `WorkflowTemplatesService.findOne()` | `apps/api-gateway/src/app/workflows/workflow-templates.service.ts:120` | Loads template + currentVersion with definition |
| `WorkflowTemplatesService.findPublished()` | Same file, line 322 | Already used by catalog list |
| `WorkflowExecutionService.enqueueRun()` | `apps/api-gateway/src/app/workflow-execution/workflow-execution.service.ts` | Enqueues job with runId as BullMQ jobId |
| `WorkflowRunEntity` | `libs/db-layer/src/lib/entities/workflow-run.entity.ts` | All fields exist (status, inputSnapshot, startedBy, etc.) |
| `WorkflowDefinition` / `WorkflowInput` | `libs/shared/src/lib/types/workflow-definition.interface.ts` | Input role, source types, accept config, text_config |
| `WorkflowJobPayload` | `libs/shared/src/lib/types/workflow-job.interface.ts` | BullMQ job data structure |
| `AssetsService.findOne(id, tenantId)` | `apps/api-gateway/src/app/assets/assets.service.ts:138` | Server-side asset ID validation (throws 404 if not found) |
| `AssetsService.findAll(tenantId)` | Same file | Asset picker dropdown data source (frontend calls `GET /app/assets`) |
| Upload endpoint | `POST /app/assets` (existing) | File upload → returns asset ID (folderId optional, defaults to root) |

### WorkflowRunEntity — Already Exists (No Schema Changes Needed)

Entity has all required fields:
- `status` (QUEUED/RUNNING/COMPLETED/FAILED/CANCELLED)
- `startedBy` (UUID — the user who submitted)
- `versionId` (FK to workflow_versions)
- `inputSnapshot` (JSONB — full snapshot of definition + user inputs)
- `creditsConsumed` (int, default 0 — deferred to Story 4-4)
- `startedAt`, `completedAt`, `durationMs` (timing — filled by processor)

### inputSnapshot Structure

The `inputSnapshot` JSONB column captures the full run context at submission time:
```json
{
  "templateId": "uuid",
  "templateName": "Analyze Transcript",
  "versionId": "uuid",
  "versionNumber": 1,
  "definition": { "...full WorkflowDefinition..." },
  "userInputs": {
    "transcript": { "type": "asset", "assetIds": ["uuid1", "uuid2"] },
    "codebook": { "type": "asset", "assetIds": ["uuid3"] },
    "notes": { "type": "text", "text": "Focus on themes of leadership" }
  }
}
```

### WorkflowJobPayload Construction

The runs service builds the payload from the definition + user inputs:
```typescript
const payload: WorkflowJobPayload = {
  runId: runEntity.id,
  tenantId,
  versionId: version.id,
  definition: version.definition,
  contextInputs: {}, // Populated from user inputs with role: "context"
  // subjectFile/subjectFiles populated from user inputs with role: "subject"
};
```

**Payload population rules for Story 4-1** (processor is still a no-op placeholder):
- **`contextInputs`**: For each user input with `role: "context"`:
  - If `type: 'asset'` in DTO → create `{ type: 'file', assetId: '<uuid>' }` (translate 'asset' → 'file'). Leave `storagePath` and `content` empty — resolved in Story 4-2 (prompt assembly).
  - If `type: 'text'` in DTO → create `{ type: 'text', content: '<user text>' }`.
- **`subjectFile` / `subjectFiles`**: Leave **undefined**. Subject file resolution + per-file job creation happens in Story 4-3 (fan-out). The subject asset IDs are preserved in `inputSnapshot` for later retrieval.
- The `inputSnapshot` on the entity captures ALL user inputs (including subject asset IDs) as a permanent record.

### Upload Flow for source: ["upload"]

Frontend handles this transparently:
1. User drops file in dropzone
2. UI calls `POST /app/assets` (existing endpoint) → file saved to data vault
3. UI receives asset ID back
4. Asset ID stored in form state
5. On form submit, asset ID sent in `inputs[inputName].assetIds`

From the backend's perspective, ALL file inputs are asset IDs. The upload-vs-asset distinction is purely a UI concern.

### Guard Stack for WorkflowRunsController

```typescript
@UseGuards(JwtAuthGuard, TenantStatusGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)
```

**Order matters:** JWT first (authentication) → TenantStatus (is tenant active?) → Roles (authorization). This matches all other `/app/` controllers.

### Critical: TransactionManager for ALL Entity Operations

Per project-context.md Rule 2: Use `TransactionManager.run(tenantId, ...)` for ALL operations on tenant-scoped entities. This sets `SET LOCAL app.current_tenant` for RLS.

Per Rule 2c: Include `tenantId` in ALL WHERE clauses alongside primary key.

```typescript
// CORRECT
await this.txManager.run(tenantId, async (manager) => {
  const template = await manager.findOne(WorkflowTemplateEntity, {
    where: { id: templateId, tenantId },  // tenantId in WHERE
  });
});
```

### Critical: @IsUUID Prohibition

Per project-context.md Rule 27: Use `@Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)` for UUID validation in DTOs. Never use `@IsUUID()` (rejects seed/test UUIDs).

### Angular Patterns to Follow

1. **Standalone components** with `inject()` — no constructor injection (Rule 6)
2. **Signals** for component state — `signal()`, `computed()` (Rule 6)
3. **takeUntilDestroyed(this.destroyRef)** on ALL subscriptions (Rule 13)
4. **Observable returns** from service methods (Rule 9)
5. **data-testid** on all interactive elements (Rule 10)
6. **Lucide icons** registered in `app.config.ts` (see `memory/lucide-icon-bug.md`)
7. **Lazy-loaded routes** via `loadComponent` in `app.routes.ts`
8. **Custom SCSS** using design system variables — NO Material/PrimeNG (Rule 7)

### Frontend Route Structure

```
/app/workflows              → WorkflowCatalogComponent (replaces ComingSoonComponent)
/app/workflows/run/:templateId → WorkflowRunFormComponent
```

Both lazy-loaded. The app-layout nav item "Workflows" already points to `/app/workflows`.

### credits_per_run — Wizard Integration (Minimal Change)

The `credits_per_run` field is editable in the wizard Metadata step (Bubble Admin only). This is a **minimal UI change** — add ONE number input field (`<input type="number" min="1">`) to the existing metadata step component, below the existing fields. This is NOT a redesign of the wizard step.

**Note:** The CreateWorkflowTemplateDto already has optional fields. Adding `creditsPerRun?: number` with `@IsOptional()` and `@IsInt()` is straightforward.

### Out of Scope (Explicitly)

| Feature | Deferred To | Rationale |
|---------|-------------|-----------|
| Credit deduction at submission | Story 4-4 | Pre-flight validation story |
| Token budget check | Story 4-4 | Pre-flight validation story |
| `is_test_run` flag | Story 4-7 | Test run story |
| Cross-tenant template sharing | Phase 2 | RLS handles tenant isolation |
| Run status polling / live updates | Epic 5 | Report dashboard story |
| Output display / report view | Epic 5 | Report dashboard story |
| File content reading for payload | Story 4-2 | Prompt assembly story |
| Rate limiting on LLM calls | Story 4-2 | LLM provider interface |

### Previous Story Intelligence (4-0)

Key learnings from Story 4-0 to apply here:
- **TransactionManager.run(tenantId, ...)** is mandatory for background workers AND for services that operate on tenant-scoped entities
- **@OnWorkerEvent patterns** — the processor already handles status updates; the runs service just creates the initial QUEUED entity
- **Atomic transactions** — combine findOne + validation + create in a single transaction where possible
- **Structured logging** — use `{ message, runId, tenantId }` format
- **lockDuration in @Processor** — set in decorator options, not defaultJobOptions

### Project Structure Notes

- New backend files in `apps/api-gateway/src/app/workflow-runs/`
- New frontend files in `apps/web/src/app/app/workflows/`
- New DTOs in `libs/shared/src/lib/dtos/workflow/`
- Entity change: `libs/db-layer/src/lib/entities/workflow-template.entity.ts` (add column)
- DTO changes: `libs/shared/src/lib/dtos/workflow/workflow-template-response.dto.ts` (add field)
- Route changes: `apps/web/src/app/app.routes.ts`

### References

- [Source: workflow-catalog.controller.ts](apps/api-gateway/src/app/workflows/workflow-catalog.controller.ts) — Existing catalog controller
- [Source: workflow-templates.service.ts](apps/api-gateway/src/app/workflows/workflow-templates.service.ts) — findOne, findPublished, toResponse
- [Source: workflow-execution.service.ts](apps/api-gateway/src/app/workflow-execution/workflow-execution.service.ts) — enqueueRun
- [Source: workflow-run.entity.ts](libs/db-layer/src/lib/entities/workflow-run.entity.ts) — Entity schema
- [Source: workflow-template.entity.ts](libs/db-layer/src/lib/entities/workflow-template.entity.ts) — Add credits_per_run
- [Source: workflow-definition.interface.ts](libs/shared/src/lib/types/workflow-definition.interface.ts) — WorkflowInput, source types
- [Source: workflow-job.interface.ts](libs/shared/src/lib/types/workflow-job.interface.ts) — WorkflowJobPayload
- [Source: workflow-template-response.dto.ts](libs/shared/src/lib/dtos/workflow/workflow-template-response.dto.ts) — Add creditsPerRun
- [Source: app.routes.ts](apps/web/src/app/app.routes.ts) — Route updates (line 137-142)
- [Source: app.module.ts](apps/api-gateway/src/app/app.module.ts) — Register WorkflowRunsModule
- [Source: project-context.md](project-context.md) — Implementation rules
- [Source: epic-4-planning-2026-02-09.md](_bmad-output/implementation-artifacts/retrospectives/epic-4-planning-2026-02-09.md) — Planning decisions

## AC-to-Test Mapping

| AC | Test IDs | Description |
|----|----------|-------------|
| AC1 | 5.1-5.6 (frontend), 9.1 | Catalog card grid with name, description, tags, credits |
| AC2 | 2.1-2.4 (task), 8.3 | Catalog detail endpoint returns template with definition |
| AC3 | 6.4, 9.2a | Asset picker renders for source: ["asset"] |
| AC4 | 6.5, 9.2b | File dropzone renders for source: ["upload"] |
| AC5 | 6.6, 9.2c | Text area renders for source: ["text"] |
| AC6 | 6.7, 9.2d | Toggle for mixed source types |
| AC7 | 6.8 | Subject multi-file selection |
| AC8 | 6.9, 9.2e | Required field validation |
| AC9 | 8.1a-8.1j | Run initiation: create entity, enqueue, snapshot, response |
| AC10 | 8.1f | Asset ID validation |
| AC11 | 1.1-1.5, 8.1 | credits_per_run column + DTO + display |
| AC12 | 10.1 | Module wiring test |
| AC13 | 10.4 | E2E regression |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Code review found 8 issues (3H, 4M, 1L) — all fixed in post-review pass

### Completion Notes List

- H1: canSubmit computed signal never re-evaluated — added `inputStates.update(arr => [...arr])` after all mutations
- H2: @ValidateNested({ each: true }) doesn't iterate Record values — replaced with custom ValidateInputRecordConstraint
- H3: AC11 wizard metadata step missing creditsPerRun field — added form field + output + wizard wiring
- M1: setTimeout not cleaned up — added DestroyRef.onDestroy cleanup
- M2: onTextChange was no-op — now triggers signal refresh
- M3: max_size_mb not enforced in file upload — added size check before upload
- M4: workflow-chains.service.spec.ts modified but not in story file references
- L1: Dev Agent Record / File List was empty

### File List

**New files:**
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.module.ts`
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.controller.ts`
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.ts`
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.service.spec.ts`
- `apps/api-gateway/src/app/workflow-runs/workflow-runs.controller.spec.ts`
- `apps/web/src/app/app/workflows/workflow-catalog.component.ts`
- `apps/web/src/app/app/workflows/workflow-catalog.component.spec.ts`
- `apps/web/src/app/app/workflows/workflow-run-form.component.ts`
- `apps/web/src/app/app/workflows/workflow-run-form.component.spec.ts`
- `apps/web/src/app/core/services/workflow-catalog.service.ts`
- `libs/shared/src/lib/dtos/workflow/initiate-workflow-run.dto.ts`
- `libs/shared/src/lib/dtos/workflow/workflow-run-response.dto.ts`

**Modified files:**
- `apps/api-gateway/src/app/app.module.ts` — register WorkflowRunsModule
- `apps/api-gateway/src/app/workflows/workflow-catalog.controller.ts` — add GET /:id detail endpoint
- `apps/api-gateway/src/app/workflows/workflow-catalog.controller.spec.ts` — add detail endpoint tests
- `apps/api-gateway/src/app/workflows/workflow-templates.service.ts` — add creditsPerRun to toResponse()
- `apps/api-gateway/src/app/workflows/workflow-templates.service.spec.ts` — update for creditsPerRun
- `apps/api-gateway/src/app/workflows/workflow-templates.controller.spec.ts` — update for creditsPerRun
- `apps/api-gateway/src/app/workflows/workflow-chains.service.spec.ts` — fix mock alignment
- `apps/api-gateway/src/app/module-wiring.spec.ts` — add WorkflowRunsModule wiring
- `apps/web/src/app/app.routes.ts` — add catalog + run form routes
- `apps/web/src/app/component-wiring.spec.ts` — add catalog + run form wiring
- `apps/web/src/app/admin/workflows/wizard/steps/wizard-metadata-step.component.ts` — add creditsPerRun field
- `apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.ts` — add creditsPerRun signal + pass to create()
- `apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.html` — wire creditsPerRun bindings
- `libs/db-layer/src/lib/entities/workflow-template.entity.ts` — add credits_per_run column
- `libs/shared/src/lib/dtos/workflow/create-workflow-template.dto.ts` — add creditsPerRun
- `libs/shared/src/lib/dtos/workflow/update-workflow-template.dto.ts` — add creditsPerRun
- `libs/shared/src/lib/dtos/workflow/workflow-template-response.dto.ts` — add creditsPerRun
- `libs/shared/src/lib/dtos/workflow/index.ts` — export new DTOs
