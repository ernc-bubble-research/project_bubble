---
stepsCompleted: [1, 2, 3, 4, 5, 6]
includedDocuments:
  prd: "_bmad-output/planning-artifacts/prd.md"
  architecture: "_bmad-output/planning-artifacts/architecture.md"
  epics: "_bmad-output/planning-artifacts/epics.md"
---

# Implementation Readiness Report

**Date:** 2026-01-18
**Project:** project_bubble
**Status:** In Progress

## 1. Document Inventory

The following documents have been discovered and selected for assessment:

### PRD Documents
- **Selected:** `_bmad-output/planning-artifacts/prd.md`
- **Drafts/Alternates Found:** `prd_fr_draft.md`, `prd_nfr_draft.md` (Ignoring drafts in favor of main file)

### Architecture Documents
- **Selected:** `_bmad-output/planning-artifacts/architecture.md`
- **Context Files:** `architecture_elicitation_results.md`, `architecture_tradeoff_matrix.md`, `party_mode_architecture_context.md` (Using main file for assessment)

### Epics & Stories
- **Selected:** `_bmad-output/planning-artifacts/epics.md`

### UX Design
- **Status:** Not Found (Skipping UX alignment check)

## 2. Validation Findings


## PRD Analysis

### Functional Requirements

*   **FR1: [Prototype]** Bubble Admin can define workflow graph topology using a **Form-Based Wizard** (No-Code).
*   **FR2: [Prototype]** Bubble Admin can configure specific node types (Scanner, Doer, Reviewer) with execution instructions and **Markdown Prompts**.
*   **FR_Versioning: [Prototype]** System enforces **Immutable Versioning** for workflows; editing a workflow creates a new version (`v2`) to protect active runs.
*   **FR42: [MVP]** System soft-deletes Admin objects (Workflows, Assets) allowing restoration within a grace period (e.g., 30 days).
*   **FR3: [Prototype]** Bubble Admin can define strict input allow-lists (e.g., "only .txt, .docx") and max file size limits; System rejects non-compliant files at upload.
*   **FR4: [Prototype]** Bubble Admin can define a strictly typed `InputSchema` (Text, File Array, Asset Selection, Dropdown/Enum) for each workflow.
*   **FR4_UI: [Prototype]** Storefront UI dynamically renders input forms (Modals) based strictly on the Workflow's Input Schema (No hardcoded forms).
*   **FR5: [Prototype]** Bubble Admin can define output report schemas mapping analysis results to UI components.
*   **FR6: [Prototype]** Bubble Admin can update validation rules for "Gatekeeper Protocol" within workflows.
*   **FR35: [Prototype]** Bubble Admin can configure retry policies (count, backoff) for specific node types.
*   **FR7: [Prototype]** Creator can browse available admin-defined workflows in the Storefront.
*   **FR8: [Prototype]** Creator can initiate a new workflow run from the Storefront.
*   **FR9: [Prototype]** Creator can upload required files (supporting .txt, .csv, .md, .docx, .pdf) as defined by the `InputSchema`, including support for **Batch/Array inputs**.
*   **FR10: [Prototype]** Creator can select necessary Company Assets (e.g., Codebooks, Knowledge Files) to bind to the run.
*   **FR11: [Prototype]** Creator can provide text responses to mandatory custom form questions.
*   **FR46: [Prototype]** System validates all mandatory inputs (Files, Forms) are present before allowing Workflow submission.
*   **FR36: [Prototype]** Creator can view remaining run quota (e.g. "Runs: 5/10") in the Storefront.
*   **FR37: [Prototype]** System pauses execution if tenant usage exceeds Admin-defined hard limits (e.g., max runs/month).
*   **FR47: [Prototype]** System enforces a "Max Steps per Model Run" limit (e.g., 50 steps) to prevent infinite loops.
*   **FR12: [Prototype]** System queues workflow execution for asynchronous processing.
*   **FR13: [Prototype]** System supports concurrent execution of multiple workflow runs.
*   **FR34: [Prototype]** System can persist intermediate state at each node completion to allow resumption after failure.
*   **FR14: [Prototype]** Creator can view generated reports in an interactive web interface.
*   **FR15: [Prototype]** Creator can click citation superscripts to reveal source text in a side-panel "Evidence Drawer".
*   **FR16: [Prototype]** Creator can verify or correct system-flagged assumptions via inline feedback forms.
*   **FR17: [Prototype]** Creator can provide natural language feedback to request specific refinements or corrections.
*   **FR18: [Prototype]** System re-runs workflow execution incorporating user feedback as new context.
*   **FR19: [Prototype]** Creator can export final reports to PDF format.
*   **FR41: [MVP]** Creator can target feedback to specific report sections or specific data nodes (e.g., "Fix only the 'Pricing' section").
*   **FR20: [Prototype]** Guest can access specific reports via a secure magic link that expires after a configurable duration (default 7 days).
*   **FR39: [Prototype]** Guest access is strictly scoped to the specific Report UUID linked in the magic link.
*   **FR40: [Prototype]** Creator can revoke active magic links to terminate Guest access.
*   **FR48: [Prototype]** System ingests and indexes Company Assets (text extraction + embedding). **MVP restricted to Text/PDF**.
*   **FR48_Library: [Prototype]** System provides a **Shared Tenant Drive** with Folders. All assets are visible to the Tenant.
*   **FR_Archive: [Prototype]** Deleted assets support **Soft Delete / Archive** with configurable retention (Admin Policy) before physical purge.
*   **FR48_Parallel: [Prototype]** System processes multiple file uploads concurrently (Parallel Ingestion).
*   **FR_Ingest: [Phase 2]** System upgrades to "Smart Normalization" (Vision, Splitters).
*   **FR21: [Prototype]** Knowledge Base ("The Brain") stores validated interaction data / insights separately from raw assets.
*   **FR23: [Prototype]** Customer Admin can manage Company Assets (Codebooks, Knowledge Files) available to the tenant.
*   **FR_Graph_1: [Phase 2]** System upgrades Vector Store to **Hybrid Knowledge Graph**, storing explicit relationships (edges) between information nodes.
*   **FR_Graph_2: [Phase 2]** System supports "Multi-Hop" reasoning (traversing edges) to answer complex queries across disparate documents.
*   **FR24: [Future]** System creates versioned snapshots of the Knowledge Base/Graph state.
*   **FR25: [Future]** Bubble Admin can revert the Knowledge Base to a previous version/snapshot ("Last Known Good State").
*   **FR50: [Future]** Bubble Admin can execute "Right to be Forgotten" commands to scrub specific user PII from Logs and Knowledge Base.
*   **FR44: [Future]** Bubble Admin can configure data retention policies (e.g., "Auto-archive runs older than 1 year").
*   **FR52: [Future]** Creator can "Chat with Report" to query specific insights and raw data within a run context (Scoped RAG).
*   **FR53: [Future]** Creator can "Chat with Company" to query the entire Tenant Knowledge Graph (Global RAG).
*   **FR26: [Prototype]** Bubble Admin can provision new tenants via API.
*   **FR_Admin_Lobby: [Prototype]** Bubble Admin has a **"Super Admin Dashboard" (Lobby)** to view all tenants, user counts, and status.
*   **FR_Impersonate: [Prototype]** Bubble Admin can **Impersonate** a specific tenant for support (Option B), with visual warnings and strict audit logging.
*   **FR_Entitlements: [Prototype]** Bubble Admin can configure **Credit Quotas**, **Workflow Allow-Lists**, and **Asset Retention Policy** (Days) per Tenant.
*   **FR51: [Prototype]** System initializes new Tenants with "Template Workflows".
*   **FR27: [Prototype]** Customer Admin can manually create users within their tenant (Admin sets initial credentials).
*   **FR27_INVITE: [Phase 2]** Customer Admin can invite users via email (Self-service onboarding).
*   **FR28: [Prototype]** System enforces unique IDs for all interactive elements to support automated testing.
*   **FR29: [Future]** Bubble Admin can configure LLM provider settings per workflow or tenant via UI (Advanced Multi-Provider).
*   **FR38: [Prototype]** Customer Admin can view full execution traces (Input -> Prompt -> Raw Output) for debugging purposes.
*   **FR49: [MVP]** System displays "Service Status" banners for downstream dependencies (e.g., "LLM Provider API Degraded").
*   **FR30: [Prototype]** System enforces logical isolation of tenant data using Row-Level Security (RLS).
*   **FR31: [Prototype]** System logs all agent actions (user, timestamp, prompt version, input) for audit trails.
*   **FR32: [Prototype]** System supports configuration for data residency (processing region).
*   **FR33: [Prototype]** System authenticates users based on assigned roles (Bubble Admin, Customer Admin, Creator).
*   **FR43: [MVP]** System applies a watermark (User Email + Timestamp) to all PDF exports.
*   **FR45: [Prototype]** System sanitizes and validates all user text inputs (Feedback, Forms) to prevent prompt injection attacks.
*   **FR_Sec_Sanit: [Prototype]** System sanitizes (DOMPurify) all Admin-uploaded Markdown content before rendering to prevent Stored XSS.
*   **FR_QA_TestID: [Prototype]** System generates stable `data-testid` attributes for all dynamic form fields to enable E2E testing.

