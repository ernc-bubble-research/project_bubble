# Story 4-hide-chain-ui: Hide All Chain UI for V1

Status: done

## Story

As a **Bubble Admin**,
I want **chain-related UI hidden from the Workflow Studio**,
so that **users don't encounter an incomplete, deferred feature before it's ready for V1 deployment**.

## Context

**Decision**: Made in party mode 2026-02-17 — Chain Orchestration (Story 4-6) is deferred to post-deployment. Chains are purely additive convenience; users can run workflows manually in sequence. Zero coupling to the single-workflow engine.

**Action**: Hide all chain-facing UI before V1 goes live. Preserve all backend code, chain component files, and chain unit tests — none of that changes. This story is purely about hiding the UI surface area so it cannot be reached.

**Re-enablement**: When Story 4-6 ships, reverse these changes (routes re-added, tab unhidden, E2E unskipped).

**Party mode attendees**: Winston (arch), Naz (adversarial), Amelia (dev), erinc (decision-maker) — 2026-02-19

## Key Decisions (from party mode)

1. **Hiding mechanism: Option A** — remove routes + hide tab with `@if`. No feature flag, no guard. Simple reverse when Story 4-6 ships.
2. **Routes removed** (not commented out) — Angular wildcard `**` → `NotFoundComponent` handles stale bookmarks cleanly.
3. **`ChainListComponent` never instantiated via `@if`** — no pre-loading of chain data on admin page load. Confirmed clean.
4. **E2E tests: `test.skip` / `test.describe.skip`** with `// TODO: re-enable in Story 4-6` comment. Preserves test code for re-enablement.
5. **Subtitle update**: "templates and chains" → "templates" (line 5 of workflow-studio.component.html).
6. **`3.7-UNIT-001b` updated** (not skipped): assert only `workflow-studio-templates-tab` present; assert `workflow-studio-chains-tab` is absent. This is the correct post-hide behavior, not a skip.
7. **Backend: ZERO changes** — controller, service, entity, DTOs, all backend tests untouched.

## Acceptance Criteria

1. **AC1**: The Chains tab button is not present in the DOM of Workflow Studio — `data-testid="workflow-studio-chains-tab"` does not exist.
2. **AC2**: Navigating to `/admin/workflows/chains/new` renders the 404 page (NotFoundComponent), not the chain builder.
3. **AC3**: Navigating to `/admin/workflows/chains/:id/edit` renders the 404 page, not the chain builder.
4. **AC4**: The Workflow Studio page subtitle does not reference "chains".
5. **AC5**: All 4 chain E2E tests are skipped (not failing) with TODO comment referencing Story 4-6. E2E suite reports 40 passing + 4 skipped + 2 pre-existing flaky failures (was 46 passing + 0 skipped). Flaky failures: 1E-E2E-002a (login), 2E-E2E-002a (file upload) — confirmed unrelated to chain-hiding changes by re-run.
6. **AC6**: All unit tests pass. `workflow-studio.component.spec.ts` chain-related tests are either updated or skipped as specified.

## Tasks / Subtasks

