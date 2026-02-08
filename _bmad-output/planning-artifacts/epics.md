---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# project_bubble - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for project_bubble, decomposing the requirements from the PRD and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

*   FR1: [Prototype] Bubble Admin can define atomic workflow templates via a form-based wizard (metadata, inputs, execution, knowledge, prompt, output).
*   FR2: [Prototype] Bubble Admin can configure workflow inputs (context/subject roles), execution settings (parallel/batch), and LLM prompt instructions.
*   FR3: [Prototype] Bubble Admin can define strict input allow-lists (e.g., "only .txt, .docx") and max file size limits.
*   FR4: [Prototype] Bubble Admin can create custom form inputs (text fields, multiple choice) for workflow initialization.
*   FR5: [Prototype] Bubble Admin can define output report schemas mapping analysis results to UI components.
*   FR6: [Prototype] Bubble Admin can update validation rules for "Gatekeeper Protocol" within workflows.
*   FR7: [Prototype] Creator can browse available admin-defined workflows in the Workflows.
*   FR8: [Prototype] Creator can initiate a new workflow run from the Workflows.
*   FR9: [Prototype] Creator can upload required files (supporting .txt, .csv, .md, .docx, .pdf) for a run.
*   FR10: [Prototype] Creator can select necessary Company Assets (e.g., Codebooks, Knowledge Files) to bind to the run.
*   FR11: [Prototype] Creator can provide text responses to mandatory custom form questions.
*   FR12: [Prototype] System queues workflow execution for asynchronous processing.
*   FR13: [Prototype] System supports concurrent execution of multiple workflow runs.
*   FR14: [Prototype] Creator can view generated reports in an interactive web interface.
*   FR15: [Prototype] Creator can click citation superscripts to reveal source text in a side-panel "Evidence Drawer".
*   FR16: [Prototype] Creator can verify or correct system-flagged assumptions via inline feedback forms.
*   FR17: [Prototype] Creator can provide natural language feedback to request specific refinements or corrections.
*   FR18: [Prototype] System re-runs workflow execution incorporating user feedback as new context.
*   FR19: [Prototype] Creator can export final reports to PDF format.
*   FR20: [Prototype] Guest can access specific reports via a secure magic link that expires after a configurable duration.
*   FR21: [Prototype] System stores validated interaction data (corrections, verified assumptions) into the Knowledge Graph.
*   FR22: [Prototype] Workflow execution queries Knowledge Graph for historical context before processing new inputs.
*   FR23: [Prototype] Customer Admin can manage Company Assets (Codebooks, Knowledge Files) available to the tenant.
*   FR26: [Prototype] Bubble Admin can provision new tenants and configure tenant-level settings.
*   FR27: [Prototype] Customer Admin can invite and manage users within their tenant.
*   FR28: [Prototype] System enforces unique IDs for all interactive elements to support automated testing.
*   FR29: [Prototype] Bubble Admin can configure LLM provider settings per workflow or tenant.
*   FR30: [Prototype] System enforces logical isolation of tenant data using Row-Level Security (RLS).
*   FR31: [Prototype] System logs all agent actions (user, timestamp, prompt version, input) for audit trails.
*   FR32: [Prototype] System supports configuration for data residency (processing region).
*   FR33: [Prototype] System authenticates users based on assigned roles.
*   FR34: [Prototype] System can persist workflow run state (input snapshots, output assets, retry history) to allow debugging and auditing.
*   FR35: [Prototype] Bubble Admin can configure validation retry count per workflow template and system-wide default.
*   FR36: [Prototype] Creator can view remaining run quota (e.g. "Runs: 5/10") in the Workflows.
*   FR37: [Prototype] System pauses execution if tenant usage exceeds Admin-defined hard limits.
*   FR38: [Prototype] Customer Admin can view full execution traces (Input -> Prompt -> Raw Output) for debugging purposes.
*   FR39: [Prototype] Guest access is strictly scoped to the specific Report UUID linked in the magic link.
*   FR40: [Prototype] Creator can revoke active magic links to terminate Guest access.
*   FR42: [MVP] System soft-deletes Admin objects (Workflows, Assets).
*   FR43: [MVP] System applies a watermark (User Email + Timestamp) to all PDF exports.
*   FR44: [Future] Bubble Admin can configure data retention policies.
*   FR45: [Prototype] System sanitizes and validates all user text inputs to prevent prompt injection.
*   FR46: [Prototype] System validates all mandatory inputs (Files, Forms) are present before allowing Workflow submission.
*   FR47: [Prototype] System enforces context window token budget checks before execution and max output token limits per workflow.
*   FR48: [Prototype] System ingests and indexes Company Assets (text extraction + embedding) upon upload.
*   FR49: [MVP] System displays "Service Status" banners.
*   FR50: [Future] Bubble Admin can execute "Right to be Forgotten" commands.
*   FR51: [Prototype] System initializes new Tenants with a set of "Template Workflows" and "Sample Assets".

### NonFunctional Requirements

*   **NFR-Perf-1 (UI Latency):** "Evidence Drawer" and "Citation Sidebar" interactions must render within < 200ms.
*   **NFR-Perf-2 (Ack):** Workflow submission must return a "Queued" status within 2 seconds.
*   **NFR-Perf-3 (Render):** Completed reports must load within 3 seconds.
*   **NFR-Sec-1 (RLS):** 100% of database queries must be executed via the RLS-enabled user context.
*   **NFR-Sec-2 (Encryption):** AES-256 at rest and TLS 1.3 in transit for all assets.
*   **NFR-Sec-3 (Links):** Magic Links must be cryptographically secure and adhere to expiration.
*   **NFR-Rel-1 (Run Tracking):** Workflow Engine must persist run state (input_snapshot, assembled_prompt, raw_llm_response, retry_history) to Postgres for every workflow run.
*   **NFR-Rel-2 (Retry):** Downstream failures must trigger Exponential Backoff retry policy.
*   **NFR-Scale-1 (Concurrent):** System must support Admin-configurable concurrent run limits per tenant.
*   **NFR-Scale-2 (Knowledge):** System must handle Knowledge Base with up to 10,000 vector chunks per tenant.
*   **NFR-Comp-1 (Residency):** Infrastructure hosted in EU (Frankfurt/Dublin).

### Additional Requirements (Architecture)

*   **Tech Stack:** Nx Monorepo, NestJS (API + Worker), Angular 18+, PostgreSQL + pgvector, BullMQ/Redis.
*   **Pattern:** CQRS-lite (API Service vs Worker Service).
*   **Pattern:** Shared DTOs for contract consistency.
*   **Pattern:** Hexagonal Architecture for LLM provider swapping.
*   **Constraint:** "The 200ms Rule" - API must offload heavy tasks to Queue.
*   **Constraint:** "Security by Consumption" - Use `TransactionManager` for all DB access.

### FR Coverage Map