Total FRs: 66

### Non-Functional Requirements

*   **UI Latency:** "Evidence Drawer" and "Citation Sidebar" interactions must render within **< 200ms** to ensure a "native app" feel.
*   **Submission Acknowledgement:** Workflow submission must return a "Queued" status within **2 seconds**, regardless of input file size.
*   **Report Rendering:** Completed reports (including up to 50 citations) must load within **3 seconds**.
*   **Strict Isolation:** **100%** of database queries must be executed via the RLS-enabled user context (no superuser connections in application code).
*   **Encryption:** All Company Assets and Knowledge Graph data must be encrypted **AES-256 at rest** and **TLS 1.3 in transit**.
*   **Ephemeral Access:** Magic Links must be cryptographically secure (256-bit entropy) and strictly adhere to the expiration window (default 7 days).
*   **State Persistence:** The Workflow Engine (LangGraph) must persist state to Postgres after **every single node transition** to ensure zero data loss on crash.
*   **Error Handling:** Downstream failures (LLM Provider 500 errors) must trigger a **Exponential Backoff** retry policy (up to 3 attempts) before failing user-visibly.
*   **Concurrency:** System must support **Admin-configurable concurrent run limits** per tenant (e.g., Tier 1 = 5 runs, Tier 2 = 20 runs), enforced by the job queue.
*   **Graph Size:** System must handle Knowledge Graphs up to **10,000 nodes/edges** per tenant with sub-second query performance.
*   **Data Residency:** System infrastructure (DB + LLM Region) will be hosted in **EU (Frankfurt/Dublin)** for Prototype/MVP.

