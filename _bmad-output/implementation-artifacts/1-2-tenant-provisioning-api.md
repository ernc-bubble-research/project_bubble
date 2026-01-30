# Story 1.2: Tenant Provisioning (API)

Status: ready-for-dev

## Story

**As a** Bubble Admin,
**I want** to provision new Tenants via an API/UI,
**So that** I can onboard new customers.

## Acceptance Criteria

1.  **Endpoint**: `POST /admin/tenants` accepts `{ "name": "Acme Corp" }`.
2.  **Database**: Creates a new record in `tenants` table with a unique UUID.
3.  **Response**: Returns the created tenant object `{ "id": "...", "name": "Acme Corp" }`.
4.  **Security**: Protected by a basic Admin API Key check (RBAC comes in Story 1.3).

## Tasks / Subtasks

- [ ] Task 1: Database Migration
    - [ ] Generate Prisma migration for `Tenant` model.
    - [ ] Run migration.

- [ ] Task 2: Backend Implementation
    - [ ] Create `TenantService` in `libs/backend/core` (or distinct lib?). *Note: Architecture says Core has shared modules.*
    - [ ] Create `TenantController` in `apps/api-gateway`.
    - [ ] Implement `createTenant` method.

- [ ] Task 3: Security (API Key)
    - [ ] Implement a simple `AdminApiKeyGuard`.
    - [ ] Apply to `/admin/tenants` route.

## Dev Notes
- Use Prisma Schema in `libs/backend/core/prisma/schema.prisma` (if exists) or create one.
- Architecture: `apps/api-gateway` should delegate to `libs/backend/...`.
