# Story 3.1: Workflow Definition Data Foundation

Status: done

## Story

As a **Bubble Admin**,
I want the platform to have a complete data layer for workflow definitions (entities, DTOs, types, validators, RLS policies),
so that the Workflow Builder UI (Story 3.2+) and Execution Engine (Epic 4) have a solid, type-safe, schema-validated foundation to build on.

## CRITICAL CONTEXT

> **The original Epic 3 stories in epics.md are OBSOLETE.** They reference "nodes", "graph steps", "Agent/Tool/Reviewer types", "Scanner node", "Rule Builder" — NONE of this exists. The party mode architectural pivot (2026-02-01) replaced the node-based architecture with **atomic workflows** (single LLM call, YAML-as-prompt). The **tech spec** (`_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md`) is the **ONLY authoritative reference** for Epic 3 implementation.

> **Story 3.1 is the data foundation only — NO UI.** It creates the entities, types, DTOs, validators, and RLS policies that all subsequent Epic 3 and Epic 4 stories depend on.

## Acceptance Criteria (from Tech Spec)

1. **Given** the 5 new entity files are created, **when** the API gateway starts with `synchronize: true`, **then** all 5 tables are auto-created in PostgreSQL with correct columns, types, constraints, and indexes.

2. **Given** a valid `WorkflowDefinition` TypeScript object (matching tech spec §1.1), **when** stored as JSONB in `workflow_versions.definition`, **then** it can be retrieved and reconstructed without data loss.

3. **Given** a workflow definition with inputs, **when** the schema validator runs, **then** it confirms: exactly 1 subject input, all required fields present, valid enum values, unique input names, prompt contains all `{input_name}` variables, output format/sections are correctly configured.

4. **Given** an invalid workflow definition (0 subject inputs, or 2 subject inputs, or missing required fields), **when** the schema validator runs, **then** it returns detailed, actionable error messages.

5. **Given** the `workflow_templates` and `workflow_chains` tables exist, **when** RLS is enabled, **then** custom policies allow access when `tenant_id = current_tenant OR visibility = 'public' OR current_tenant = ANY(allowed_tenants)`.

6. **Given** the `workflow_versions` and `workflow_runs` tables exist, **when** RLS is enabled, **then** standard `tenant_isolation` policies are applied.

7. **Given** the `llm_models` table exists, **then** it has NO RLS policy and NO `tenant_id` column (system-wide table).

8. **Given** the `AssetEntity` is updated, **when** existing assets are queried, **then** they have `source_type = 'user_upload'` (default) and `workflow_run_id = NULL`.

9. **Given** all workflow DTOs are created, **when** validated via `plainToInstance + validate`, **then** they enforce all field constraints (required, type, length, enum values).

10. **Given** the `LlmModelEntity` seed data, **when** the API gateway starts in development mode, **then** 5 initial models are seeded (as defined in tech spec §5.4).

## Tasks / Subtasks

