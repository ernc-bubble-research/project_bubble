# Project Bubble - Readiness Refinement Plan

**Goal:** Address all gaps identified in the [Implementation Readiness Report](./implementation-readiness-report-2026-01-18.md) and prepare for a clean "Implementation Phase" start.

## Phase 1: Structural Integrity (Epic Gaps)
> **Why first?** Addressing the requirements (like "Execution Traces" and "Targeted Feedback") ensures the UX Designer knows *what* to design, preventing rework.

- [x] **Address Readiness Report Findings**
    - [x] Add Story for **PDF Export** (FR19)
    - [x] Add Story for **Execution Trace Viewer** (FR38) -- Added as Story 7.4
    - [x] Add Story for **Watermarking** (FR43) -- Included in Story 5.5
    - [x] Refine **Template Seeding** (FR51) -- Added as Story 1.2e
    - [x] Refine **Targeted Feedback** logic (FR41) -- Refined Story 5.3

## Phase 2: Visual Foundation (UX)
> **Why second?** Now the designer has a complete list of features to visualize.

- [/] **Run `create-ux-design` workflow**
    - [x] Step 1: Initialization & Mockup Audit
    - [x] Step 2: Discovery & Sitemap
    - [ ] Step 3: Wireframes & Flows
    - [ ] Step 4: Final Polish
    - Agent: `ux-designer`
    - Workflow: `create-ux-design`
    - Output: `ux-design.md` (Navigation, Layouts, Key interactions)

## Phase 3: Detailed Review (The User Request)
> **Why third?** We review the *complete* picture (Original + New Stories + UX).

- [ ] **Epic-by-Epic Walkthrough**
    - [ ] Epic 1: Foundation (Review "Technical" nature)
    - [ ] Epic 2: Asset Management
    - [ ] Epic 3: Workflow Definition
    - [ ] Epic 4: Execution Engine (Check against UX)
    - [ ] Epic 5: Reporting (Check against UX)
    - [ ] Epic 6: Guest Access
    - [ ] Epic 7: Observability

## Phase 4: The Clean Slate (Code)
> **Why last?** We only clear the deck when we are 100% ready to build the right thing.

- [ ] **Archive Existing Code**
    - Move current `apps/` and `libs/` to `_archive/legacy_v0/`
    - Ensure `sprint-status` is reset
    - **Outcome:** Fresh start for implementation of Epic 1.
