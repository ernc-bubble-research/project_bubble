# Story 2.4: Validated Insight Storage (Memory)

Status: done

## Story

As a **Creator**,
I want validated user feedback and findings to be saved back to the Knowledge Base,
so that the system learns from corrections (e.g., "User confirmed X is true") and improves over time.

## Acceptance Criteria

1. **AC1 — Insight Storage**: Given a validated feedback event (from any source: report feedback, assumption correction, or manual insight entry), when the Knowledge Service receives the event, then a new `knowledge_chunks` row is created with `isVerified = true` and metadata linking to the originating run/report.

2. **AC2 — Verified Metadata**: Each validated insight stores in its `metadata` JSONB: `sourceType` (enum: `report_feedback` | `assumption_correction` | `manual_entry`), `sourceRunId` (UUID, nullable — the workflow run that produced the insight), `sourceReportId` (UUID, nullable — the report where feedback was given), `verifiedBy` (UUID — user who verified/created), `verifiedAt` (ISO timestamp), and `originalContent` (string, nullable — the original text before correction, if applicable).

3. **AC3 — Embedding Generation**: Validated insights are embedded using the same `EmbeddingProvider` (hexagonal pattern) as regular chunks, so they appear in vector similarity searches. The embedding is generated from the insight `content` field.

4. **AC4 — Boosted Search Results**: The `KnowledgeSearchService.search()` method boosts verified chunks in results. Verified chunks (`isVerified = true`) receive a configurable relevance boost (default: +0.1 added to similarity score, capped at 1.0). The boost ensures user-validated knowledge ranks higher than raw document extracts at similar similarity levels.

5. **AC5 — Tenant Scoping (RLS)**: All validated insight operations are scoped to the current tenant via `TransactionManager` and RLS. The `knowledge_chunks` table already has RLS policies from Story 2.2.

6. **AC6 — Programmatic API**: A `ValidatedInsightService.store()` method accepts: `content` (string, the validated insight text), `tenantId` (string), `metadata` (object with source linkage fields from AC2). The service is injectable by other modules (e.g., Epic 5 feedback processing). A REST endpoint also exists for testing and future direct integrations.

7. **AC7 — Retrieval**: A `ValidatedInsightService.getByRun()` method retrieves all validated insights for a given `sourceRunId`, and a `getByTenant()` returns paginated insights for the current tenant. Both are tenant-scoped via RLS.

8. **AC8 — Deletion**: Validated insights can be soft-deleted (setting a `deletedAt` timestamp). Soft-deleted insights are excluded from search results and retrieval. Hard deletion is not exposed via API (future GDPR requirement).

9. **AC9 — Tests Pass**: All new and existing tests pass. New unit tests cover: insight storage (with embedding), boosted search scoring, retrieval by run/tenant, soft deletion, DTO validation, controller auth. 361 existing tests + new tests must all pass.

## Tasks / Subtasks

- [x] **Task 1: Database Schema Updates** (AC: 1, 2, 5, 8)
  - [x] 1.1: Add `isVerified` boolean column (default `false`) to `KnowledgeChunkEntity`
  - [x] 1.2: Add `verifiedBy` UUID column (nullable)
  - [x] 1.3: Add `deletedAt` timestamp column (nullable)
  - [x] 1.4: Update `createMockKnowledgeChunk()` factory with new field defaults
  - [x] 1.5: Made `asset_id` nullable for standalone insights (asset relation + column)

- [x] **Task 2: Shared DTOs** (AC: 2, 6, 7)
  - [x] 2.1: Created `CreateValidatedInsightDto` with `InsightSourceType` enum
  - [x] 2.2: Created `ValidatedInsightResponseDto` extending `KnowledgeChunkResponseDto`
  - [x] 2.3: Updated barrel exports in `knowledge/index.ts`