| FR | Epic | Description |
| :--- | :--- | :--- |
| FR30, FR33, FR26, FR27, FR28, FR32, FR51, FR_Admin_Lobby, FR_Impersonate, FR_Entitlements | **Epic 1** | System Foundation, Auth, & Tenants |
| FR23, FR48, FR48_Library, FR48_Parallel, FR_Archive, FR3, FR21, FR22 | **Epic 2** | Asset & Knowledge Management |
| FR1, FR2, FR4, FR5, FR6, FR35, FR42, FR_QA_TestID | **Epic 3** | Workflow Definition (Atomic Workflows, Chains, Wizard) |
| FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR34, FR36, FR37, FR46, FR47, FR_Sec_Sanit | **Epic 4** | Workflow Execution Engine (The Creator) |
| FR14, FR15, FR16, FR17, FR18, FR19, FR43, FR45 | **Epic 5** | Interactive Reporting & Feedback |
| FR20, FR39, FR40 | **Epic 6** | Guest Access & Sharing |
| FR29, FR31, FR38, FR49 | **Epic 7** | Observability & Advanced Ops |

## Epic List

### Epic 1: Tenant Management & Platform Setup
**Goal:** Establish the production-ready platform with secure tenant management, authentication, and data isolation from Day 1.
**FRs covered:** FR30, FR33, FR26, FR27, FR28, FR32, FR51, FR_Admin_Lobby, FR_Impersonate, FR_Entitlements
**NFRs:** NFR-Sec-1, NFR-Sec-2, NFR-Comp-1

#### Story 1.1: Monorepo & Infrastructure Initialization
**As a** Developer,
**I want** a configured Nx Monorepo (NestJS/Angular) with Postgres+pgvector running locally via Docker,
**So that** I have a consistent, production-parity development environment.

**Acceptance Criteria:**

**Given** a fresh clone of the repo
**When** I run `npm install` and `docker-compose up`
**Then** the NestJS API and Postgres (with pgvector extension) should be running
**And** the Global LLM API Key (Gemini) should be loadable from environment variables
**And** the project structure should match the Architecture definition (apps/libs split)

#### Story 1.2: Tenant Provisioning (API)
**As a** Bubble Admin,
**I want** to provision new Tenants via an API/UI,
**So that** I can onboard new customers.

**Acceptance Criteria:**
**Given** a valid Admin API Key
**When** I POST to `/admin/tenants` with a name
**Then** a new Tenant record is created with a unique UUID

#### Story 1.3: Bubble Admin Dashboard ("The Lobby")
**As a** Bubble Admin,
**I want** a "Super Admin" landing page that lists all active tenants,
**So that** I can see who is on the platform and manage them.

**Acceptance Criteria:**
**Given** I log in with `role: bubble_admin`
**Then** I am redirected to `/admin/dashboard`
**And** I see a table of Tenants (Name, ID, User Count, Status)
**And** I see a "Create Tenant" button (triggers Story 1.2)

#### Story 1.4: Impersonation Action
**As a** Bubble Admin,
**I want** to click "Manage" on a tenant in the Lobby,
**So that** I can log in as them to provide support.

**Acceptance Criteria:**
**Given** I click "Manage Acme Corp"
**Then** the system issues a temporary token scoped to `tenant_id: acme_corp`
**And** the UI reloads showing the Acme Corp Dashboard
**And** a **Prominent "Viewing as Acme Corp" Banner** persists at the top (Red/Safety Orange)
**And** after 60 minutes of inactivity, the session reverts to the Admin Lobby (does not logout, just exits impersonation)

#### Story 1.5: Tenant Configuration (Credits & Entitlements)
**As a** Bubble Admin,
**I want** to configure a tenant's limits (run quota, asset retention) and general settings,
**So that** I can enforce pricing tiers and control tenant resource allocation.

**Acceptance Criteria:**
**Given** I am on the Tenant Detail page (in The Lobby)
**When** I edit "Settings"
**Then** I can set `max_monthly_runs` (Integer)
**And** I can set **`asset_retention_days`** (Integer, default: 30) for the Soft Delete Archive policy
**And** I can set general tenant settings: name, primary contact, plan tier, data residency
**And** I can suspend/activate a tenant
**And** workflow access is shown as read-only (managed at workflow level — see Epic 3 design decision)
**And** system deducts credits **Upfront** (at Run Request); if request fails validation, credit is refunded immediately.

#### Story 1.6: Tenant Seeding (Templates) [Prototype]
**As a** Bubble Admin,
**I want** new tenants to be initialized with "Template Workflows" and "Sample Assets",
**So that** they can experience the value immediately without manual setup.

**Acceptance Criteria:**
**Given** a new Tenant is created (via Story 1.2)
**Then** the system automatically copies the "Global Template Workflows" (e.g., QDA Analyzer) into the new Tenant's scope
**And** creates a "Sample Codebook" in their Asset Library
**And** labels these as "Example / Read-Only" (or allows users to clone/edit them)

#### Story 1.7: User Authentication & RBAC
**As a** User,
**I want** to log in and receive a secure JWT,
**So that** the system knows my identity, tenant context, and permissions.

**Acceptance Criteria:**

**Given** valid credentials
**When** I login
**Then** I receive a JWT containing `sub` (User ID), `tenant_id`, and `role`
**And** the supported roles are `BubbleAdmin`, `CustomerAdmin`, `Creator`

#### Story 1.8: RLS Enforcement Mechanism (Security)
**As a** Bubble Admin,
**I want** the system to enforce strict tenant data isolation via `SET LOCAL app.current_tenant` on every query,
**So that** no tenant can ever access another tenant's data, even if application code has a bug.

**Acceptance Criteria:**
**Given** a database transaction (HTTP Request OR Background Job)
**When** a query is executed
**Then** the `TransactionInterceptor` must automatically inject `SET LOCAL app.current_tenant`
**And** for Background Jobs (BullMQ), the Worker must reconstitute the Tenant Context from the Job Payload before opening the transaction
**And** a Code Guard must prevent direct Repository access

#### Story 1.9: User Management (Admin Creation) [Prototype]
**As a** Customer Admin (managing my team) OR Bubble Admin (providing support),
**I want** to create a new user directly in the system,
**So that** I can onboard team members without relying on an external email service.

**Acceptance Criteria:**
**Given** I am a **Customer Admin**
**When** I create a user
**Then** the user is strictly bound to *my* `tenant_id`

**Given** I am a **Bubble Admin** (Super User)
**When** I create a user
**Then** I must specify which `tenant_id` this user belongs to (or assign them to the 'Admin' tenant)
**And** the password is securely hashed immediately

#### Story 1.10: Login & Password Pages (Auth UI) [Prototype]
**As a** User,
**I want** a clean login page and password-set page,
**So that** I can authenticate and access the application.

**Acceptance Criteria:**

**Given** I navigate to `/auth/login`
**Then** I see a branded login form with email and password fields, the Bubble logo, and a "Sign In" button
**And** the form validates email format and required fields before submission
**And** on invalid credentials, I see an inline error: "Invalid email or password"
**And** on successful login, I am redirected to `/app/workflows` (Creator/Customer Admin) or `/admin/dashboard` (Bubble Admin)

**Given** I navigate to `/auth/set-password` with a valid invitation/reset token
**Then** I see a password-set form with "New Password" and "Confirm Password" fields
**And** the form enforces minimum password requirements (8+ chars, mixed case, number)
**And** on success, I am redirected to `/auth/login` with a success message

#### Story 1.11: CI/CD Pipeline Setup [Prototype]
**As a** Developer,
**I want** a CI/CD pipeline configured with GitHub Actions and Nx Cloud,
**So that** every push is automatically built, tested, and validated.

**Acceptance Criteria:**

