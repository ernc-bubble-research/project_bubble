# Epic 3 - Retrospective Discussion Items

## Critical Issues for Retrospective

### 1. SYSTEMIC: Unsubscribed RxJS HTTP Subscriptions (39 instances)

**Severity**: CRITICAL
**Scope**: Entire web application
**Discovery**: Story 3.7 code review

**Problem**: The code review process has repeatedly failed to catch unsubscribed HTTP subscriptions. This pattern exists in **39 locations** across the codebase:

```
apps/web/src/app/app/data-vault/upload-zone.component.ts:184
apps/web/src/app/admin/dashboard/dashboard.component.ts:58
apps/web/src/app/admin/tenants/tenant-list.component.ts:40
apps/web/src/app/admin/dashboard/create-tenant-modal.component.ts:166
apps/web/src/app/app/data-vault/data-vault.component.ts:75
apps/web/src/app/app/data-vault/data-vault.component.ts:86
apps/web/src/app/app/data-vault/data-vault.component.ts:106
apps/web/src/app/app/data-vault/data-vault.component.ts:132
apps/web/src/app/app/data-vault/data-vault.component.ts:156
apps/web/src/app/app/data-vault/data-vault.component.ts:172
apps/web/src/app/app/data-vault/data-vault.component.ts:191
apps/web/src/app/app/data-vault/data-vault.component.ts:213
apps/web/src/app/auth/login/login.component.ts:55
apps/web/src/app/admin/tenants/tenant-detail.component.ts:117
apps/web/src/app/admin/tenants/tenant-detail.component.ts:166
apps/web/src/app/admin/tenants/tenant-detail.component.ts:182
apps/web/src/app/admin/tenants/tenant-detail.component.ts:197
apps/web/src/app/admin/tenants/tenant-detail.component.ts:222
apps/web/src/app/admin/tenants/tenant-detail.component.ts:256
apps/web/src/app/admin/tenants/tenant-detail.component.ts:305
apps/web/src/app/admin/tenants/tenant-detail.component.ts:337
apps/web/src/app/auth/set-password/set-password.component.ts:90
apps/web/src/app/app/data-vault/create-folder-dialog.component.ts:130
apps/web/src/app/admin/tenants/invite-user-dialog.component.ts:43
apps/web/src/app/admin/workflows/template-list.component.ts:236
apps/web/src/app/admin/workflows/template-list.component.ts:285
apps/web/src/app/admin/workflows/chain-list.component.ts:210
apps/web/src/app/admin/workflows/wizard/steps/wizard-execution-step.component.ts:56
apps/web/src/app/admin/workflows/chain-builder/chain-visibility-settings.component.ts:282
apps/web/src/app/admin/workflows/chain-builder/chain-data-flow.component.ts:244
apps/web/src/app/admin/workflows/chain-builder/chain-input-mapping.component.ts:282
apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.ts:177
apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.ts:226
apps/web/src/app/admin/workflows/wizard/workflow-wizard.component.ts:241
apps/web/src/app/admin/workflows/chain-builder/chain-steps-list.component.ts:238
apps/web/src/app/admin/workflows/chain-builder/chain-builder.component.ts:141
apps/web/src/app/admin/workflows/chain-builder/chain-builder.component.ts:167
apps/web/src/app/admin/workflows/chain-builder/chain-builder.component.ts:182
apps/web/src/app/admin/workflows/chain-builder/chain-add-step.component.ts:176
```

**Consequences**:
- Memory leaks
- Callbacks firing on destroyed components
- Potential runtime errors
- Unpredictable behavior

**Root Cause Analysis**:
1. The AI code review process consistently deprioritizes this as "low severity"
2. No automated lint rule enforcing subscription cleanup
3. Pattern was established in early stories and propagated
4. Code review checklist does not explicitly flag this as a BLOCKING issue

**Required Actions**:
1. Add ESLint rule: `rxjs-angular/prefer-takeuntil` or similar
2. Update `project-context.md` to make `takeUntilDestroyed()` MANDATORY for ALL subscriptions
3. Create a remediation story to fix all 39 instances
4. Update code review workflow to CHECK THIS FIRST before any other issues

**Proposed Rule for project-context.md**:
```
Rule XX: ALL RxJS subscriptions MUST use takeUntilDestroyed() or equivalent cleanup pattern.
- Use: this.httpService.get().pipe(takeUntilDestroyed()).subscribe()
- Inject DestroyRef: private destroyRef = inject(DestroyRef);
- NO EXCEPTIONS for HTTP calls - they can still be in flight when component destroys
```

---

## Discussion Questions

1. Why did the code review process fail to catch this 39 times?
2. Should we add automated linting before any more stories are implemented?
3. Should Epic 3 be considered "incomplete" until all 39 instances are fixed?
4. How do we prevent this pattern from recurring in Epic 4+?
