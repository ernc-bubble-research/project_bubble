# Story 3H: RxJS Subscription Cleanup Hardening

Status: ready-for-dev

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

### Epic 1 Components (11 files, 15 subscriptions)
| File | Line(s) |
|------|---------|
| `apps/web/src/app/admin/dashboard/dashboard.component.ts` | 58 |
| `apps/web/src/app/admin/tenants/tenant-list.component.ts` | 40 |
| `apps/web/src/app/admin/dashboard/create-tenant-modal.component.ts` | 166 |
| `apps/web/src/app/admin/tenants/tenant-detail.component.ts` | 117, 166, 182, 197, 222, 256, 305, 337 |
| `apps/web/src/app/admin/tenants/invite-user-dialog.component.ts` | 43 |
| `apps/web/src/app/auth/login/login.component.ts` | 55 |
| `apps/web/src/app/auth/set-password/set-password.component.ts` | 90 |

### Epic 2 Components (3 files, 9 subscriptions)
| File | Line(s) |
|------|---------|
| `apps/web/src/app/app/data-vault/upload-zone.component.ts` | 184 |
| `apps/web/src/app/app/data-vault/data-vault.component.ts` | 75, 86, 106, 132, 156, 172, 191, 213 |
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
- [ ] Install `eslint-plugin-rxjs-angular`
- [ ] Configure in `.eslintrc.json` for web app
- [ ] Enable `rxjs-angular/prefer-takeuntil` rule as "error"
- [ ] Run lint to see all violations

### Task 2: Update project-context.md
- [ ] Add new rule requiring `takeUntilDestroyed()` for ALL subscriptions
- [ ] Include code examples showing correct pattern
- [ ] Mark as CRITICAL - code review must reject violations

### Task 3: Fix Epic 1 Components
- [ ] Fix dashboard.component.ts
- [ ] Fix tenant-list.component.ts
- [ ] Fix create-tenant-modal.component.ts
- [ ] Fix tenant-detail.component.ts (8 subscriptions)
- [ ] Fix invite-user-dialog.component.ts
- [ ] Fix login.component.ts
- [ ] Fix set-password.component.ts

### Task 4: Fix Epic 2 Components
- [ ] Fix upload-zone.component.ts
- [ ] Fix data-vault.component.ts (8 subscriptions)
- [ ] Fix create-folder-dialog.component.ts

### Task 5: Fix Epic 3 Components
- [ ] Fix wizard-execution-step.component.ts
- [ ] Fix workflow-wizard.component.ts (3 subscriptions)
- [ ] Fix chain-visibility-settings.component.ts
- [ ] Fix chain-data-flow.component.ts
- [ ] Fix chain-input-mapping.component.ts
- [ ] Fix chain-steps-list.component.ts
- [ ] Fix chain-builder.component.ts (3 subscriptions)
- [ ] Fix chain-add-step.component.ts

### Task 6: Verify
- [ ] Run all tests (`nx test web`)
- [ ] Run lint (`nx lint web`) - should pass with new rules
- [ ] Verify no new violations introduced

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

- [ ] All 36 remaining subscriptions fixed (39 total - 3 already fixed in Story 3.7)
- [ ] ESLint rule installed and configured
- [ ] project-context.md updated with new rule
- [ ] All tests pass
- [ ] Lint passes (0 errors)
- [ ] Code review passed

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 retrospective discussion |
