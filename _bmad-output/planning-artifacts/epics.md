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

*   FR1: [Prototype] Bubble Admin can define workflow graph topology using nodes and edges.
*   FR2: [Prototype] Bubble Admin can configure specific node types (Scanner, Doer, Reviewer) with execution instructions.
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
*   FR34: [Prototype] System can persist intermediate state at each node completion to allow resumption on failure.
*   FR35: [Prototype] Bubble Admin can configure retry policies (count, backoff) for specific node types.
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
*   FR47: [Prototype] System enforces a "Max Steps per Model Run" limit (e.g., 50 steps).
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
*   **NFR-Rel-1 (Checkpoint):** Workflow Engine must persist state to Postgres after every node transition.
*   **NFR-Rel-2 (Retry):** Downstream failures must trigger Exponential Backoff retry policy.
*   **NFR-Scale-1 (Concurrent):** System must support Admin-configurable concurrent run limits per tenant.
*   **NFR-Scale-2 (Graph):** System must handle Knowledge Graphs up to 10,000 nodes/edges per tenant.
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
| FR1, FR2, FR4, FR5, FR6, FR35, FR42, FR_QA_TestID | **Epic 3** | Workflow Definition (The Architect) |
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
**Goal:** Enable tenants to manage their proprietary data and ingest them into the "Company Brain" (Vector Knowledge Base).
**Strategy:** We distinguish between **Reference Assets** (Vectorized for RAG) and **Instruction Assets** (Codebooks/Dictionaries - Injected or Vectorized based on size).
**Technical Note:** Implementation using PostgreSQL (`pgvector`) as a **Vector Store**. "Full Knowledge Graph" (Nodes & Edges) is deferred to MVP v2.

#### Story 2.1: Asset Management (Tenant Shared Drive)
**As a** Customer Admin or User,
**I want** to upload and manage files in a shared Assets,
**So that** my team has a central repository of inputs.

**Acceptance Criteria:**
**Given** I upload a file (Text/PDF only for MVP)
**Then** it is stored in the **Assets** (accessible to all tenant users)
**And** the system supports **Parallel Uploads**
**And** I can organize it into **Folders**
**And** the system calculates a **SHA-256 Hash** to prevent duplicate uploads (Warning: "File exists")
**And** I can **Delete** a file:
*   *Action:* File is moved to **"Archive/Trash"** status (Soft Delete).
*   *Retention:* File remains recoverable for [N] days (Admin Configurable), then is physically purged.
*   *Warning:* Deletion removes it for *everyone* in the tenant (Shared Drive model).

#### Story 2.2: Vector Ingestion (Reference Assets)
**As a** Creator,
**I want** my uploaded reference assets to be automatically processed and indexed into the Knowledge Base,
**So that** workflow agents can find relevant context from my documents during analysis.

**Acceptance Criteria:**

**Given** a new Asset of type `REFERENCE`
**When** the Ingestion Worker runs
**Then** it extracts, chunks, and embeds the text
**And** stores it in the `knowledge_vectors` table (pgvector)
**And** `INSTRUCTION` assets (like Codebooks) are stored as raw text (or vectorized if > Token Limit)
**Note:** For MVP v1, we focus on pure vector retrieval.

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
**Goal:** Provide "Architects" (Admins) with a user-friendly "Form-Based" tool to define the agents.
**Approach:** **"Low-Code/No-Code Wizard"**. The Admin uses dropdowns and forms to generate the underlying JSON. No raw code editing required.
**FRs covered:** FR1, FR2, FR4, FR5, FR6, FR35, FR42

> **DESIGN DECISION (from Story 1.5 revision):** Workflow access control is **workflow-centric**, not tenant-centric. Each workflow template has a `visibility` field: `public` (default, available to all tenants) or `private` (restricted to a specific `allowedTenants: string[]` list). This avoids the N-tenant update problem when rolling out new workflows. The Bubble Admin configures visibility when publishing a workflow in Workflow Studio. The tenant's Entitlements tab shows a read-only view of available workflows. Epic 3 stories (likely Story 3.1 or 3.6) must implement the `visibility` + `allowedTenants` fields on the workflow template entity and the corresponding UI in Workflow Studio.

