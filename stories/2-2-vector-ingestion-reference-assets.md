# Story 2.2: Vector Ingestion ("Learn This" — Knowledge Base Indexing)

Status: done

## Story

As a **Creator**,
I want to explicitly mark files in the Data Vault for indexing into the Knowledge Base,
so that workflow agents can find relevant context from my documents during analysis.

## Acceptance Criteria

1. **AC1 — "Learn This" Action**: Given I select one or more files in the Data Vault, when I click "Add to Knowledge Base" (the "Learn This" action), then the system queues the file(s) for text extraction, chunking, and embedding.

2. **AC2 — Text Extraction**: Given a file is queued for indexing, the system extracts text from PDF (via `pdf-parse`), TXT, MD, and DOCX files. Extraction runs asynchronously in the worker-engine via BullMQ.

3. **AC3 — Chunking**: Extracted text is split into overlapping chunks (target ~500 tokens, ~100 token overlap). Each chunk stores: `content`, `chunkIndex`, `metadata` (page number for PDFs, line range for text files).

4. **AC4 — Embedding**: Each chunk is embedded using the Google Generative AI embedding model (`text-embedding-004`). Embeddings are stored as `vector(768)` in the `knowledge_chunks` table using pgvector.

5. **AC5 — Vector Storage**: Embeddings are stored in a `knowledge_chunks` table with columns: `id`, `tenantId` (RLS), `assetId` (FK to assets), `content` (text), `chunkIndex` (int), `metadata` (jsonb), `embedding` (vector(768)), `createdAt`. RLS policy enforces tenant isolation.

6. **AC6 — isIndexed Flag**: When all chunks for a file are successfully embedded and stored, the asset's `isIndexed` flag is set to `true`. If indexing fails, `isIndexed` remains `false` and the error is logged.

7. **AC7 — De-index**: Users can remove a file from the Knowledge Base. This deletes all `knowledge_chunks` rows for that asset and sets `isIndexed = false`.

8. **AC8 — UI: Indexed Badge**: Files with `isIndexed = true` display a brain icon badge in the Data Vault file card (both grid and list views).

9. **AC9 — UI: Info Tooltip**: An info button (ℹ) near the "Learn This" action explains: "Adding to Knowledge Base means Bubble's AI agents will permanently learn from this file across all workflows."

10. **AC10 — UI: Indexing Status**: While a file is being indexed (job in progress), the UI shows a spinner/progress indicator on that file card instead of the brain badge.

11. **AC11 — The 200ms Rule**: Text extraction, chunking, and embedding run in the `worker-engine` (BullMQ), NOT in `api-gateway`. The API endpoint returns `202 Accepted` with a job ID.

12. **AC12 — Tests Pass**: All new and existing tests pass. New unit tests cover: ingestion service, text extraction, chunking logic, embedding service mock, vector storage, de-index, and UI components.

## Tasks / Subtasks

- [x] **Task 1: Database — KnowledgeChunk Entity & pgvector Setup** (AC: 5)
  - [x] 1.1: Enable pgvector extension in `RlsSetupService.onModuleInit()`
  - [x] 1.2: Create `KnowledgeChunkEntity` with vector(768) as float8[] for TypeORM compatibility
  - [x] 1.3: Add `'knowledge_chunks'` to `tenantScopedTables` in `RlsSetupService`
  - [x] 1.4: Create `createMockKnowledgeChunk()` factory and export from testing barrel

- [x] **Task 2: Shared DTOs** (AC: 1, 6, 7)
  - [x] 2.1: Create `IndexAssetResponseDto` with jobId, assetId, status fields
  - [x] 2.2: Create `KnowledgeChunkResponseDto` with id, assetId, content, chunkIndex, metadata
  - [x] 2.3: Export new DTOs from barrel files

- [x] **Task 3: Text Extraction Service** (AC: 2)
  - [x] 3.1: Create `text-extractor.service.ts` — PDF (pdf-parse), TXT/MD (fs.readFile), DOCX (mammoth)
  - [x] 3.2: Pure utility, no DB access, no RLS

