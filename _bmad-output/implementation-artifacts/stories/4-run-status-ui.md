# Story 4-run-status-ui: Executions List & Detail UI

Status: done

## Story

As a **customer admin or creator**,
I want **to view my workflow execution history, inspect per-file results, download outputs, and retry failed files**,
so that **I can track the status of my workflow runs, retrieve completed outputs, and recover from failures without admin intervention**.

## Context

This is primarily a frontend story with a small backend DTO expansion (Task 1). All four backend APIs are fully built and tested (Stories 4-1, 4-5, 4-5b):
- `GET /api/app/workflow-runs` — paginated list with status filter
- `GET /api/app/workflow-runs/:id` — detail with perFileResults
- `POST /api/app/workflow-runs/:id/retry-failed` — retry failed files (credit re-deduction)
- `GET /api/app/workflow-runs/:id/outputs/:fileIndex` — file download (blob)

**Route/API naming note:** Frontend routes use `/app/executions` (user-facing label) while backend API uses `/api/app/workflow-runs` (resource name). This is intentional — UI label ≠ API resource name.

**Party Mode Decisions (2026-02-22):**
- **Sidebar label**: "Executions" — industry standard (n8n, Make.com, Zapier pattern)
- **Routing**: `/app/executions` (list), `/app/executions/:id` (detail)
- **Polling**: 5s on detail page (active runs), 10s on list page (active runs). Auto-stop on terminal state.
- **Bulk download**: `client-zip` library (6.4kB, zero deps, streaming) for "Download All" on fan-out runs
- **Retry button**: "Retry Failed Files" label (not "Continue"). Confirmation dialog showing refund context + re-deduction amount.
- **Max retry guard**: Disable retry button + tooltip when all failed files at max retries
- **Service**: New dedicated `WorkflowRunService` (separate from `WorkflowCatalogService`)
- **Telemetry**: Aggregated failure dashboards deferred to 7P-8. This story shows per-run error messages only.

**Backend DTO Gap:**
`WorkflowRunResponseDto` is missing fields the UI needs: `startedAt`, `completedAt`, `durationMs`, `errorMessage`, `maxRetryCount`, `creditsPerRun`, and `inputSnapshot` (contains `templateName`). Task 1 expands the DTO. This is a backward-compatible additive change (new optional fields).

**Status Badge Color Mapping:**
| Status | Color | Style |
|--------|-------|-------|
| `queued` | Gray | Solid |
| `running` | Blue | Animated pulse |
| `completed` | Green | Solid |
| `completed_with_errors` | Amber/Orange | Solid |
| `failed` | Red | Solid |
| `cancelled` | Gray | Strikethrough text |

**Date Display Format:**
- < 24 hours: Relative time ("2 hours ago", "5 minutes ago")
- >= 24 hours: Absolute date ("Feb 22, 2026, 2:30 PM")

**Polling Test Strategy:**
Use `jest.useFakeTimers()` to control `interval()`. Mock service to return different statuses on successive calls. Advance timers with `jest.advanceTimersByTime()`. Verify re-fetch on non-terminal, auto-stop on terminal, cleanup on destroy.

**Story Review Findings (2026-02-22):**
12 findings from full team review — all addressed in this version:
- W-1: Task 1 wording fixed (add or update mapping)
- W-2: Test run filtering moved to backend (excludeTestRuns query param)
- W-3: Route/API naming documented in Context
- W-4: `creditsPerRun` added to DTO expansion
- N-1: `Cancelled` added to status filter
- N-2: Retry dialog loading state added to AC7
- N-3: Download uses `perFileResult.fileName` (no header parsing)
- S-1: Status badge color mapping defined in Context
- S-2: Date format defined in Context
- J-1: Queued/pending empty state added to AC5
- M-1: Polling test strategy documented in Context
- M-2: Service test row added to traceability

## Acceptance Criteria

### AC1: WorkflowRunResponseDto Expanded
**Given** the existing `WorkflowRunResponseDto` in `libs/shared`
**When** the frontend requests run data
**Then** the DTO includes additional fields: `startedAt`, `completedAt`, `durationMs`, `errorMessage`, `maxRetryCount`, `creditsPerRun`, `templateName` (extracted from `inputSnapshot.templateName`)
**And** the service DTO mapping populates these fields from the entity
**And** existing API consumers are unaffected (all new fields are optional)

### AC2: Sidebar Navigation — "Executions" Tab
**Given** a customer admin or creator logged in to the app
**When** they view the sidebar navigation
**Then** an "Executions" tab appears between "Workflows" and "Access Log"
**And** the tab uses the `list-checks` Lucide icon
**And** clicking it navigates to `/app/executions`
**And** `routerLinkActive` highlights the tab when on any `/app/executions` route

