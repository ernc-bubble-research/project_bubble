# Story: 4-fix-browser-imports — Fix class-transformer Browser Crash

**Epic**: 4 — Workflow Execution Engine
**Status**: done
**Priority**: Critical (blocks wizard — entire workflow creation/editing broken)
**Estimate**: XS (< 1 hour)

## Problem

The wizard component (`/admin/workflows/create` and `/admin/workflows/edit/:id`) renders a blank page due to:

```
ERROR TypeError: Reflect.getMetadata is not a function
    at class-transformer.js:807:33
```

`class-transformer` is pulled into the browser bundle via the `@project-bubble/shared` barrel, which re-exports DTOs decorated with `@nestjs/swagger` → `class-transformer` → `Reflect.getMetadata` (not available in browser).

## Root Cause

Runtime (non-type) imports from `@project-bubble/shared` in browser code trigger barrel evaluation, loading all DTOs and their decorator dependencies.

The project already has `@project-bubble/shared/web` (excludes DTOs). Browser code should use either `import type` or import from `/web`.

## Affected Files (4 browser files with runtime imports)

1. `wizard-execution-step.component.ts` — `import { GENERATION_PARAM_KEY_MAP } from '@project-bubble/shared'` (added in 4-GP)
2. `workflow-catalog.component.ts` — `import { WorkflowTemplateResponseDto } from '@project-bubble/shared'`
3. `workflow-catalog.service.ts` — `import { WorkflowTemplateResponseDto, ... } from '@project-bubble/shared'`
4. `workflow-run-form.component.ts` — `import { WorkflowTemplateResponseDto, ... } from '@project-bubble/shared'` (2 import blocks)

## Tasks

- [x] 1. Change `wizard-execution-step.component.ts` to import `GENERATION_PARAM_KEY_MAP` from `@project-bubble/shared/web`
- [x] 2. Convert 3 remaining files' runtime DTO imports to `import type`
- [x] 3. Add ESLint rule to `apps/web/eslint.config.mjs` banning runtime imports from `@project-bubble/shared` (only `@project-bubble/shared/web` or `import type` allowed)
- [x] 4. Run unit tests (all 4 projects) — 1460 pass
- [x] 5. Run E2E tests — 46/46 pass (was 38/46)
- [x] 6. (Review fix) Add `typescript-eslint` plugin registration to ESLint rule config block + verify rule fires via `nx lint web`
- [x] 7. (Review fix) Add docblock comment to `libs/shared/src/index.ts` explaining barrel split
- [x] 8. (Review fix) Add explanatory comment to ESLint config for spec file exclusion

## Acceptance Criteria

- [x] AC1: Navigating to `/admin/workflows/create` renders the wizard stepper (no blank page)
- [x] AC2: Navigating to `/admin/workflows/edit/:id` renders pre-populated wizard
- [x] AC3: No `Reflect.getMetadata` errors in browser console
- [x] AC4: Zero runtime (non-type) `import { ... } from '@project-bubble/shared'` in `apps/web/src/**/*.ts` (excluding spec files)
- [x] AC5: ESLint rule prevents future runtime imports from `@project-bubble/shared` in browser code
- [x] AC6: All unit tests pass (1460)
- [x] AC7: E2E tests pass (38 → 46, all 8 previously failing tests fixed)

## Out-of-Scope

- TransactionManager bypassRls fix → 4-fix-published-template-404
- Soft-delete audit → 4-fix-published-template-404

## Traceability

| Change | File | Line(s) |
|--------|------|---------|
| Runtime → /web import | wizard-execution-step.component.ts | 6 |
| Runtime → import type | workflow-catalog.component.ts | 6 |
| Runtime → import type | workflow-catalog.service.ts | 4-8 |
| Runtime → import type (2 blocks) | workflow-run-form.component.ts | 7-10, 11-14 |
| ESLint no-restricted-imports rule + plugin registration | eslint.config.mjs | 2, 47-72 |
| Barrel split documentation | libs/shared/src/index.ts | 1-8 |

## Dev Agent Record

- **Agent**: Amelia (dev)
- **Session**: 2026-02-16
- **Investigation**: Root cause confirmed via Playwright console capture — `Reflect.getMetadata is not a function` from class-transformer.js loaded transitively through barrel imports.
- **Implementation**: 5 import changes across 4 files + 1 ESLint rule + 3 review fixes. All 1460 unit tests + 46 E2E tests pass.

## Code Review Summary

- **Pass 1 (Amelia)**: 0 findings
- **Pass 2 (Naz)**: 6 findings — F5 FIX (ESLint rule manual test), F6 FIX (barrel docs), F1/F2/F3/F4 REJECT
- **Pass 3 (Murat)**: 5 findings — F1 FIX (plugin registration), F2/F4 FIX (same as Naz F2/F6), F5 TRACK in 4-test-gaps, F3 REJECT
- **Post-review verification**: ESLint rule confirmed functional via `nx lint web` (catches runtime imports, allows `import type`)