- [x] **Task 3: ValidatedInsightService** (AC: 1, 2, 3, 5, 6, 7, 8)
  - [x] 3.1: Created service with `TransactionManager` and `EMBEDDING_PROVIDER` injection
  - [x] 3.2: Implemented `store()` — embeds content, inserts with isVerified=true, asset_id=NULL
  - [x] 3.3: Implemented `getByRun()` — queries by metadata->>'sourceRunId'
  - [x] 3.4: Implemented `getByTenant()` — paginated with LIMIT/OFFSET
  - [x] 3.5: Implemented `softDelete()` — sets deleted_at = NOW()
  - [x] 3.6: Error handling with InternalServerErrorException on embedding failure
  - [x] 3.7: Logs metadata only, never content

- [x] **Task 4: Update KnowledgeSearchService for Boosted Scoring** (AC: 4)
  - [x] 4.1: Added `deleted_at IS NULL` filter to WHERE clause
  - [x] 4.2: LEAST() boost with CASE WHEN is_verified, capped at 1.0
  - [x] 4.3: `verifiedBoost` parameter (default 0.1) as $4
  - [x] 4.4: Changed JOIN to LEFT JOIN for standalone insights
  - [x] 4.5: Updated and added search tests for boost + soft-delete

- [x] **Task 5: REST API Controller** (AC: 6, 7, 8)
  - [x] 5.1: 4 new endpoints: POST/GET /insights, GET /insights/run/:runId, DELETE /insights/:id
  - [x] 5.2: Reuses JwtAuthGuard + RolesGuard with same role set
  - [x] 5.3: Extracts tenant_id + sub (userId) from req.user
  - [x] 5.4: Full @ApiResponse decorators for all response codes (201/200/204, 400, 401, 403, 500)

- [x] **Task 6: Update KnowledgeModule** (AC: 6)
  - [x] 6.1: Registered `ValidatedInsightService` as provider
  - [x] 6.2: Exported `ValidatedInsightService` for Epic 5

- [x] **Task 7: Testing** (AC: 9)
  - [x] 7.1: `validated-insight.service.spec.ts` — 16 tests covering store, retrieval, soft-delete, NotFoundException, embedding failure
  - [x] 7.2: `knowledge-search.service.spec.ts` — 5 new tests (2.4-UNIT-002a–e) for boost + soft-delete
  - [x] 7.3: `knowledge.controller.spec.ts` — 10 new tests (2.4-UNIT-003–006) for insight endpoints + 404 propagation
  - [x] 7.4: DTO validation tests — 9 tests (2.4-UNIT-007a–i) for CreateValidatedInsightDto + 6 tests (2.4-UNIT-008a–f) for ListInsightsQueryDto
  - [x] 7.5: Full suite: 406 tests passing (shared:1, db-layer:16, web:136, api-gateway:253), 0 lint errors

## Dev Notes

### Consumer Context

This story provides the **storage mechanism** for validated insights (the "Memory" layer). It is consumed by:
- **Epic 5 Story 5.3/5.4 (primary)** — Human-in-the-Loop feedback processing stores validated insights via `ValidatedInsightService.store()`
- **Epic 4 workflow execution (future)** — Agents query Knowledge Base and get boosted results from verified insights
- **Epic 8 conversational RAG (future)** — Chat interface benefits from boosted verified knowledge

The REST endpoints exist for testing, debugging, and programmatic feedback ingestion before the Report UI (Epic 5) exists. The primary consumer is the injected `ValidatedInsightService`.

### Critical Architecture Constraints

1. **Reuse `knowledge_chunks` table**: Per the epics spec, validated insights are stored IN the same table as regular chunks. They are distinguished by `is_verified = true`. This avoids a separate entity and leverages existing RLS policies, vector search infrastructure, and embedding pipeline.

2. **Standalone insights (no asset link)**: Unlike regular knowledge chunks which are linked to an `AssetEntity` via `asset_id`, validated insights have `asset_id = NULL`. They are not file extracts — they are user-validated conclusions. The SQL queries in search and retrieval must handle nullable `asset_id` (LEFT JOIN instead of INNER JOIN for insights, or handle null assetName in results).

