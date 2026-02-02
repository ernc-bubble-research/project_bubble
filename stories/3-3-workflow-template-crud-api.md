# Story 3.3: Workflow Template CRUD API

Status: done

## Story

As a **Bubble Admin**,
I want API endpoints to create, read, update, list, and soft-delete workflow templates (with versioned definitions) and to list/manage LLM models,
so that the Workflow Studio UI (Story 3.2) can persist and manage workflow definitions, and tenants can discover available models.

## CRITICAL CONTEXT

> **The original Epic 3 stories in epics.md are OBSOLETE for node-based references.** They reference "nodes", "graph steps" — NONE of this exists. The party mode architectural pivot (2026-02-01) replaced the node-based architecture with **atomic workflows** (single LLM call, YAML-as-prompt). The **tech spec** (`_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md`) is the **ONLY authoritative reference** for Epic 3 implementation.

> **Story 3.1 (Data Foundation) is DONE.** All entities, DTOs, TypeScript interfaces, validators, RLS policies, and seed data are in place. This story builds NestJS services and controllers on top of that foundation.

> **This story is backend-only — NO Angular UI.** The UI is Story 3.2 (Workflow Builder Wizard).

## Acceptance Criteria

1. **Given** an authenticated Bubble Admin, **when** I call `POST /admin/workflow-templates` with `{ name, description?, visibility? }`, **then** a WorkflowTemplate record is created with `status=draft`, `visibility=public` (default), and the template ID is returned.

2. **Given** a created template, **when** I call `POST /admin/workflow-templates/:id/versions` with a `{ definition }` object, **then** a WorkflowVersion (v1) is created with the definition JSONB, and the template's `currentVersionId` is updated to point to this version.

3. **Given** a template with v1, **when** I call `POST /admin/workflow-templates/:id/versions` with a new definition, **then** a new version (v2) is created with `versionNumber` auto-incremented, and the template's `currentVersionId` is updated to v2.

4. **Given** a version creation request with an invalid definition, **when** the schema validator runs, **then** the API returns `400 Bad Request` with detailed validation error messages from `validateWorkflowDefinition()`.

5. **Given** an authenticated Bubble Admin, **when** I call `GET /admin/workflow-templates`, **then** I receive a paginated list of templates (respecting RLS — admin sees all via custom policy), with optional filtering by `status` and `visibility`.

6. **Given** a template ID, **when** I call `GET /admin/workflow-templates/:id`, **then** I receive the template with its current version's definition embedded.

7. **Given** a template ID, **when** I call `PATCH /admin/workflow-templates/:id` with `{ name?, description?, status?, visibility?, allowedTenants? }`, **then** the template metadata is updated (NOT the definition — definitions are versioned separately).

8. **Given** a template ID, **when** I call `DELETE /admin/workflow-templates/:id`, **then** the template is soft-deleted (sets `deletedAt` timestamp via TypeORM `@DeleteDateColumn`).

9. **Given** a template ID, **when** I call `GET /admin/workflow-templates/:id/versions`, **then** I receive a list of all versions for that template, ordered by `versionNumber DESC`.

10. **Given** an authenticated user (any role), **when** I call `GET /app/llm-models`, **then** I receive a list of active LLM models (from the system-wide `llm_models` table, `isActive=true` only).

11. **Given** an authenticated Bubble Admin, **when** I call `POST /admin/llm-models` with model data, **then** a new LLM model record is created in the system-wide table.

12. **Given** all endpoints, **then** each has complete Swagger documentation (`@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse` for 200/201/400/401/403/404).

13. **Given** all template/version endpoints, **then** they use `TransactionManager` for tenant-scoped operations. LLM model endpoints use direct `Repository` injection (no tenant scoping — documented exemption).

## Tasks / Subtasks

