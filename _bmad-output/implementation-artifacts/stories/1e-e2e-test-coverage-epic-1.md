# Story 1E: E2E Test Coverage - Epic 1

Status: ready-for-dev

## Story

**As a** Developer,
**I want** end-to-end tests for all Epic 1 features,
**So that** I can verify the authentication, tenant management, and admin dashboard work correctly in a real browser.

## Background

Epic 1 has 555+ unit tests but zero E2E tests. Unit tests mock everything and never start the actual server. Critical bugs were discovered during manual UI testing that unit tests completely missed:
- API gateway crashes on startup (entity registration)
- Navigation routes pointing to 404
- Authentication flow issues

This story adds E2E test coverage for all Epic 1 functionality.

## Acceptance Criteria

1. **E2E Framework Setup** - Playwright configured for the web app
2. **API Health Check** - E2E test verifies API gateway starts without errors
3. **Login Flow** - Test complete login journey (form → API → redirect)
4. **Set Password Flow** - Test invitation acceptance and password setting
5. **Admin Dashboard** - Test dashboard loads with tenant cards
6. **Tenant CRUD** - Test create, view, edit tenant workflows
7. **User Management** - Test user invitation and listing
8. **Navigation** - Test all sidebar links resolve to real pages
9. **Logout** - Test logout redirects to login
10. **Error States** - Test invalid credentials show error message

## Test Scenarios

### Authentication
- [ ] `[E2E-1.1]` Login with valid credentials succeeds
- [ ] `[E2E-1.2]` Login with invalid credentials shows error
- [ ] `[E2E-1.3]` Login redirects to dashboard for admin
- [ ] `[E2E-1.4]` Unauthenticated user redirected to login
- [ ] `[E2E-1.5]` Set password flow completes successfully
- [ ] `[E2E-1.6]` Logout clears session and redirects

### Admin Dashboard
- [ ] `[E2E-1.7]` Dashboard page loads without errors
- [ ] `[E2E-1.8]` Tenant cards display correct data
- [ ] `[E2E-1.9]` Create tenant modal opens and submits
- [ ] `[E2E-1.10]` Quick stats show correct counts

### Tenant Management
- [ ] `[E2E-1.11]` Tenant list page loads
- [ ] `[E2E-1.12]` Tenant detail page loads with correct data
- [ ] `[E2E-1.13]` Edit tenant form saves changes
- [ ] `[E2E-1.14]` User list shows tenant users
- [ ] `[E2E-1.15]` Invite user modal sends invitation

### Navigation
- [ ] `[E2E-1.16]` All sidebar links navigate to valid routes
- [ ] `[E2E-1.17]` Breadcrumbs work correctly
- [ ] `[E2E-1.18]` Back navigation works

## Tasks

### Task 1: Playwright Setup
- [ ] Install Playwright in web app
- [ ] Configure playwright.config.ts
- [ ] Create test fixtures for authentication
- [ ] Create test data seeding script

### Task 2: Auth E2E Tests
- [ ] Implement E2E-1.1 through E2E-1.6

### Task 3: Dashboard E2E Tests
- [ ] Implement E2E-1.7 through E2E-1.10

### Task 4: Tenant E2E Tests
- [ ] Implement E2E-1.11 through E2E-1.15

### Task 5: Navigation E2E Tests
- [ ] Implement E2E-1.16 through E2E-1.18

### Task 6: CI Integration
- [ ] Add E2E test command to nx
- [ ] Document how to run E2E tests locally

## Technical Notes

- Use Playwright's built-in test fixtures
- Create a test database with seeded data
- Tests should be independent (no test depends on another)
- Use data-testid attributes for selectors (already exist in components)

## Definition of Done

- [ ] All 18 test scenarios passing
- [ ] Playwright configured and documented
- [ ] Tests run in under 2 minutes
- [ ] Code review passed

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 discussion item #5 |