### AC3: Executions List Page
**Given** a customer navigates to `/app/executions`
**When** the page loads
**Then** a table displays with columns: Status (badge per color mapping), Workflow Name, Created (relative/absolute per date format), Files (completed/total), Credits, Actions (View)
**And** runs are sorted by `createdAt` DESC (newest first)
**And** pagination controls appear (Previous/Next) with page/total display
**And** a status filter dropdown allows filtering by: All, Queued, Running, Completed, Completed with Errors, Failed, Cancelled
**And** empty state shows: "No executions yet. Start by running a workflow from the catalog."
**And** test runs are excluded via backend query param (`excludeTestRuns=true`), NOT filtered on the frontend

### AC4: List Page Polling
**Given** the executions list page is displayed
**When** any visible run has a non-terminal status (`queued` or `running`)
**Then** the list auto-refreshes every 10 seconds
**And** polling stops when all visible runs reach terminal state or the component is destroyed
**And** polling uses `takeUntilDestroyed(this.destroyRef)` for cleanup

### AC5: Execution Detail Page
**Given** a customer clicks "View" on a run row or navigates to `/app/executions/:id`
**When** the detail page loads
**Then** a header shows: workflow name, status badge (per color mapping), created date, started/completed timestamps, duration, credits consumed
**And** when the run is `queued` (no perFileResults yet), a message shows: "Run is queued, waiting to start..." with no per-file table
**And** when the run is `running` with partial perFileResults, pending files show "Pending" status badge (gray)
**And** an error message banner appears if `errorMessage` is present (for failed runs)
**And** a per-file results table shows: File Name, Status (badge per color mapping), Token Usage (input/output), Retry Attempt (X of max), Actions (Download/Error)
**And** failed file rows show expandable error message text
**And** completed file rows show a "Download" button using `perFileResult.fileName` as the download filename
**And** a "Back to Executions" link returns to the list page

### AC6: Detail Page Polling
**Given** the detail page is displayed for a non-terminal run
**When** the run status is `queued` or `running`
**Then** the page auto-refreshes every 5 seconds
**And** polling stops when run reaches terminal state or the component is destroyed

### AC7: Retry Failed Files — Confirmation Dialog
**Given** a run with status `completed_with_errors` and at least one failed file below max retries
**When** the customer clicks "Retry Failed Files"
**Then** a confirmation dialog appears showing:
  - Number of files to retry (only files below max retry count)
  - Credit cost computed from `creditsPerRun` field (files to retry x creditsPerRun)
  - Message: "Credits for failed files were refunded. Retrying will deduct X credits."
  - [Cancel] and [Retry Failed Files] buttons
**And** the "Retry Failed Files" button in the dialog shows a loading spinner during the API call and is disabled to prevent double-clicks
**And** clicking "Retry Failed Files" calls `POST /workflow-runs/:id/retry-failed`
**And** on success, the dialog closes and the page refreshes to show updated perFileResults
**And** on error (402 insufficient credits, 409 already running), an error toast appears and the dialog remains open

### AC8: Retry Button State Management
**Given** a run detail page
**When** the run status is NOT `completed_with_errors`
**Then** the "Retry Failed Files" button is hidden
**When** all failed files have reached `maxRetryCount`
**Then** the button is disabled with tooltip: "All failed files have reached the maximum retry limit (X attempts)"
**When** some but not all failed files are at max retries
**Then** the button shows: "Retry N Failed Files" (only retryable count)

### AC9: Bulk Download (Download All)
**Given** a completed or completed_with_errors run with multiple output files
**When** the customer clicks "Download All"
**Then** all completed output files are fetched as blobs
**And** a zip file is created client-side using `client-zip`
**And** the zip is downloaded as `{workflowName}-outputs.zip`
**And** a progress indicator shows "Downloading X of Y files..."
**And** failed/pending files are skipped (only completed files included)
**And** the button is hidden if zero files are completed

## Tasks

### Task 1: Expand WorkflowRunResponseDto + Service Mapping
- [x] 1.1 Add fields to `WorkflowRunResponseDto`: `startedAt?`, `completedAt?`, `durationMs?`, `errorMessage?`, `maxRetryCount?`, `creditsPerRun?`, `templateName?`
- [x] 1.2 Add or update DTO mapping in `workflow-runs.service.ts` to populate new fields (extract `templateName` from `inputSnapshot.templateName`, extract `creditsPerRun` from `inputSnapshot` or template lookup)
- [x] 1.3 Add `excludeTestRuns` query param support to `ListWorkflowRunsQueryDto` and `findAllByTenant()` — filter `isTestRun = false` in the WHERE clause when param is true
- [x] 1.4 Add unit tests: DTO mapping includes new fields, `templateName` extracted correctly, `excludeTestRuns` filters correctly
- [x] 1.5 Verify existing tests still pass (backward-compatible change)

