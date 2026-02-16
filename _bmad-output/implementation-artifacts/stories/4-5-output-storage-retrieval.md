# Story 4-5: Output Storage & Retrieval

Status: done

## Story

As a **Bubble Admin running a workflow**,
I want **the LLM-generated output for each file to be sanity-checked, persisted as a downloadable asset, and retrievable via API**,
so that **Epic 5 can render reports and customers can access their generated documents**.

## Context

The execution engine (Stories 4-0 through 4-3) handles fan-out (N jobs per workflow run), LLM calls via the provider factory, and fan-in aggregation. After the LLM returns a response, the text is stored in `rawLlmResponse` on the `PerFileResult` JSONB column — but NO persistent output file is created and no sanity checks are performed.

This story bridges the gap between "LLM returned text" and "user has a downloadable file." It also adds BullMQ immediate retry (per-job, 3 attempts) and granular per-file status tracking for real-time progress UI in Epic 5.

**Party mode date**: 2026-02-16
**Attendees**: Winston, Mary, John, Sally, Murat, Naz, Amelia, Bob, Barry, erinc (decision-maker)

**Critical clarification from party mode**: "Validation" was the wrong frame for this story. Story 3-11 (section/chapter wizard input) was cancelled — there is no schema to validate against. The prompts are Bubble's IP, written by the Bubble team. Customers upload inputs and click Run. If the LLM output format is wrong, it's a prompt engineering problem, not a runtime validation problem. This story does sanity checks only (non-empty, valid text, within bounds).

## Key Decisions (from party mode 2026-02-16)

1. **No structural document validation** — we control the prompts; LLM output format is a prompt engineering concern, not runtime validation. Story 3-11 cancellation removed sections from wizard.
2. **Sanity checks only** — non-empty, valid UTF-8 text, within token bounds, detect garbage responses.
3. **Immediate retry per-job** — BullMQ built-in retry (3 attempts, exponential backoff). NOT "process all then retry failures." UX-first: user sees responsive progress, not idle waiting.
4. **Fan-in counter invariant** — increments only on terminal state (completed/failed after ALL retries exhausted). Never on retry attempts.
5. **Granular per-file status** — `pending → processing → retrying → completed | failed` with `retryAttempt` and `maxRetries` fields on PerFileResult.
6. **Store raw markdown** — format-agnostic storage. No section marker parsing (Epic 5 concern).
7. **Markdown rendering in Epic 5** — Angular markdown library + CSS theme. Noted on sprint-status 5-1.
8. **Naz's HTML comment section markers** — `<!-- SECTION:key -->` convention noted for Epic 5 story 5-3 when per-section operations are needed.
9. **Output persisted as AssetEntity** — `sourceType: 'workflow_output'`, deterministic filenames from `filename_template`.
10. **Version management deferred** — Epic 5 story 5-4 handles keep/archive decision for regenerated outputs.
11. **Stop populating rawLlmResponse on WorkflowRunEntity** — column stays (no migration), just unused. PerFileResult + AssetEntity are the truth.
12. **mimeType from format field** — `WorkflowOutput.format` drives mimeType (`markdown` → `text/markdown`, `json` → `application/json`), not hardcoded.
13. **createFromBuffer on AssetsService** — new method to create assets from raw text/buffer instead of Multer upload objects. Avoids coupling processor to Multer types.
14. **Raw stream for output download** — `Content-Type` + `Content-Disposition` headers, no JSON wrapper.
15. **Retry failed button wiring deferred** — Story 4-5b: `POST /workflow-runs/:id/retry-failed`, credit re-deduction, fan-in counter re-opening. Existing button (from 4-3) stays unconnected in 4-5.

## Tasks

