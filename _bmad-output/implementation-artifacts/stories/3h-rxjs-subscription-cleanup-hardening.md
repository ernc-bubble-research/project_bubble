# Story 3H: RxJS Subscription Cleanup Hardening

Status: done

## Story

**As a** Developer,
**I want** all RxJS subscriptions to use proper cleanup patterns,
**So that** we eliminate memory leaks and prevent callbacks firing on destroyed components.

## Background

During Story 3.7 code review, a SYSTEMIC issue was discovered: **39 HTTP subscriptions** across the entire web application have no cleanup mechanism. This pattern was established in Epic 1 and propagated through Epics 2 and 3 without being caught by code review.

### Root Cause Analysis

1. Code review consistently classified subscription leaks as "LOW severity"
2. No automated lint rule enforces subscription cleanup
3. Pattern was copy-pasted from early stories
4. HTTP calls "usually complete quickly" was used as rationalization

### Impact

- Memory leaks (callbacks hold references to destroyed components)
- Potential runtime errors when callbacks fire on destroyed components
- Unpredictable behavior if user navigates during in-flight requests

## Acceptance Criteria

1. **All 39 existing subscriptions fixed** - Every `.subscribe()` call uses `takeUntilDestroyed()`
2. **ESLint rule added** - `eslint-plugin-rxjs-angular` installed with `prefer-takeuntil` rule
3. **project-context.md updated** - New CRITICAL rule requiring `takeUntilDestroyed()` for all subscriptions
4. **All tests pass** - No regressions introduced
5. **Lint passes** - Including new RxJS rules

## Files to Fix

### Epic 1 Components (7 files, 15 subscriptions)
| File | Line(s) |
|------|---------|
| `apps/web/src/app/admin/dashboard/dashboard.component.ts` | 58 |
| `apps/web/src/app/admin/tenants/tenant-list.component.ts` | 40 |
| `apps/web/src/app/admin/dashboard/create-tenant-modal.component.ts` | 166 |
| `apps/web/src/app/admin/tenants/tenant-detail.component.ts` | 117, 166, 182, 197, 222, 256, 305, 337 |
| `apps/web/src/app/admin/tenants/invite-user-dialog.component.ts` | 43 |
| `apps/web/src/app/auth/login/login.component.ts` | 55 |
| `apps/web/src/app/auth/set-password/set-password.component.ts` | 90 |

### Epic 2 Components (3 files, 11 subscriptions)
| File | Line(s) |
|------|---------|
| `apps/web/src/app/app/data-vault/upload-zone.component.ts` | 184 |
| `apps/web/src/app/app/data-vault/data-vault.component.ts` | 66, 75, 86, 106, 132, 156, 172, 191, 213 |
| `apps/web/src/app/app/data-vault/create-folder-dialog.component.ts` | 130 |

### Epic 3 Components (8 files, 12 subscriptions)
| File | Line(s) |
|------|---------|
| `apps/web/src/app/admin/workflows/wizard/steps/wizard-execution-step.component.ts` | 56 |
| `apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.ts` | 177, 226, 241 |
| `apps/web/src/app/admin/workflows/chain-builder/chain-visibility-settings.component.ts` | 282 |
| `apps/web/src/app/admin/workflows/chain-builder/chain-data-flow.component.ts` | 244 |
| `apps/web/src/app/admin/workflows/chain-builder/chain-input-mapping.component.ts` | 282 |
| `apps/web/src/app/admin/workflows/chain-builder/chain-steps-list.component.ts` | 238 |
| `apps/web/src/app/admin/workflows/chain-builder/chain-builder.component.ts` | 141, 167, 182 |
| `apps/web/src/app/admin/workflows/chain-builder/chain-add-step.component.ts` | 176 |

**Note:** `template-list.component.ts` and `chain-list.component.ts` were already fixed during Story 3.7 review.

## Tasks

### Task 1: Install ESLint Plugin
- [x] Install `eslint-plugin-rxjs-angular-x` (ESLint v9-compatible fork)
- [x] Configure in `apps/web/eslint.config.mjs` (flat config, not `.eslintrc.json`)
- [x] Enable `rxjs-angular-x/prefer-takeuntil` rule as "error" with `alias: ['takeUntilDestroyed']`
- [x] Run lint — found exactly 36 violations (39 total - 3 already fixed in Story 3.7)

### Task 2: Update project-context.md
- [x] Rule 13 already exists requiring `takeUntilDestroyed()` for ALL subscriptions
- [x] Includes code examples showing correct pattern
- [x] Marked as CRITICAL — code review must reject violations

### Task 3: Fix Epic 1 Components (7 files, 15 subscriptions)
- [x] Fix dashboard.component.ts (1 subscription)
- [x] Fix tenant-list.component.ts (1 subscription)
- [x] Fix create-tenant-modal.component.ts (1 subscription)
- [x] Fix tenant-detail.component.ts (8 subscriptions)
- [x] Fix invite-user-dialog.component.ts (1 subscription)
- [x] Fix login.component.ts (1 subscription)
- [x] Fix set-password.component.ts (1 subscription)

### Task 4: Fix Epic 2 Components (3 files, 11 subscriptions)
- [x] Fix upload-zone.component.ts (1 subscription)
- [x] Fix data-vault.component.ts (9 subscriptions)
- [x] Fix create-folder-dialog.component.ts (1 subscription)