**Given** a PR is opened or a commit is pushed to main
**When** GitHub Actions triggers
**Then** `nx affected:lint` runs on changed projects
**And** `nx affected:test` runs unit tests on changed projects
**And** `nx affected:build` builds changed apps (web, api-gateway, worker-engine)
**And** the pipeline fails if any step fails, blocking the merge
**And** Nx Cloud caches previous builds to speed up CI runs

#### Story 1.12: User Invitations (Email Flow) [Phase 2]
**As a** Customer Admin,
**I want** to invite colleagues via email,
**So that** they can set their own passwords and onboard themselves.

**Acceptance Criteria:**
**Given** I invite `bob@example.com`
**Then** an email is sent via (SendGrid/AWS SES) with a magic token
**And** Bob can click the link to set his password
**And** he is added to my Tenant

### Epic 2: Asset & Knowledge Management
**Goal:** Enable tenants to manage their proprietary data and selectively ingest them into the "Company Brain" (Vector Knowledge Base).
**Strategy:** Files are type-agnostic at upload. Users explicitly choose which files to add to the Knowledge Base ("Learn This" action). The "type" of a file (e.g., codebook, transcript) is assigned at workflow runtime when the user selects inputs for specific workflow steps — NOT at upload time.
**Technical Note:** Implementation using PostgreSQL (`pgvector`) as a **Vector Store**. "Full Knowledge Graph" (Nodes & Edges) is deferred to MVP v2.

> **DESIGN DECISION (from Story 2.1 review):** The original `assetType` enum (codebook/transcript/knowledge) was removed. Those labels are workflow-specific examples, not universal file categories. Files are just files in the Data Vault. The asset entity tracks `isIndexed` (boolean) to indicate whether a file has been vectorized into the Knowledge Base. Workflow templates define their own input slots (e.g., "Select your codebook", "Select transcripts") via the Input Schema (Story 3.3), and users pick files from the vault at runtime.

> **DESIGN DECISION (Asset Deletion with Report References):**
> When a user deletes a file that is referenced by workflow reports (via `source_id` in citation objects):
> - **Option A (MVP):** System warns the user which reports reference the file. If confirmed, the file is deleted but materialized citation quotes in reports survive (already stored in report JSON). "View Full Source" becomes disabled on those citations, showing "Source file was deleted."
> - **Option B (Future — GDPR Full Erasure):** Delete file AND scrub all materialized quotes from reports. Citations show "[Source removed]." Requires `source_id` linkage to enable querying all citations by asset ID. See Epic 7 for compliance tracking.

#### Story 2.1: Asset Management (Tenant Shared Drive)
**As a** Customer Admin or User,
**I want** to upload and manage files in a shared Assets,
**So that** my team has a central repository of inputs.

**Acceptance Criteria:**
**Given** I upload a file (Text/PDF only for MVP)
**Then** it is stored in the **Assets** (accessible to all tenant users)
**And** files are type-agnostic — no asset type tagging at upload time
**And** the system supports **Parallel Uploads**
**And** I can organize it into **Folders** (max 3 levels of nesting)
**And** the system calculates a **SHA-256 Hash** to prevent duplicate uploads (Warning: "File exists")
**And** I can **Delete** a file:
*   *Action:* File is moved to **"Archive/Trash"** status (Soft Delete).
*   *Retention:* File remains recoverable for [N] days (Admin Configurable), then is physically purged.
*   *Warning:* Deletion removes it for *everyone* in the tenant (Shared Drive model).
*   *Report Reference Check:* If the file is referenced by workflow reports, the user is warned and must confirm (see Design Decision above).
**And** all logging is sanitized to prevent PII/sensitive document content from appearing in logs (NFR assessment deferred item — first story handling real data)

#### Story 2.2: Vector Ingestion ("Learn This" — Knowledge Base Indexing)
**As a** Creator,
**I want** to explicitly mark files in the Data Vault for indexing into the Knowledge Base,
**So that** workflow agents can find relevant context from my documents during analysis.

**Acceptance Criteria:**

**Given** I select one or more files in the Data Vault
**When** I click "Add to Knowledge Base" (the "Learn This" action)
**Then** the system extracts, chunks, and embeds the text from those files
**And** stores embeddings in the `knowledge_vectors` table (pgvector)
**And** the asset's `isIndexed` flag is set to `true`
**And** a visual indicator (e.g., brain icon) shows on indexed files in the Data Vault UI
**And** the UI provides an info tooltip (ℹ button) explaining: "Adding to Knowledge Base means Bubble's AI agents will permanently learn from this file across all workflows."
**And** users can also remove a file from the Knowledge Base (de-index), which deletes its vectors and sets `isIndexed = false`
**Note:** For MVP v1, we focus on pure vector retrieval. Files NOT marked for indexing are simply stored in the vault and used as direct workflow inputs at runtime.

#### Story 2.3: Semantic Search Service (Vector RAG)
**As a** Workflow Developer,
**I want** a service to query the Knowledge Base,
**So that** agents can find context (e.g., "Find mentions of 'Trust' in the transcripts").

**Acceptance Criteria:**

**Given** a query string
**When** I call `KnowledgeService.search()`
**Then** it performs a Vector Similarity Search in `pgvector`
**And** the query is strictly scoped to `WHERE tenant_id = :current_tenant` (Global Search)
**And** it ignores "Owner" checks (all Knowledge is Public within Tenant)
**And** returns relevant text chunks with metadata

#### Story 2.4: Validated Insight Storage (Memory)
**As a** Creator,
**I want** validated user feedback and findings to be saved back to the Knowledge Base,
**So that** the system learns from corrections (e.g., "User confirmed X is true") and improves over time.

**Acceptance Criteria:**

**Given** a validated feedback event is emitted (from any source: report feedback, assumption correction, or manual insight entry)
**When** the Knowledge Service receives the event
**Then** a new entry is created in `knowledge_vectors` with `is_verified=true` and metadata linking to the originating run/report
**And** the Search Service boosts these verified chunks in future queries (higher relevance weight)
**And** the entry is scoped to the current `tenant_id` via RLS

**Note:** This story provides the *storage mechanism*. The feedback *sources* (Report UI, Assumption Verification) are implemented in Epic 5. This story can be implemented and tested with programmatic/API-driven feedback events before the Report UI exists.

### Epic 3: Workflow Definition (The Architect)
**Goal:** Provide Bubble Admins with a form-based Workflow Studio to define atomic workflow templates (YAML definitions) and compose workflow chains. The admin uses a 6-step wizard to produce the YAML that the execution engine (Epic 4) consumes.
**Approach:** **LLM-Orchestrated Execution** — YAML prompts sent directly to LLM. Admin builds via wizard, platform handles assembly.
**FRs covered:** FR1, FR2, FR4, FR5, FR6, FR35, FR42
**Authoritative Reference:** `_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md`

> **GATE REQUIREMENT (COMPLETED 2026-02-02):** Workflow Definition Schema Tech Spec approved. Party mode DB entity review complete (10 findings applied). All Epic 3 stories reference the tech spec as authoritative source.

> **ARCHITECTURE (Party Mode Pivot 2026-02-01):** LangGraph.js **DEFERRED**. Workflows are atomic — single LLM call pattern. YAML IS the prompt — sent to LLM as-is. Platform handles assembly (YAML + files + knowledge context). Input taxonomy: `context` (shared across all jobs) vs `subject` (determines execution pattern). Execution patterns: `parallel` (fan-out, N BullMQ jobs) vs `batch` (fan-in, 1 job). Workflow chains link atomic workflows sequentially via metadata.

