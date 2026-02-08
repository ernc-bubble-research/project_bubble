# Story 3.8: Workflow Management View

Status: done

## Story

**As a** Bubble Admin,
**I want** a dedicated workflow management view to edit workflow settings after creation,
**So that** I can update visibility, archive workflows, and control tenant access without recreating them.

## Background

The Workflow Builder Wizard (Story 3.2) creates workflows, but there is no UI to manage workflows after creation. The backend supports:
- Visibility: public, private (with allowedTenants for private)
- Archive status (via status field: draft/published/archived)

These settings need a management interface separate from the creation wizard.

## Acceptance Criteria

1. **Workflow Settings Modal** - Clicking "Settings" from template/chain card menu opens a modal
2. **Visibility Controls** - Can change visibility between public/private
3. **Tenant Selection** - When private, can select which tenants have access
4. **Archive/Unarchive** - Can archive and unarchive workflows
5. **Enable/Disable** - Mapped to archive/unarchive (no boolean enabled field in entities)
6. **Save Changes** - Changes persist to backend via existing API
7. **Validation** - Cannot save private visibility without at least one tenant selected
8. **Feedback** - Toast notifications for success/error states

## Tasks

### Task 1: Create Workflow Settings Modal Component
- [x] Create `workflow-settings-modal.component.ts` (+ `.html`, `.scss`)
- [x] Add visibility radio buttons (public/private)
- [x] Add tenant checklist (shown when private)
- [x] Add archive/unarchive actions
- [x] Style consistent with existing modals (llm-model-form-dialog pattern)

### Task 2: Integrate with Template Card
- [x] Add "Settings" option to template card menu
- [x] Emit settingsClick event from template-card.component.ts
- [x] Handle in template-list.component.ts to open modal

### Task 3: Connect to Backend
- [x] Add WorkflowTemplateService.update() method (was missing)
- [x] Use WorkflowTemplateService.update() for visibility/archive changes (PATCH)
- [x] Use WorkflowChainService.update()/delete()/restore() for chain operations
- [x] Fetch tenant list for private visibility (TenantService.getAll(), filter admin tenant)
- [x] Handle loading and error states

### Task 4: Add to Chain Cards
- [x] Add 3-dot menu to chain-card.component.ts (previously had none)
- [x] Add "Settings" option to chain card menu
- [x] Reuse the same modal component in chain-list.component.ts

### Task 5: Tests
- [x] 21 unit tests for modal core (rendering, visibility, tenants, save, cancel, errors, loading)
- [x] 16 unit tests for modal lifecycle (archive confirmation, archive/unarchive template/chain, error paths, button visibility)
- [x] 2 new tests for template-card settings click
- [x] 4 new tests for chain-card menu and settings
- [x] 3 new tests for template-list modal integration
- [x] 3 new tests for chain-list modal integration

## Technical Notes

- Backend only supports `public | private` visibility (not `restricted` as originally written)
- No boolean `enabled` field exists — archive/unarchive via status field is the mechanism
- Template update: `PATCH /api/admin/workflow-templates/:id`
- Chain update: `PUT /api/admin/workflow-chains/:id` (draft only), `DELETE` for archive, `PATCH :id/restore` for unarchive
- Admin tenant (nil UUID `00000000-0000-0000-0000-000000000000`) filtered from tenant selector
- Modal uses `input.required<WorkflowSettingsTarget>()` with union type for template/chain

## Definition of Done

- [x] All acceptance criteria met
- [x] Unit tests pass (422 web tests, 401 API tests — 823 total)
- [x] Lint passes (0 errors)
- [x] Code review passed (party mode — 10 findings, all resolved)
- [ ] E2E test for visibility change flow (→ Story 3E)

## File List

### New Files
| File | Description |
|------|-------------|
| `apps/web/src/app/admin/workflows/workflow-settings-modal.component.ts` | Settings modal component (visibility, tenants, archive) |
| `apps/web/src/app/admin/workflows/workflow-settings-modal.component.html` | Modal template with form, radio buttons, tenant checklist |
| `apps/web/src/app/admin/workflows/workflow-settings-modal.component.scss` | Modal styles following existing dialog pattern |
| `apps/web/src/app/admin/workflows/workflow-settings-modal.component.spec.ts` | 21 core unit tests (rendering, visibility, tenants, save, cancel, errors) |
| `apps/web/src/app/admin/workflows/workflow-settings-modal-lifecycle.spec.ts` | 16 lifecycle unit tests (archive confirmation, archive/unarchive, error paths) |

