# Handover Context

**Project:** `project_bubble`
**Session Date:** 2026-02-01
**Status:** Epic 2 COMPLETE — Retrospective done, ready for Epic 3 (gates pending)

## 1. Workflow Protocol
We follow a **Strict Story-Driven Workflow** using the BMAD methodology.
**The Rule:** No code is written unless a specific `stories/<story>.md` file exists and is approved.

**Last Completed Stories:**
- `stories/2-4-validated-insight-storage-memory.md` — **done** (code review passed, 406 tests)
- `stories/2-3-semantic-search-service-vector-rag.md` — **done**
- `stories/2-2-vector-ingestion-reference-assets.md` — **done**
- `stories/2-1-asset-management-tenant-shared-drive.md` — **done**

**Next:**
- Pre-Epic-3 gates must be completed before any Epic 3 story creation

## 2. Current State
- **Epic 1:** done (all stories complete, retrospective done, NFR assessment done)
- **Epic 1H:** done (security & reliability hardening, 237 tests)
- **Epic 2:** done (all 4 stories complete, retrospective done, NFR assessment PASS after 13 hardening fixes)
- **Total tests:** 406 (shared=1, db-layer=15, api-gateway=254, web=137), 0 lint errors
- **Sprint tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml`

## 3. Pre-Epic-3 Gates (BLOCKING)

| Gate | Status | Notes |
|------|--------|-------|
| LangGraph.js quick-spec | NOT STARTED | Defines GraphJSON schema contract between Epic 3 (builder UI) and Epic 4 (execution engine). MUST complete before any Epic 3 story. |
| Swagger @ApiResponse gap fix | NOT STARTED | Add missing error response decorators to ALL Epic 1+2 controllers. Rule added to project-context.md. |
| Epic 2 retrospective | DONE | `_bmad-output/implementation-artifacts/epic-2-retro-2026-02-01.md` |
| Epic 2 NFR assessment | DONE (PASS) | `_bmad-output/epic-2-nfr-assessment.md` |

## 4. Next Actions
1. **Run LangGraph.js quick-spec** (`/bmad:bmm:workflows:quick-spec`) — GATE REQUIREMENT
2. **Fix Swagger @ApiResponse gaps** across all Epic 1+2 controllers
3. **Create Story 3.1** with `/bmad:bmm:workflows:create-story` (after gates met)
4. Continue through Epics 3 → 4 → 5 → 6 (with Epic 7 parallel to 4-6)
5. **After MVP delivery:** Husky pre-push hook, Story 1.11 CI/CD, Docker Compose, production deployment

## 5. Key Decisions (Accumulated)
- **Production-quality MVP mandate:** "Being MVP is not an excuse for lousy implementation. We are building a production level MVP without any loose ends. MVP IS NOT AN EXCUSE TO PRODUCE CRAP." — applies to ALL stories, assessments, and quality gates.
- **LLM provider-agnostic architecture:** Hexagonal pattern for ALL AI/LLM usage. `EmbeddingProvider` interface in place. Extends to `LLMProvider` in Epic 4+.
- **Story 1.11 (CI/CD) deferred to post-MVP.** BMAD workflow runs full lint/test/build on every story.
- **MVP runs on laptop.** Angular + NestJS + Postgres (Docker) + Redis (Docker) + Google AI API keys.
- **LangGraph.js Tech Spec required before Epic 3.** Defines `GraphJSON` schema contract.
- **Mock LLM Provider required before Epic 4.** `LLM_PROVIDER=mock|google-ai-studio|vertex`.
- **BullMQ processor in api-gateway (MVP).** Worker-engine reserved for Epic 4 (LangGraph).
- **Defense-in-depth tenant_id:** All raw SQL should include explicit `AND tenant_id = $N` alongside RLS. Applied in Epic 2 hardening, to be applied holistically in future hardening sprint.

## 6. Critical Process Corrections (Epic 2 Retro — 2026-02-01)
These are NON-NEGOTIABLE. Documented in `project-context.md` under "Process Discipline Rules":

1. **No "acceptable for MVP" filter.** Quality gates are PASS or FAIL. No CONCERNS with deferrals.
2. **Code review ALWAYS presents findings before fixing.** Even in YOLO mode.
3. **Report ALL metrics on every test run.** Tests, lint errors, AND lint warnings per project. No omissions.
4. **YOLO mode ≠ skip user decisions.** Only routine prompts are auto-confirmed.
5. **A bug in 5 places is 5 bugs**, not a "consistent pattern."

## 7. Epic 2 Technical Capabilities Built
- **pgvector:** Extension enabled, HNSW index, cosine similarity search
- **BullMQ:** Async ingestion pipeline with retry/backoff
- **Hexagonal Embedding:** `EmbeddingProvider` interface, Gemini + Mock implementations
- **Text Extraction:** pdf-parse, mammoth (DOCX), fs.readFile (TXT/MD)
- **Chunking:** ~2000 char chunks, ~400 overlap, paragraph/sentence/word boundaries
- **Validated Insights:** Verified knowledge storage with boosted search relevance
- **File Security:** Extension whitelist, 10MB Multer limit, MIME validation, filename sanitization

## 8. Known Issues
- SCSS budget warning on tenant-detail.component.scss (5.46 kB vs 4 kB budget) — cosmetic, not blocking
- api-gateway: 65 lint warnings (all `no-explicit-any` in test mocks) — accepted for test code
- `synchronize:true` in TypeORM — must switch to migrations before production (tracked for Epic 7)