Total NFRs: 11

### Additional Requirements

*   **Project Context:** Greenfield Codebase implementing a Brownfield Specification (Strict Functional Parity).
*   **Technical Stack:** Nx, NestJS, Angular, Postgres+pgvector, BullMQ.
*   **Compliance:** SOC2 readiness (audit logs), GDPR data residency.

### PRD Completeness Assessment

The PRD is highly detailed and structurally complete. It uses specific IDs (FRxx) and tagging (Prototype/MVP/Future). The inclusion of specific "Innovation Areas" and "User Journeys" provides excellent context. NFRs are quantified (metrics like 200ms, 3 seconds). The distinction between Prototype and Phase 2 features is clear. State management (LangGraph persistence) and Tenant Isolation (RLS) are explicitly defined as core requirements.

No critical gaps detected in PRD structure.

*Pending validation in Step 3...*

## Epic Coverage Validation

### Coverage Matrix

| FR Number | PRD Requirement | Epic Coverage | Status |
| :--- | :--- | :--- | :--- |
| FR1 | Graph Topology (Wizard) | Epic 3 (Story 3.1) | ✓ Covered |
| FR2 | Node Configuration | Epic 3 (Story 3.2) | ✓ Covered |
| FR3 | Input Allow-lists | Epic 3 (Story 3.3) | ✓ Covered |
| FR4 | InputSchema | Epic 3 (Story 3.3) | ✓ Covered |
| FR5 | Report Schema | Epic 3 (Story 3.3 - Implied) | ⚠️ Partial |
| FR6 | Validation Rules | Epic 3 (Story 3.4) | ✓ Covered |
| FR7 | Browse Workflows | Epic 4 (Story 4.1) | ✓ Covered |
| FR8 | Initiate Run | Epic 4 (Story 4.1) | ✓ Covered |
| FR9 | Upload Files | Epic 4 (Story 4.1) | ✓ Covered |
| FR10 | Select Assets | Epic 4 (Story 4.1) | ✓ Covered |
| FR11 | Text Responses | Epic 4 (Story 4.1) | ✓ Covered |
| FR12 | Queue Execution | Epic 4 (Story 4.2) | ✓ Covered |
| FR13 | Concurrent Execution | Epic 4 (Story 3.5/4.2) | ✓ Covered |
| FR14 | View Reports | Epic 5 (Story 5.1) | ✓ Covered |
| FR15 | Citations / Evidence | Epic 5 (Story 5.2) | ✓ Covered |
| FR16 | Verify Assumptions | Epic 5 (Story 5.3) | ✓ Covered |
| FR17 | Feedback | Epic 5 (Story 5.3) | ✓ Covered |
| FR18 | Re-Run | Epic 5 (Story 5.4) | ✓ Covered |
| FR19 | PDF Export | **NOT FOUND** | ❌ MISSING |
| FR20 | Magic Link | Epic 6 (Story 6.1) | ✓ Covered |
| FR21 | Store Insights | Epic 2 (Story 2.4) | ✓ Covered |
| FR22 | Query KG Context | Epic 2 (Story 2.3?) / Epic 4 | ⚠️ Implicit |
| FR23 | Manage Assets | Epic 2 (Story 2.1) | ✓ Covered |
| FR24 | KG Snapshots (Future) | **NOT FOUND** | ❌ MISSING |
| FR25 | Revert KG (Future) | **NOT FOUND** | ❌ MISSING |
| FR26 | Provision Tenants | Epic 1 (Story 1.2) | ✓ Covered |
| FR27 | Create Users | Epic 1 (Story 1.5) | ✓ Covered |
| FR28 | Unique IDs | Epic 3 (Story 3.3) | ✓ Covered |
| FR29 | LLM Provider Settings | Epic 7 (Story 7.1) | ✓ Covered |
| FR30 | RLS Isolation | Epic 1 (Story 1.4) | ✓ Covered |
| FR31 | Audit Logs | Epic 7 (Story 7.2) | ✓ Covered |
| FR32 | Data Residency | Epic 7 (Story 7.3 - Implied) | ⚠️ Partial |
| FR33 | Auth / Roles | Epic 1 (Story 1.3) | ✓ Covered |
| FR34 | State Persistence | Epic 4 (Story 4.3) | ✓ Covered |
| FR35 | Retry Policies | Epic 3 (Story 3.1 - Implied) | ⚠️ Partial |
| FR36 | Run Quota View | Epic 4 (Story 4.1?) | ⚠️ Implicit |
| FR37 | Quota Limits | Epic 1 (Story 1.2d) | ✓ Covered |
| FR38 | Execution Traces | **NOT FOUND** | ❌ MISSING |
| FR39 | Guest Scope | Epic 6 (Story 6.2) | ✓ Covered |
| FR40 | Revoke Link | Epic 6 (Story 6.1) | ✓ Covered |
| FR41 | Target Feedback | Epic 5 (Story 5.3 - General only) | ⚠️ Implementation Gap |
| FR42 | Soft Delete | Epic 1 (Story 1.2d / 2.1) | ✓ Covered |
| FR43 | PDF Watermark | **NOT FOUND** | ❌ MISSING |
| FR44 | Retention Policy | Epic 1 (Story 1.2d) | ✓ Covered |
| FR45 | Sanitize Input | Epic 3 (Story 3.2), Epic 4 | ✓ Covered |
| FR46 | Validate Inputs | Epic 4 (Story 4.1) | ✓ Covered |
| FR47 | Max Steps | Epic 4 (Story 4.2 - Implied) | ⚠️ Partial |
| FR48 | Ingest Assets | Epic 2 (Story 2.2) | ✓ Covered |
| FR49 | Service Status | Epic 7 (Story 7.3) | ✓ Covered |
| FR50 | Right to Forgotten | **NOT FOUND** | ❌ MISSING |
| FR51 | Template Workflows | **NOT FOUND** | ❌ MISSING |
| FR52 | Chat Report (Future) | Epic 8 (Story 8.1) | ✓ Covered |
| FR53 | Chat Company (Future) | Epic 8 (Story 8.2) | ✓ Covered |