#### Story 3.1: Form-Based Workflow Builder
**As a** Bubble Admin,
**I want** to define the workflow steps using a simple list interface (Add Step -> Select Type),
**So that** I can build agents without writing code or connecting complex graph nodes.

**Acceptance Criteria:**
**Given** I am in the Admin Panel -> "Create Workflow"
**When** I click "Add Step"
**Then** I can select a Node Type (e.g., "Agent", "Tool", "Reviewer") from a simple dropdown
**And** the system visualizes the workflow as a linear list or simple sequence
**And** complex cycles (loops) are handled via pre-defined "Retry/Loop" patterns in the dropdown, not manual edge drawing.

#### Story 3.2: Node Configuration Form
**As a** Bubble Admin,
**I want** to configure each step using a standard form, with the option to upload Markdown files for complex prompt instructions,
**So that** I don't have to copy-paste massive text blocks.

**Acceptance Criteria:**
**Given** I select a step (Node)
**When** the Configuration Panel opens
**Then** I see structured fields:
*   **System Prompt:** A large text area for instructions.
*   **Knowledge Context:** A "File Upload" button to attach a `.md` file. The system reads this file and injects it into the prompt.
*   **Model:** A dropdown to select `Gemini 1.5 Pro` or `Flash`.
*   **Tools:** A multi-select checklist to enable capabilities.
**And** the system **Sanitizes (DOMPurify)** any Markdown content rendered in the UI to prevent XSS.

#### Story 3.2b: The Gatekeeper Pattern (Scanner Configuration)
**As a** Bubble Admin,
**I want** to configure the first node as a "Gatekeeper" that validates input semantics (e.g., "Is this a Transcript?"),
**So that** I don't waste 10k tokens analyzing a shopping list.

**Acceptance Criteria:**
**Given** I am configuring a "Scanner" Node
**Then** I can set a **"Validation Prompt"** (e.g., "Check if text contains speaker labels")
**And** I can set a **"Fail Fast"** message (e.g., "Error: Input is not a transcript")
**And** the engine runs this check on the first 1,000 tokens only (Low Cost) before proceeding.

#### Story 3.3: Input Schema Wizard (The Dynamic Form Builder)
**As a** Bubble Admin,
**I want** to define the inputs using a "Field Builder" (like Typeform),
**So that** the Workflows knows exactly which Modal fields to render for the user.

**Acceptance Criteria:**
**Given** the "Input Settings" tab
**When** I configure a field (e.g., "Label: Project Name", "Type: Text", "Required: True")
**Then** the system generates a standard JSON Schema: `{ "project_name": { "type": "string" } }`
**And** I can select specialized types (File, Asset Picker).
**And** the system generates a stable `data-testid` attribute (e.g., `data-testid="input-project-name"`) for every field to enable robust E2E testing.
**And** this schema is saved to the Workflow Definition.

#### Story 3.4: Logic Rule Builder (The Gatekeeper)
**As a** Workflow Designer,
**I want** to define conditional logic using a "Rule Builder" interface,
**So that** I can route bad results to a fixer node without writing JavaScript.

**Acceptance Criteria:**
**Given** I want to add a check (e.g., "If Quality is Low")
**When** I configure the "Next Step" logic
**Then** I see a **Rule Builder UI**:
*   **If:** [Dropdown: Metric] (e.g., `Quality_Score`)
*   **Operator:** [Dropdown] (e.g., `Less Than`)
*   **Value:** [Input] (e.g., `0.8`)
*   **Then Go To:** [Dropdown: Step Name] (e.g., `Fixer_Node`)
*   **Else Go To:** [Dropdown: Step Name] (e.g., `End`)

#### Story 3.5: Parallel Execution (Easy Mode)
**As a** Power User,
**I want** to enable parallel processing by selecting a collection variable,
**So that** I don't have to configure complex Map-Reduce graphs.

