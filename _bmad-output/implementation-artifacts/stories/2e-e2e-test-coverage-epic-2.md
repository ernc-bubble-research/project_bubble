# Story 2E: E2E Test Coverage - Epic 2

Status: ready-for-dev

## Story

**As a** Developer,
**I want** end-to-end tests for all Epic 2 features,
**So that** I can verify the Data Vault (asset management) works correctly in a real browser.

## Background

Epic 2 covers Asset & Knowledge Management. While knowledge features are being deferred to Phase 2, the Data Vault (file upload, folders) is critical and needs E2E coverage.

## Acceptance Criteria

1. **Data Vault Navigation** - E2E test verifies Data Vault page loads
2. **Folder CRUD** - Test create, rename, delete folders
3. **File Upload** - Test file upload flow (drag & drop, button)
4. **File Listing** - Test files display correctly in vault
5. **File Download** - Test file download works
6. **File Delete** - Test file deletion with confirmation
7. **Breadcrumb Navigation** - Test folder navigation via breadcrumbs
8. **Empty States** - Test empty folder displays correct message

## Test Scenarios

### Data Vault Navigation
- [ ] `[E2E-2.1]` Data Vault page loads without errors
- [ ] `[E2E-2.2]` Root folder shows default state

### Folder Operations
- [ ] `[E2E-2.3]` Create new folder succeeds
- [ ] `[E2E-2.4]` Rename folder succeeds
- [ ] `[E2E-2.5]` Delete empty folder succeeds
- [ ] `[E2E-2.6]` Navigate into folder updates view
- [ ] `[E2E-2.7]` Breadcrumb navigation works

### File Operations
- [ ] `[E2E-2.8]` Upload file via button succeeds
- [ ] `[E2E-2.9]` Upload file via drag & drop succeeds
- [ ] `[E2E-2.10]` Uploaded file appears in list
- [ ] `[E2E-2.11]` File metadata displays correctly
- [ ] `[E2E-2.12]` Download file succeeds
- [ ] `[E2E-2.13]` Delete file with confirmation succeeds

### Edge Cases
- [ ] `[E2E-2.14]` Upload invalid file type shows error
- [ ] `[E2E-2.15]` Empty folder shows empty state message

## Tasks

### Task 1: Test Fixtures
- [ ] Create file upload test fixtures (sample PDF, DOCX)
- [ ] Create folder seeding for test data

### Task 2: Navigation E2E Tests
- [ ] Implement E2E-2.1 through E2E-2.2

### Task 3: Folder E2E Tests
- [ ] Implement E2E-2.3 through E2E-2.7

### Task 4: File E2E Tests
- [ ] Implement E2E-2.8 through E2E-2.13

### Task 5: Edge Case E2E Tests
- [ ] Implement E2E-2.14 through E2E-2.15

## Technical Notes

- File upload tests need actual test files in fixtures folder
- Use Playwright's file chooser API for upload tests
- Download tests should verify file contents, not just HTTP response

## Definition of Done

- [ ] All 15 test scenarios passing
- [ ] Tests run in under 2 minutes
- [ ] Code review passed

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 discussion item #5 |