### Missing Requirements & Gaps

#### Critical Functional Gaps (Must Fix)

1.  **FR19 & FR43 (PDF Export & Watermark):** [Prototype/MVP]
    *   **Impact:** Users cannot export reports, a core requirement. Compliance watermark is missing.
    *   **Recommendation:** Add "Story 5.5: PDF Generation Service" to Epic 5.

2.  **FR38 (Execution Traces):** [Prototype]
    *   **Impact:** Customer Admins cannot debug or trust the "Black Box".
    *   **Recommendation:** Add "Story 7.4: Execution Trace Viewer" to Epic 7.

3.  **FR51 (Template Workflows):** [Prototype]
    *   **Impact:** New tenants start with an empty state (Bad UX).
    *   **Recommendation:** Add detail to "Story 1.2: Tenant Provisioning" to include seeding.

4.  **FR41 (Targeted Feedback):** [MVP]
    *   **Impact:** Users can only give general feedback, not specific corrections to data points.
    *   **Recommendation:** Refine Story 5.3 to support node-specific targeting.

#### Documentation Gaps (Map vs Stories)

*   **FR_Versioning, FR4_UI, FR48_Library, FR_Archive**: Covered in stories but missing from Epic metadata/tables.

### Coverage Statistics

*   Total PRD FRs: 67 (Including FR22)
*   **Fully Covered:** 53
*   **Partial/Implicit:** 6
*   **Missing:** 8 (FR19, FR43, FR38, FR51, FR24, FR25, FR50, FR41)
*   **Coverage:** ~79% (Functional check)