### Task 2: WorkflowRunService + Routing + Sidebar
- [x] 2.1 Create `workflow-run.service.ts` with methods: `listRuns(params)`, `getRun(id)`, `retryFailed(id)`, `downloadOutput(id, fileIndex)` — `downloadOutput` returns Observable<Blob> and uses `perFileResult.fileName` for client-side filename
- [x] 2.2 Add unit tests for all 4 service methods (mock HttpClient, verify URLs/params/response types)
- [x] 2.3 Add routes to `app.routes.ts`: `/app/executions` (list), `/app/executions/:id` (detail)
- [x] 2.4 Add "Executions" nav item to `AppLayoutComponent.navItems` (icon: `list-checks`, route: `/app/executions`)
- [x] 2.5 Register `ListChecks` icon in `app.config.ts` and `app-layout.component.spec.ts`
- [x] 2.6 Install `client-zip` dependency: `npm install client-zip`

### Task 3: Executions List Component
- [x] 3.1 Create `execution-list.component.ts` with signals: `runs`, `total`, `page`, `limit`, `statusFilter`, `isLoading`
- [x] 3.2 Implement table with columns: status badge (per color mapping), workflow name, created date (relative/absolute per format), files (completed/total), credits, view action
- [x] 3.3 Implement status filter dropdown (All + all 6 statuses including Cancelled) and pagination (previous/next)
- [x] 3.4 Implement polling: `interval(10000)` when any visible run is non-terminal, auto-stop
- [x] 3.5 Pass `excludeTestRuns=true` query param on all list API calls
- [x] 3.6 Add unit tests: loading state, empty state, populated table, filter changes (including Cancelled), pagination, polling lifecycle (use `jest.useFakeTimers()`)

### Task 4: Execution Detail Component
- [x] 4.1 Create `execution-detail.component.ts` with signals: `run`, `isLoading`, `isRetrying`, `downloadProgress`
- [x] 4.2 Implement header section: workflow name, status badge (per color mapping), timestamps (relative/absolute per format), duration, credits
- [x] 4.3 Implement per-file results table: file name, status badge, token usage, retry attempt (X of max), download/error actions
- [x] 4.4 Implement error message display (banner for run-level, expandable for file-level)
- [x] 4.5 Implement queued state ("Run is queued, waiting to start...") and running state with pending file badges
- [x] 4.6 Implement detail page polling: `interval(5000)` for non-terminal runs
- [x] 4.7 Add unit tests: all 6 status variants (including cancelled), queued empty state, per-file table rendering, error display, polling lifecycle (use `jest.useFakeTimers()`)

### Task 5: Retry Confirmation + Download
- [x] 5.1 Implement retry confirmation dialog with credit context (refund message + re-deduction amount from `creditsPerRun`), loading spinner during API call, disabled button to prevent double-clicks
- [x] 5.2 Implement retry button state management (hidden/enabled/disabled per AC8)
- [x] 5.3 Implement individual file download (blob fetch + programmatic `<a>` click, filename from `perFileResult.fileName`)
- [x] 5.4 Implement "Download All" using `client-zip` with progress indicator
- [x] 5.5 Add unit tests: dialog display, cancel behavior, confirm + API call + loading state, double-click prevention, error toast on 402/409, button states, download trigger with correct filename, bulk download

### Task 6: Browser Smoke Test
- [x] 6.1 Run E2E suite: `./scripts/dev-servers.sh stop && npx nx e2e web-e2e`
- [x] 6.2 Verify all existing tests pass (no regressions from new routes/nav) — 42 passed, 4 skipped (chain-ui), 1 pre-existing flaky failure (data-vault archive)

## Out-of-Scope

- **Aggregated failure telemetry/dashboards** — tracked as 7P-8 (ops concern, not customer UI)
- **WebSocket real-time updates for production runs** — polling is sufficient. WebSocket already exists for test runs (4-7a). Production runs can be added post-deployment if needed.
- **Sorting controls** — list is sorted by `createdAt` DESC only. Additional sort options deferred.
- **Search/text filter** — not needed for V1. Status filter + pagination covers the use case.
- **Run cancellation** — no cancel endpoint exists yet. Separate story if needed.