**Acceptance Criteria:**
**Given** a step that receives a List/Array variable (e.g., `files[]`)
**When** I check **"Run in Parallel"** and select **"Map over: files"**
**Then** the system automatically configures the Map-Reduce pattern
**And** I see a configuration for "Max Concurrency" (e.g., 5 items at a time)

#### Story 3.6: Workflow Versioning & Locking
**As a** System Architect,
**I want** workflows to be immutable versioned snapshots (v1, v2),
**So that** editing a workflow definition does not break active runs relying on the old logic.

**Acceptance Criteria:**
**Given** an existing published workflow (v1)
**When** the Admin saves changes
**Then** the system creates a new version (v2)
**And** new runs use v2
**And** existing active runs continue using v1 (references are locked to `workflow_version_id`)
**And** the Admin can "Rollback" (set v1 as active) if v2 is broken

### Epic 4: Workflow Execution Engine (The Creator)
**Goal:** The heart of the system. Enable "Creators" to run workflows asynchronously, handling file inputs, queue management, and robust state persistence.
**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR34, FR36, FR37, FR46, FR47
**NFRs:** NFR-Perf-2, NFR-Rel-1, NFR-Rel-2, NFR-Scale-1

> **GATE REQUIREMENT:** Before starting Epic 4, run `/bmad:bmm:workflows:quick-spec` to produce a LangGraph.js Integration Tech Spec. This must define: graph_json → StateGraph mapping, state schema, node type implementations (Scanner/Doer/Reviewer/Output), Postgres checkpointing, Map/parallel pattern, and feedback re-run strategy. No Epic 4 stories should be created until this spec is approved.

#### Story 4.1: Workflows & Run Initiation (Dynamic Forms)
**As a** Creator,
**I want** to select a workflow and see a dynamically generated modal based on the Admin's definition,
**So that** I don't have to guess what files to upload.

**Acceptance Criteria:**
**Given** I click "Run" on the "QDA Workflow" card
**Then** a Modal opens rendering the form defined in `InputSchema` (Story 3.3)
**And** specialized fields render correctly:
    *   `format: file_upload` -> Renders Multi-File Dropzone.
    *   `format: asset_picker` -> Renders Dropdown of Tenant Assets.
**And** every field has the stable `data-testid` defined in the schema (QA Requirement).
**And** validation prevents submission until all required fields are filled

#### Story 4.2: Execution Engine Core (Versioned Runner)
**As a** Creator,
**I want** my workflow runs to execute reliably in the background using the exact workflow version I selected,
**So that** I don't have to wait with my browser open and my run isn't affected if an admin updates the workflow.

**Acceptance Criteria:**
**Given** a "Job Created" event in BullMQ
**When** the Worker picks it up
**Then** it loads the specific `GraphJSON` from `workflow_versions` using the `version_id` in the payload (NOT the current tip)
**And** executes the nodes, supporting the **"Map over [Variable]"** pattern defined in Story 3.5
**And** guarantees extracted text from user files is **Sanitized (DOMPurify)** before use/storage
**And** updates the Run Status to `RUNNING`

#### Story 4.3: State Persistence & Resumption (Auto-Save)
**As a** Creator,
**I want** the system to automatically save my workflow's progress after every step,
**So that** if there's a server issue, my run resumes where it left off instead of starting over.

**Acceptance Criteria:**

**Given** a workflow is running
**When** a node completes
**Then** a serialized snapshot of the `State` is saved to Postgres
**And** if the worker crashes, it resumes from the last snapshot upon restart

#### Story 4.4: Dynamic Validation (The Runtime Blocker)
**As a** Creator,
**I want** the system to prevent me from running a workflow if I am missing a required Asset (e.g., "Codebook"),
**So that** I don't waste credits on a failed run.

**Acceptance Criteria:**

**Given** a Creator opens the Run Wizard for a workflow that requires a "Codebook" asset
**When** no asset of type "Codebook" exists in the tenant's Data Vault
**Then** the Asset Picker field displays an inline error: "Missing Required Asset: [Asset Type]"
**And** the "Run" button is disabled with a tooltip explaining the missing requirement
**And** a link to the Data Vault is provided so the user can upload the missing asset