> **DESIGN DECISION (from Story 1.5 revision):** Workflow access control is **workflow-centric**, not tenant-centric. Each workflow template has a `visibility` field: `public` (default, available to all tenants) or `private` (restricted to a specific `allowedTenants: UUID[]` list). Custom RLS policies enforce visibility. The Bubble Admin configures visibility when publishing a workflow in Workflow Studio. The tenant's Entitlements tab shows a read-only view of accessible workflows.

#### Story 3.1: Workflow Definition Data Foundation
**As a** Developer,
**I want** the database entities, TypeScript interfaces, shared DTOs, and YAML schema validator for workflow definitions,
**So that** the Workflow Studio UI (Story 3.2) and execution engine (Epic 4) have a stable data layer to build on.

**Acceptance Criteria:**
**Given** the tech spec §6 entity definitions
**Then** 5 new entities are created: WorkflowTemplateEntity, WorkflowVersionEntity, WorkflowChainEntity, WorkflowRunEntity, LlmModelEntity
**And** AssetEntity is extended with `sourceType` (enum: user_upload/workflow_output) and `workflowRunId` (nullable FK)
**And** RLS policies are registered: standard policies for workflow_versions + workflow_runs, custom policies for workflow_templates + workflow_chains (visibility + allowed_tenants)
**And** TypeScript interfaces (WorkflowDefinition, WorkflowChainDefinition, WorkflowJobPayload) are in libs/shared
**And** Shared DTOs for CRUD operations are in libs/shared/src/lib/dtos/workflow/
**And** A YAML schema validator enforces: exactly 1 subject input, required fields present, prompt variables match input names, valid output format
**And** LlmModel seed data includes at least gemini-2.0-flash and gemini-2.0-pro
**And** all entities pass unit tests

#### Story 3.2: Workflow Builder Wizard (Admin UI)
**As a** Bubble Admin,
**I want** a 6-step wizard in Workflow Studio to create and edit atomic workflow templates,
**So that** I can build LLM-powered workflows without writing YAML directly.

**Acceptance Criteria:**
**Given** I navigate to `/admin/workflow-studio` and click "Create Workflow"
**Then** a 6-step wizard opens with: (1) Metadata, (2) Inputs, (3) Execution, (4) Knowledge, (5) Prompt, (6) Output
**And** Step 1 lets me set name, description, and tags
**And** Step 2 lets me add inputs with: name, label, role (context/subject), source types (asset/upload/text checkboxes), required toggle, file restrictions, text config
**And** the wizard enforces exactly ONE subject input (validation error if zero or multiple)
**And** Step 3 lets me select processing mode (parallel/batch), LLM model (dropdown from llm_models table), temperature, max output tokens, max retries
**And** Step 4 lets me toggle RAG on/off, configure query strategy, similarity threshold, max chunks
**And** Step 5 provides a large text area for the prompt with `{input_name}` variable highlighting matching Step 2 input names
**And** Step 6 lets me select output format (markdown/json), define sections (for markdown) or JSON schema (for json), and set filename template
**And** every non-obvious field has an info tooltip
**And** the wizard produces a valid YAML workflow definition stored in workflow_versions.definition (JSONB)
**And** I can navigate back and forth between steps without losing data

#### Story 3.3: Workflow Template CRUD API
**As a** Bubble Admin,
**I want** API endpoints to create, read, update, list, and soft-delete workflow templates,
**So that** the Workflow Studio UI can persist and manage workflow definitions.

**Acceptance Criteria:**
**Given** an authenticated Bubble Admin
**When** I call `POST /admin/workflow-templates` with a valid workflow definition
**Then** a WorkflowTemplate record is created with status=draft and a WorkflowVersion (v1) is created with the definition JSONB
**And** `GET /admin/workflow-templates` returns a paginated list of templates with visibility filtering
**And** `GET /admin/workflow-templates/:id` returns the template with its current version's definition
**And** `PUT /admin/workflow-templates/:id` creates a new version (v2, v3, etc.) — definitions are immutable once saved
**And** `DELETE /admin/workflow-templates/:id` performs soft-delete (sets deletedAt timestamp)
**And** the YAML schema validator runs on every create/update and rejects invalid definitions with detailed error messages
**And** all endpoints use TransactionManager for tenant-scoped operations
**And** all endpoints have complete Swagger documentation (@ApiResponse for 200/201/400/401/403)

#### Story 3.4: Workflow Versioning & Publishing
**As a** Bubble Admin,
**I want** workflows to be immutable versioned snapshots with publish/draft lifecycle,
**So that** editing a workflow does not break active runs and I can roll back to previous versions.

**Acceptance Criteria:**
**Given** an existing workflow template with version v1 (status: published)
**When** the Admin edits and saves changes
**Then** a new version (v2) is created with status=draft
**And** the template's currentVersionId still points to v1 until the admin publishes v2
**And** I can publish v2, which updates the template's currentVersionId
**And** existing active runs continue using v1 (references are locked to workflow_version_id)
**And** I can "Rollback" (set currentVersionId back to v1) if v2 is broken
**And** I can view version history and compare versions
**And** published workflows appear in the tenant workflow catalog (Epic 4)

#### Story 3.5: Workflow Visibility & Access Control
**As a** Bubble Admin,
**I want** to configure which tenants can access each workflow template,
**So that** I can offer different workflow libraries to different customers.

**Acceptance Criteria:**
**Given** I am editing a workflow template
**When** I configure visibility settings
**Then** I can set visibility to `public` (all tenants) or `private` (restricted)
**And** for private workflows, I can select allowed tenants from a multi-select list
**And** the custom RLS policy enforces: tenants see templates where `visibility=public` OR their `tenant_id` is in `allowed_tenants`
**And** the Workflow Studio template list shows visibility badges (public/private)
**And** the Tenant Entitlements tab (Story 1.5) shows a read-only view of accessible workflows

#### Story 3.6a: Workflow Chain CRUD API
**As a** Developer,
**I want** API endpoints to create, read, update, list, and soft-delete workflow chains,
**So that** the Chain Builder UI can persist and manage chain definitions.

**Acceptance Criteria:**
**Given** an authenticated Bubble Admin
**When** I call `POST /admin/workflow-chains` with a valid chain definition
**Then** a WorkflowChain record is created with the definition JSONB
**And** `GET /admin/workflow-chains` returns a paginated list of chains with visibility filtering
**And** `GET /admin/workflow-chains/:id` returns the chain with its full definition
**And** `PUT /admin/workflow-chains/:id` updates the chain definition
**And** `DELETE /admin/workflow-chains/:id` performs soft-delete (sets deletedAt timestamp)
**And** chain definition validation enforces: at least 2 steps, valid workflow template references, valid input mapping schema
**And** visibility/access control reuses the pattern from Story 3.5 (public/private + allowed_tenants)
**And** all endpoints use TransactionManager for tenant-scoped operations
**And** all endpoints have complete Swagger documentation (@ApiResponse for 200/201/400/401/403)
**And** shared DTOs (CreateChainDto, UpdateChainDto, ChainResponseDto) are in libs/shared

#### Story 3.6b: Workflow Chain Builder UI
**As a** Bubble Admin,
**I want** a Chain Builder interface in Workflow Studio to compose multi-step workflow chains,
**So that** I can visually build analysis pipelines without writing JSON directly.