### Task 5: Fix Epic 3 Components (7 files needing fixes, 11 subscriptions)
- [x] wizard-execution-step.component.ts — Already fixed in Story 3.7 (has DestroyRef + takeUntilDestroyed)
- [x] Fix workflow-wizard.component.ts (3 subscriptions)
- [x] Fix chain-visibility-settings.component.ts (1 subscription)
- [x] Fix chain-data-flow.component.ts (1 subscription)
- [x] Fix chain-input-mapping.component.ts (1 subscription)
- [x] Fix chain-steps-list.component.ts (1 subscription)
- [x] Fix chain-builder.component.ts (3 subscriptions)
- [x] Fix chain-add-step.component.ts (1 subscription)

### Task 6: Verify
- [x] Run all tests (`nx test web`) — 291 tests pass across 38 suites
- [x] Run lint (`nx lint web`) — 0 errors, 0 warnings
- [x] Verified no regressions introduced

## Pattern to Apply

For each file:

1. Add imports:
```typescript
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
```

2. Inject DestroyRef:
```typescript
private readonly destroyRef = inject(DestroyRef);
```

3. Add to every subscription:
```typescript
this.service.getData().pipe(
  takeUntilDestroyed(this.destroyRef)
).subscribe({
  next: (data) => { ... },
  error: (err) => { ... }
});
```

## Definition of Done

- [x] All 36 remaining subscriptions fixed (39 total - 3 already fixed in Story 3.7)
- [x] ESLint rule installed and configured (`eslint-plugin-rxjs-angular-x` v0.1.1)
- [x] project-context.md updated with new rule (Rule 13)
- [x] All tests pass (291 tests, 38 suites)
- [x] Lint passes (0 errors, 0 warnings)
- [x] Code review passed

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Added `eslint-plugin-rxjs-angular-x` v0.1.1 dependency |
| `package-lock.json` | Lock file updated for new dependency |
| `apps/web/eslint.config.mjs` | Added `eslint-plugin-rxjs-angular-x` with `prefer-takeuntil` rule + type-aware linting |
| `apps/web/src/app/admin/dashboard/dashboard.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/admin/tenants/tenant-list.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/admin/dashboard/create-tenant-modal.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/admin/tenants/tenant-detail.component.ts` | Added DestroyRef + takeUntilDestroyed (8 subscriptions) |
| `apps/web/src/app/admin/tenants/invite-user-dialog.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/auth/login/login.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/auth/set-password/set-password.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/app/data-vault/upload-zone.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/app/data-vault/data-vault.component.ts` | Added DestroyRef + takeUntilDestroyed (9 subscriptions); replaced OnDestroy with DestroyRef.onDestroy() for setInterval cleanup |
| `apps/web/src/app/app/data-vault/create-folder-dialog.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.ts` | Added DestroyRef + takeUntilDestroyed (3 subscriptions) |
| `apps/web/src/app/admin/workflows/chain-builder/chain-visibility-settings.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/admin/workflows/chain-builder/chain-data-flow.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/admin/workflows/chain-builder/chain-input-mapping.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/admin/workflows/chain-builder/chain-steps-list.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/admin/workflows/chain-builder/chain-builder.component.ts` | Added DestroyRef + takeUntilDestroyed (3 subscriptions) |
| `apps/web/src/app/admin/workflows/chain-builder/chain-add-step.component.ts` | Added DestroyRef + takeUntilDestroyed (1 subscription) |
| `apps/web/src/app/admin/workflows/workflow-search.component.ts` | Migrated from legacy takeUntil(destroy$) + OnDestroy to takeUntilDestroyed(destroyRef) (1 subscription) |
| `apps/web/src/app/app/data-vault/data-vault.component.spec.ts` | Updated afterEach and destroy test: `component.ngOnDestroy()` → `fixture.destroy()` to match DestroyRef.onDestroy() migration |

## Review Notes

**Review Date:** 2026-02-04

**Findings (0 High, 3 Medium, 2 Low):**

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| M1 | Medium | `workflow-search.component.ts` used legacy `takeUntil(destroy$)` + `OnDestroy` pattern — missed because ESLint `checkDestroy: false` accepts the legacy pattern | Migrated to `takeUntilDestroyed(destroyRef)`, removed `OnDestroy` and `destroy$` Subject |
| M2 | Medium | Story "Files to Fix" header said "Epic 1 Components (11 files...)" but only 7 files listed | Fixed header to "(7 files, 15 subscriptions)" |
| M3 | Medium | `data-vault.component.ts` retained `OnDestroy` interface for `setInterval` cleanup — inconsistent with modernized pattern | Replaced `ngOnDestroy()` with `DestroyRef.onDestroy()` callback in constructor |
| L1 | Low | `package.json` and `package-lock.json` missing from Files Changed table | Added to table |
| L2 | Low | Epic 2 header said "9 subscriptions" but data-vault has 9 subs + paramMap = total 11 for Epic 2 | Fixed header to "(3 files, 11 subscriptions)" |

**Total subscription count reconciliation:**
- Epic 1: 7 files, 15 subscriptions
- Epic 2: 3 files, 11 subscriptions
- Epic 3: 8 files, 12 subscriptions (1 pre-fixed in Story 3.7)
- Total: 38 subscriptions across 18 unique files (+ 1 legacy-pattern file caught in review = 39 total)

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 retrospective discussion |
| 2026-02-04 | Dev | All 6 tasks completed. 36 subscriptions fixed across 17 files. ESLint plugin installed. 291 tests pass, 0 lint errors. Ready for review. |
| 2026-02-04 | Review | Code review found 5 issues (0H/3M/2L). All fixed: migrated workflow-search.component.ts to takeUntilDestroyed, modernized data-vault.component.ts OnDestroy to DestroyRef.onDestroy(), updated spec to use fixture.destroy(), fixed 3 documentation inaccuracies in story file. 291 tests pass, 0 lint errors. Story done. |
