# Story 1-13: Tenant Lifecycle Management

Status: ready-for-dev

## Story

**As a** Bubble Admin,
**I want** to archive, suspend, and permanently delete tenants,
**So that** I can manage churned customers and comply with GDPR/data privacy requirements.

## Background

Currently tenant management only supports create, read, and update operations. There is no way to:
- Archive a tenant (soft delete, data preserved)
- Suspend a tenant (temporarily disable access)
- Permanently delete a tenant (GDPR right to erasure)

This is critical for:
1. Managing churned customers without losing historical data
2. Temporarily suspending tenants for non-payment
3. GDPR compliance - customers can request complete data deletion

## Acceptance Criteria

1. **Tenant Status Field** - Add status field: active, suspended, archived
2. **Suspend Tenant** - Admin can suspend a tenant (users cannot log in)
3. **Unsuspend Tenant** - Admin can reactivate a suspended tenant
4. **Archive Tenant** - Admin can archive a tenant (soft delete)
5. **Unarchive Tenant** - Admin can restore an archived tenant to active
6. **Hard Delete** - Admin can permanently delete an archived tenant (with confirmation)
7. **Cascade Delete** - Hard delete removes all tenant data (users, assets, workflows, runs)
8. **UI Controls** - Tenant detail page shows status and action buttons
9. **List Filtering** - Tenant list can filter by status (active/suspended/archived)
10. **Suspended Access Blocked** - Suspended tenant users see "Account suspended" message

## Tasks

### Task 1: Database Schema Update
- [ ] Add `status` enum column to tenants table (active, suspended, archived)
- [ ] Add migration script
- [ ] Update TenantEntity with status field

### Task 2: Backend API Updates
- [ ] Add PATCH /tenants/:id/suspend endpoint
- [ ] Add PATCH /tenants/:id/unsuspend endpoint
- [ ] Add PATCH /tenants/:id/archive endpoint
- [ ] Add PATCH /tenants/:id/unarchive endpoint
- [ ] Add DELETE /tenants/:id endpoint (hard delete, requires archived status)
- [ ] Update GET /tenants to support status filter query param

### Task 3: Cascade Delete Implementation
- [ ] Delete all users belonging to tenant
- [ ] Delete all assets and files (S3/storage)
- [ ] Delete all folders
- [ ] Delete all knowledge chunks (vectors)
- [ ] Delete all workflow runs and outputs
- [ ] Delete all workflow templates owned by tenant
- [ ] Use database transaction for atomicity

### Task 4: Auth Guard Update
- [ ] Check tenant status during authentication
- [ ] Return 403 with "Account suspended" for suspended tenants
- [ ] Return 403 with "Account archived" for archived tenants

### Task 5: Frontend - Tenant Detail Updates
- [ ] Show current status badge on tenant detail page
- [ ] Add Suspend/Unsuspend button (conditionally shown)
- [ ] Add Archive/Unarchive button (conditionally shown)
- [ ] Add Delete button (only shown for archived tenants)
- [ ] Confirmation dialog for destructive actions

### Task 6: Frontend - Tenant List Updates
- [ ] Add status filter dropdown to tenant list
- [ ] Show status badge on tenant cards
- [ ] Visual distinction for suspended/archived tenants (greyed out)

### Task 7: Tests
- [ ] Unit tests for all new endpoints
- [ ] Unit tests for cascade delete logic
- [ ] Unit tests for auth guard status check
- [ ] Frontend component tests

## Technical Notes

- Hard delete should be a background job for large tenants (lots of data)
- Consider adding audit log entry for all lifecycle changes
- Suspended tenants should still appear in admin views but not be accessible by their users
- Archive is reversible, delete is not - make this very clear in UI

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Database migration works (up and down)
- [ ] All tests pass
- [ ] Lint passes
- [ ] Code review passed
- [ ] E2E test for suspend/archive/delete flow

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-04 | Retrospective | Story created from Epic 3 discussion item #3 |