### Modified Files
| File | Changes |
|------|---------|
| `apps/web/src/app/app.config.ts` | Added Archive, Globe, Shield icon registrations |
| `apps/web/src/app/core/services/workflow-template.service.ts` | Added `update()` method |
| `apps/web/src/app/admin/workflows/template-card.component.ts` | Added settingsClick output, Settings menu item |
| `apps/web/src/app/admin/workflows/template-list.component.ts` | Added modal import, settingsTarget signal, handlers |
| `apps/web/src/app/admin/workflows/chain-card.component.ts` | Added 3-dot menu, settingsClick output, showMenu signal |
| `apps/web/src/app/admin/workflows/chain-list.component.ts` | Added modal import, settingsTarget signal, handlers |
| `apps/web/src/app/admin/workflows/template-card.component.spec.ts` | Added 2 settings tests |
| `apps/web/src/app/admin/workflows/chain-card.component.spec.ts` | Added 4 menu/settings tests |
| `apps/web/src/app/admin/workflows/template-list.component.spec.ts` | Added 3 modal integration tests |
| `apps/web/src/app/admin/workflows/chain-list.component.spec.ts` | Added 3 modal integration tests |

## Test Traceability

| AC | Test ID | Test File | Test Description | Status |
|----|---------|-----------|------------------|--------|
| AC1 | 3.8-UNIT-005 | workflow-settings-modal.component.spec.ts | Shows Template Settings title | ✓ |
| AC1 | 3.8-UNIT-005a | workflow-settings-modal.component.spec.ts | Shows Chain Settings title | ✓ |
| AC1 | 3.8-UNIT-005b | workflow-settings-modal.component.spec.ts | Shows workflow name | ✓ |
| AC1 | 3.8-UNIT-005c | workflow-settings-modal.component.spec.ts | Shows status badge | ✓ |
| AC1 | 3.8-card-01 | template-card.component.spec.ts | Settings click emits event | ✓ |
| AC1 | 3.8-card-02 | chain-card.component.spec.ts | Menu toggle, settings click | ✓ |
| AC1 | 3.8-list-01 | template-list.component.spec.ts | Modal opens on settings click | ✓ |
| AC1 | 3.8-list-02 | chain-list.component.spec.ts | Modal opens on settings click | ✓ |
| AC2 | 3.8-UNIT-006 | workflow-settings-modal.component.spec.ts | Public radio selected for public template | ✓ |
| AC2 | 3.8-UNIT-006a | workflow-settings-modal.component.spec.ts | Private selected shows tenant selector | ✓ |
| AC2 | 3.8-UNIT-006b | workflow-settings-modal.component.spec.ts | Public hides tenant selector | ✓ |
| AC2 | 3.8-UNIT-015 | workflow-settings-modal.component.spec.ts | Switching to public clears allowedTenants | ✓ |
| AC3 | 3.8-UNIT-007 | workflow-settings-modal.component.spec.ts | Shows non-admin tenants in private mode | ✓ |
| AC3 | 3.8-UNIT-007a | workflow-settings-modal.component.spec.ts | Tenant toggle updates allowedTenants | ✓ |
| AC3 | 3.8-UNIT-007b | workflow-settings-modal.component.spec.ts | isTenantSelected returns correct boolean | ✓ |
| AC4 | 3.8-UNIT-011 | workflow-settings-modal-lifecycle.spec.ts | Archive template sends PATCH status:archived | ✓ |
| AC4 | 3.8-UNIT-011b | workflow-settings-modal-lifecycle.spec.ts | Archive chain sends DELETE | ✓ |
| AC4 | 3.8-UNIT-011d | workflow-settings-modal-lifecycle.spec.ts | Unarchive template sends PATCH status:draft | ✓ |
| AC4 | 3.8-UNIT-011f | workflow-settings-modal-lifecycle.spec.ts | Unarchive chain sends PATCH restore | ✓ |
| AC4 | 3.8-UNIT-016 | workflow-settings-modal-lifecycle.spec.ts | Archive click shows confirmation dialog | ✓ |
| AC4 | 3.8-UNIT-016a | workflow-settings-modal-lifecycle.spec.ts | Archive cancel hides confirmation | ✓ |
| AC4 | 3.8-UNIT-017 | workflow-settings-modal-lifecycle.spec.ts | Non-archived shows archive button | ✓ |
| AC4 | 3.8-UNIT-017a | workflow-settings-modal-lifecycle.spec.ts | Archived shows unarchive button | ✓ |
| AC5 | — | — | Mapped to AC4 (archive/unarchive = enable/disable) | ✓ |
| AC6 | 3.8-UNIT-009 | workflow-settings-modal.component.spec.ts | Save sends PATCH with visibility payload | ✓ |
| AC6 | 3.8-UNIT-009a | workflow-settings-modal.component.spec.ts | Save includes allowedTenants for private | ✓ |
| AC6 | 3.8-UNIT-009b | workflow-settings-modal.component.spec.ts | No-change save closes without API call | ✓ |
| AC6 | 3.8-UNIT-010 | workflow-settings-modal.component.spec.ts | Chain save sends PUT with visibility | ✓ |
| AC7 | 3.8-UNIT-008 | workflow-settings-modal.component.spec.ts | Private with no tenants shows error | ✓ |
| AC8 | 3.8-UNIT-013 | workflow-settings-modal.component.spec.ts | HTTP error shows error message | ✓ |
| AC8 | 3.8-UNIT-014 | workflow-settings-modal.component.spec.ts | Submitting disables buttons | ✓ |
| AC8 | 3.8-UNIT-011a | workflow-settings-modal-lifecycle.spec.ts | Archive error shows message | ✓ |
| AC8 | 3.8-UNIT-011c | workflow-settings-modal-lifecycle.spec.ts | Chain archive error shows message | ✓ |
| AC8 | 3.8-UNIT-011e | workflow-settings-modal-lifecycle.spec.ts | Unarchive error shows message | ✓ |
| AC8 | 3.8-UNIT-011g | workflow-settings-modal-lifecycle.spec.ts | Chain unarchive error shows message | ✓ |
| — | 3.8-UNIT-012 | workflow-settings-modal.component.spec.ts | Cancel emits cancelled | ✓ |
| — | 3.8-UNIT-012a | workflow-settings-modal.component.spec.ts | Backdrop click emits cancelled | ✓ |
| — | 3.8-UNIT-012b | workflow-settings-modal.component.spec.ts | Escape key emits cancelled | ✓ |