- [x] 1. Expand PerFileResult interface with granular status and retry tracking (AC: #1)
  - [x] 1.1 Add `'pending' | 'processing' | 'retrying'` to PerFileResult status union type
  - [x] 1.2 Add `retryAttempt?: number` and `maxRetries?: number` fields to PerFileResult
  - [x] 1.3 Add `outputAssetId?: string` field to PerFileResult for linking to output asset
  - [x] 1.4 Update WorkflowRunResponseDto if needed to expose new fields — NOT NEEDED, PerFileResult is typed via shared interface and already passed through in response DTO
- [x] 2. Configure BullMQ immediate retry for fan-out jobs (AC: #2, #3)
  - [x] 2.1 Add `attempts: 3, backoff: { type: 'exponential', delay: 1000 }` to fan-out job options via JOB_RETRY_OPTIONS constant
  - [x] 2.2 Verify fan-in counter logic: `completed` event fires only on success, `failed` fires only after all attempts exhausted — verified, counter increment is inside recordFanOutSuccess which only runs after successful LLM call
  - [x] 2.3 Write intermediate status to PerFileResult on retry (`retrying` + attempt number) via `writePerFileStatus` helper
- [x] 3. Implement output sanity check utility (AC: #4)
  - [x] 3.1 Create `output-sanity-check.util.ts` with `validateLlmOutput(text, tokenBudget)` function
  - [x] 3.2 Checks: non-empty, valid string (not null/undefined), within token bounds, minimum length (>50 chars)
  - [x] 3.3 Returns `{ valid: boolean; reason?: string }` — reason populates PerFileResult.errorMessage on failure
- [x] 4. Persist LLM output as AssetEntity + track token usage (AC: #4, #5, #6, #7)
  - [x] 4.1 `createFromBuffer(buffer, metadata)` method already exists on AssetsService — verified and used directly
  - [x] 4.2 After sanity check passes, call `createFromBuffer` with markdown text, `sourceType: 'workflow_output'`, `workflowRunId`, deterministic filename
  - [x] 4.3 Set mimeType from `WorkflowOutput.format` field via FORMAT_MIME_MAP (`markdown` → `text/markdown`, `json` → `application/json`)
  - [x] 4.4 Append output asset ID to WorkflowRun.outputAssetIds array via SQL array_append
  - [x] 4.5 Link outputAssetId in the PerFileResult entry
  - [x] 4.6 tokenUsage from LLM response was already persisted in PerFileResult via recordFanOutSuccess — verified
  - [x] 4.7 Aggregate total tokenUsage in finalizeRun for run-level summary — already exists via finalizeRun SQL query
  - [x] 4.8 Stop populating rawLlmResponse on WorkflowRunEntity — removed from recordFanOutSuccess entity update
- [x] 5. Implement deterministic filename generation (AC: #7)
  - [x] 5.1 Create `output-filename.util.ts` with `generateOutputFilename(template, subjectFileName, index)` function
  - [x] 5.2 Support placeholders: `{subject}` (input filename without extension), `{index}` (file number), `{date}` (ISO date)
  - [x] 5.3 Fallback to `output-{index}.md` if no template defined
- [x] 6. Add API endpoints for run outputs (AC: #8, #9)
  - [x] 6.1 `GET /api/app/workflow-runs` — list runs with pagination (`page`, `limit`) and optional `status` filter (tenant-scoped, Rule 2c)
  - [x] 6.2 `GET /api/app/workflow-runs/:id` — return run details including perFileResults and outputAssetIds (tenant-scoped, Rule 2c)
  - [x] 6.3 `GET /api/app/workflow-runs/:id/outputs/:fileIndex` — raw stream with `Content-Type` (from asset mimeType) + `Content-Disposition` headers, no JSON wrapper
  - [x] 6.4 Guards: JwtAuthGuard + TenantStatusGuard + RolesGuard on endpoints — existing guard setup on WorkflowRunsController already covers this

## Acceptance Criteria

- [x] AC1: PerFileResult interface includes granular status (`pending`, `processing`, `retrying`, `completed`, `failed`) and `retryAttempt`/`maxRetries` fields
- [x] AC2: Fan-out jobs configured with BullMQ retry (3 attempts, exponential backoff) — retries happen immediately per-job, not as a second pass
- [x] AC3: Fan-in counter increments only on terminal state (success after completion OR failure after all retries exhausted) — never on intermediate retry attempts
- [x] AC4: LLM response passes sanity checks (non-empty, valid text, within token bounds) before output file is created; failed checks mark the file as `failed` with a human-readable reason
- [x] AC5: Each successful per-file output is persisted as an AssetEntity with `sourceType: 'workflow_output'` and linked to the WorkflowRun via `workflowRunId` FK
- [x] AC6: Output asset ID is recorded in PerFileResult.outputAssetId and in WorkflowRun.outputAssetIds array
- [x] AC7: Output filename is deterministic, generated from the workflow definition's `filename_template` with subject file name substitution
- [x] AC8: `GET /api/app/workflow-runs/:id` returns run details including perFileResults with all status fields (tenant-scoped, Rule 2c)
- [x] AC9: `GET /api/app/workflow-runs/:id/outputs/:fileIndex` streams the output file content from disk (tenant-scoped, Rule 2c)

## Out-of-Scope

- Document structure validation (sections/chapters) → NOT NEEDED (Story 3-11 cancelled, we control prompts)
- Section marker parsing (`<!-- SECTION:key -->`) → Epic 5 story 5-3
- Collapsed/expanded per-file progress UI → Epic 5 story 5-1
- User feedback & regeneration → Epic 5 story 5-4
- Version management (keep/archive) → Epic 5 story 5-4
- Markdown rendering in browser → Epic 5 story 5-1
- JSON output format support → deferred (all current workflows output markdown)
- "Retry failed" button wiring (endpoint + credit re-deduction + fan-in re-open) → Story 4-5b

## Implementation Notes

1. **BullMQ retry is built-in**: Configure `attempts` and `backoff` on job options where fan-out jobs are enqueued (in `WorkflowExecutionService` or processor). BullMQ fires `completed` only on success, `failed` only after all attempts exhausted. Existing fan-in counter logic needs ZERO changes for the counter itself.

2. **Intermediate status writes**: When a job starts processing, update PerFileResult status to `processing`. On retry, update to `retrying` with `retryAttempt`. This requires writing to DB mid-job (before final success/failure). Use the same atomic JSONB append pattern from `recordFanOutSuccess`.

3. **AssetEntity creation via createFromBuffer**: Add `createFromBuffer(buffer: Buffer, metadata: { tenantId, filename, mimeType, sourceType, workflowRunId })` to AssetsService. Follows same pattern as `upload()` (disk write → SHA256 → DB record) but takes raw buffer instead of Multer file object. This avoids coupling the processor to Express/Multer types.

4. **Filename template expansion**: The `WorkflowOutput.filename_template` field exists in the workflow definition. Expand `{subject}` → input filename stem, `{index}` → 0-padded file number, `{date}` → ISO date string.

5. **Rule 2c compliance**: ALL new queries MUST include `tenantId` in WHERE clause. The GET endpoints must scope by tenant from JWT. The asset creation must set `tenantId` from the workflow run's tenant.

6. **Rule 31 compliance**: If any new raw SQL uses RETURNING, add Tier 2 wiring test. The existing `recordFanOutSuccess` already uses raw SQL with RETURNING — verify it's covered.

7. **Sanity check is NOT validation**: We check "did we get something?" not "is the structure correct?" The checks are: (a) non-null/non-empty string, (b) length > 50 characters, (c) total tokens within budget, (d) response is valid text (not binary garbage).

8. **Output file download**: `GET /workflow-runs/:id/outputs/:fileIndex` returns raw file stream with `Content-Type` (from asset mimeType) and `Content-Disposition: attachment; filename="..."` headers. No JSON wrapper — client gets the file directly.

9. **Stop populating rawLlmResponse**: The column on WorkflowRunEntity stays (no migration), but the processor stops writing to it. PerFileResult.rawLlmResponse + the persisted AssetEntity file are the source of truth.

## Test Data Strategy

**Existing fixtures to leverage:**
- Workflow run with fan-out jobs (from 4-3 test infrastructure)
- AssetEntity creation pattern (from assets.service.spec.ts)
- BullMQ job processing mocks (from processor spec)

**Key test scenarios:**
- Happy path: LLM returns valid markdown → sanity check passes → file written → asset created → linked to run
- Empty response: LLM returns empty string → sanity check fails → PerFileResult status = `failed`, errorMessage set
- Token budget exceeded: response exceeds budget → sanity check fails
- Retry success: first attempt fails (LLM error), second attempt succeeds → fan-in counter increments once
- All retries exhausted: 3 failures → PerFileResult status = `failed` after all attempts
- Filename template: `{subject}-report.md` with input file `data.xlsx` → `data-report.md`
- GET endpoint: returns run with perFileResults and outputAssetIds (tenant-scoped)
- GET output file: streams file content, 404 for invalid index, 403 for wrong tenant

## Code Review

### Pass 1 — Amelia (self-review, same session)

**10 findings identified. User approved all 10.**

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| F1 | HIGH | Rule 2c: Raw SQL UPDATEs in processor missing `AND tenant_id = $N` (writePerFileStatus, recordFanOutSuccess upsert, recordFanOutSuccess array_append) | FIX — Added `AND tenant_id` clause to all 3 raw SQL UPDATE statements |
| F2 | HIGH | Rule 2c: `manager.findOne(WorkflowRunEntity, { where: { id: runId } })` missing tenantId | FIX — Added `tenantId` to WHERE |
| F3 | MEDIUM | `manager.update(WorkflowRunEntity, { id: runId }, {...})` missing tenantId in criteria | FIX — Added `tenantId` to update criteria |
| F4 | MEDIUM | downloadOutput: no error handler for missing/unreadable files on disk | FIX — Added `fileStream.on('error', ...)` before `pipe()` |
| F5 | MEDIUM | `uploadedBy` set to model name instead of user UUID | FIX — Changed to `run.startedBy` (single-job) and added `startedBy` param to `recordFanOutSuccess` (fan-out) |
| F6 | MEDIUM | No DTO validation tests for ListWorkflowRunsQueryDto | FIX — Added 6 tests (4-5-UNIT-043 through 048) in workflow-query.dto.spec.ts |
| F7 | MEDIUM | downloadOutput test was rejecting on happy path (missing fs mock) | FIX — Added partial `jest.mock('fs')` with `...jest.requireActual('fs')`, fixed mockRes stream methods |
| F8 | LOW | `createFromBuffer` has no MIME type validation (internal API) | DEFERRED_TO: 4-test-gaps-error-path-coverage |
| F9 | LOW | `WorkflowRunResponseDto.toResponse` omits templateId, templateName, workflowName | DEFERRED_TO: 5-1-interactive-report-dashboard |
| F10 | LOW | `makeJob()` defaults `attemptsMade: 3` in processor spec (should be 0) | DEFERRED_TO: 4-test-gaps-error-path-coverage |

**Test count after Pass 1 fixes**: 1,575 (api-gateway 851 + db-layer 40 + shared 103 + web 581)

### Pass 2 — Naz (adversarial, party mode, fresh context)

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| N2-1 | HIGH | Rule 2c: `recordFanOutSuccess` counter `WHERE id = $1` missing `AND tenant_id` | FIX — added `AND tenant_id = $3` |
| N2-2 | HIGH | Rule 2c: `recordFanOutFailure` counter `WHERE id = $1` missing `AND tenant_id` | FIX — added `AND tenant_id = $2` |
| N2-3 | HIGH | Rule 2c: `recordFanOutFailure` per_file_results upsert `WHERE id = $3` missing `AND tenant_id` | FIX — added `AND tenant_id = $4` |
| N2-4 | MEDIUM | Rule 2c: `finalizeRun` update `{ id: runId }` missing `tenantId` | FIX — changed to `{ id: runId, tenantId }` |
| N2-5 | MEDIUM | Rule 2c: `markRunFailed` update `{ id: runId }` missing `tenantId` | FIX — changed to `{ id: runId, tenantId }` |
| N2-6 | HIGH | Content-Disposition header injection — unsanitized `originalName` (OWASP) | FIX — regex sanitization of `"`, `\`, `/`, `\n`, `\r` + test 4-5-UNIT-049 |
| N2-7 | LOW | `findAllByTenant` offset can go negative if DTO validation bypassed | FIX — `Math.max(0, ...)` defense-in-depth |

**All 7 findings FIXED.** 5 are Rule 2c violations (same recurring violation — added to Epic 4 retro agenda).

**Test count after Pass 2 fixes**: 1,576 (api-gateway 852 + db-layer 40 + shared 103 + web 581)

### Pass 3 — Murat (test/arch, party mode, fresh context)

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| M3-1 | MEDIUM | Rule 2c: `markRunRunning` update `{ id: runId }` missing `tenantId` in criteria — missed by BOTH Pass 1 and Pass 2 | FIX — changed to `{ id: runId, tenantId }` |
| M3-2 | MEDIUM | No test for sanity check failure in fan-out path (only single-job tested) | FIX — added test 4-5-UNIT-050 |
| M3-3 | MEDIUM | No test for `createFromBuffer` error propagation (disk full, permission denied) | FIX — added test 4-5-UNIT-051 |
| M3-4 | LOW | `makeJob()` defaults `attemptsMade: 3` — masks retry-related branches | Already tracked as F10 in 4-test-gaps-error-path-coverage |
| M3-5 | MEDIUM | No test for stream error handler in `downloadOutput` (file missing on disk) | FIX — added test 4-5-UNIT-052 |

**4 findings FIXED, 1 already tracked.** M3-1 is the 12th Rule 2c violation across 6 stories — retro item.

## Traceability

| Test ID | AC | File |
|---------|-----|------|
| 4-5-UNIT-001 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-002 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-003 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-004 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-005 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-006 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-007 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-008 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-009 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-010 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-011 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-012 | AC4 | output-sanity-check.util.spec.ts |
| 4-5-UNIT-013 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-014 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-015 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-016 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-017 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-018 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-019 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-020 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-021 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-022 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-023 | AC7 | output-filename.util.spec.ts |
| 4-5-UNIT-024 | AC8 | workflow-runs.controller.spec.ts |
| 4-5-UNIT-025 | AC8 | workflow-runs.controller.spec.ts |
| 4-5-UNIT-026 | AC9 | workflow-runs.controller.spec.ts |
| 4-5-UNIT-027 | AC9 | workflow-runs.controller.spec.ts |
| 4-5-UNIT-028 | AC8,AC9 | workflow-runs.controller.spec.ts |
| 4-5-UNIT-029 | AC8 | workflow-runs.controller.spec.ts |
| 4-5-UNIT-030 | AC8 | workflow-runs.service.spec.ts |
| 4-5-UNIT-031 | AC8 | workflow-runs.service.spec.ts |
| 4-5-UNIT-032 | AC8 | workflow-runs.service.spec.ts |
| 4-5-UNIT-033 | AC8 | workflow-runs.service.spec.ts |
| 4-5-UNIT-034 | AC8 | workflow-runs.service.spec.ts |
| 4-5-UNIT-035 | AC8 | workflow-runs.service.spec.ts |
| 4-5-UNIT-036 | AC9 | workflow-runs.service.spec.ts |
| 4-5-UNIT-037 | AC9 | workflow-runs.service.spec.ts |
| 4-5-UNIT-038 | AC9 | workflow-runs.service.spec.ts |
| 4-5-UNIT-039 | AC9 | workflow-runs.service.spec.ts |
| 4-5-UNIT-040 | AC9 | workflow-runs.service.spec.ts |
| 4-5-UNIT-041 | AC9 | workflow-runs.service.spec.ts |
| 4-5-UNIT-042 | AC8 | workflow-runs.service.spec.ts |
| Existing processor tests updated | AC1-AC6 | workflow-execution.processor.spec.ts |
| Existing execution service tests updated | AC2 | workflow-execution.service.spec.ts |
| 4-5-UNIT-043 | AC8 | workflow-query.dto.spec.ts |
| 4-5-UNIT-044 | AC8 | workflow-query.dto.spec.ts |
| 4-5-UNIT-045 | AC8 | workflow-query.dto.spec.ts |
| 4-5-UNIT-046 | AC8 | workflow-query.dto.spec.ts |
| 4-5-UNIT-047 | AC8 | workflow-query.dto.spec.ts |
| 4-5-UNIT-048 | AC8 | workflow-query.dto.spec.ts |
| 4-5-UNIT-049 | AC8 | workflow-runs.controller.spec.ts |
| 4-5-UNIT-050 | AC4 | workflow-execution.processor.spec.ts |
| 4-5-UNIT-051 | AC5 | workflow-execution.processor.spec.ts |
| 4-5-UNIT-052 | AC9 | workflow-runs.controller.spec.ts |

## Dev Agent Record

- **Agent**: Amelia
- **Session span**: 2 sessions (context compaction occurred)
- **Implementation date**: 2026-02-16
- **Tests added**: 52 new tests (12 sanity check + 11 filename + 7 controller + 13 service + 6 DTO validation + 3 Pass 2/3 coverage tests)
- **Tests updated**: 11 existing tests (8 processor + 3 execution service)
- **Test total**: 1,596 (api-gateway 872 + db-layer 40 + shared 103 + web 581) — excludes api-contract-b (Tier 3, needs running DB)
- **Previous total**: 1,527 (from 4-H1)
- **Delta**: +69
- **Pre-existing failures**: api-contract-b.spec.ts (Tier 3 DB-dependent — tracked in 4-test-gaps for graceful skip)
- **Code review findings**: Pass 1: 10 findings (7 fixed, 3 tracked). Pass 2: 7 findings (all fixed — 5 Rule 2c). Pass 3: 5 findings (4 fixed, 1 already tracked).