- [x] 1. Remove chain routes from `app.routes.ts` (AC: #2, #3)
  - [x] 1.1 Delete the `chains/new` route block (lines 85-92)
  - [x] 1.2 Delete the `chains/:id/edit` route block (lines 93-100)
  - [x] 1.3 Verify wildcard `**` route exists in the same file (it does — line 163) ✓

- [x] 2. Update `workflow-studio.component.html` (AC: #1, #4)
  - [x] 2.1 Remove the Chains tab `<button>` block
  - [x] 2.2 Remove the `@if (activeTab() === 'chains')` content block
  - [x] 2.3 Update subtitle text: "Create and manage LLM-powered workflow templates and chains" → "Create and manage LLM-powered workflow templates"

- [x] 3. Update `workflow-studio.component.ts` (AC: #1, #6)
  - [x] 3.1 Narrow `ActiveTab` type from `'templates' | 'chains'` to `'templates'`
  - [x] 3.2 Remove `ChainListComponent` from imports array and import statement

- [x] 4. Update `workflow-studio.component.spec.ts` (AC: #6)
  - [x] 4.1 Skip `3.7-UNIT-002` with `xit` + TODO comment referencing Story 4-6
  - [x] 4.2 Skip `3.7-UNIT-002b` with `xit` + TODO comment referencing Story 4-6
  - [x] 4.3 Update `3.7-UNIT-001b`: assert templates-tab truthy AND chains-tab falsy
  - [x] 4.4 Update `3.7-UNIT-002a`: keep templatesContent assertion, remove chains absence check
  - [x] 4.5 Drop `Link` from `LucideIconProvider` in the spec

- [x] 5. Skip chain E2E tests (AC: #5)
  - [x] 5.1 `01-navigation.spec.ts`: `test.skip` on `[3E-E2E-001b]` + TODO 4-6 comment
  - [x] 5.2 `03-chain-builder.spec.ts`: `test.describe.skip` + TODO 4-6 comment

- [x] 6. Run smoke test (AC: #5, #6)
  - [x] 6.1 Unit tests: 4 pass, 2 skipped (workflow-studio.component.spec.ts) ✓
  - [x] 6.2 E2E: 40 pass + 4 skipped (2 pre-existing flaky failures confirmed unrelated by re-run) ✓

## Dev Notes

### Files to Touch

| File | Change |
|------|--------|
| `apps/web/src/app/app.routes.ts` | Remove 2 chain routes (lines 85-100) |
| `apps/web/src/app/admin/workflows/workflow-studio.component.html` | Remove tab + content block + update subtitle |
| `apps/web/src/app/admin/workflows/workflow-studio.component.ts` | Narrow ActiveTab type, remove ChainListComponent import |
| `apps/web/src/app/admin/workflows/workflow-studio.component.spec.ts` | Skip 2, update 2, drop Link icon |
| `apps/web-e2e/src/workflow-studio/01-navigation.spec.ts` | `test.skip` on 3E-E2E-001b |
| `apps/web-e2e/src/workflow-studio/03-chain-builder.spec.ts` | `test.describe.skip` entire describe block |

### Files NOT Touched (intentional)

- All backend: `workflow-chains.controller.ts`, `workflow-chains.service.ts`, `workflow-chains.service.spec.ts`, `workflow-chains.controller.spec.ts`
- All chain component files: `chain-list.component.ts`, `chain-card.component.ts`, `chain-builder/` directory — preserved for Story 4-6
- All chain component spec files — preserved, untouched
- `WorkflowChainService` (`apps/web/src/app/core/services/workflow-chain.service.ts`) — preserved
- `global-setup.ts` E2E seed — chain seed data preserved (OFF-LIMITS for drive-by changes per shared infra rule)
- All shared DTOs and db-layer entities

### Critical Rules

- **Shared infra OFF-LIMITS**: `global-setup.ts`, `fixtures.ts`, `test-db-helpers.ts`, `playwright.config.ts` — do NOT touch.
- **Do not delete chain component files** — Story 4-6 will re-enable them. Deleting = rework.
- **`test.skip` not `xtest`** for E2E (Playwright convention). `xit` for Jasmine/Jest unit tests.
- **Rule 26**: Run E2E smoke test. Expect 42 passing + 4 skipped.

### Out-of-Scope

| Item | Tracked In |
|------|-----------|
| Chain re-enablement + runtime re-validation of template accessibility | Story 4-6 (post-deployment) |
| Chain service cross-tenant bug (`workflow-chains.service.ts:290`) | Story 4-6 |
| All chain component logic, styling, tests | Preserved unchanged — Story 4-6 |

## Test Traceability

| AC | Test File | Test ID | Status |
|----|-----------|---------|--------|
| AC1 | workflow-studio.component.spec.ts | 3.7-UNIT-001b (updated — chains-tab absent) | PASS |
| AC1 | workflow-studio.component.spec.ts | 3.7-UNIT-002a (updated — no chains content) | PASS |
| AC2, AC3 | smoke/navigation.spec.ts | 4-hide-chain-ui-E2E-001 (new — 404 for removed routes) | PASS |
| AC4 | workflow-studio.component.spec.ts | 3.7-UNIT-001 (templates tab default) | PASS |
| AC5 | 01-navigation.spec.ts | 3E-E2E-001b (skipped) | SKIP |
| AC5 | 03-chain-builder.spec.ts | 3E-E2E-003a/b/c (skipped) | SKIP |
| AC6 | workflow-studio.component.spec.ts | 3.7-UNIT-002 (skipped) | SKIP |
| AC6 | workflow-studio.component.spec.ts | 3.7-UNIT-002b (skipped) | SKIP |

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.5

### Debug Log References
- E2E re-run: 2 tests (`1E-E2E-002a` login + `2E-E2E-002a` file upload) failed in full suite run but passed on re-run. Confirmed pre-existing flakiness, unrelated to this story's changes. Chain tests correctly skipped (4).

### Code Review Findings
**Pass 1 (Amelia — self-review):**
- A1 (LOW): `'chains' as never` cast in 2 skipped `xit` tests. TypeScript requires the cast because ActiveTab no longer includes 'chains'. Tests never execute (xit). No behavioral change. No fix.

**Pass 2 (Naz — adversarial):**
- N2-1 (MEDIUM): MW-1-CW-007 test description and unnecessary mock not updated. Resolution: FIXED — updated test description to "(ChainListComponent hidden — Story 4-6)" and removed dead WorkflowChainService provider.
- N2-2 (LOW): AC5 text contradicts actual E2E run result (42 vs 40 passing). Resolution: FIXED — updated AC5 to say "40 passing + 4 skipped + 2 pre-existing flaky failures" with flaky test names documented.
- N2-3 (LOW): Pass 1 A1 uses banned word "Acceptable" in Dev Agent Record. Resolution: FIXED — reworded without "acceptable".

**Pass 3 (Murat — test architect):**
- M3-1 (MEDIUM): MW-1-CW-011 still provides unnecessary WorkflowChainService mock. Resolution: FIXED — removed dead WorkflowChainService provider (same issue as N2-1, different test).
- M3-2 (LOW): No E2E coverage for wildcard 404 route behavior (AC2/AC3 claim 404 but no test). Resolution: FIXED — added E2E test `[4-hide-chain-ui-E2E-001]` in smoke/navigation.spec.ts covering both removed chain routes.
- M3-3 (LOW): ChainListComponent hardcoded route will 404 but is unreachable in V1. Resolution: TRACKED in Story 4-6 (re-enablement story).
- M3-4 (LOW): Unit test cast `'chains' as never` is unusual pattern (4-step re-enablement per test). Resolution: TRACKED in Story 4-6.
- M3-5 (MEDIUM→HIGH per Naz): Story claims "simple reverse" but re-enablement has 9+ steps. Resolution: TRACKED in Story 4-6 with detailed reversal checklist added to Out-of-Scope table (9 steps across 6 files documented).
- M3-6 (LOW): WorkflowChainService import/mock only used in one test (MW-1-CW-009). Resolution: FIXED via M3-1 — now clearer that mock is only for ChainBuilder test.
- M3-7 (LOW): E2E skip comment format inconsistency. Resolution: FIXED — standardized to "when chain routes and UI are restored".

### Completion Notes List
- 2 chain routes removed from app.routes.ts (chains/new + chains/:id/edit)
- Chains tab button + content block removed from workflow-studio.component.html
- Subtitle updated: removed "and chains"
- ActiveTab narrowed to `'templates'`, ChainListComponent import removed from .ts
- 2 unit tests skipped (xit), 2 unit tests updated, Link icon dropped from spec
- 4 E2E tests skipped (1 test.skip + 1 test.describe.skip with TODO 4-6 comments)
- All chain component files, backend code, chain unit tests: UNTOUCHED
- E2E result: 40 pass + 4 skip (2 pre-existing flaky failures unrelated to this story)
- Pass 3 fixes: M3-1 (MW-1-CW-011 mock removed), M3-2 (E2E 404 test added), M3-7 (TODO comments standardized), M3-5 (reversal checklist added to Out-of-Scope)

### File List
| File | Change |
|------|--------|
| `apps/web/src/app/app.routes.ts` | Removed 2 chain routes |
| `apps/web/src/app/admin/workflows/workflow-studio.component.html` | Removed Chains tab + content block + updated subtitle |
| `apps/web/src/app/admin/workflows/workflow-studio.component.ts` | Narrowed ActiveTab type, removed ChainListComponent import |
| `apps/web/src/app/admin/workflows/workflow-studio.component.spec.ts` | Skipped 2, updated 2, dropped Link icon |
| `apps/web-e2e/src/workflow-studio/01-navigation.spec.ts` | test.skip on 3E-E2E-001b + standardized TODO comment (Pass 3 M3-7) |
| `apps/web-e2e/src/workflow-studio/03-chain-builder.spec.ts` | test.describe.skip on entire describe |
| `apps/web/src/app/component-wiring.spec.ts` | Removed WorkflowChainService mock from MW-1-CW-007 (Pass 2 N2-1) + MW-1-CW-011 (Pass 3 M3-1) |
| `apps/web-e2e/src/smoke/navigation.spec.ts` | Added E2E test 4-hide-chain-ui-E2E-001 for 404 route behavior (Pass 3 M3-2) |

### Out-of-Scope
| Item | Tracked In |
|------|-----------|
| Chain re-enablement + full chain feature — **Reversal checklist**: (1) Add 2 routes back to `app.routes.ts` (chains/new + chains/:id/edit with canDeactivate guard), (2) Restore Chains tab button in workflow-studio.component.html, (3) Restore `@if (activeTab() === 'chains')` content block with `app-chain-list`, (4) Update subtitle: "templates" → "templates and chains", (5) Widen `ActiveTab` type: `'templates'` → `'templates' \| 'chains'`, (6) Restore `ChainListComponent` import in .ts, (7) Un-skip 2 unit tests (3.7-UNIT-002, 3.7-UNIT-002b) + remove `as never` casts, (8) Un-skip E2E test 3E-E2E-001b (`test.skip` → `test`), (9) Un-skip E2E describe block in 03-chain-builder.spec.ts (`test.describe.skip` → `test.describe`). Total: 9 steps across 6 files. | Story 4-6 (post-deployment) |
| Chain service cross-tenant bug (`workflow-chains.service.ts:290`) | Story 4-6 |
| ChainListComponent hardcoded route will 404 (navigateToCreate navigates to removed route) — zero V1 runtime risk (component never instantiated) | Story 4-6 |
| All chain component/backend files | Preserved unchanged |
