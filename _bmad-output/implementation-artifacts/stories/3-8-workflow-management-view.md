# Story 3.8: Workflow Management View

Status: ready-for-dev

## Story

**As a** Bubble Admin,
**I want** a dedicated workflow management view to edit workflow settings after creation,
**So that** I can update visibility, archive workflows, and control tenant access without recreating them.

## Background

The Workflow Builder Wizard (Story 3.2) creates workflows, but there is no UI to manage workflows after creation. The backend supports:
- Visibility: public, private, restricted
- Allowed tenants list (for restricted visibility)
- Archive status

These settings need a management interface separate from the creation wizard.

## Acceptance Criteria

1. **Workflow Settings Modal** - Clicking "Settings" from template card menu opens a modal
2. **Visibility Controls** - Can change visibility between public/private/restricted
3. **Tenant Selection** - When restricted, can select which tenants have access
4. **Archive/Unarchive** - Can archive and unarchive workflows
5. **Enable/Disable** - Can disable a workflow for all tenants (soft disable vs archive)
6. **Save Changes** - Changes persist to backend via existing API
7. **Validation** - Cannot save restricted visibility without at least one tenant selected
8. **Feedback** - Toast notifications for success/error states

## Tasks

### Task 1: Create Workflow Settings Modal Component
- [ ] Create `workflow-settings-modal.component.ts`
- [ ] Add visibility radio buttons (public/private/restricted)
- [ ] Add tenant multi-select dropdown (shown when restricted)
- [ ] Add archive toggle
- [ ] Add enabled/disabled toggle
- [ ] Style consistent with existing modals

### Task 2: Integrate with Template Card
- [ ] Add "Settings" option to template card menu
- [ ] Emit settingsClick event from template-card.component.ts
- [ ] Handle in template-list.component.ts to open modal

### Task 3: Connect to Backend
- [ ] Use WorkflowTemplateService.update() for visibility/archive changes
- [ ] Fetch tenant list for restricted visibility dropdown
- [ ] Handle loading and error states

### Task 4: Add to Chain Cards
- [ ] Add same settings option to chain-card.component.ts
- [ ] Reuse the same modal component

### Task 5: Tests
- [ ] Unit tests for modal component
- [ ] Unit tests for visibility validation
- [ ] Unit tests for tenant selection logic

## Technical Notes

- Reuse existing `WorkflowTemplateService.update()` method
- Tenant list comes from `TenantsService.getAll()` (admin-only endpoint)
- Modal should use the same styling as create-folder-dialog and other modals
- Consider using a shared modal wrapper component if one exists

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Unit tests pass
- [ ] Lint passes
- [ ] Code review passed
- [ ] E2E test for visibility change flow

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 discussion item #2 |