**Given** a Creator has selected all required inputs and clicks "Run"
**When** the server-side pre-flight validation runs
**Then** the system re-validates all inputs (files, assets, form fields) against the workflow's InputSchema
**And** if any validation fails, the submission is rejected with a specific error message per field
**And** no credits are deducted for a rejected submission

**Given** a Creator's tenant has exhausted their run quota (FR37)
**When** the Creator attempts to submit a run
**Then** the "Run" button is disabled
**And** the UI displays: "Run quota exceeded. Contact your admin to increase your plan."
**And** no credits are deducted

#### Story 4.5: Context Injection (Markdown Support)
**As a** Creator,
**I want** workflow agents to automatically receive the knowledge context files (Markdown) attached by the admin during workflow definition,
**So that** the analysis is informed by methodology guides and domain knowledge without me needing to upload them each time.

**Acceptance Criteria:**
**Given** a Node Definition with an attached `context_file_id` (Markdown)
**When** the Agent Node is initialized
**Then** the Worker fetches the file content from Storage (S3/MinIO)
**And** **Sanitizes it** (Server-Side) to ensure no executable code is present
**And** appends it to the System Prompt: `\n\n### Context:\n{file_content}`

#### Story 4.6: Output Generation (Raw Data & Citations)
**As a** Data Analyst,
**I want** the final output to be saved as a structured JSON containing the text AND specific citations (Page numbers, Quotes),
**So that** the UI can later verify the evidence.

**Acceptance Criteria:**

**Given** a workflow completes successfully
**When** the final node runs
**Then** it aggregates the results into a standardized JSON format
**And** includes "Citation Objects" `{ source_id, quote, page_num }` for every claim
**And** saves this JSON as a `Report` record linked to the Run

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
**And** any correction triggers a re-run (Global or Partial depending on dependency graph).

#### Story 5.4: Feedback Processing (The Re-Run)
**As a** Workflow Engine,
**I want** to accept user feedback and trigger a partial re-run,
**So that** the report is updated with the new context.

**Acceptance Criteria:**

**Given** submitting feedback
**When** the "Re-Run" triggers
**Then** the engine re-executes the generation nodes
**And** injects the Feedback as a high-priority "Correction Context" into the system prompt

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

#### Story 7.3: Service Status Monitor
**As a** Creator,
**I want** to see a banner if the LLM Provider (Gemini) is down,
**So that** I don't blame Bubble for the failure.

**Acceptance Criteria:**

**Given** the worker detects repeated 500 errors from Gemini
**Then** the System Status is updated to `DEGRADED`
**And** a global banner appears in the Workflows UI

#### Story 7.4: Execution Trace Viewer [Prototype]
**As a** Customer Admin,
**I want** to view the full execution trace of a workflow run,
**So that** I can debug why an agent gave a specific answer.

**Acceptance Criteria:**
**Given** a specific Run ID
**When** I view the "Debug/Trace" tab
**Then** I see a chronological log of every Node execution
**And** for each Node, I can expand to see the **Exact Input** (Prompts sent to LLM) and **Raw Output** (Response from LLM)
**And** I can see the Token Usage cost for that step

#### Story 7.1: LLM Provider Configuration [Future]
**As a** Bubble Admin,
**I want** a UI to configure multiple LLM Providers (e.g., Gemini, OpenAI, Anthropic) and API Keys per tenant or workflow,
**So that** I can control which models are used, manage costs, and switch providers without downtime.

**Acceptance Criteria:**

**Given** I am on the Admin Portal → System Settings → LLM Providers page
**When** I add a new LLM Provider
**Then** I can configure: Provider Name, API Key (encrypted at rest), Default Model, and Rate Limits
**And** I can assign a provider as the default for a specific Tenant or Workflow
**And** the system validates the API Key by making a test call before saving
**And** I can set a **Fallback Provider** that activates if the primary returns repeated errors

**Given** a Workflow is configured to use Provider A
**When** Provider A returns 3+ consecutive 500 errors
**Then** the system automatically switches to the configured Fallback Provider
**And** logs the failover event in the audit trail

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