**Acceptance Criteria:**
**Given** I navigate to Workflow Studio and click "Create Chain"
**Then** a chain builder form opens with: metadata section (name, description) and steps section
**And** I can add steps by selecting from a dropdown of published atomic workflow templates
**And** I can reorder steps via drag-and-drop or up/down buttons
**And** I can remove steps from the chain
**And** for each step (except Step 0), I can configure input mapping: source selection (previous_output, inherited, fixed, runtime) for each input
**And** the builder shows a visual summary of data flow between steps
**And** I can set visibility (public/private) and allowed tenants (reuses pattern from Story 3.5 UI)
**And** the builder validates: minimum 2 steps, all required inputs mapped
**And** I can save the chain (calls Story 3.6a API)
**And** I can edit existing chains (loads from API, populates form)
**And** every non-obvious field has an info tooltip
**And** intermediate outputs between steps are marked as visible/downloadable after chain completion

#### Story 3.7: Workflow Studio Template Library (Admin UI)
**As a** Bubble Admin,
**I want** a template library view in Workflow Studio showing all workflow templates and chains,
**So that** I can browse, search, filter, and manage my workflow catalog.

**Acceptance Criteria:**
**Given** I navigate to `/admin/workflow-studio`
**Then** I see a card grid of all workflow templates with: name, description, tags, status badge (draft/published), visibility badge (public/private), version number, last modified date
**And** I can filter by status, visibility, and tags
**And** I can search by name and description
**And** I can click a template card to open the edit wizard (Story 3.2)
**And** I can click "Create Workflow" to start the wizard for a new template
**And** a separate tab/section shows workflow chains with similar card layout
**And** I can duplicate an existing template to create a new one based on it

#### Story 3.10: File Type Preset Groups (Wizard UX Improvement)
**As a** Bubble Admin,
**I want** to select common file type groups (Documents, Images, Spreadsheets, etc.) with one click when configuring file upload restrictions in the wizard,
**So that** I don't have to manually type dozens of individual file extensions.

**Acceptance Criteria:**
**Given** I am on Step 2 (Inputs) of the Workflow Builder Wizard editing a file-upload input's accepted extensions
**Then** I see a row of preset group chips: Documents (pdf, doc, docx, rtf, txt, odt), Spreadsheets (xls, xlsx, csv, tsv, ods), Images (jpg, jpeg, png, gif, webp, svg, bmp), Audio/Video (mp3, wav, mp4, avi, mov, webm), Archives (zip, tar, gz, 7z, rar), Code (js, ts, py, java, json, xml, yaml, html, css), All Files (wildcard)
**And** clicking a chip toggles it on/off and adds/removes its extensions from the accepted list
**And** selected chips show their extensions as read-only pills below the chip row
**And** a "+ Custom extension" input allows adding extensions not covered by presets
**And** preset groups are defined as a shared constant (`FILE_TYPE_PRESETS`) in libs/shared for reuse by backend validation in Epic 4
**And** the existing manual extension entry still works for edge cases

> **Party Mode Consensus (2026-02-08):** Standalone UX story, not part of Story 3.8. Hardcoded presets (not admin-configurable). Chip-toggle UI pattern. ~half day effort. Shared constant in libs/shared for frontend + backend reuse.

#### Story 3.11: Prompt-to-Output Section Auto-Population
**As a** Bubble Admin,
**I want** the wizard to automatically parse my prompt's output structure and populate the Output step's sections,
**So that** I don't have to manually re-define the document structure that's already described in my prompt.

**Acceptance Criteria:**
**Given** I have written a prompt in Step 5 (Prompt) that includes an `## Output Structure` section (or equivalent convention)
**When** I navigate to Step 6 (Output)
**Then** the wizard parses the prompt for structured output section definitions and auto-populates the sections list
**And** the admin can review and edit the auto-populated sections
**And** the prompt is the single source of truth — if the admin corrects the structure, they correct it in the prompt
**And** if no structure is detected in the prompt, a warning is shown asking the admin to confirm
**And** if the admin confirms no structure, a single default section is created using the workflow template name as the title
**And** the parsing logic uses convention-based detection (documented template with `## Output Structure` section pattern)

> **Epic 3 Retro Decision (2026-02-08):** Option A (convention-based parsing) was unanimously chosen by the team. Prompt is single source of truth — no manual re-entry of output sections. Fallback: single section with workflow template name. LLM-assisted parsing (Option C) deferred to future epic as enhancement. Must be completed before Epic 4 starts.

### Epic 4: Workflow Execution Engine (The Creator)
**Goal:** The heart of the system. Enable Creators to browse available workflows, submit runs with dynamic input forms, and execute LLM-orchestrated analysis asynchronously via BullMQ. Handles prompt assembly, fan-out/fan-in execution, output validation with automatic retry, token budget checks, credit pre-checks, and workflow chain orchestration.
**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR34, FR36, FR37, FR46, FR47
**NFRs:** NFR-Perf-2, NFR-Rel-1, NFR-Rel-2, NFR-Scale-1
**Authoritative Reference:** `_bmad-output/implementation-artifacts/tech-spec-workflow-definition-schema.md`

> **ARCHITECTURE (Party Mode Pivot 2026-02-01):** LangGraph.js **DEFERRED**. The execution engine consumes atomic YAML workflow definitions (produced by Epic 3). Workflows are single LLM call patterns — YAML IS the prompt. Platform handles assembly: read input files/text + RAG context + YAML prompt template -> inject variables -> send to LLM via hexagonal `LLMProvider` interface. Execution patterns: `parallel` (fan-out: N BullMQ jobs, 1 per subject file) vs `batch` (fan-in: 1 BullMQ job with all files). Workflow chains use BullMQ FlowProducer to orchestrate sequential atomic workflow steps.

> **GATE REQUIREMENT (BEFORE Story 4.1 or 4.2):** Build Mock LLM Provider alongside real providers. MockLlmProvider (deterministic, free, for dev + unit tests), VertexLlmProvider (production), GoogleAIStudioProvider (free tier, smoke tests). Switched via `LLM_PROVIDER` env var.

> **EPIC 3 RETRO PLANNING ITEMS (2026-02-08):** The following topics were raised during the Epic 3 retrospective and must be discussed during Epic 4 planning party mode:
> 1. **Circuit breaker for LLM providers** — Stop sending after N consecutive failures (e.g., 429 rate limits), surface error to user. Don't queue infinitely.
> 2. **Per-tenant safety cap / budget system** — Design BEFORE execution engine. Even simple "max N requests per workflow run" safety cap prevents runaway loops burning credits.
> 3. **In-process BullMQ consumer first** — Keep BullMQ consumer in api-gateway (same pattern as Epic 2 ingestion). Extract to separate worker-engine service only when scaling requires it. Less moving parts, faster iteration.
> 4. **Credit/billing system design** — How to track, debit, enforce limits per tenant. Business requirement, not just technical.
> 5. **Output validation strategies** — Verifying LLM output matches expected schema (structural validation, not content quality).
> 6. **Fan-out/fan-in patterns with BullMQ** — Parallel job execution + result aggregation. FlowProducer patterns.
> 7. **Token budget management** — Ensuring prompts don't exceed model context windows. Interactive file deselection UI.

#### Story 4.1: Workflow Catalog & Run Initiation (Dynamic Forms)
**As a** Creator,
**I want** to browse available workflows and see a dynamically generated run form based on the workflow's input definitions,
**So that** I know exactly what files, assets, and text inputs to provide.