3. **TransactionManager is MANDATORY**: `knowledge_chunks` has `tenant_id` + RLS. All DB operations via `TransactionManager.run(tenantId, cb)`.

4. **Reuse EMBEDDING_PROVIDER**: Same provider as ingestion and search. Import via `IngestionModule` export.

5. **Log sanitization**: Insight content may contain user corrections with sensitive information. Log only metadata — NEVER content.

6. **API Documentation Rules**: ALL new controller endpoints MUST have complete `@ApiResponse` decorators for every response code (200/201/204, 400, 401, 403, 500). This is a project-context.md rule.

### Search SQL Update

The existing search query in `knowledge-search.service.ts` needs two changes:

```sql
-- BEFORE (Story 2.3):
SELECT ... (1 - (kc.embedding <=> $1::vector))::float8 AS similarity
FROM knowledge_chunks kc
JOIN assets a ON a.id = kc.asset_id
WHERE kc.embedding IS NOT NULL
  AND (1 - (kc.embedding <=> $1::vector)) >= $2
ORDER BY similarity DESC
LIMIT $3

-- AFTER (Story 2.4):
SELECT ...
  LEAST((1 - (kc.embedding <=> $1::vector)) + CASE WHEN kc.is_verified THEN $4 ELSE 0 END, 1.0)::float8 AS similarity
FROM knowledge_chunks kc
LEFT JOIN assets a ON a.id = kc.asset_id  -- LEFT JOIN for standalone insights
WHERE kc.embedding IS NOT NULL
  AND kc.deleted_at IS NULL               -- exclude soft-deleted
  AND (1 - (kc.embedding <=> $1::vector)) + CASE WHEN kc.is_verified THEN $4 ELSE 0 END >= $2
ORDER BY similarity DESC
LIMIT $3
```

**Parameters change:** `$4` = verified boost (default 0.1)

**Note on LEFT JOIN**: Validated insights have `asset_id = NULL`, so `assetName` will be NULL for those results. `SearchResultDto.assetName` and `KnowledgeChunkResponseDto.assetId` are typed as `string | null` with `nullable: true` on `@ApiProperty`.

### Existing Code to Reuse

| What | Where | How |
|------|-------|-----|
| TransactionManager | `@project-bubble/db-layer` | Inject and use `run(tenantId, cb)` |
| EmbeddingProvider + token | `apps/api-gateway/src/app/ingestion/embedding.provider.ts` | `@Inject(EMBEDDING_PROVIDER)` |
| KnowledgeChunkEntity | `@project-bubble/db-layer` | Add new columns to existing entity |
| KnowledgeSearchService | `apps/api-gateway/src/app/knowledge/` | Modify search SQL |
| KnowledgeController | `apps/api-gateway/src/app/knowledge/` | Add new endpoints |
| KnowledgeModule | `apps/api-gateway/src/app/knowledge/` | Register new service |
| JWT + Roles guards | `apps/api-gateway/src/app/auth/guards/` | Apply to new endpoints |
| createMockKnowledgeChunk() | `@project-bubble/db-layer/testing` | Update with new fields |

### File Structure

```
libs/db-layer/src/lib/entities/
  └── knowledge-chunk.entity.ts         (MODIFIED — add isVerified, verifiedBy, deletedAt)

libs/shared/src/lib/dtos/knowledge/
  ├── create-validated-insight.dto.ts    (NEW)
  ├── validated-insight-response.dto.ts  (NEW)
  └── index.ts                          (MODIFIED — add new exports)

apps/api-gateway/src/app/knowledge/
  ├── validated-insight.service.ts       (NEW)
  ├── validated-insight.service.spec.ts  (NEW)
  ├── knowledge-search.service.ts        (MODIFIED — boosted scoring + deleted filter)
  ├── knowledge-search.service.spec.ts   (MODIFIED — new tests for boost + delete)
  ├── knowledge.controller.ts            (MODIFIED — add insight endpoints)
  ├── knowledge.controller.spec.ts       (MODIFIED — add insight endpoint tests)
  └── knowledge.module.ts                (MODIFIED — register ValidatedInsightService)
```

