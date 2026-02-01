# Handover Context

**Project:** `project_bubble`
**Session Date:** 2026-02-01
**Status:** Epic 2 COMPLETE — Swagger gate DONE, Workflow Definition Schema quick-spec gate pending

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
| Workflow Definition Schema quick-spec | NOT STARTED | Defines YAML workflow schema contract between Epic 3 (builder UI) and Epic 4 (execution engine). LangGraph.js DEFERRED — replaced by LLM-orchestrated execution. MUST complete before any Epic 3 story. |
| Swagger @ApiResponse gap fix | DONE | All 11 controllers (42 endpoints) now have complete @ApiResponse, @ApiTags, @ApiBearerAuth, @ApiOperation decorators. 406 tests, 0 errors. |
| Epic 2 retrospective | DONE | `_bmad-output/implementation-artifacts/epic-2-retro-2026-02-01.md` |
| Epic 2 NFR assessment | DONE (PASS) | `_bmad-output/epic-2-nfr-assessment.md` |

## 4. Next Actions
1. **Run Workflow Definition Schema quick-spec** (`/bmad:bmm:workflows:quick-spec`) — LAST REMAINING GATE. Defines YAML schema for atomic workflows, input roles, execution patterns, chain composition.
2. **Create Story 3.1** with `/bmad:bmm:workflows:create-story` (after schema gate met)
3. Continue through Epics 3 → 4 → 5 → 6 (with Epic 7 parallel to 4-6)
4. **After MVP delivery:** Husky pre-push hook, Story 1.11 CI/CD, Docker Compose, production deployment

## 5. Key Decisions (Accumulated)
- **Production-quality MVP mandate:** "Being MVP is not an excuse for lousy implementation. We are building a production level MVP without any loose ends. MVP IS NOT AN EXCUSE TO PRODUCE CRAP." — applies to ALL stories, assessments, and quality gates.
- **LLM provider-agnostic architecture:** Hexagonal pattern for ALL AI/LLM usage. `EmbeddingProvider` interface in place. Extends to `LLMProvider` in Epic 4+.
- **Story 1.11 (CI/CD) deferred to post-MVP.** BMAD workflow runs full lint/test/build on every story.
- **MVP runs on laptop.** Angular + NestJS + Postgres (Docker) + Redis (Docker) + Google AI API keys.
- **LangGraph.js DEFERRED to future epic.** Replaced by LLM-orchestrated execution for MVP. YAML prompts sent directly to LLM.
- **Workflow Definition Schema quick-spec required before Epic 3.** Defines YAML workflow schema contract (replaces GraphJSON).
- **Mock LLM Provider required before Epic 4.** `LLM_PROVIDER=mock|google-ai-studio|vertex`.
- **BullMQ processor in api-gateway (MVP).** Reused for workflow execution (fan-out/fan-in patterns).
- **Defense-in-depth tenant_id:** All raw SQL should include explicit `AND tenant_id = $N` alongside RLS. Applied in Epic 2 hardening, to be applied holistically in future hardening sprint.

### Architectural Pivot: LLM-Orchestrated Execution (Party Mode — 2026-02-01)
17 decisions captured from full-team party mode discussion:

1. **LangGraph.js deferred** — not used for MVP
2. **LLM-orchestrated execution** — YAML prompt sent directly to LLM, platform handles assembly only
3. **Atomic workflows** — each workflow = 1 LLM call pattern, clear inputs/outputs
4. **Input role taxonomy** — `context` (shared across runs) vs `subject` (items being processed)
5. **Fan-out** — `subject.accept: single` + `processing: parallel` → N parallel BullMQ jobs
6. **Fan-in** — `subject.accept: multiple` + `processing: batch` → 1 job with all files
7. **Workflow chains** — link atomic workflows sequentially, output of A → input of B
8. **Chain orchestrator** — lightweight BullMQ FlowProducer, watches step completion
9. **Context window** — pre-execution token count per job, interactive file selection UI if over limit
10. **Map-reduce** — deferred to post-MVP
11. **Output validation** — structural only (required sections present), no content quality judgment
12. **Prompt responsibility** — platform = infrastructure, prompt quality = Bubble's IP
13. **YAML is the prompt** — fed to LLM as-is, no transformation layer
14. **Input sources** — `asset` (existing), `upload` (new file), `text` (free-form entry)
15. **Workflow outputs = assets** — stored with `source_type: workflow_output`, linked to `workflow_run_id`
16. **Chain input mapping** — chain orchestrator auto-routes step N outputs → step N+1 subject inputs (metadata only, no file uploads in chain builder)
17. **Intermediate visibility** — users can inspect/download intermediate outputs between chain steps

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
- shared: 1 lint warning (unused `IsEnum` import in list-assets-query.dto.ts)
- api-gateway: 65 lint warnings (all `no-explicit-any` in test mocks + 2 unused eslint-disable directives) — accepted for test code
- `synchronize:true` in TypeORM — must switch to migrations before production (tracked for Epic 7)
