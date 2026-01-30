# Handover Context

**Project:** `project_bubble`
**Session Date:** 2026-01-28
**Status:** Protocol Reset & Alignment Complete

## 1. Critical Protocol Change (Mandatory)
We have switched to a **Strict Story-Driven Workflow** to prevent feature creep and hallucinations.
**The Rule:** No code is written unless a specific `stories/story-XXX.md` file exists and is approved by the user.

**Active Story:**
*   `stories/story-001-frontend-foundation.md` (Approved & Implemented).
    *   Defines: 3-Zone Architecture, "Dark/Blue" Layout, and Sidebar Navigation.
    *   **Naming Convention (Option A):** `Workflows`, `Assets`, `Activity`.

## 2. Current State
*   **Documentation:**
    *   `epics.md`, `ux-design-specification.md`, and `story-001` all align on Option A naming.
*   **Code (`apps/web`):**
    *   `AppLayout`: Sidebar updated to Workflows/Assets/Activity.
    *   `app.routes.ts`: Routes updated to `/app/workflows`, `/app/assets`, `/app/activity`.
    *   *Note:* Routes currently point to `LibraryComponent` as a placeholder.

## 3. Next Actions (Next Session)
**Goal:** Implement Backend Authentication (Epic 1.3).

1.  **Generate Story 002:**
    *   Execute `/bmad-bmm-workflows-create-story`.
    *   Extract Epic 1.3 (Auth) requirements into `stories/story-002-backend-auth.md`.
    *   **Verify** with User.
2.  **Implementation:**
    *   Execute `/bmad-bmm-workflows-dev-story` for Story 002.
    *   Implement NestJS Guards, JWT Strategy, and User Entity.

## 4. Known Oddities
*   The component folder `features/storefront/library` is still named "library". This should be renamed to "workflows" in a future refactor task, but functionality is correct.