### Previous Story Learnings (from Story 2.3)

- **SearchResultDto extends KnowledgeChunkResponseDto**: Proper inheritance established in code review. Follow same pattern for `ValidatedInsightResponseDto`.
- **Raw SQL for pgvector**: TypeORM doesn't support pgvector operators. Use `manager.query()` with raw SQL.
- **`::float8` cast on similarity**: Required to prevent string return. Apply to all SQL similarity expressions.
- **Error handling on embedding provider**: try/catch with `InternalServerErrorException`. Same pattern for insight embedding.
- **DTO validation tests with `plainToInstance` + `validate`**: Pattern established in Story 2.3. Use for `CreateValidatedInsightDto`.
- **Test ID format**: `[2.4-UNIT-XXX]` with priority `[P1]` for services, `[P2]` for controllers.
- **PROCESS**: Present code review findings to user BEFORE fixing. Ask for user decision on each finding.
- **No lazy behavior**: Do not accept project-wide gaps as "consistent". Flag and address them.
- **Complete @ApiResponse decorators**: Required for ALL response codes on every endpoint.

### Scope Boundaries

- **Feedback UI NOT in scope**: This story builds the storage mechanism only. The report feedback UI and assumption correction UI are in Epic 5 (Stories 5.3, 5.4).
- **Workflow integration NOT in scope**: Epic 4 workflow nodes will call `KnowledgeSearchService.search()` which now automatically boosts verified chunks. No workflow-specific code in this story.
- **Batch insight storage NOT in scope**: Single insight per request. Batch storage may be added when Epic 5 feedback processing requires it.
- **Insight editing NOT in scope**: Insights are immutable once stored. Users can soft-delete and create new ones.
- **Hard deletion NOT in scope**: Soft delete only. Hard deletion deferred to GDPR requirements (Epic 7).

### Dependencies

- **No new npm packages needed**: Uses existing pgvector, class-validator, class-transformer, NestJS core.
- **Existing infrastructure**: knowledge_chunks table, RLS, EMBEDDING_PROVIDER, TransactionManager.

### Environment Variables

No new environment variables. Reuses existing:
```env
EMBEDDING_PROVIDER=mock     # mock | gemini
EMBEDDING_MODEL=text-embedding-004
```

### Project Structure Notes

- Modified entity: `libs/db-layer/src/lib/entities/knowledge-chunk.entity.ts`
- New DTOs: `libs/shared/src/lib/dtos/knowledge/`
- New service: `apps/api-gateway/src/app/knowledge/validated-insight.service.ts`
- Modified: existing knowledge module, controller, search service
- No new modules or app.module.ts changes — everything stays in KnowledgeModule

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.4]
- [Source: project-context.md — TransactionManager rule, API Documentation Rules, Log sanitization]
- [Source: stories/2-3-semantic-search-service-vector-rag.md — Search patterns, code review learnings]
- [Source: stories/2-2-vector-ingestion-reference-assets.md — Entity structure, embedding pipeline]
- [Source: libs/db-layer/src/lib/entities/knowledge-chunk.entity.ts — Current entity schema]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- N/A — no unexpected errors during implementation

### Completion Notes List

- Made `asset_id` nullable in `KnowledgeChunkEntity` (column + ManyToOne relation) since validated insights are standalone (not linked to files)
- Changed `JOIN` to `LEFT JOIN` in search SQL to handle NULL asset_id
- Added `LEAST(..., 1.0)` cap to prevent boosted similarity exceeding 1.0
- All SQL uses raw `manager.query()` with parameterized queries for pgvector compatibility
- `InsightSourceType` enum created as string enum for JSONB storage (not TypeORM column enum)
- mapToResponseDto() private helper extracts verified metadata from JSONB
- Controller reuses same class-level guards — no per-endpoint guard duplication
- 46 new tests added for Story 2.4 (16 service + 5 search + 10 controller + 15 DTO validation)

