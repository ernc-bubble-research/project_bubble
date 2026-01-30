# Story 1.2b: Bubble Admin Dashboard ("The Lobby")

Status: ready-for-dev

## Story

**As a** Bubble Admin,
**I want** a "Super Admin" landing page that lists all active tenants,
**So that** I can see who is on the platform and manage them.

## Acceptance Criteria

1.  **Route**: User accessing `/ops` (or `/admin/dashboard`) is shown the dashboard.
2.  **Tenant List**: specific table showing:
    - Name
    - ID (UUID)
    - Status (Active/Inactive - mock or default to Active)
    - User Count (mock or real if easy)
3.  **Create Action**: A "Create Tenant" button that opens a simple form/modal to call the API from Story 1.2.
4.  **Auth**: *Prerequisite Note*: Since Story 1.3 (Auth) is not done, we will assume a "Dev Mode" or simple header injection for the API Client.

## Tasks / Subtasks

- [ ] Task 1: Frontend Setup (Angular)
    - [ ] Generate `AdminFeature` library or component in `apps/web`.
    - [ ] Configure Routing (`/ops`).

- [ ] Task 2: Tenant List UI
    - [ ] Create `TenantListComponent`.
    - [ ] Implement `TenantService` (Frontend) to fetch from `GET /api/admin/tenants`.
    - [ ] Display data in a responsive table.

- [ ] Task 3: Create Tenant Integration
    - [ ] Create simple "Add Tenant" form.
    - [ ] Connect to `POST /api/admin/tenants`.

## Dev Notes
- Use the `ADMIN_API_KEY` configured in Story 1.2 for API calls.
- Frontend can store this key in LocalStorage or an Input Field for now (Temporary Dev Auth).