*Pending validation in Step 4...*

## UX Alignment Assessment

### UX Document Status

**Not Found**

### Alignment Issues

*   **N/A (No UX Document)**

### Warnings

⚠️ **CRITICAL: UX Implied but Missing**

The PRD explicitly defines a rich user interface ("Storefront", "Evidence Drawer", "Interactive Reports") and the Architecture specifies Angular 18+. However, no devoted `ux-design.md` artifact was found.

*   **Risk:** Developers may have to implement complex UI features (e.g., "Evidence Drawer") based solely on text descriptions without visual guidance, leading to rework.
*   **Recommendation:** Create a `create-ux-design` task or at least wireframes effectively before "Story 5.2" implementation.

*Pending validation in Step 5...*

## Epic Quality Review

### Structure & Value Assessment

*   **Epic 1 (System Foundation):** 🟠 **Technical/Infrastructure Epic.**
    *   **Issue:** Focuses on "Monorepo", "RLS", "Auth". Use of "As a Developer" (Story 1.1) is an anti-pattern.
    *   **Justification:** Essential for Greenfield project start, but represents "Plumbing" rather than direct "User Value" in the stricter sense.
    *   **Recommendation:** Acceptable for Phase 1 Greenfield, but ensure future epics remain user-centric.

*   **Epic 2, 3, 4, 5, 6:** 🟢 **User-Centric.**
    *   Clearly defined user value (Upload, Define, Run, View).

### Dependency Analysis

*   **Linear Flow:** Epic 1 (Auth) -> Epic 2 (Assets) / Epic 3 (Definitions) -> Epic 4 (Execution) -> Epic 5 (Reporting).
*   **Independence:** No circular dependencies detected.
*   **Forward References:** None detected. Stories generally build on previous outputs.

### Story Quality Check

*   **Sizing:** Stories appear vertically sliced and manageable (1-3 days est).
*   **Acceptance Criteria:**
    *   **Format:** Consistent `Given/When/Then` used throughout.
    *   **Specificity:** High. Specific UI interactions and System behaviors defined (e.g., "AES-256", "<200ms").
    *   **Testability:** Excellent. ACs include verifiable states ("Tenant record created", "Modal opens").

### Database / Schema Strategy

*   **Pattern:** "Create when needed" appears to be followed.
    *   Epic 1 creates Tenants/Users tables.
    *   Epic 2 creates Assets/Vectors tables.
    *   Epic 3 creates Workflow/Version tables.

### Quality Violations

#### 🟠 Major Issues

1.  **Story 1.1 "Monorepo & Infrastructure":** "As a Developer..." user persona.
    *   *Correction:* Acknowledge this is a "Chore" or "Spike" disguised as a story.
2.  **Epic 1 (General):** Foundation-heavy.
    *   *Risk:* Delays visible user value until Epic 2/3.

#### 🟡 Minor Concerns

1.  **Implicit Features:** Features like "PDF Export" (FR19) are listed in Epic headers but lack explicit implementation stories (as noted in Coverage section).

*Pending validation in Step 6...*

## Summary and Recommendations

### Overall Readiness Status

**NEEDS WORK** (Critical UX Gaps & Missing MVP Features)

### Critical Issues Requiring Immediate Action

1.  🔴 **UX Artifact Missing:** Project is UI-heavy ("Storefront", "Interactive Report"), but no UX design exists. Risk of rework is high.
2.  🔴 **Functional Gaps:** Core "Prototype" requirements (PDF Export, Execution Traces) have no implementation stories.
3.  🟠 **Technical Epics:** Epic 1 is infrastructure-heavy with weak user value definition.

### Recommended Next Steps

1.  **Create UX Artifact:** Run `create-ux-design` workflow to define the "Storefront" and "Report" layouts.
2.  **Add Missing Stories:** 
    *   Add **Story 5.5** for PDF Export (FR19).
    *   Add **Story 7.4** for Execution Trace Viewer (FR38).
    *   Add **Story 1.X** for Template Workflow Seeding (FR51).
3.  **Verify "Future" Scope:** Confirm that FR24, FR25, FR50 are indeed deferred and do not need stories now.

### Final Note

This assessment identified **UX, Functional, and Quality** issues. 
*   **79% FR Coverage** (Good, but key MVP features missing).
*   **UX Missing** (Critical Risk).

Please review the detailed sections above.