**Acceptance Criteria:**
**Given** I navigate to `/app/workflows`
**Then** I see a card grid of published workflows available to my tenant (respecting visibility + allowed_tenants)
**And** each card shows: name, description, tags

**Given** I click "Run" on a workflow card
**Then** a run form opens, dynamically rendering fields from the workflow's `inputs[]` definition:
*   `source: ["asset"]` renders an Asset Picker (dropdown of tenant Data Vault files)
*   `source: ["upload"]` renders a File Dropzone (with accept.extensions + max_size_mb restrictions)
*   `source: ["text"]` renders a Text Area (with placeholder + max_length from text_config)
*   `source: ["asset", "upload"]` renders both options with a toggle
**And** the subject input supports multiple file selection (each file becomes a separate job in parallel mode)
**And** every field has a stable `data-testid` attribute
**And** validation prevents submission until all required inputs are provided

#### Story 4.2: LLM Provider Interface & Prompt Assembly
**As a** Developer,
**I want** a hexagonal LLM provider interface and prompt assembly pipeline,
**So that** the execution engine can call any LLM provider without coupling to specific SDKs.

**Acceptance Criteria:**
**Given** the existing EmbeddingProvider hexagonal pattern
**Then** an LLMProvider interface is created with `generate(prompt, model, options)` method
**And** three implementations: MockLlmProvider (deterministic canned responses), GoogleAIStudioProvider (free tier), VertexLlmProvider (production)
**And** provider is selected via `LLM_PROVIDER` env var (mock | google-ai-studio | vertex)
**And** the prompt assembly pipeline: reads all context input files/text -> reads subject file -> runs RAG query if knowledge.enabled -> replaces `{input_name}` and `{knowledge_context}` variables in prompt template -> sends assembled prompt to LLM
**And** the LLM model is resolved from the `llm_models` table using execution.model from the workflow definition
**And** token usage (prompt + completion) is tracked per call

#### Story 4.3: Execution Engine Core (Fan-Out/Fan-In)
**As a** Creator,
**I want** my workflow runs to execute reliably in the background using the correct execution pattern,
**So that** multiple transcripts are analyzed in parallel or consolidated in a single batch.

**Acceptance Criteria:**
**Given** a run submission with N subject files and `execution.processing: "parallel"`
**Then** N BullMQ jobs are created (1 per subject file), each receiving ALL context inputs + ONE subject file
**And** jobs run concurrently up to `execution.max_concurrency` (default: 5)
**And** each job loads the specific workflow definition from `workflow_versions` using the `version_id` (NOT the current tip)

**Given** a run submission with N subject files and `execution.processing: "batch"`
**Then** 1 BullMQ job is created with ALL context inputs + ALL subject files concatenated

**And** a WorkflowRun record is created with: input_snapshot, status=queued, version_id, tenant_id
**And** run status transitions: queued -> running -> completed/failed
**And** the assembled prompt and raw LLM response are stored on the WorkflowRun record for debugging

#### Story 4.4: Pre-Flight Validation & Credit Check
**As a** Creator,
**I want** the system to validate my inputs and check my credit balance before accepting a run,
**So that** I don't waste credits on invalid submissions or get surprised by insufficient quota.

**Acceptance Criteria:**
**Given** a Creator submits a run
**When** server-side pre-flight validation runs
**Then** all inputs are validated against the workflow's input definitions (required fields, file types, max sizes)
**And** the context window token budget is calculated per job (tech spec §5.1): prompt template + context inputs + subject file + knowledge chunks
**And** if total tokens exceed the model's context window, the UI shows an interactive file selection dialog to deselect files until under budget
**And** the tenant's credit/quota balance is checked (FR37) — if exhausted, submission is rejected with clear message
**And** credits are deducted upfront (Story 1.5 pattern) — refunded if validation fails
**And** no BullMQ jobs are created until all validations pass

#### Story 4.5: Output Validation & Storage
**As a** Creator,
**I want** the system to validate LLM output structure and store results as downloadable assets,
**So that** I get properly structured reports and can find them in my Data Vault.

**Acceptance Criteria:**
**Given** the LLM returns a response
**Then** the platform validates output structure (NOT content quality):
*   For `format: "markdown"`: checks that all `sections[].required: true` headings are present
*   For `format: "json"`: parses JSON and validates against `output.json_schema`
**And** if validation fails, an automatic retry is triggered with a correction prompt (tech spec §4.2)
**And** retries repeat up to `execution.max_retries` times (default from system settings, overridable per-workflow)
**And** if all retries fail, the best attempt is stored with a `validation_warning` flag and a visible banner to the user
**And** successful output is stored as an AssetEntity with `sourceType: workflow_output` and `workflowRunId` FK
**And** output filename follows `output.filename_template` pattern
**And** the WorkflowRun record is updated with: output_asset_ids, token_usage, credits_consumed, duration_ms

#### Story 4.6: Workflow Chain Orchestration
**As a** Creator,
**I want** to run multi-step workflow chains where output from one step feeds into the next,
**So that** I can execute complex analysis pipelines (e.g., analyze transcripts then consolidate findings).

**Acceptance Criteria:**
**Given** a Creator initiates a chain run
**Then** the chain orchestrator (BullMQ FlowProducer) runs Step 0 as a normal atomic workflow
**And** when Step 0 completes, output assets are stored with `sourceType: workflow_output`
**And** the orchestrator reads `input_mapping` for Step 1 and populates inputs from their designated sources (previous step outputs, inherited inputs, fixed values, or runtime user input)
**And** Step 1 runs with populated inputs -> outputs stored -> repeat for all steps
**And** intermediate outputs between steps are visible and downloadable
**And** if any step fails, the chain is marked as failed with the failing step identified
**And** a WorkflowRun record is created for the chain with `chain_id` reference (check constraint: version_id OR chain_id)

#### Story 4.7: Workflow Test Run & Preview
**As a** Bubble Admin,
**I want** to preview the user-facing run form and execute a test run of my workflow before publishing,
**So that** I can see exactly what end-users will experience and verify that my prompts produce quality output.

**Acceptance Criteria:**
**Given** I am viewing a workflow template in Workflow Studio (draft or published)
**When** I click "Test Run"
**Then** I see the same dynamically generated run form that end-users would see (Story 4.1), rendered from the workflow's input definitions
**And** I can fill in test data (upload files, select assets, enter text) just like a Creator would
**And** submitting the form executes the workflow through the real execution pipeline with a `dryRun` flag
**And** the LLM response and assembled prompt are displayed inline for review
**And** I can iterate — modify the workflow's prompt in the wizard, then re-run the test to compare results
**And** test runs do not consume tenant credits and are not visible to Creators
**And** test run history is stored for the admin's reference (last N test runs per template)

> **Party Mode Consensus (2026-02-08):** Combines layout preview (Option A) and functional test (Option B) into one story. Option A comes free — the test run form IS the user-facing form component. Option B requires the Epic 4 execution engine. Deferred from Epic 3 because building a fake preview would be throwaway work. The real run form component is reused for both test runs and production runs.

### Epic 5: Interactive Reporting & Feedback Loop
**Goal:** Deliver the value. Provide a highly responsive report viewer where users can verify evidence ("Traceable Truth") and provide feedback that triggers re-runs.
**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR19, FR43, FR45
**NFRs:** NFR-Perf-1, NFR-Perf-3