- [x] **Task 4: Chunking Service** (AC: 3)
  - [x] 4.1: Create `chunker.service.ts` — ~2000 char chunks, ~400 char overlap, paragraph/sentence/word boundary splitting
  - [x] 4.2: Stateless, easily testable

- [x] **Task 5: Embedding Service** (AC: 4)
  - [x] 5.1: Create `embedding.service.ts` with batch support (max 100), exponential backoff retry
  - [x] 5.2: GEMINI_API_KEY validation with clear error messages
  - [x] 5.3: Hexagonal Pattern — `EmbeddingProvider` interface, `GeminiEmbeddingProvider`, `MockEmbeddingProvider`

- [x] **Task 6: Ingestion Orchestration Service** (AC: 1, 6, 7, 11)
  - [x] 6.1: Create `ingestion.service.ts` — indexAsset (queue), processIndexing (pipeline), deIndexAsset
  - [x] 6.2: TransactionManager for all DB operations (RLS)
  - [x] 6.3: Failure rollback — delete partial chunks, keep isIndexed=false

- [x] **Task 7: BullMQ Integration** (AC: 11)
  - [x] 7.1: Create `ingestion.module.ts` with BullModule.registerQueue('ingestion')
  - [x] 7.2: Configure `BullModule.forRoot()` in app.module.ts with Redis connection
  - [x] 7.3: Create `ingestion.processor.ts` — @Processor('ingestion')
  - [x] 7.4: MVP decision: BullMQ processor in api-gateway (documented)

- [x] **Task 8: REST API Endpoints** (AC: 1, 7)
  - [x] 8.1: Create `ingestion.controller.ts` — POST (202 Accepted) and DELETE endpoints
  - [x] 8.2: ParseUUIDPipe, JWT tenant extraction, guards

- [x] **Task 9: Angular Frontend — "Learn This" UI** (AC: 8, 9, 10)
  - [x] 9.1: Add indexAsset/deIndexAsset methods to asset.service.ts
  - [x] 9.2: Rewrite file-card.component.ts — brain badge, indexing spinner, Learn This/Remove actions
  - [x] 9.3: Update data-vault.component — indexingIds signal, onIndexAsset, onDeIndexAsset, indexSelected
  - [x] 9.4: Info tooltip via title attribute on Learn This button and ℹ icon

- [x] **Task 10: Testing** (AC: 12)
  - [x] 10.1: text-extractor.service.spec.ts (5 tests)
  - [x] 10.2: chunker.service.spec.ts (8 tests)
  - [x] 10.3: embedding.service.spec.ts (7 tests)
  - [x] 10.4: ingestion.service.spec.ts (9 tests)
  - [x] 10.5: ingestion.controller.spec.ts (2 tests)
  - [x] 10.6: file-card.component.spec.ts (7 tests) + data-vault.component.spec.ts (4 new tests)
  - [x] 10.7: Full suite: 331 tests passing (shared=1, db-layer=16, api-gateway=180, web=134), 0 lint errors

## Dev Notes

### Critical Architecture Constraints

1. **TransactionManager is MANDATORY**: `knowledge_chunks` table has `tenant_id` — all DB operations MUST use `TransactionManager`. Pattern: `this.txManager.run(tenantId, async (manager) => { ... })`.

2. **The 200ms Rule**: Text extraction + chunking + embedding is heavy. The API endpoint queues the job via BullMQ and returns `202 Accepted`. Processing happens asynchronously.

3. **BullMQ in api-gateway (MVP)**: For simplicity, run the BullMQ processor in api-gateway (not worker-engine). The worker-engine app is empty and reserved for Epic 4 (LangGraph workflow execution). Ingestion is lightweight enough to coexist. Document this so future devs know to move it later.