## Dev Agent Record

| Field | Value |
|-------|-------|
| Story | 4-run-status-ui |
| Agent | Amelia |
| Started | 2026-02-22 |
| Completed | 2026-02-22 |
| Tests Added | 75 (8 backend + 6 service + 22 list + 39 detail) |
| Total Tests | 1777 (717 web + 103 shared + 40 db-layer + 917 api-gateway unit) |
| Code Review | Pass 1 complete (9 findings, 3 fixed), Pass 2 Naz (12 findings), Pass 3 Murat (8 findings) — party mode verdict: 17 FIX, 0 TRACK, 3 REJECT — all 17 fixed |
| E2E | 42 pass, 4 skipped, 1 pre-existing flaky |

## Test Traceability

| AC | Test File | Test ID | Status |
|----|-----------|---------|--------|
| AC1 | workflow-runs.service.spec.ts | 4-RSUI-UNIT-001..007 | PASS |
| AC2 | app-layout.component.spec.ts | 3.1-2-UNIT-022..025 | PASS |
| AC2 | workflow-run.service.spec.ts | 4-RSUI-UNIT-010..015 | PASS |
| AC3 | execution-list.component.spec.ts | 4-RSUI-UNIT-020..031 | PASS |
| AC4 | execution-list.component.spec.ts | 4-RSUI-UNIT-035..036, 067..069 | PASS |
| AC5 | execution-detail.component.spec.ts | 4-RSUI-UNIT-040..047, 072..076 | PASS |
| AC6 | execution-detail.component.spec.ts | 4-RSUI-UNIT-063..064, 077..078 | PASS |
| AC7 | execution-detail.component.spec.ts | 4-RSUI-UNIT-051..055, 083 | PASS |
| AC8 | execution-detail.component.spec.ts | 4-RSUI-UNIT-048..050, 081..082 | PASS |
| AC9 | execution-detail.component.spec.ts | 4-RSUI-UNIT-056..059, 079..080 | PASS |
| — | execution-list.component.spec.ts | 4-RSUI-UNIT-070..071 | PASS |
| — | workflow-runs.service.spec.ts | 4-RSUI-UNIT-008 | PASS |

## Code Review Results

### Pass 1 — Amelia (self-review)
9 findings: 3 fixed (template reference error, missing cancelled status, missing icons), 6 deferred to Pass 2/3.

### Pass 2 — Naz (adversarial)
12 findings. Party mode verdicts:
- **NAZ-2 [HIGH] FIX**: `takeWhile` → `filter` in list polling (bug: takeWhile permanently kills interval)
- **NAZ-3 [HIGH] FIX**: List/detail polling inconsistency (same fix as NAZ-2)
- **NAZ-4 [MEDIUM] FIX**: `downloadAll()` destroyed check between loop iterations
- **NAZ-5 [MEDIUM] FIX**: DTO null→undefined normalization in `toResponse()`
- **NAZ-6 [MEDIUM] FIX**: Show "N/A" for context-only workflows in files column
- **NAZ-7 [MEDIUM] FIX**: Extract `formatDate`/`relativeTime` to shared utility (DRY)
- **NAZ-8 [MEDIUM] FIX**: Add `logger.error()` in download stream error handler
- **NAZ-9 [LOW] REJECT**: Hardcoded status options — over-engineering for 7 fixed values
- **NAZ-10 [LOW] FIX**: Add `formatDate` tests in detail spec
- **NAZ-11 [LOW] REJECT**: Token total discarded — spec says "In/Out", total unused by design
- **NAZ-12 [LOW] REJECT**: Hardcoded tooltip — over-engineering for single use

### Pass 3 — Murat (test architect)
8 findings. Party mode verdicts:
- **MURAT-1 [HIGH] FIX**: List polling timer tests with `jest.useFakeTimers()`
- **MURAT-2 [HIGH] FIX**: Detail polling timer tests
- **MURAT-3 [MEDIUM] FIX**: `downloadAll()` happy path + error path coverage
- **MURAT-4 [MEDIUM] FIX**: Download error cleanup verification (signals reset)
- **MURAT-5 [LOW] FIX**: "just now" (< 1 minute) edge case test
- **MURAT-6 [LOW] FIX**: `getRetryDisplay()` test
- **MURAT-7 [MEDIUM] FIX**: Generic retry error (500) test
- **MURAT-8 [LOW] FIX**: Backend DTO null coalescing test

**Final: 17 FIX, 0 TRACK, 3 REJECT. All 17 fixes implemented and tests passing.**
