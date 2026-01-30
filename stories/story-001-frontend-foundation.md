# Story 001: Frontend Foundation (The Walking Skeleton)

**Epic:** Epic 1 (System Foundation)
**Status:** In Progress
**Priority:** Critical
**Assigned Agent:** [Amelia | Senior Engineer]

## Context
This story initializes the frontend application (`apps/web`), implementing the "3-Zone Architecture" and the core Design System. It establishes the "Shell" for all future features.

## Visual Source of Truth
**Target Design:** `docs/ui_mockup/screenshot_navbar.jpg`
**Reference Code:** `docs/ui_mockup/styles.css`, `docs/ui_mockup/library.html`

**Implementation Strategy (The "Visual Adaptation" Rule):**
1.  **Extract:** Copy the CSS variables, utility classes, and layout structures from `docs/ui_mockup/styles.css` into `apps/web/src/styles.css`.
2.  **Adapt:** Use the *Visual Layout* from `library.html` (Sidebar, Topbar, Card Grid) but populate the *Content* (Menu Items, Routes) strictly from the **Restrictions** below.
3.  **Strict Menu Items:**
    *   **Sidebar:** Use the HTML structure from `library.html` but ONLY render the links defined in "Requirement 3: Navigation Links".
    *   **Do NOT** copy "dummy" links from the mockup (e.g., "Settings", "Help" if not in Story).

## Requirements (From Epics)

### 1. Design System (Epic 1.1)
**As a** Developer,
**I want** to transplant the "Dark/Blue" aesthetic from `docs/ui_mockup`,
**So that** the app matches the approved high-fidelity screenshot.

**Acceptance Criteria:**
- [ ] `styles.css` matches `docs/ui_mockup/styles.css` (Ported).
- [ ] `AppLayout` visually matches `screenshot_navbar.jpg` (Icon style, padding, colors).
- [ ] Icons are replaced with **Lucide SVG** equivalents of the mockup icons.

### 2. High-Level Routing (The 3 Zones)
**As a** System Architect,
**I want** strictly enforced routing separation,
**So that** users are isolated based on their context.

**Acceptance Criteria:**
- [ ] Zone A (Public): `/auth/login` (PublicLayout).
- [ ] Zone B (App): `/app/*` (AppLayout - The Storefront).
- [ ] Zone C (Admin): `/admin/*` (AdminLayout - The Workshop).
- [ ] Default Redirect: `/` -> `/auth/login`.

### 3. Navigation Links (Strict Naming)
**As a** Creator,
**I want** to see the correct navigation items defined in the PRD,
**So that** I am not confused by inconsistent terminology.

**Acceptance Criteria:**
- [ ] `AppLayout` Sidebar:
    - [ ] **Workflows** (Link: `/app/workflows`) -> *Replaces "Storefront/Library".*
    - [ ] **Assets** (Link: `/app/assets`) -> *Replaces "Tenant Library/Vault".*
    - [ ] **Activity** (Link: `/app/activity`) -> *Replaces "Reports/Runs".*
- [ ] `AdminLayout` Sidebar:
    - [ ] **Dashboard** (Link: `/admin/dashboard`)
    - [ ] **Workflows** (Link: `/admin/workflows`)
    - [ ] **Tenants** (Link: `/admin/tenants`)

## Verification Plan
1.  **Strict Visual Check:**
    - **Compare** running app against `docs/ui_mockup/screenshot_navbar.jpg`.
    - **Verify** Sidebar colors, spacing, and font weights match the screenshot.
    - **Verify** Menu Items match the Story List (Workflows, Assets, Activity), NOT the Mockup List.
2.  **Code Check:**
    - Verify `app.routes.ts` matches the URLs.
    - Verify `AppLayout` HTML text matches the Labels.

## Technical Notes
- Use `LucideAngularModule.pick({...})` in `app.config.ts` (Global Provider).
- Remove any "My Vault" code artifacts.