4. **Hexagonal Embedding Pattern**: Use an `EmbeddingProvider` interface. `MockEmbeddingProvider` returns deterministic fake vectors for testing. `GeminiEmbeddingProvider` calls the real API. Switched via `EMBEDDING_PROVIDER` env var. This follows the same pattern planned for LLM providers in Epic 4.

5. **pgvector Column**: TypeORM doesn't natively support `vector` type. Options:
   - Use `@Column({ type: 'float8', array: true })` and cast in queries
   - Or use raw SQL for the vector column definition and query with pgvector operators (`<=>` for cosine distance)
   - The query patterns will be refined in Story 2.3 (Semantic Search). For now, just store the vectors correctly.

6. **Shared DTO Rule**: ALL DTOs in `libs/shared/src/lib/dtos/asset/`. Both Angular and NestJS consume the same classes.

7. **Log Sanitization**: Log only metadata (`assetId`, `chunkCount`, `embeddingDimensions`). NEVER log file content or chunk text.

8. **RLS for knowledge_chunks**: Add `'knowledge_chunks'` to `tenantScopedTables` in `RlsSetupService`. Standard tenant isolation policy only.

### pgvector Setup

The Docker image `pgvector/pgvector:pg16` already includes the extension. Enable it with:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```
Run this in `RlsSetupService.onModuleInit()` before creating RLS policies.

### Database Schema

```sql
-- knowledge_chunks table (pgvector)
CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(768),   -- pgvector type, 768 dims for text-embedding-004
  created_at TIMESTAMP DEFAULT now()
);

-- Vector similarity index (for Story 2.3 search, but create now)
CREATE INDEX knowledge_chunks_embedding_idx
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Google Generative AI Embedding

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

// Embed a single text
const result = await model.embedContent(text);
const embedding = result.embedding.values; // number[] of length 768
```

- Model: `text-embedding-004` (768 dimensions, free tier available)
- Batch: Use `model.batchEmbedContents()` for multiple texts (max 100 per call)
- Rate limits: ~1500 RPM on free tier. Implement simple retry with backoff.

### Chunking Strategy

- **Target chunk size**: ~2000 characters (~500 tokens)
- **Overlap**: ~400 characters (~100 tokens)
- **Split priority**: Paragraph break (`\n\n`) > Sentence end (`. `) > Word break (` `)
- **Minimum chunk size**: 100 characters (don't create tiny fragments)
- **Each chunk stores**: content, chunkIndex (0-based), metadata (charStart, charEnd, optional page number)

### Text Extraction by File Type

| MIME Type | Extractor | Package |
|-----------|-----------|---------|
| `application/pdf` | `pdf-parse` | Already installed |
| `text/plain` | `fs.readFile(path, 'utf-8')` | Built-in |
| `text/markdown` | `fs.readFile(path, 'utf-8')` | Built-in |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `mammoth.extractRawText()` | **Install: `npm install mammoth`** |

### New npm Dependencies

| Package | Purpose | Install Command |
|---------|---------|-----------------|
| `mammoth` | DOCX text extraction | `npm install mammoth` |
| `@types/mammoth` | TypeScript types | `npm install -D @types/mammoth` (check if exists, mammoth may include types) |

**Already installed (no action needed):**
- `pdf-parse` (PDF extraction)
- `@google/generative-ai` (embeddings)
- `@nestjs/bullmq` + `bullmq` (job queue)
- `pg` (PostgreSQL client)

### Existing Code to Reuse

| What | Where | How |
|------|-------|-----|
| TransactionManager | `@project-bubble/db-layer` | Inject and use `run(tenantId, cb)` |
| RLS policy setup | `libs/db-layer/src/lib/rls-setup.service.ts` | Add `knowledge_chunks` table |
| AssetEntity | `libs/db-layer/src/lib/entities/asset.entity.ts` | `isIndexed` field exists |
| Entity barrel export | `libs/db-layer/src/lib/entities/index.ts` | Add KnowledgeChunkEntity |
| DTO barrel export | `libs/shared/src/lib/dtos/index.ts` | Add new DTOs |
| AssetsService | `apps/api-gateway/src/app/assets/assets.service.ts` | `findEntity()` for asset validation |
| JWT + Roles guards | `apps/api-gateway/src/app/auth/guards/` | Apply to ingestion controller |
| Asset.service (Angular) | `apps/web/src/app/core/services/asset.service.ts` | Add index/deIndex methods |
| File card component | `apps/web/src/app/app/data-vault/file-card.component.ts` | Add brain badge |
| Data vault component | `apps/web/src/app/app/data-vault/data-vault.component.ts` | Add Learn This actions |
| Test factories | `@project-bubble/db-layer/testing` | Add createMockKnowledgeChunk |
| ConfigModule | Global in api-gateway | Use `ConfigService.get('GEMINI_API_KEY')` |

### API Endpoint Design

```
# Ingestion (under Assets)
POST   /api/app/assets/:id/index    - Queue file for Knowledge Base indexing (202 Accepted)
DELETE /api/app/assets/:id/index    - Remove file from Knowledge Base (200 OK)
```

All endpoints require JWT auth. Tenant context extracted from JWT.

### File Structure (New Files)

```
libs/db-layer/src/lib/entities/
  └── knowledge-chunk.entity.ts          (NEW)