#### Story 5.1: Interactive Report Dashboard
**As a** Creator,
**I want** a clean, interactive dashboard to view the generated report,
**So that** I can easily digest the insights.

**Acceptance Criteria:**

**Given** a completed run
**When** I open the report page
**Then** the markdown content renders within 3 seconds
**And** citations are rendered as clickable superscripts `[1]`

#### Story 5.2: Evidence Evidence Drawer (Progressive Disclosure)
**As a** Creator,
**I want** to see the exact quote and context when I click a citation, with the option to open the full source file,
**So that** I can trust the claim without loading a massive PDF every time.

**Acceptance Criteria:**

**Given** I click a citation `[1]`
**Then** a "Citation Card" opens in the side drawer showing the Quote + Surrounding Text
**When** I click "View Full Source" on the card
**Then** a Modal opens loading the original PDF, jumped to the specific page, with text highlighted

#### Story 5.3: Human-in-the-Loop Feedback (Multi-Modal)
**As a** Creator,
**I want** to correct the AI's logic using various feedback mechanisms,
**So that** I can ensure the final report is accurate, regardless of whether the AI flagged the issue or not.

**Acceptance Criteria:**
**Given** the report is generated
**Then** I have **Three Feedback Mechanisms**:
1.  **Flagged Assumption Review:** A list of "Low Confidence" items. I can **Edit** the text to provide the correct fact (not just Yes/No).
2.  **Unflagged Correction (General):** I can proactively add a new constraint or correct a "High Confidence" error (e.g., "Actually, Vendor X is the customer") via a chat/text input.
3.  **Targeted Section Feedback:** I can select a specific Report Section and provide feedback scoped to that block (FR41), triggering a focused update.
**And** any correction triggers a re-run of the atomic workflow with the feedback injected as additional context.

#### Story 5.4: Feedback Processing (The Re-Run)
**As a** Workflow Engine,
**I want** to accept user feedback and trigger a partial re-run,
**So that** the report is updated with the new context.

**Acceptance Criteria:**

**Given** submitting feedback
**When** the "Re-Run" triggers
**Then** the engine re-executes the atomic workflow
**And** injects the Feedback as a high-priority "Correction Context" appended to the assembled prompt

#### Story 5.5: PDF Export Service [Prototype]
**As a** Creator,
**I want** to export the final report as a watermark-protected PDF,
**So that** I can share a static version with stakeholders.

**Acceptance Criteria:**
**Given** a completed report
**When** I click "Export PDF"
**Then** the backend generates a PDF file preserving the report layout
**And** applies a faint watermark (User Email + Timestamp) diagonally across every page (FR43 - MVP)
**And** the file download starts automatically

### Epic 6: Guest Access & Sharing
**Goal:** Enable viral sharing by allowing authenticated Users to generate secure, time-limited Magic Links for external Guests (Stakeholders).
**FRs covered:** FR20, FR39, FR40
**NFRs:** NFR-Sec-3

#### Story 6.1: Magic Link Generator Service
**As a** Creator,
**I want** to generate a "Share Link" for a specific report,
**So that** I can send it to my boss who doesn't have a login.

**Acceptance Criteria:**

**Given** a completed report
**When** I click "Share"
**Then** the system generates a cryptographically secure token (e.g., stored hash)
**And** the link expires in 7 days by default
**And** I can revoke the link at any time

#### Story 6.2: Guest Access Guard (Middleware)
**As a** Security Architect,
**I want** to strictly limit Guest access to ONLY the specific report ID linked to the token,
**So that** a guest cannot modify data or view other reports.

**Acceptance Criteria:**

**Given** a request with a valid Magic Link Token
**When** the middleware processes it
**Then** it assigns `Role: Guest` and `Scope: Read-Only`
**And** restricts DB access to `Report.id == Token.report_id` ONLY

#### Story 6.3: Guest Report Viewer (Read-Only)
**As a** Guest,
**I want** to view the report and evidence drawer,
**So that** I can consume the insights without logging in.

**Acceptance Criteria:**

**Given** I access a Magic Link
**Then** I see the Interactive Report (Story 5.1) and Evidence Drawer (Story 5.2)
**But** I cannot see "Edit Assumptions" or "Re-run" buttons

### Epic 7: Observability & Advanced Operations
**Goal:** Ensure the system is operationally maintainable with audit logs, debugging traces for AI runs, and service status monitoring.
**FRs covered:** FR29, FR31, FR38, FR49

#### Story 7.2: Audit Logging Service (Security)
**As a** Compliance Officer,
**I want** every sensitive action (Login, Run, Export) to be logged with `who, when, what`,
**So that** we have a trail for future SOC2 compliance.

**Acceptance Criteria:**

**Given** a user performs an action
**Then** an immutable log entry is created in the `audit_logs` table
**And** it contains `user_id`, `tenant_id`, `action_type`, and `timestamp`
**And** impersonation events are fully audited: who impersonated, which tenant, start/end time, actions performed during impersonation (NFR assessment deferred item — replaces interim `logger.warn` placeholder from hardening story)

#### Story 7.3: Service Status Monitor
**As a** Creator,
**I want** to see a banner if the LLM Provider (Gemini) is down,
**So that** I don't blame Bubble for the failure.

**Acceptance Criteria:**

**Given** the worker detects repeated 500 errors from Gemini
**Then** the System Status is updated to `DEGRADED`
**And** a global banner appears in the Workflows UI
**And** a health check endpoint (`/health`) is available using `@nestjs/terminus` that checks database connectivity and external service status (NFR assessment deferred item — prerequisite for service monitoring)

#### Story 7.4: Admin Execution Inspector [Prototype]
**As a** Bubble Admin or Customer Admin,
**I want** to view the full execution details of a workflow run,
**So that** I can debug prompt quality, inspect LLM responses, and tune workflow definitions.

**Acceptance Criteria:**
**Given** a specific Run ID
**When** I view the "Inspect" tab (Admin Execution Inspector — tech spec §8)
**Then** I see the run summary: status, duration_ms, credits_consumed, model used
**And** I can view the **assembled prompt** (the full prompt sent to the LLM after variable injection)
**And** I can view the **raw LLM response** (unprocessed output)
**And** I can see the **input snapshot** (what files/text were provided)
**And** I can see **token usage** breakdown (prompt tokens + completion tokens)
**And** I can see **retry history** (if output validation triggered retries, each attempt is logged)
**And** for chain runs, I can inspect each step's execution independently
**And** the inspector is read-only — no ability to modify runs from this view

#### Story 7.6: GDPR Full Erasure — Citation Scrubbing [Future]
**As a** User with data deletion rights,
**I want** to delete a file AND have all materialized citation quotes scrubbed from reports that referenced it,
**So that** my right to erasure is fully respected.

**Acceptance Criteria:**

**Given** I delete a file that is referenced by workflow reports
**When** I select "Full Erasure" (Option B)
**Then** the file is permanently deleted
**And** all citation objects in reports where `source_id` matches this file are scrubbed — quote text replaced with "[Source removed]"
**And** "View Full Source" is disabled on those citations
**And** the scrubbing event is logged in the audit trail

**Note:** This story implements Option B from the Epic 2 Design Decision (Asset Deletion with Report References). Option A (MVP) preserves citation quotes when the source file is deleted. This story adds the full erasure capability. Requires `source_id` linkage in citation objects (Story 4.6) to enable querying all citations by asset ID.