### Code Review Fixes Applied

- **H1**: `SearchResultDto.assetName` type changed from `string` to `string | null` with `nullable: true`
- **H2**: `KnowledgeChunkResponseDto.assetId` type changed from `string` to `string | null` with `nullable: true`
- **H3**: `softDelete()` now uses `RETURNING id` and throws `NotFoundException` when 0 rows affected
- **M2**: Controller `listInsights()` now uses `ListInsightsQueryDto` with `@Type(() => Number)` + `@IsInt`/`@Min`/`@Max` validation instead of raw `@Query` string params with `parseInt`
- **M3**: Deferred — defense-in-depth `tenant_id` in WHERE clauses to be applied project-wide as a hardening story
- **L1**: `InsightMetadata` interface moved from service file to `libs/shared` per Shared Brain Rule
- **L2**: Dev Notes search SQL example corrected (removed `kc.is_verified AS "isVerified"` which is not in implementation)
- **M1**: File List updated with all review-fix files

### Change Log

| Date | Change |
|------|--------|
| 2026-02-01 | Tasks 1-7 implemented. 397 tests passing, 0 lint errors. |
| 2026-02-01 | Code review: 8 findings (3H, 3M, 2L). All fixed except M3 (deferred). 406 tests passing. |

### File List

| File | Action | Purpose |
|------|--------|---------|
| `libs/db-layer/src/lib/entities/knowledge-chunk.entity.ts` | MODIFIED | Added isVerified, verifiedBy, deletedAt columns; made asset_id nullable |
| `libs/db-layer/src/test-utils/factories.ts` | MODIFIED | Updated createMockKnowledgeChunk() with new field defaults |
| `libs/shared/src/lib/dtos/knowledge/create-validated-insight.dto.ts` | NEW | CreateValidatedInsightDto + InsightSourceType enum |
| `libs/shared/src/lib/dtos/knowledge/validated-insight-response.dto.ts` | NEW | ValidatedInsightResponseDto extending KnowledgeChunkResponseDto |
| `libs/shared/src/lib/dtos/knowledge/insight-metadata.ts` | NEW | InsightMetadata interface (moved from service — Shared Brain Rule) |
| `libs/shared/src/lib/dtos/knowledge/list-insights-query.dto.ts` | NEW | ListInsightsQueryDto with pagination validation |
| `libs/shared/src/lib/dtos/knowledge/search-result.dto.ts` | MODIFIED | assetName type changed to string \| null |
| `libs/shared/src/lib/dtos/asset/knowledge-chunk-response.dto.ts` | MODIFIED | assetId type changed to string \| null |
| `libs/shared/src/lib/dtos/knowledge/index.ts` | MODIFIED | Added barrel exports for InsightMetadata + ListInsightsQueryDto |
| `libs/shared/src/lib/dtos/index.ts` | MODIFIED | Added knowledge barrel export |
| `apps/api-gateway/src/app/knowledge/validated-insight.service.ts` | NEW | Core service: store, getByRun, getByTenant, softDelete |
| `apps/api-gateway/src/app/knowledge/validated-insight.service.spec.ts` | NEW | 16 unit tests |
| `apps/api-gateway/src/app/knowledge/knowledge-search.service.ts` | MODIFIED | Boost scoring, soft-delete filter, LEFT JOIN |
| `apps/api-gateway/src/app/knowledge/knowledge-search.service.spec.ts` | MODIFIED | 5 new tests for boost + soft-delete |
| `apps/api-gateway/src/app/knowledge/knowledge.controller.ts` | MODIFIED | 4 new insight endpoints, ListInsightsQueryDto, full @ApiResponse |
| `apps/api-gateway/src/app/knowledge/knowledge.controller.spec.ts` | MODIFIED | 25 new tests (10 controller + 15 DTO validation) |
| `apps/api-gateway/src/app/knowledge/knowledge.module.ts` | MODIFIED | Registered + exported ValidatedInsightService |