## Dev Agent Record

- Adapted "restricted" visibility to "private" (backend only supports public/private)
- Adapted "Enable/Disable" to archive/unarchive (no boolean enabled field in entities)
- Added missing `WorkflowTemplateService.update()` method
- Chain card had no menu previously — added complete 3-dot menu with HostListener for outside-click
- Fixed lint errors: Changed section `<label>` elements to `<span>` for accessibility (label-has-associated-control)
- Fixed UpperCasePipe import (template uses `| uppercase`)
- Fixed Tenant mock data (used correct interface fields: dataResidency, maxMonthlyRuns, assetRetentionDays)
- **Review fixes (10 findings)**: Extracted `executeRequest()` helper (F1), clarified effect comment (F2), added `fixture.destroy()` to afterEach (F3), added archive confirmation dialog (F4), added form dirty check in onSave (F5), added Escape key test (F6), added archive/unarchive error path tests (F7), split spec into 2 files <300 lines each (F8), added AC-to-Test traceability table (F9), removed dead `isArchived` computed (F10)

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 discussion item #2 |
| 2026-02-08 | Dev Agent | Implementation complete — 34 new tests, 10 files modified/created, all ACs met |
| 2026-02-08 | Dev Agent | Review fixes — 10 findings resolved, spec split into 2 files, 37 → 49 tests, traceability table added |