#### Story 7.5: Refresh Token Rotation (Auth Hardening)
**As a** User,
**I want** my session to be extended seamlessly via refresh tokens,
**So that** I don't get abruptly logged out after the access token expires.

**Acceptance Criteria:**

**Given** a user authenticates successfully
**Then** the system issues both an access token (short-lived) and a refresh token (long-lived, stored securely)
**And** when the access token expires, the frontend automatically requests a new one using the refresh token
**And** refresh tokens are rotated on each use (old token invalidated)
**And** refresh tokens are revoked on password change or explicit logout
**And** the system maintains a refresh token allowlist or denylist in the database

**Note:** This story replaces the interim 7-day JWT expiry set in the hardening story. NFR assessment deferred item.

#### Story 7.1: LLM Model & Provider Management (Admin UI)
**As a** Bubble Admin,
**I want** a UI to manage the LLM model registry and configure provider API keys,
**So that** I can control which models are available for workflows, manage costs, and switch providers.

**Acceptance Criteria:**

**Given** I am on the Admin Portal → System Settings → LLM Configuration page
**When** I manage the model registry
**Then** I can view all entries in the `llm_models` table (system-wide, not tenant-scoped)
**And** I can add new models: display_name, provider_key (gemini/openai/anthropic), model_id, context_window, cost_per_1k_input, cost_per_1k_output, is_active toggle
**And** I can edit existing models (update costs, toggle active/inactive)
**And** inactive models are hidden from the workflow builder's model dropdown but existing workflows referencing them continue to work
**And** I can configure provider API keys (encrypted at rest) per provider_key
**And** the system validates API keys by making a test call before saving
**And** I can configure system defaults: default model, default validation retry count (tech spec §4.2), default max_output_tokens
**And** I can set a **Fallback Provider** that activates if the primary returns repeated errors
**And** failover events are logged in the audit trail

**Note:** The `llm_models` table and LlmModelEntity are created in Story 3.1. This story adds the admin management UI and provider configuration. See tech spec §5.4 for full specification.

### Epic 9: Knowledge Graph Evolution (Phase 2 - The Moat)
**Goal:** Upgrade the flat "Vector Knowledge Base" into a true "Hybrid Knowledge Graph" to enable multi-hop reasoning and "Connecting the Dots" across projects.
**Status:** [Future / Phase 2]
**Technical Note:** Requires implementing `node_relationships` table and Graph Traversal algorithms.

#### Story 9.1: Relational Edge Extraction
**As a** Creator,
**I want** the system to automatically identify entities and relationships in my documents (e.g., "Project A -> uses -> Tool B"),
**So that** the Knowledge Graph can reveal hidden connections across my research data.

#### Story 9.2: Visual Graph Explorer
**As a** Creator,
**I want** to visually explore connections between my assets,
**So that** I can see hidden patterns (e.g., "All these interviews mention 'Pricing'").

#### Story 9.3: Smart Ingestion Pipelines (Vision & Normalization) - [Phase 2 / Future]
**As a** Creator,
**I want** the ingestion system to handle non-text uploads (Images, PPTs, Charts) via advanced parsing strategies,
**So that** I can upload any document type and the system extracts meaningful content automatically.

**Acceptance Criteria:**

**Given** a non-text upload (Image/PPT/Chart)
**When** the Ingestion Worker processes the file
**Then** the Agent executes the **Advanced Pipeline**:
1.  **Safety & Tagging:** Auto-applies System Tags based on content classification.
2.  **Classification:** Router decides parsing strategy (Vision Model for Charts, OCR for scanned docs).
3.  **Concept Extraction:** Parent-level "Blueprint" vectorization for complex documents.
4.  **Hybrid Splitting:** Separating Tables from Text for structured extraction.

**Note:** For Prototype (Epic 2), only the **Text Pipeline** is active (Story 2.2). This story activates the Advanced Pipeline in Phase 2.

### Epic 8: Conversational Intelligence (Future Roadmap)
**Goal:** Enable "Chat with Data" capabilities, transforming static reports and knowledge graphs into interactive, conversational consultants.
**FRs covered:** FR52, FR53

#### Story 8.1: Chat with Report (Scoped RAG)
**As a** Creator,
**I want** to chat with a specific report to ask follow-up questions (e.g., "Why did you conclude X?"),
**So that** I can explore the insights deeper without needing a re-run.

**Acceptance Criteria:**

**Given** a completed report
**When** I switch to "Chat Mode"
**Then** I can message the agent
**And** the context is strictly scoped to the Report content and its Citation Sources (using kept transient vectors or re-indexed report data)

#### Story 8.2: Chat with Company (Global RAG)
**As a** Strategist,
**I want** to chat with the entire Tenant Knowledge Graph (e.g., "What have we learned about Pricing across all projects?"),
**So that** I can find cross-project patterns.

**Acceptance Criteria:**

**Given** I am in the "Company Brain" view
**When** I ask a question
**Then** the agent searches the entire Hybrid Knowledge Graph (Vector + Relational) across all assets and past reports
**And** synthesizes a global answer with citations to multiple projects

### Epic 10: Advanced Visual Definition (Future MVP v2)
**Goal:** Introduce a full "No-Code" Visual Canvas for defining workflows, replacing the Form-Based Wizard with a drag-and-drop experience.
**Status:** [Future] - Deferred from Epic 3.

#### Story 10.1: Visual Graph Canvas
**As a** Bubble Admin,
**I want** to drag and drop nodes onto an infinite canvas and connect them with wires,
**So that** I can visualize complex non-linear flows easily.

#### Story 10.2: Visual Cycle Detection
**As a** Bubble Admin,
**I want** the canvas to visually highlight valid/invalid loops,
**So that** I don't create infinite recursion bugs.

### Epic 11: Plan Tier Management & Template System (Placeholder)
**Goal:** Provide Bubble Admins with a dedicated admin interface to define, configure, and manage plan tiers as reusable templates. When a tier is assigned to a tenant, its predefined limits (monthly runs, retention days, feature flags, etc.) are automatically applied. Admins can add, rename, remove, and modify tier definitions without code changes.
**Status:** [Future] - To be detailed and broken into stories.
**Dependencies:** Epic 1 (tenant entity with planTier field already exists).

**Scope (to be refined):**
- Admin page (`/admin/plan-tiers`) to list, create, edit, and delete tier definitions
- Each tier definition includes: name, display label, maxMonthlyRuns, assetRetentionDays, feature flags, and any future entitlement fields
- When assigning a tier to a tenant, the system auto-populates the tenant's entitlement fields from the tier template
- Option to override individual limits per tenant after tier assignment
- Migration path for existing tenants with manually-set limits
- Audit log for tier changes

#### Story 11.1: Tier Definition CRUD (Placeholder)
**As a** Bubble Admin,
**I want** to create, edit, and delete plan tier definitions from the admin panel,
**So that** I can manage what each tier includes without code changes.

#### Story 11.2: Tier-to-Tenant Auto-Apply (Placeholder)
**As a** Bubble Admin,
**I want** assigning a tier to a tenant to automatically set that tenant's entitlement limits,
**So that** I don't have to manually configure each tenant's limits individually.

#### Story 11.3: Per-Tenant Override (Placeholder)
**As a** Bubble Admin,
**I want** to override specific limits on a per-tenant basis after a tier is assigned,
**So that** I can handle custom deals or exceptions.
