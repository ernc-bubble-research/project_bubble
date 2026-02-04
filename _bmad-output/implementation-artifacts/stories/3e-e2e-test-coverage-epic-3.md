# Story 3E: E2E Test Coverage - Epic 3

Status: ready-for-dev

## Story

**As a** Developer,
**I want** end-to-end tests for all Epic 3 features,
**So that** I can verify the Workflow Studio (templates, chains, wizard) works correctly in a real browser.

## Background

Epic 3 covers Workflow Definition including the template library, chain builder, and workflow wizard. Story 3.2 (the wizard) was particularly large and needs thorough E2E validation to ensure it actually works.

## Acceptance Criteria

1. **Workflow Studio Navigation** - Template and Chain tabs work
2. **Template List** - Templates load and display correctly
3. **Workflow Wizard** - All 6 steps complete successfully
4. **Template CRUD** - Create, view, duplicate templates
5. **Chain Builder** - Chain creation and editing works
6. **Filters & Search** - Filter and search functionality works
7. **Publish Flow** - Publishing a template works

## Test Scenarios

### Workflow Studio Navigation
- [ ] `[E2E-3.1]` Workflow Studio page loads
- [ ] `[E2E-3.2]` Templates tab shows template list
- [ ] `[E2E-3.3]` Chains tab shows chain list
- [ ] `[E2E-3.4]` Tab switching works correctly

### Template List
- [ ] `[E2E-3.5]` Template cards display correctly
- [ ] `[E2E-3.6]` Filter by status works
- [ ] `[E2E-3.7]` Search by name works
- [ ] `[E2E-3.8]` Clear filters resets view
- [ ] `[E2E-3.9]` Empty state shows when no templates

### Workflow Wizard - Complete Flow
- [ ] `[E2E-3.10]` "New Workflow" button opens wizard
- [ ] `[E2E-3.11]` Basics step: fill name, description → Next
- [ ] `[E2E-3.12]` Inputs step: add subject input → Next
- [ ] `[E2E-3.13]` Prompt step: enter system/user prompts → Next
- [ ] `[E2E-3.14]` Output step: configure JSON output → Next
- [ ] `[E2E-3.15]` Metadata step: add tags → Next
- [ ] `[E2E-3.16]` Review step: verify summary displays all data
- [ ] `[E2E-3.17]` Save as Draft succeeds
- [ ] `[E2E-3.18]` Publish succeeds
- [ ] `[E2E-3.19]` Created template appears in list

### Wizard Validation
- [ ] `[E2E-3.20]` Cannot proceed without required fields
- [ ] `[E2E-3.21]` Back button preserves form state
- [ ] `[E2E-3.22]` Unsaved changes warning on navigate away

### Template Actions
- [ ] `[E2E-3.23]` Click template card opens edit wizard
- [ ] `[E2E-3.24]` Duplicate template creates copy
- [ ] `[E2E-3.25]` Archive template changes status

### Chain Builder
- [ ] `[E2E-3.26]` "New Chain" button opens chain builder
- [ ] `[E2E-3.27]` Add step to chain works
- [ ] `[E2E-3.28]` Configure step input mapping works
- [ ] `[E2E-3.29]` Save chain succeeds
- [ ] `[E2E-3.30]` Created chain appears in list

## Tasks

### Task 1: Navigation E2E Tests
- [ ] Implement E2E-3.1 through E2E-3.4

### Task 2: Template List E2E Tests
- [ ] Implement E2E-3.5 through E2E-3.9

### Task 3: Wizard Flow E2E Tests
- [ ] Implement E2E-3.10 through E2E-3.19
- [ ] This is the CRITICAL test - validates Story 3.2 works

### Task 4: Wizard Validation E2E Tests
- [ ] Implement E2E-3.20 through E2E-3.22

### Task 5: Template Actions E2E Tests
- [ ] Implement E2E-3.23 through E2E-3.25

### Task 6: Chain Builder E2E Tests
- [ ] Implement E2E-3.26 through E2E-3.30

## Technical Notes

- Wizard tests should complete the FULL flow, not skip steps
- Use realistic test data that matches what a real user would enter
- Pay special attention to E2E-3.10 through E2E-3.19 - this validates Story 3.2

## Definition of Done

- [ ] All 30 test scenarios passing
- [ ] Wizard flow test proves Story 3.2 works end-to-end
- [ ] Tests run in under 3 minutes
- [ ] Code review passed

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 discussion item #5 |
