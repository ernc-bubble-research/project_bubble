# Handover Context

**Project:** `project_bubble`
**Session Date:** 2026-02-01
**Status:** Epic 2 in-progress — Story 2.2 done, Story 2.3 next

## 1. Workflow Protocol
We follow a **Strict Story-Driven Workflow** using the BMAD methodology.
**The Rule:** No code is written unless a specific `stories/<story>.md` file exists and is approved.

**Last Completed Stories:**
- `stories/2-2-vector-ingestion-reference-assets.md` — **done** (implemented + code reviewed, 335 tests)
- `stories/2-1-asset-management-tenant-shared-drive.md` — **done**
- `stories/1h-1-security-reliability-hardening.md` — **done**

**Next Story:**
- `stories/2-3-semantic-search-service-vector-rag.md` — **backlog** (needs create-story workflow)

## 2. Current State
- **Epic 1:** done (all stories complete, retrospective done, NFR assessment done)
- **Epic 1H:** done (security & reliability hardening, 237 tests)
- **Epic 2:** in-progress (2.1 done, 2.2 done, 2.3-2.4 backlog)
- **Total tests:** 335 (shared=1, db-layer=16, api-gateway=183, web=136), 0 lint errors
- **Sprint tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

## 3. Next Actions
1. **Create & Execute Story 2.3:** Semantic Search Service (Vector RAG) — uses KnowledgeChunkResponseDto and pgvector queries
2. **Create & Execute Story 2.4:** Validated Insight Storage (Memory)
3. **Before Epic 3:** Run quick-spec for LangGraph.js Integration Tech Spec (defines GraphJSON schema contract)
4. **Epic 3:** Workflow Definition (requires tech spec first)
5. **Before Epic 4:** Build Mock LLM Provider (Hexagonal pattern)
6. Continue through Epics 4 → 5 → 6 (with Epic 7 parallel to 4-6)
7. **After MVP delivery:** Husky pre-push hook, Story 1.11 CI/CD, Docker Compose, production deployment

## 4. Key Decisions (Accumulated)
- **Production-quality MVP mandate:** "Being MVP is not an excuse for lousy implementation. We are building a production level MVP without any loose ends." — applies to all stories.
- **LLM provider-agnostic architecture:** Hexagonal pattern confirmed for ALL AI/LLM usage. `EmbeddingProvider` interface already in place (Story 2.2). Extends to `LLMProvider` in Epic 4+. Each new provider is a thin adapter (~30-50 lines). Switchable via env var.
- **Story 1.11 (CI/CD) deferred to post-MVP.** BMAD workflow runs full lint/test/build on every story.
- **MVP runs on laptop.** Angular + NestJS + Postgres (Docker) + Redis (Docker) + Google AI API keys.
- **LangGraph.js Tech Spec required before Epic 3.** Defines `GraphJSON` schema contract.
- **Mock LLM Provider required before Epic 4.** `LLM_PROVIDER=mock|google-ai-studio|vertex`.
- **BullMQ processor in api-gateway (MVP).** Worker-engine reserved for Epic 4 (LangGraph). Documented for future migration.

## 5. Story 2.2 Code Review Highlights
- GeminiEmbeddingProvider: client instantiated once in constructor (not per-batch)
- BullModule.forRootAsync with ConfigService (no raw process.env)
- Frontend polling (3s interval) for indexing state — spinner stays until `isIndexed=true`
- forkJoin for bulk operations (deleteSelected, indexSelected)
- deIndexAsset validates `isIndexed` before deleting chunks
- Full review findings in `stories/2-2-vector-ingestion-reference-assets.md` → Senior Developer Review section

## 6. Known Issues
- SCSS budget warning on tenant-detail.component.scss (5.46 kB vs 4 kB budget) — cosmetic, not blocking