- [x] Task 1: Create WorkflowTemplateEntity (AC: #1, #5)
  - [x]1.1 Create `libs/db-layer/src/lib/entities/workflow-template.entity.ts`
  - [x]1.2 Define `WorkflowTemplateStatus` enum: `draft`, `published`, `archived`
  - [x]1.3 Define `WorkflowVisibility` enum: `public`, `private`
  - [x]1.4 Columns per tech spec §6.1: id, tenant_id, name, description, visibility, allowed_tenants (UUID[]), status, current_version_id, created_by, created_at, updated_at, deleted_at
  - [x]1.5 Use `@DeleteDateColumn({ name: 'deleted_at' })` (NOT raw `@Column`) per party mode review
  - [x]1.6 Add `@Index(['status', 'visibility'])` composite index
  - [x]1.7 `allowed_tenants` as `@Column({ type: 'uuid', array: true, nullable: true })`

- [x]Task 2: Create WorkflowVersionEntity (AC: #1, #2)
  - [x]2.1 Create `libs/db-layer/src/lib/entities/workflow-version.entity.ts`
  - [x]2.2 Columns per tech spec §6.2: id, tenant_id, template_id (FK), version_number, definition (JSONB), created_by, created_at
  - [x]2.3 `@Unique(['templateId', 'versionNumber'])` constraint
  - [x]2.4 `@ManyToOne(() => WorkflowTemplateEntity)` for template_id FK
  - [x]2.5 NO `@UpdateDateColumn` — versions are immutable

- [x]Task 3: Create WorkflowChainEntity (AC: #1, #5)
  - [x]3.1 Create `libs/db-layer/src/lib/entities/workflow-chain.entity.ts`
  - [x]3.2 Define `WorkflowChainStatus` enum (same values as template status)
  - [x]3.3 Columns per tech spec §6.3: id, tenant_id, name, description, visibility, allowed_tenants, definition (JSONB), status, created_by, created_at, updated_at, deleted_at
  - [x]3.4 Use `@DeleteDateColumn({ name: 'deleted_at' })` per party mode review
  - [x]3.5 Add `@Index(['status', 'visibility'])` composite index

- [x]Task 4: Create WorkflowRunEntity (AC: #1)
  - [x]4.1 Create `libs/db-layer/src/lib/entities/workflow-run.entity.ts`
  - [x]4.2 Define `WorkflowRunStatus` enum: `queued`, `running`, `completed`, `failed`, `cancelled`
  - [x]4.3 Columns per tech spec §6.4: id, tenant_id, version_id (FK), chain_id (FK), chain_step_index, status, started_by, input_snapshot (JSONB), output_asset_ids (UUID[]), assembled_prompt (TEXT), raw_llm_response (TEXT), retry_history (JSONB), error_message (TEXT), validation_warnings (TEXT[]), token_usage (JSONB), model_id (FK), credits_consumed, started_at, completed_at, duration_ms, created_at
  - [x]4.4 `@Check('"version_id" IS NOT NULL OR "chain_id" IS NOT NULL')` constraint
  - [x]4.5 Add indexes: `(status)`, `(started_by)`, `(chain_id, chain_step_index)`, `(tenant_id, created_at DESC)`
  - [x]4.6 `@ManyToOne` relations to WorkflowVersionEntity, WorkflowChainEntity, LlmModelEntity

- [x]Task 5: Create LlmModelEntity + seed data (AC: #7, #10)
  - [x]5.1 Create `libs/db-layer/src/lib/entities/llm-model.entity.ts`
  - [x]5.2 Columns per tech spec §5.4: id, provider_key, model_id, display_name, context_window, max_output_tokens, is_active, cost_per_1k_input (DECIMAL), cost_per_1k_output (DECIMAL), created_at, updated_at
  - [x]5.3 `@Unique(['providerKey', 'modelId'])` constraint
  - [x]5.4 NO `tenant_id` column — this is a system-wide table
  - [x]5.5 Create seed logic in `RlsSetupService.onModuleInit()` (or a new `LlmModelSeedService`) to insert 5 initial models from tech spec §5.4 table (idempotent — only seed if table is empty)

- [x]Task 6: Extend AssetEntity (AC: #8)
  - [x]6.1 Add `sourceType` column: `@Column({ name: 'source_type', type: 'varchar', length: 50, default: 'user_upload' })`
  - [x]6.2 Add `workflowRunId` column: `@Column({ name: 'workflow_run_id', type: 'uuid', nullable: true })`
  - [x]6.3 Add `@ManyToOne(() => WorkflowRunEntity, { nullable: true })` + `@JoinColumn({ name: 'workflow_run_id' })` for FK

- [x]Task 7: Register entities and RLS policies (AC: #5, #6)
  - [x]7.1 Export all new entities and enums from `libs/db-layer/src/lib/entities/index.ts`
  - [x]7.2 Add `workflow_versions` and `workflow_runs` to `tenantScopedTables` array in `rls-setup.service.ts`
  - [x]7.3 Create `createWorkflowTemplateAccessPolicy()` method in `RlsSetupService` — custom policy per tech spec §6.6 SQL
  - [x]7.4 Create `createWorkflowChainAccessPolicy()` method — same custom policy pattern
  - [x]7.5 Call both new methods from `onModuleInit()` after standard RLS setup
  - [x]7.6 RLS must also enable + force RLS on `workflow_templates` and `workflow_chains` tables (just not the standard tenant_isolation policy)

- [x]Task 8: Create WorkflowDefinition TypeScript interface (AC: #2, #3)
  - [x]8.1 Create `libs/shared/src/lib/types/workflow-definition.interface.ts`
  - [x]8.2 Define interfaces: `WorkflowDefinition`, `WorkflowMetadata`, `WorkflowInput`, `WorkflowInputSource`, `WorkflowTextConfig`, `WorkflowAcceptConfig`, `WorkflowExecution`, `WorkflowKnowledge`, `WorkflowOutput`, `WorkflowOutputSection`
  - [x]8.3 All fields match tech spec §1.2 Schema Field Reference exactly
  - [x]8.4 Export from `libs/shared/src/lib/types/index.ts`

- [x]Task 9: Create ChainDefinition TypeScript interface (AC: #2)
  - [x]9.1 Create `libs/shared/src/lib/types/workflow-chain.interface.ts`
  - [x]9.2 Define interfaces: `ChainDefinition`, `ChainMetadata`, `ChainStep`, `ChainInputMapping`, `ChainInputSource`
  - [x]9.3 All fields match tech spec §3.1 and §3.3 exactly
  - [x]9.4 Export from `libs/shared/src/lib/types/index.ts`

- [x]Task 10: Create WorkflowJobPayload interface
  - [x]10.1 Create `libs/shared/src/lib/types/workflow-job.interface.ts`
  - [x]10.2 Define `WorkflowJobPayload` interface matching tech spec §7.2
  - [x]10.3 Export from `libs/shared/src/lib/types/index.ts`

- [x]Task 11: Create workflow DTOs (AC: #9)
  - [x]11.1 Create `libs/shared/src/lib/dtos/workflow/` directory
  - [x]11.2 `CreateWorkflowTemplateDto`: name (required, max 255), description (optional), visibility (enum), tags (optional string[])
  - [x]11.3 `UpdateWorkflowTemplateDto`: partial of create (all optional), plus status transitions
  - [x]11.4 `WorkflowTemplateResponseDto`: all template fields + currentVersion nested
  - [x]11.5 `CreateWorkflowVersionDto`: templateId (required UUID), definition (required object — the full workflow definition)
  - [x]11.6 `WorkflowVersionResponseDto`: all version fields
  - [x]11.7 `CreateWorkflowChainDto`: name, description, visibility, definition (chain JSONB)
  - [x]11.8 `WorkflowChainResponseDto`: all chain fields
  - [x]11.9 `LlmModelResponseDto`: all model fields
  - [x]11.10 `CreateLlmModelDto`: provider_key, model_id, display_name, context_window, max_output_tokens, is_active, cost fields
  - [x]11.11 Create barrel file `libs/shared/src/lib/dtos/workflow/index.ts`
  - [x]11.12 Export from main `libs/shared/src/lib/dtos/index.ts`
  - [x]11.13 All DTOs use `@ApiProperty()` for Swagger and `class-validator` decorators

- [x]Task 12: YAML schema validation utility (AC: #3, #4)
  - [x]12.1 Create `libs/shared/src/lib/validators/workflow-schema.validator.ts`
  - [x]12.2 Implement `validateWorkflowDefinition(definition: WorkflowDefinition): ValidationResult`
  - [x]12.3 Validation rules: exactly 1 subject input, all required fields present, valid enum values (`role`, `processing`, `format`), input names unique, prompt contains `{input_name}` placeholders matching all inputs, output.sections required when format=markdown, output.json_schema required when format=json (mutually exclusive)
  - [x]12.4 Return type: `{ valid: boolean, errors: string[] }` with specific, actionable error messages
  - [x]12.5 Export from `libs/shared/src/lib/validators/index.ts` (create barrel file)

- [x]Task 13: Testing (AC: all)
  - [x]13.1 Entity unit tests: creation, JSONB storage/retrieval, enum constraints, relation integrity, soft-delete via `@DeleteDateColumn`
  - [x]13.2 Schema validator tests: valid definitions (parallel, batch, with/without knowledge, markdown output, json output), invalid definitions (0 subject, 2 subjects, duplicate input names, missing required fields, prompt missing variables, wrong output format)
  - [x]13.3 DTO validation tests: all DTOs with `plainToInstance + validate` — required fields, type constraints, enum values, max lengths
  - [x]13.4 RLS policy tests: verify `workflow_templates` custom policy allows public access, verify `workflow_versions` standard policy enforces tenant isolation
  - [x]13.5 LlmModel seed test: verify 5 models seeded on first startup, verify idempotent (no duplicates on restart)
  - [x]13.6 AssetEntity extension test: existing assets have default `source_type`, new workflow outputs have correct fields
  - [x]13.7 All tests follow BDD Given/When/Then format (Epic 3+)
  - [x]13.8 Test IDs: `[3.1-UNIT-XXX]` with priority markers `[P0]`-`[P3]`

## Dev Notes

### Architecture Patterns to Follow

- **Entity pattern:** UUID PK via `@PrimaryGeneratedColumn('uuid')`, `tenant_id` column, `@CreateDateColumn`/`@UpdateDateColumn`. See `libs/db-layer/src/lib/entities/asset.entity.ts` for reference.
- **Enum pattern:** String enums exported alongside entity. See `AssetStatus` in `asset.entity.ts`.
- **JSONB columns:** `@Column({ type: 'jsonb' })`. See `metadata` column in `knowledge-chunk.entity.ts`.
- **Array columns:** `@Column({ type: 'uuid', array: true, nullable: true })`. See `embedding` column pattern in `knowledge-chunk.entity.ts`.
- **Soft-delete:** Use `@DeleteDateColumn({ name: 'deleted_at' })` — NOT raw `@Column`. This enables `.softDelete()` / `.restore()` repository methods.
- **RLS custom policy:** Follow existing patterns in `rls-setup.service.ts` — 4 custom policies already exist (`auth_select_all`, `auth_accept_invitations`, `auth_insert_users`, `auth_update_invitations`). Use same `DO $$ ... IF NOT EXISTS ... END $$` pattern.
- **DTO pattern:** See `libs/shared/src/lib/dtos/knowledge/create-validated-insight.dto.ts` for complex DTO with enums. All DTOs need `@ApiProperty()` and `class-validator` decorators.
- **Barrel exports:** See `libs/db-layer/src/lib/entities/index.ts` for entity export pattern.
- **TransactionManager exemption:** `LlmModelEntity` is NOT tenant-scoped. Access directly via `DataSource` or `Repository`, NOT via `TransactionManager`. Already documented in `project-context.md`.

### Critical Implementation Details

1. **`@DeleteDateColumn` behavior:** When using `repository.softDelete(id)`, TypeORM automatically sets `deleted_at` to current timestamp. All `find*` queries automatically filter `WHERE deleted_at IS NULL`. To include soft-deleted records, use `withDeleted()` option.

2. **Custom RLS policy SQL** (from tech spec §6.6 — copy exactly):
   ```sql
   CREATE POLICY template_access ON workflow_templates
     USING (
       tenant_id = current_setting('app.current_tenant', true)::uuid
       OR visibility = 'public'
       OR current_setting('app.current_tenant', true)::uuid = ANY(allowed_tenants)
     );
   ```
   Same pattern for `workflow_chains` with policy name `chain_access`.

3. **RLS enable + force** is still needed on `workflow_templates` and `workflow_chains` even though they don't use the standard `tenant_isolation` policy. Call `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.

4. **`WorkflowRunEntity` CHECK constraint:** Use TypeORM's `@Check` decorator:
   ```typescript
   @Entity('workflow_runs')
   @Check('"version_id" IS NOT NULL OR "chain_id" IS NOT NULL')
   export class WorkflowRunEntity { ... }
   ```

5. **LlmModel seed data** (5 rows from tech spec §5.4):
   | provider_key | model_id | display_name | context_window | max_output_tokens |
   |---|---|---|---|---|
   | google-ai-studio | models/gemini-2.0-flash | Gemini 2.0 Flash | 1000000 | 8192 |
   | google-ai-studio | models/gemini-2.0-pro | Gemini 2.0 Pro | 1000000 | 8192 |
   | vertex | gemini-2.0-flash | Gemini 2.0 Flash (Vertex) | 1000000 | 8192 |
   | vertex | gemini-2.0-pro | Gemini 2.0 Pro (Vertex) | 1000000 | 8192 |
   | mock | mock-model | Mock LLM (Testing) | 1000000 | 8192 |

6. **Schema validator** must be usable on both frontend and backend (it's in `libs/shared`). Do NOT import NestJS or backend-specific packages. Use plain TypeScript only.

7. **`WorkflowDefinition` interface** is the single most critical type in this story. It IS the schema contract between Epic 3 (builder) and Epic 4 (engine). Every field must match tech spec §1.2 exactly.

8. **DECIMAL columns** for cost tracking: Use `@Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })` for `cost_per_1k_input` and `cost_per_1k_output`.

### Previous Story Learnings (from Epic 2)

- **Raw SQL for RLS policies:** Use `this.dataSource.query()` with `DO $$ ... END $$` blocks. See existing custom policies in `rls-setup.service.ts`.
- **PROCESS RULE:** Present code review findings BEFORE fixing. User chooses action per finding.
- **NO "acceptable for MVP" language.** Quality bar is production-grade.
- **Report ALL metrics:** Tests, lint errors, AND warnings for all 4 projects.
- **BDD test format (Epic 3+):** Use Given/When/Then comments in test bodies.
- **Test ID format:** `[3.1-UNIT-XXX]` with `[P0]`-`[P3]` priority markers.

### Project Structure Notes

New files to create:
```
libs/db-layer/src/lib/entities/
  workflow-template.entity.ts  (NEW)
  workflow-version.entity.ts   (NEW)
  workflow-chain.entity.ts     (NEW)
  workflow-run.entity.ts       (NEW)
  llm-model.entity.ts          (NEW)
  index.ts                     (MODIFY — add exports)

libs/db-layer/src/lib/
  rls-setup.service.ts         (MODIFY — add custom policies + new tables)

libs/shared/src/lib/types/
  workflow-definition.interface.ts  (NEW)
  workflow-chain.interface.ts       (NEW)
  workflow-job.interface.ts         (NEW)
  index.ts                          (MODIFY — add exports)

libs/shared/src/lib/dtos/workflow/
  create-workflow-template.dto.ts    (NEW)
  update-workflow-template.dto.ts    (NEW)
  workflow-template-response.dto.ts  (NEW)
  create-workflow-version.dto.ts     (NEW)
  workflow-version-response.dto.ts   (NEW)
  create-workflow-chain.dto.ts       (NEW)
  workflow-chain-response.dto.ts     (NEW)
  llm-model-response.dto.ts         (NEW)
  create-llm-model.dto.ts           (NEW)
  index.ts                           (NEW)

libs/shared/src/lib/dtos/
  index.ts                           (MODIFY — add workflow barrel)

libs/shared/src/lib/validators/
  workflow-schema.validator.ts       (NEW)
  index.ts                           (NEW)

libs/db-layer/src/lib/entities/
  asset.entity.ts                    (MODIFY — add sourceType, workflowRunId)
```

### References

- [Tech Spec §1.1-1.4: YAML Schema & Wizard Flow](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [Tech Spec §3.1-3.4: Chain Definition & Input Mapping](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [Tech Spec §5.4: LLM Model Management](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [Tech Spec §6.1-6.7: Database Entity Design](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [Tech Spec §7.2: Job Payload Schema](../../_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md)
- [project-context.md §2: RLS Rules](../../project-context.md)
- [project-context.md §5: Workflow Execution Architecture](../../project-context.md)
- [AssetEntity pattern](../../libs/db-layer/src/lib/entities/asset.entity.ts)
- [KnowledgeChunkEntity JSONB/array pattern](../../libs/db-layer/src/lib/entities/knowledge-chunk.entity.ts)
- [RlsSetupService custom policies](../../libs/db-layer/src/lib/rls-setup.service.ts)
- [Entity barrel exports](../../libs/db-layer/src/lib/entities/index.ts)
- [DTO pattern](../../libs/shared/src/lib/dtos/knowledge/create-validated-insight.dto.ts)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- All 13 tasks completed: 5 entities, AssetEntity extension, RLS registration, 3 TypeScript interfaces, 9 DTOs + barrel, schema validator, 47 tests
- 453 tests passing across all 4 projects, 0 lint errors
- Code review found 7 issues (2 HIGH, 3 MEDIUM, 2 LOW) — all fixed in review pass
- HIGH fixes: `credits_consumed` changed from DECIMAL to INTEGER per tech spec, `input_snapshot` changed from nullable to NOT NULL per tech spec
- Removed `tags` field from CreateWorkflowTemplateDto and UpdateWorkflowTemplateDto (not in tech spec §6.1)

### File List

**New files:**
- `libs/db-layer/src/lib/entities/workflow-template.entity.ts` — WorkflowTemplateEntity + enums
- `libs/db-layer/src/lib/entities/workflow-version.entity.ts` — WorkflowVersionEntity (immutable)
- `libs/db-layer/src/lib/entities/workflow-chain.entity.ts` — WorkflowChainEntity + enums
- `libs/db-layer/src/lib/entities/workflow-run.entity.ts` — WorkflowRunEntity + enum
- `libs/db-layer/src/lib/entities/llm-model.entity.ts` — LlmModelEntity (system-wide, no RLS)
- `libs/shared/src/lib/types/workflow-definition.interface.ts` — WorkflowDefinition interfaces
- `libs/shared/src/lib/types/workflow-chain.interface.ts` — ChainDefinition interfaces
- `libs/shared/src/lib/types/workflow-job.interface.ts` — WorkflowJobPayload interface
- `libs/shared/src/lib/dtos/workflow/create-workflow-template.dto.ts`
- `libs/shared/src/lib/dtos/workflow/update-workflow-template.dto.ts`
- `libs/shared/src/lib/dtos/workflow/workflow-template-response.dto.ts`
- `libs/shared/src/lib/dtos/workflow/create-workflow-version.dto.ts`
- `libs/shared/src/lib/dtos/workflow/workflow-version-response.dto.ts`
- `libs/shared/src/lib/dtos/workflow/create-workflow-chain.dto.ts`
- `libs/shared/src/lib/dtos/workflow/workflow-chain-response.dto.ts`
- `libs/shared/src/lib/dtos/workflow/create-llm-model.dto.ts`
- `libs/shared/src/lib/dtos/workflow/llm-model-response.dto.ts`
- `libs/shared/src/lib/dtos/workflow/index.ts` — barrel export
- `libs/shared/src/lib/validators/workflow-schema.validator.ts` — schema validator
- `libs/shared/src/lib/validators/index.ts` — barrel export
- `libs/shared/src/lib/validators/workflow-schema.validator.spec.ts` — 22 tests
- `libs/shared/src/lib/dtos/workflow/workflow.dto.spec.ts` — 19 tests

**Modified files:**
- `libs/db-layer/src/lib/entities/asset.entity.ts` — added sourceType, workflowRunId columns
- `libs/db-layer/src/lib/entities/index.ts` — added new entity/enum exports
- `libs/db-layer/src/lib/rls-setup.service.ts` — added workflow RLS policies + LLM seed
- `libs/db-layer/src/lib/rls-setup.service.spec.ts` — added 6 new tests (42-47)
- `libs/shared/src/lib/types/index.ts` — added type exports
- `libs/shared/src/lib/dtos/index.ts` — added workflow barrel export
- `libs/shared/src/index.ts` — added validators export