- [x] Task 1: Create WorkflowTemplatesService (AC: #1, #2, #3, #4, #6, #7, #8, #13)
  - [x] 1.1 Create `apps/api-gateway/src/app/workflows/workflow-templates.service.ts`
  - [x] 1.2 Inject `TransactionManager` — all operations via `txManager.run(tenantId, ...)`
  - [x] 1.3 `create(dto, tenantId, userId)` — creates template with `status: 'draft'`, `createdBy: userId`
  - [x] 1.4 `findAll(tenantId, query)` — paginated list with `limit`/`offset`, optional `status`/`visibility` filters, uses QueryBuilder with `.take()`/`.skip()`
  - [x] 1.5 `findOne(id, tenantId)` — returns template with `currentVersion` relation loaded, throws `NotFoundException` if not found
  - [x] 1.6 `update(id, tenantId, dto)` — partial update of metadata fields only (name, description, status, visibility, allowedTenants)
  - [x] 1.7 `softDelete(id, tenantId)` — uses `manager.softDelete(WorkflowTemplateEntity, id)` via `@DeleteDateColumn`
  - [x] 1.8 `restore(id, tenantId)` — uses `manager.restore(WorkflowTemplateEntity, id)` — requires `withDeleted()` to find
  - [x] 1.9 Private `toResponse(entity)` method mapping entity to `WorkflowTemplateResponseDto`. When the `currentVersion` relation is loaded (e.g., `findOne`), populate the nested `currentVersion` field in the response DTO.

- [x] Task 2: Create WorkflowVersionsService (AC: #2, #3, #4, #9, #13)
  - [x] 2.1 Create `apps/api-gateway/src/app/workflows/workflow-versions.service.ts`
  - [x] 2.2 Inject `TransactionManager`
  - [x] 2.3 `createVersion(dto, tenantId, userId)` — in a SINGLE transaction: (a) validate definition via `validateWorkflowDefinition()`, (b) verify template exists and belongs to tenant, (c) calculate next `versionNumber` via `MAX(version_number) + 1` query, (d) create version record, (e) update template's `currentVersionId`
  - [x] 2.4 `findAllByTemplate(templateId, tenantId)` — list versions for a template, ordered `versionNumber DESC`
  - [x] 2.5 `findOne(id, tenantId)` — get single version by ID
  - [x] 2.6 Private `toResponse(entity)` method

- [x] Task 3: Create LlmModelsService (AC: #10, #11, #13)
  - [x] 3.1 Create `apps/api-gateway/src/app/workflows/llm-models.service.ts`
  - [x] 3.2 Inject `Repository<LlmModelEntity>` directly (NOT TransactionManager — documented exemption, no tenant_id, no RLS)
  - [x] 3.3 `findAllActive()` — returns models where `isActive=true`, ordered by `displayName`
  - [x] 3.4 `findAll()` — returns all models (admin view, includes inactive)
  - [x] 3.5 `create(dto)` — creates new model, handles `23505` unique constraint error (duplicate provider_key + model_id)
  - [x] 3.6 `update(id, dto)` — partial update (toggle isActive, update costs, etc.)
  - [x] 3.7 Private `toResponse(entity)` method

- [x] Task 4: Create WorkflowTemplatesController (AC: #1, #5, #6, #7, #8, #12)
  - [x] 4.1 Create `apps/api-gateway/src/app/workflows/workflow-templates.controller.ts`
  - [x] 4.2 Class decorators: `@ApiTags('Admin - Workflow Templates')`, `@ApiBearerAuth()`, `@Controller('admin/workflow-templates')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.BUBBLE_ADMIN)`
  - [x] 4.3 `POST /` — create template. Extract `tenantId` and `userId` from `req.user`
  - [x] 4.4 `GET /` — list templates. Accept `@Query() query: ListWorkflowTemplatesQueryDto`
  - [x] 4.5 `GET /:id` — get template with current version. `@Param('id', ParseUUIDPipe)`
  - [x] 4.6 `PATCH /:id` — update template metadata
  - [x] 4.7 `DELETE /:id` — soft-delete template
  - [x] 4.8 `POST /:id/restore` — restore soft-deleted template
  - [x] 4.9 Full `@ApiResponse` decorators on every method (200/201, 400, 401, 403, 404)

- [x] Task 5: Create WorkflowVersionsController (AC: #2, #3, #4, #9, #12)
  - [x] 5.1 Create `apps/api-gateway/src/app/workflows/workflow-versions.controller.ts`
  - [x] 5.2 Class decorators: `@ApiTags('Admin - Workflow Versions')`, `@ApiBearerAuth()`, `@Controller('admin/workflow-templates/:templateId/versions')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(UserRole.BUBBLE_ADMIN)`
  - [x] 5.3 `POST /` — create version (includes schema validation). Template ID from `@Param('templateId', ParseUUIDPipe)`. Request body uses `CreateWorkflowVersionBodyDto` (just `{ definition }` — NO `templateId` in body). Service receives `templateId` from URL param + `definition` from body separately.
  - [x] 5.4 `GET /` — list versions for template
  - [x] 5.5 `GET /:versionId` — get specific version
  - [x] 5.6 Full `@ApiResponse` decorators

- [x] Task 6: Create LlmModelsController (AC: #10, #11, #12)
  - [x] 6.1 Create `apps/api-gateway/src/app/workflows/llm-models.controller.ts`
  - [x] 6.2 Two controller classes in same file OR separate files:
    - `AppLlmModelsController` — `@Controller('app/llm-models')`, `@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)` — read-only `GET /` returns active models only
    - `AdminLlmModelsController` — `@Controller('admin/llm-models')`, `@Roles(UserRole.BUBBLE_ADMIN)` — full CRUD: `GET /` (all models), `POST /`, `PATCH /:id`
  - [x] 6.3 Full `@ApiResponse` decorators

- [x] Task 7: Create ListWorkflowTemplatesQueryDto (AC: #5)
  - [x] 7.1 Create `libs/shared/src/lib/dtos/workflow/list-workflow-templates-query.dto.ts`
  - [x] 7.2 Fields: `limit` (optional, default 50, max 200), `offset` (optional, default 0), `status` (optional, enum: draft/published/archived), `visibility` (optional, enum: public/private)
  - [x] 7.3 Follow existing `ListAssetsQueryDto` pattern: `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min()`, `@Max()`
  - [x] 7.4 Export from `libs/shared/src/lib/dtos/workflow/index.ts`

- [x] Task 7b: Create CreateWorkflowVersionBodyDto (AC: #2, #3)
  - [x] 7b.1 Create `libs/shared/src/lib/dtos/workflow/create-workflow-version-body.dto.ts`
  - [x] 7b.2 Fields: `definition` (required, `@IsObject()`, `@IsNotEmpty()`). This DTO is used by the HTTP endpoint `POST /admin/workflow-templates/:templateId/versions` — the `templateId` comes from the URL param, NOT the body.
  - [x] 7b.3 The existing `CreateWorkflowVersionDto` (with `templateId` + `definition`) is kept for programmatic/internal use by the service layer.
  - [x] 7b.4 Export from `libs/shared/src/lib/dtos/workflow/index.ts`

- [x] Task 7c: Create UpdateLlmModelDto (AC: #11)
  - [x] 7c.1 Create `libs/shared/src/lib/dtos/workflow/update-llm-model.dto.ts`
  - [x] 7c.2 Partial of `CreateLlmModelDto` — all fields optional: `displayName?`, `contextWindow?`, `maxOutputTokens?`, `isActive?`, `costPer1kInput?`, `costPer1kOutput?`. Do NOT allow changing `providerKey` or `modelId` (these form the unique constraint).
  - [x] 7c.3 Export from `libs/shared/src/lib/dtos/workflow/index.ts`

- [x] Task 8: Create WorkflowsModule (AC: all)
  - [x] 8.1 Create `apps/api-gateway/src/app/workflows/workflows.module.ts`
  - [x] 8.2 `imports: [TypeOrmModule.forFeature([WorkflowTemplateEntity, WorkflowVersionEntity, LlmModelEntity])]`
  - [x] 8.3 Register all 3 services + all controllers
  - [x] 8.4 Export services for future use by other modules (execution engine in Epic 4)
  - [x] 8.5 Register WorkflowsModule in `app.module.ts` imports

- [x] Task 9: Unit Tests — Services (AC: all)
  - [x] 9.1 Create `apps/api-gateway/src/app/workflows/workflow-templates.service.spec.ts`
    - [3.3-UNIT-001] create: valid input -> template created with draft status
    - [3.3-UNIT-002] create: duplicate name handling (should NOT throw — names are not unique)
    - [3.3-UNIT-003] findAll: returns paginated results respecting limit/offset
    - [3.3-UNIT-004] findAll: filters by status
    - [3.3-UNIT-005] findAll: filters by visibility
    - [3.3-UNIT-006] findOne: returns template with currentVersion loaded
    - [3.3-UNIT-007] findOne: not found -> NotFoundException
    - [3.3-UNIT-008] update: partial update of name/description/status
    - [3.3-UNIT-009] update: not found -> NotFoundException
    - [3.3-UNIT-010] softDelete: sets deletedAt
    - [3.3-UNIT-011] softDelete: not found -> NotFoundException
    - [3.3-UNIT-012] restore: restores soft-deleted template
  - [x] 9.2 Create `apps/api-gateway/src/app/workflows/workflow-versions.service.spec.ts`
    - [3.3-UNIT-013] createVersion: valid definition -> version created, template currentVersionId updated
    - [3.3-UNIT-014] createVersion: auto-increments versionNumber (v1 -> v2 -> v3)
    - [3.3-UNIT-015] createVersion: invalid definition -> BadRequestException with validation errors
    - [3.3-UNIT-016] createVersion: template not found -> NotFoundException
    - [3.3-UNIT-017] findAllByTemplate: returns versions ordered by versionNumber DESC
    - [3.3-UNIT-018] findOne: returns version by ID
    - [3.3-UNIT-019] findOne: not found -> NotFoundException
  - [x] 9.3 Create `apps/api-gateway/src/app/workflows/llm-models.service.spec.ts`
    - [3.3-UNIT-020] findAllActive: returns only active models
    - [3.3-UNIT-021] findAll: returns all models including inactive
    - [3.3-UNIT-022] create: valid input -> model created
    - [3.3-UNIT-023] create: duplicate provider_key+model_id -> ConflictException
    - [3.3-UNIT-024] update: toggles isActive

- [x] Task 10: Unit Tests — Controllers (AC: all)
  - [x] 10.1 Create `apps/api-gateway/src/app/workflows/workflow-templates.controller.spec.ts`
    - [3.3-UNIT-025] POST / delegates to service.create with correct args
    - [3.3-UNIT-026] GET / delegates to service.findAll with query params
    - [3.3-UNIT-027] GET /:id delegates to service.findOne
    - [3.3-UNIT-028] PATCH /:id delegates to service.update
    - [3.3-UNIT-029] DELETE /:id delegates to service.softDelete
    - [3.3-UNIT-030] POST /:id/restore delegates to service.restore
  - [x] 10.2 Create `apps/api-gateway/src/app/workflows/workflow-versions.controller.spec.ts`
    - [3.3-UNIT-031] POST / delegates to service.createVersion
    - [3.3-UNIT-032] GET / delegates to service.findAllByTemplate
    - [3.3-UNIT-033] GET /:versionId delegates to service.findOne
  - [x] 10.3 Create `apps/api-gateway/src/app/workflows/llm-models.controller.spec.ts`
    - [3.3-UNIT-034] GET /app/llm-models returns active models only
    - [3.3-UNIT-035] GET /admin/llm-models returns all models
    - [3.3-UNIT-036] POST /admin/llm-models creates model
    - [3.3-UNIT-037] PATCH /admin/llm-models/:id updates model

- [x] Task 11: Unit Tests — ListWorkflowTemplatesQueryDto (AC: #5)
  - [x] 11.1 Add to existing `workflow.dto.spec.ts` or create new file if approaching 300-line limit
    - [3.3-UNIT-038] valid query with all fields -> passes
    - [3.3-UNIT-039] empty query (all defaults) -> passes
    - [3.3-UNIT-040] invalid status enum -> returns error
    - [3.3-UNIT-041] limit exceeding max (>200) -> returns error
    - [3.3-UNIT-042] negative offset -> returns error

- [x] Task 12: Verify full test suite & lint (AC: all)
  - [x] 12.1 Run all tests across all 4 projects: `npx nx run-many -t test --all`
  - [x] 12.2 Run lint across all 4 projects: `npx nx run-many -t lint --all`
  - [x] 12.3 Report complete metrics: tests, lint errors, AND lint warnings per project

## Dev Notes

### Architecture Patterns to Follow

- **Service pattern:** Inject `TransactionManager`, wrap all DB operations in `txManager.run(tenantId, ...)`. Use `manager.find()`, `manager.findOne()`, `manager.create()`, `manager.save()`, `manager.softDelete()`, `manager.restore()`. See `apps/api-gateway/src/app/users/users.service.ts` for reference.
- **Controller pattern:** Class-level `@ApiTags()`, `@ApiBearerAuth()`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles()`. Method-level `@ApiOperation()`, `@ApiResponse()`. Extract `tenantId` and `userId` from `req.user`. See `apps/api-gateway/src/app/assets/assets.controller.ts`.
- **Module pattern:** `TypeOrmModule.forFeature([...entities])` in imports, export services. See `apps/api-gateway/src/app/assets/assets.module.ts`.
- **List query pattern:** Follow `libs/shared/src/lib/dtos/asset/list-assets-query.dto.ts` — `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min()`, `@Max()`, `@ApiPropertyOptional()`.
- **Controller test pattern:** Direct constructor instantiation: `controller = new MyController(mockService as any)`. Per `project-context.md` testing rules.
- **Service test pattern:** Mock `TransactionManager` — mock `txManager.run` to call the callback with a mock `EntityManager`. Mock `manager.find()`, `manager.findOne()`, `manager.save()`, etc.
- **Response DTO mapping:** Private `toResponse(entity)` method in service that manually maps entity to DTO. See `UsersService.toResponse()`.
- **LlmModel exemption:** `LlmModelService` injects `Repository<LlmModelEntity>` directly — NO TransactionManager. This is a documented exemption in `project-context.md` because `llm_models` has no `tenant_id` and no RLS.

### Critical Implementation Details

1. **Version creation is a multi-step transaction.** Within a single `txManager.run()`: validate definition, find template, calculate next version number, create version, update template's `currentVersionId`. If any step fails, the entire transaction rolls back.

2. **Schema validation on version creation.** Call `validateWorkflowDefinition(dto.definition)` from `libs/shared/src/lib/validators/workflow-schema.validator.ts`. If validation fails, throw `BadRequestException` with the error array. Import path: `@project-bubble/shared` → `validateWorkflowDefinition`.

3. **Soft-delete via `@DeleteDateColumn`.** WorkflowTemplateEntity uses `@DeleteDateColumn({ name: 'deleted_at' })`. Use `manager.softDelete(WorkflowTemplateEntity, { id, tenantId })` — TypeORM automatically sets `deleted_at`. All `find*` queries automatically filter `WHERE deleted_at IS NULL`. To find soft-deleted records (for restore), use `manager.findOne(WorkflowTemplateEntity, { where: { id }, withDeleted: true })`.

4. **Pagination via QueryBuilder.** For list endpoints, use `manager.createQueryBuilder(Entity, 'alias').take(limit).skip(offset).orderBy(...)` with conditional `.andWhere()` for filters. Return the array directly (no total count for MVP — add if needed). **⚠️ CRITICAL:** `QueryBuilder` does NOT auto-filter `@DeleteDateColumn` soft-deleted records like `find*()` methods do. You MUST add explicit `.andWhere('alias.deleted_at IS NULL')` to ALL QueryBuilder queries on `WorkflowTemplateEntity`. Alternatively, use `manager.find(WorkflowTemplateEntity, { where: {...}, take, skip })` which auto-filters — but this is less flexible for dynamic filters.

5. **`req.user` shape.** From `JwtAuthGuard`: `req.user = { userId: string, tenantId: string, role: string, email: string }`. The `tenantId` comes from JWT payload. For admin requests, this is the admin's own tenant. RLS custom policy on `workflow_templates` handles visibility (admin sees their own + public templates). **⚠️ VERIFY:** Check existing controllers (e.g., `assets.controller.ts`, `users.controller.ts`) for whether they use `req.user.userId` (camelCase) or `req.user.user_id` (snake_case). Some controllers use different conventions — be consistent with the JWT strategy's actual output.

6. **Version number auto-increment.** Query `SELECT MAX(version_number) FROM workflow_versions WHERE template_id = :templateId` within the transaction. If null (first version), start at 1.

7. **currentVersionId update.** When creating a new version, always update the template's `currentVersionId` to the new version's ID. This means the latest version is always the "current" one. Explicit rollback (Story 3.4) will allow changing this pointer.

8. **Admin endpoint paths.** Templates and versions use `/admin/workflow-templates` prefix (Bubble Admin only). LLM models have two paths: `/app/llm-models` (all authenticated users, read-only active models) and `/admin/llm-models` (Bubble Admin, full CRUD).

### Entities Already Available (from Story 3.1)

```
libs/db-layer/src/lib/entities/
  workflow-template.entity.ts  — WorkflowTemplateEntity, WorkflowTemplateStatus, WorkflowVisibility
  workflow-version.entity.ts   — WorkflowVersionEntity
  workflow-chain.entity.ts     — WorkflowChainEntity (NOT used in this story)
  workflow-run.entity.ts       — WorkflowRunEntity (NOT used in this story)
  llm-model.entity.ts          — LlmModelEntity
```

### DTOs Already Available (from Story 3.1)

```
libs/shared/src/lib/dtos/workflow/
  create-workflow-template.dto.ts  — name (required), description (optional), visibility (optional)
  update-workflow-template.dto.ts  — all optional: name, description, visibility, allowedTenants, status
  workflow-template-response.dto.ts  — ⚠️ MUST BE EXTENDED: add optional `currentVersion?: WorkflowVersionResponseDto` field for `GET /:id` responses
  create-workflow-version.dto.ts   — templateId (required UUID), definition (required object) — kept for programmatic use
  create-workflow-version-body.dto.ts — ⚠️ NEW: just `{ definition }` — for HTTP endpoint (templateId comes from URL param)
  workflow-version-response.dto.ts
  create-llm-model.dto.ts          — providerKey, modelId, displayName, contextWindow, maxOutputTokens, isActive?, cost fields?
  update-llm-model.dto.ts          — ⚠️ NEW: all fields optional except providerKey/modelId (immutable unique constraint)
  llm-model-response.dto.ts
```

### Shared Validator Already Available (from Story 3.1)

```
libs/shared/src/lib/validators/workflow-schema.validator.ts
  export function validateWorkflowDefinition(definition: WorkflowDefinition): ValidationResult
  // Returns { valid: boolean, errors: string[] }
```

### Previous Story Learnings (from Story 3.1)

- **`@DeleteDateColumn` behavior:** `.softDelete(id)` sets `deleted_at` automatically. All `find*` queries filter `WHERE deleted_at IS NULL`. Use `withDeleted: true` to include soft-deleted.
- **RLS custom policy on templates:** Templates with `visibility='public'` are visible to ALL tenants. The admin's tenant owns the template (`tenant_id`), but any tenant can READ public templates. This is enforced by the custom `template_access` RLS policy — services don't need to manually check visibility.
- **`tags` field was REMOVED** from DTOs during code review — not in tech spec §6.1. Do NOT add tags to any API endpoint.
- **`credits_consumed` is INTEGER** (not decimal). Changed during code review.
- **`input_snapshot` is NOT NULL** on WorkflowRunEntity. Not relevant for this story but important context.
- **PROCESS RULE:** Present code review findings BEFORE fixing. User chooses action per finding.
- **NO "acceptable for MVP" language.** Quality bar is production-grade.
- **BDD test format (Epic 3+):** Use Given/When/Then comments in test bodies.
- **Test ID format:** `[3.3-UNIT-XXX]` with `[P0]`-`[P3]` priority markers.

### Project Structure Notes

New files to create:
```
apps/api-gateway/src/app/workflows/
  workflows.module.ts                          (NEW)
  workflow-templates.service.ts                (NEW)
  workflow-templates.controller.ts             (NEW)
  workflow-templates.service.spec.ts           (NEW)
  workflow-templates.controller.spec.ts        (NEW)
  workflow-versions.service.ts                 (NEW)
  workflow-versions.controller.ts              (NEW)
  workflow-versions.service.spec.ts            (NEW)
  workflow-versions.controller.spec.ts         (NEW)
  llm-models.service.ts                        (NEW)
  llm-models.controller.ts                     (NEW)
  llm-models.service.spec.ts                   (NEW)
  llm-models.controller.spec.ts                (NEW)

libs/shared/src/lib/dtos/workflow/
  list-workflow-templates-query.dto.ts          (NEW)
  create-workflow-version-body.dto.ts           (NEW)
  update-llm-model.dto.ts                       (NEW)
  index.ts                                      (MODIFY — add 3 new exports)

libs/shared/src/lib/dtos/workflow/
  workflow-template-response.dto.ts             (MODIFY — add optional currentVersion field)

apps/api-gateway/src/app/
  app.module.ts                                 (MODIFY — add WorkflowsModule import)
```

### References

- [Tech Spec §6.1: WorkflowTemplateEntity](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [Tech Spec §6.2: WorkflowVersionEntity](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [Tech Spec §5.4: LLM Model Management](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [Tech Spec §6.6: RLS Registration](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [project-context.md §2: RLS & TransactionManager Rules](../../project-context.md)
- [project-context.md §2b: LlmModelService Exemption](../../project-context.md)
- [Story 3.1: Data Foundation](./3-1-workflow-definition-data-foundation.md)
- [UsersService pattern](../../apps/api-gateway/src/app/users/users.service.ts)
- [AssetsController pattern](../../apps/api-gateway/src/app/assets/assets.controller.ts)
- [ListAssetsQueryDto pattern](../../libs/shared/src/lib/dtos/asset/list-assets-query.dto.ts)
- [Schema validator](../../libs/shared/src/lib/validators/workflow-schema.validator.ts)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- All 12 tasks + subtasks 7b, 7c completed
- 47 new tests added (38 api-gateway, 9 shared)
- Total test count: 500 (was 453)
- 0 lint errors introduced; fixed 2 non-null assertion warnings in spec file
- `req.user` verified: `tenant_id` (snake_case), `userId` (camelCase) — consistent with existing controllers
- QueryBuilder soft-delete: explicit `deleted_at IS NULL` added to all QueryBuilder queries per story dev notes
- LlmModelsService uses direct Repository injection (no TransactionManager) — documented exemption
- Two-controller pattern for LLM models: AppLlmModelsController (all roles, active only) + AdminLlmModelsController (admin, full CRUD)
- CreateWorkflowVersionBodyDto created for HTTP endpoint; existing CreateWorkflowVersionDto kept for programmatic use
- Version auto-increment uses MAX(version_number) + 1 within transaction

### Code Review Fixes (6 issues found, all fixed)

**HIGH:**
- H1: Added 23505 unique constraint catch in `createVersion()` → `ConflictException` with retry message (prevents unhandled 500 on concurrent version creation)
- H2: Added template existence check in `findAllByTemplate()` → `NotFoundException` (distinguishes "0 versions" from "template doesn't exist")
- H3: Added runtime enum validation via `parseVisibility()` and `parseStatus()` private methods in `WorkflowTemplatesService` — uses `Object.values()` check instead of compile-time `as` casts. Safe for programmatic Epic 4 calls.

**MEDIUM:**
- M1: Defense-in-depth `tenantId` added to all `findOne`, `softDelete`, and `restore` WHERE clauses in `WorkflowTemplatesService` (not relying solely on RLS)
- M2: Added `[P1]` priority marker to DTO test `describe` block in `workflow-query.dto.spec.ts`

**LOW:**
- L1: Added `@HttpCode(204)` to DELETE endpoint in `WorkflowTemplatesController`, updated `@ApiResponse` status from 200 to 204

**Post-review metrics:** 504 tests (was 500, +4 new), 0 lint errors, 79 warnings (all pre-existing)

### File List

**NEW files (16):**
- `apps/api-gateway/src/app/workflows/workflow-templates.service.ts`
- `apps/api-gateway/src/app/workflows/workflow-templates.controller.ts`
- `apps/api-gateway/src/app/workflows/workflow-templates.service.spec.ts`
- `apps/api-gateway/src/app/workflows/workflow-templates.controller.spec.ts`
- `apps/api-gateway/src/app/workflows/workflow-versions.service.ts`
- `apps/api-gateway/src/app/workflows/workflow-versions.controller.ts`
- `apps/api-gateway/src/app/workflows/workflow-versions.service.spec.ts`
- `apps/api-gateway/src/app/workflows/workflow-versions.controller.spec.ts`
- `apps/api-gateway/src/app/workflows/llm-models.service.ts`
- `apps/api-gateway/src/app/workflows/llm-models.controller.ts`
- `apps/api-gateway/src/app/workflows/llm-models.service.spec.ts`
- `apps/api-gateway/src/app/workflows/llm-models.controller.spec.ts`
- `apps/api-gateway/src/app/workflows/workflows.module.ts`
- `libs/shared/src/lib/dtos/workflow/list-workflow-templates-query.dto.ts`
- `libs/shared/src/lib/dtos/workflow/create-workflow-version-body.dto.ts`
- `libs/shared/src/lib/dtos/workflow/update-llm-model.dto.ts`

**NEW test file (1):**
- `libs/shared/src/lib/dtos/workflow/workflow-query.dto.spec.ts`

**MODIFIED files (3):**
- `libs/shared/src/lib/dtos/workflow/workflow-template-response.dto.ts` — added `currentVersion?: WorkflowVersionResponseDto`
- `libs/shared/src/lib/dtos/workflow/index.ts` — added 3 new DTO exports
- `apps/api-gateway/src/app/app.module.ts` — added WorkflowsModule import