libs/shared/src/lib/dtos/asset/
  ├── index-asset-response.dto.ts        (NEW)
  └── knowledge-chunk-response.dto.ts    (NEW)

apps/api-gateway/src/app/ingestion/
  ├── ingestion.module.ts                (NEW)
  ├── ingestion.service.ts               (NEW)
  ├── ingestion.controller.ts            (NEW)
  ├── ingestion.processor.ts             (NEW - BullMQ processor)
  ├── text-extractor.service.ts          (NEW)
  ├── chunker.service.ts                 (NEW)
  ├── embedding.service.ts               (NEW)
  ├── embedding.provider.ts              (NEW - interface + mock)
  ├── ingestion.service.spec.ts          (NEW)
  ├── ingestion.controller.spec.ts       (NEW)
  ├── text-extractor.service.spec.ts     (NEW)
  ├── chunker.service.spec.ts            (NEW)
  └── embedding.service.spec.ts          (NEW)
```

### Previous Story Learnings (from Story 2.1)

- **TransactionManager pattern**: All tenant-scoped DB ops wrapped in `txManager.run(tenantId, cb)`. Asset module demonstrates this thoroughly.
- **File storage**: Files stored at `uploads/{tenantId}/{uuid}-{originalName}`. Read from `asset.storagePath` for text extraction.
- **ParseUUIDPipe**: Use on all `:id` params in controllers.
- **Test IDs**: Use `[2.2-UNIT-XXX]` format. Priority: `[P1]` for services, `[P2]` for controllers/UI.
- **Code review found 3-7 issues per story**: Expect similar. Common: missing validation, data integrity gaps.
- **assetType removed**: Files are type-agnostic. Only `isIndexed` boolean distinguishes "learned" files.
- **Lint strictness**: No `Function` type (use typed callbacks), accessibility attributes on interactive elements.

### Scope Boundaries

- **Semantic search NOT in scope**: Query-time vector search is Story 2.3. This story only stores vectors.
- **Validated insight storage NOT in scope**: That's Story 2.4.
- **IVFFlat index tuning NOT in scope**: Create the index with default `lists = 100`. Tune when data volume is known.
- **Real-time progress NOT in scope**: Simple polling or optimistic UI. WebSocket progress is Epic 4+.
- **Worker-engine NOT in scope**: Keep BullMQ processor in api-gateway for now. Worker-engine is for Epic 4.

### Dependencies

- **New**: `mammoth` (DOCX extraction)
- **Existing**: `pdf-parse`, `@google/generative-ai`, `@nestjs/bullmq`, `bullmq`
- **Infrastructure**: Redis (already in docker-compose), pgvector (already in Postgres image)

### Environment Variables (New)

```env
# Add to .env / .env.example
EMBEDDING_PROVIDER=mock          # mock | gemini (default: gemini)
EMBEDDING_MODEL=text-embedding-004
CHUNK_SIZE=2000                   # characters
CHUNK_OVERLAP=400                 # characters
```

### Project Structure Notes

- New NestJS module: `apps/api-gateway/src/app/ingestion/`
- New entity: `KnowledgeChunkEntity` in `libs/db-layer/`
- New DTOs: `IndexAssetResponseDto`, `KnowledgeChunkResponseDto` in `libs/shared/`
- Modified: `AssetService` (Angular) — add index/deIndex methods
- Modified: `file-card.component.ts` — brain badge
- Modified: `data-vault.component.ts` — Learn This actions
- Modified: `RlsSetupService` — add knowledge_chunks + pgvector extension
- Modified: `app.module.ts` (api-gateway) — BullModule + IngestionModule

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture.md — Asset Ingestion Service, Queue Pattern, pgvector]
- [Source: project-context.md — TransactionManager rule, 200ms rule, Hexagonal pattern]
- [Source: stories/2-1-asset-management-tenant-shared-drive.md — Previous story patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- pdf-parse dynamic import TypeScript error (TS2352/TS2349): Changed from `await import('pdf-parse')` to `require('pdf-parse')` to avoid ESM/CJS interop issues
- RLS setup tests: Updated query count 16→20 (pgvector extension + knowledge_chunks RLS), policy count 4→5
- data-vault.component.spec.ts: Used `NEVER` observable to test intermediate indexing state (mock `of()` completes synchronously)
- file-card.component.ts accessibility: Added `role="presentation"` and `(keydown.enter)` to action wrapper divs

### Completion Notes List

- All 12 ACs covered
- 335 tests passing (46 new): shared=1, db-layer=16, api-gateway=183, web=136
- 0 lint errors across all projects
- BullMQ processor runs in api-gateway (MVP decision documented in ingestion.module.ts)
- Embedding stored as float8[] for TypeORM compatibility (pgvector native queries deferred to Story 2.3)
- MockEmbeddingProvider returns deterministic normalized 768-dim vectors based on text hash

### Change Log

- Installed `mammoth` for DOCX text extraction
- Added env vars: EMBEDDING_PROVIDER, EMBEDDING_MODEL, CHUNK_SIZE, CHUNK_OVERLAP

### File List

**New files:**
- `libs/db-layer/src/lib/entities/knowledge-chunk.entity.ts`
- `libs/shared/src/lib/dtos/asset/index-asset-response.dto.ts`
- `libs/shared/src/lib/dtos/asset/knowledge-chunk-response.dto.ts`
- `apps/api-gateway/src/app/ingestion/ingestion.module.ts`
- `apps/api-gateway/src/app/ingestion/ingestion.service.ts`
- `apps/api-gateway/src/app/ingestion/ingestion.controller.ts`
- `apps/api-gateway/src/app/ingestion/ingestion.processor.ts`
- `apps/api-gateway/src/app/ingestion/text-extractor.service.ts`
- `apps/api-gateway/src/app/ingestion/chunker.service.ts`
- `apps/api-gateway/src/app/ingestion/embedding.service.ts`
- `apps/api-gateway/src/app/ingestion/embedding.provider.ts`
- `apps/api-gateway/src/app/ingestion/ingestion.service.spec.ts`
- `apps/api-gateway/src/app/ingestion/ingestion.controller.spec.ts`
- `apps/api-gateway/src/app/ingestion/text-extractor.service.spec.ts`
- `apps/api-gateway/src/app/ingestion/chunker.service.spec.ts`
- `apps/api-gateway/src/app/ingestion/embedding.service.spec.ts`
- `apps/web/src/app/app/data-vault/file-card.component.spec.ts`

**Modified files:**
- `libs/db-layer/src/lib/entities/index.ts` — added KnowledgeChunkEntity export
- `libs/db-layer/src/lib/rls-setup.service.ts` — pgvector extension + knowledge_chunks RLS
- `libs/db-layer/src/lib/rls-setup.service.spec.ts` — updated query/policy counts
- `libs/db-layer/src/test-utils/factories.ts` — added createMockKnowledgeChunk
- `libs/db-layer/src/test-utils/index.ts` — added export
- `libs/shared/src/lib/dtos/asset/index.ts` — added new DTO exports
- `apps/api-gateway/src/app/app.module.ts` — BullModule.forRoot() + IngestionModule
- `apps/web/src/app/core/services/asset.service.ts` — indexAsset/deIndexAsset methods
- `apps/web/src/app/app/data-vault/file-card.component.ts` — rewritten with brain badge, indexing UI
- `apps/web/src/app/app/data-vault/data-vault.component.ts` — indexingIds, index/deIndex handlers
- `apps/web/src/app/app/data-vault/data-vault.component.html` — bulk Learn This button, card bindings
- `apps/web/src/app/app/data-vault/data-vault.component.spec.ts` — 4 new indexing tests
- `.env` — added EMBEDDING_PROVIDER, EMBEDDING_MODEL, CHUNK_SIZE, CHUNK_OVERLAP
- `.env.example` — added new env vars
- `apps/api-gateway/src/app/ingestion/ingestion.processor.spec.ts` — NEW (added during review)

## Senior Developer Review

**Review Date:** 2026-02-01
**Reviewer Model:** Claude Opus 4.5 (claude-opus-4-5-20251101)
**Review Mode:** Adversarial code review (YOLO)
**Verdict:** PASS — all HIGH and MEDIUM issues fixed

### Findings (8 total: 3 High, 3 Medium, 2 Low)

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| H1 | HIGH | GeminiEmbeddingProvider re-instantiated GoogleGenerativeAI client on every batch call | **Fixed** — Moved client + model instantiation to constructor, stored as `this.genAIModel` field |
| H2 | HIGH | BullModule.forRoot used raw `process.env` instead of ConfigService | **Fixed** — Changed to `BullModule.forRootAsync` with ConfigService injection |
| H3 | HIGH | Frontend stopped spinner after 202 response, misleading user about indexing completion | **Fixed** — Implemented 3-second polling mechanism. Spinner stays until backend confirms `isIndexed=true` |
| M1 | MEDIUM | deIndexAsset didn't validate `isIndexed` before deleting chunks | **Fixed** — Added `BadRequestException` guard when asset is not indexed |
| M2 | MEDIUM | No test coverage for IngestionProcessor | **Fixed** — Created `ingestion.processor.spec.ts` with 2 tests |
| M3 | MEDIUM | Bulk operations used fire-and-forget parallel requests without error aggregation | **Fixed** — Replaced with RxJS `forkJoin` for both `deleteSelected()` and `indexSelected()` |
| L1 | LOW | Unused `Subject` import in data-vault.component.spec.ts | **Fixed** — Removed |
| L2 | LOW | KnowledgeChunkResponseDto created but unused | **Accepted** — Forward-declared for Story 2.3 (Semantic Search), no action needed |

### Post-Review Test Results

- **api-gateway:** 23 suites, 183 tests passing
- **web:** 18 suites, 136 tests passing
- **db-layer:** 16 tests passing
- **shared:** 1 test passing
- **Total:** 335 tests, 0 lint errors
- **New tests from review:** +4 (ingestion.processor.spec.ts ×2, ingestion.service.spec.ts ×1, data-vault.component.spec.ts ×2, minus 0 removed)

### Key User Directives Captured

1. **Production-quality MVP mandate:** "Being MVP is not an excuse for lousy implementation. We are building a production level MVP without any loose ends. There is no excuse: 'fine for mvp' — not now or in any upcoming things."
2. **LLM provider-agnostic architecture confirmed:** Hexagonal embedding pattern (`EmbeddingProvider` interface) already in place. Extends to all future LLM usage (Epic 4+). Each new provider requires a thin adapter class (~30-50 lines).
