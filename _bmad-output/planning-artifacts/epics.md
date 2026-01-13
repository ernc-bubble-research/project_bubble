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
*   FR7: [Prototype] Creator can browse available admin-defined workflows in the Storefront.
*   FR8: [Prototype] Creator can initiate a new workflow run from the Storefront.
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
*   FR36: [Prototype] Creator can view remaining run quota (e.g. "Runs: 5/10") in the Storefront.
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
| FR30, FR33, FR26, FR27, FR28, FR32 | **Epic 1** | System Foundation, Auth, & Tenants |
| FR23, FR48, FR3, FR21, FR22 | **Epic 2** | Asset & Knowledge Management |
| FR1, FR2, FR4, FR5, FR6, FR35, FR42 | **Epic 3** | Workflow Definition (The Architect) |
| FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR34, FR36, FR37, FR46, FR47 | **Epic 4** | Workflow Execution Engine (The Creator) |
| FR14, FR15, FR16, FR17, FR18, FR19, FR43, FR45 | **Epic 4** | Interactive Reporting & Feedback |
| FR20, FR39, FR40 | **Epic 6** | Guest Access & Sharing |
| FR29, FR31, FR38, FR49 | **Epic 7** | Observability & Advanced Ops |

## Epic List

### Epic 1: System Foundation & Tenant Isolation
**Goal:** Establish the production-ready infrastructure, including the monorepo, database with RLS, and secure tenant management, ensuring strict data isolation from Day 1.
**FRs covered:** FR30, FR33, FR26, FR27, FR28, FR32
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

#### Story 1.2: Tenant Provisioning (Bubble Admin)
**As a** Bubble Admin,
**I want** to provision new Tenants via an API,
**So that** I can onboard new customers with a secure, isolated workspace.

**Acceptance Criteria:**

**Given** a valid Admin API Key
**When** I POST to `/admin/tenants` with a name
**Then** a new Tenant record is created with a unique UUID
**And** the default Region is set to 'EU' (Frankfurt)
**And** default settings are initialized (inheriting Global Gemini config)

#### Story 1.3: User Authentication & RBAC
**As a** User,
**I want** to log in and receive a secure JWT,
**So that** the system knows my identity, tenant context, and permissions.

**Acceptance Criteria:**

**Given** valid credentials
**When** I login
**Then** I receive a JWT containing `sub` (User ID), `tenant_id`, and `role`
**And** the supported roles are `BubbleAdmin`, `CustomerAdmin`, `Creator`

#### Story 1.4: RLS Enforcement Mechanism (Security)
**As a** Security Architect,
**I want** the system to enforce `SET LOCAL app.current_tenant` on every query and block direct repository access,
**So that** data isolation is guaranteed by the database engine and developers cannot accidentally bypass it.

**Acceptance Criteria:**

**Given** a database transaction
**When** a query is executed
**Then** the `TransactionInterceptor` must automatically inject `SET LOCAL app.current_tenant`
**And** a Linter Rule or Code Guard must exist that flags/prevents injection of `Repository` directly into Services (must use `TransactionManager`)

#### Story 1.5: User Management (Customer Admin)
**As a** Customer Admin,
**I want** to invite colleagues to my workspace,
**So that** we can collaborate on the same data.

**Acceptance Criteria:**

**Given** I am a Customer Admin
**When** I invite a user by email
**Then** the user is created and bound strictly to my `tenant_id`
**And** they are assigned the default `Creator` role

### Epic 2: Asset & Knowledge Management
**Goal:** Enable tenants to manage their proprietary data and ingest them into the "Memory" for the AI agents.
**Strategy:** We distinguish between **Reference Assets** (Vectorized -> Graph) and **Instructional Assets** (Raw Text -> Prompt).
**Technical Note:** Implementation using PostgreSQL (`pgvector` + Relational Tables) as a **Hybrid Graph**. Migration to Neo4j explicitly deferred to Future Roadmap.

#### Story 2.1: Asset Management API (CRUD & Classification)
**As a** Customer Admin,
**I want** to upload and classify "Company Assets" (Codebooks, Knowledge Files),
**So that** the system knows how to treat them (Vectorize vs Raw).

**Acceptance Criteria:**

**Given** I am authenticated as a Customer Admin
**When** I upload a file
**Then** I must specify the `AssetType`: `REFERENCE` (Facts/History) or `INSTRUCTION` (Codebooks/Rules)
**And** the file is stored in Secure Object Storage
**And** an `Asset` record is created in Postgres with this classification

#### Story 2.2: Hybrid Graph Ingestion (Reference Assets)
**As a** System Architect,
**I want** `REFERENCE` assets to be processed into the Hybrid Knowledge Graph,
**So that** they are available for semantic search.

**Acceptance Criteria:**

**Given** a new Asset of type `REFERENCE`
**When** the Ingestion Worker runs
**Then** it extracts, chunks, and embeds the text
**And** stores it in the `knowledge_nodes` table (Vectors)
**And** creates relational edges in `node_relationships` table (Hybrid Graph approach)
**And** `INSTRUCTION` assets are skipped (stored as Raw Text only)

#### Story 2.3: Semantic Search Service (Hybrid Traversal)
**As a** Workflow Developer,
**I want** a service to query the Hybrid Graph,
**So that** agents can find context.

**Acceptance Criteria:**

**Given** a query string
**When** I call `KnowledgeService.search()`
**Then** it performs a Vector Similarity Search in `pgvector`
**And** allows for relational traversal (e.g., "Find nodes related to this node") in the future
**And** returns relevant text chunks with metadata

#### Story 2.4: Knowledge Graph Write-Back (The Flywheel)
**As a** Product Strategist,
**I want** validated user feedback to be saved as high-priority nodes,
**So that** the system learns from corrections.

**Acceptance Criteria:**

**Given** validated feedback from Epic 5
**When** the "Feedback Event" is received
**Then** a new `knowledge_node` is created with `is_verified=true`
**And** the Search Service is updated to boost `is_verified` nodes over raw document nodes

### Epic 3: Workflow Definition (The Architect)
**Goal:** Provide "Architects" (Admins) with a powerful tool to define the "Mind" of the agent—configuring graph layouts, node logic, and validation rules.
**FRs covered:** FR1, FR2, FR4, FR5, FR6, FR35, FR42

#### Story 3.1: Workflow Graph Editor (Admin UI)
**As a** Bubble Admin,
**I want** to define the workflow topology (nodes and edges), supporting both linear flows and "Retry Loops" (Cycles),
**So that** I can build complex agentic behaviors like "Draft -> Review -> Fix -> Approval".

**Acceptance Criteria:**

**Given** I am in the Workflow Editor
**When** I connect Node A (Reviewer) back to Node B (Doer)
**Then** the system accepts this cycle (Loop)
**And** validates the graph structure is valid for LangGraph execution
**And** saves the topology as a JSON structure in Postgres

#### Story 3.2: Node Configuration Strategy
**As a** Bubble Admin,
**I want** to configure the internal logic of each node (System Prompt, Model, Tools),
**So that** I can specialize agents (e.g., "You are a Legal Analyst").

**Acceptance Criteria:**

**Given** a selected node
**When** I update its configuration
**Then** I can set the `SystemPrompt`, `Model` (Gemini Pro/Flash), and `Temperature`
**And** I can bind specific Tools/Capabilities (e.g., "Search Knowledge Graph")

#### Story 3.3: Input Schema & Global Validation
**As a** Bubble Admin,
**I want** to define the required inputs for the workflow, including support for "Arrays of Files",
**So that** the Storefront UI automatically generates the correct form for the user.

**Acceptance Criteria:**

**Given** a workflow definition
**When** I define `InputSchema`
**Then** I can specify fields like `client_name` (Text) or `transcripts` (File[])
**And** I can set validation rules (e.g., "Min 1 file", "Max 50MB")

#### Story 3.4: The Gatekeeper (Validation & Self-Correction)
**As a** Workflow Designer,
**I want** to define "Conditional Edges" based on agent output,
**So that** the workflow can automatically route to a "Fix it" node if the Quality Score is low.

**Acceptance Criteria:**

**Given** a Node Output (e.g., `{ quality: 0.5 }`)
**When** the Gatekeeper evaluates the condition `quality < 0.8`
**Then** the execution routes to the "Correction Node" instead of the "End Node"
**And** this logic is configurable via the Admin UI

#### Story 3.5: Advanced Patterns (Map-Reduce)
**As a** Power User,
**I want** to configure a "Map" step that runs an agent in parallel for every item in an input list,
**So that** I can process 20 files simultaneously and then "Reduce" (consolidate) them into one report.

**Acceptance Criteria:**

**Given** an input array of 20 files
**When** the workflow enters the "Map Node"
**Then** the system spawns 20 parallel execution branches (one per file)
**And** waits for all to complete before triggering the "Reduce Node"
**And** the Reduce Node receives an array of all 20 outputs

### Epic 4: Workflow Execution Engine (The Creator)
**Goal:** The heart of the system. Enable "Creators" to run workflows asynchronously, handling file inputs, queue management, and robust state persistence.
**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR34, FR36, FR37, FR46, FR47
**NFRs:** NFR-Perf-2, NFR-Rel-1, NFR-Rel-2, NFR-Scale-1

#### Story 4.1: Storefront & Run Initiation (Dynamic Forms)
**As a** Creator,
**I want** to select a workflow and see a dynamic form asking for the specific inputs it needs (e.g., "Upload 5 Transcripts", "Select Codebook"),
**So that** I can start a run with the correct data.

**Acceptance Criteria:**

**Given** I select a "Batch Analysis" workflow
**When** the page loads
**Then** the UI renders a Multi-File Uploader (because the schema assumes `File[]`) and a Dropdown for "Codebook"
**And** I cannot click "Run" until validation passes (Story 4.4)

#### Story 4.2: Execution Engine Core (The Orchestrator)
**As a** System Architect,
**I want** a robust background worker that picks up the job and executes the LangGraph definition,
**So that** the user doesn't have to wait with their browser open.

**Acceptance Criteria:**

**Given** a "Job Created" event in BullMQ
**When** the Worker picks it up
**Then** it loads the specific Workflow Graph from the DB
**And** executes the nodes (supporting parallel "Map" branches for batch inputs)
**And** updates the Run Status to `RUNNING`

#### Story 4.3: State Persistence & Resumption (Auto-Save)
**As a** DevOps Engineer,
**I want** the engine to save the workflow state (Postgres Checkpoint) after every node transition,
**So that** if the server restarts, the job resumes exactly where it left off.

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

**Given** a workflow that requires a "Style Guide" asset
**When** I try to run it without selecting one
**Then** the API rejects the request
**And** the UI shows a specific error: "Missing Required Asset: Style Guide"

#### Story 4.5: Output Generation (Raw Data & Citations)
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

#### Story 5.3: Human-in-the-Loop Feedback (Structured + Freeform)
**As a** Creator,
**I want** to review flagged assumptions and provide general feedback,
**So that** I can correct the agent's reasoning.

**Acceptance Criteria:**

**Given** the report contains "Low Confidence Assumptions"
**Then** I see a "Review Assumptions" section where I can click "Approve" or "Edit" for each
**And** I also see a "Global Feedback" text area to provide general instructions (e.g., "Focus more on X")

#### Story 5.4: Feedback Processing (The Re-Run)
**As a** Workflow Engine,
**I want** to accept user feedback and trigger a partial re-run,
**So that** the report is updated with the new context.

**Acceptance Criteria:**

**Given** submitting feedback
**When** the "Re-Run" triggers
**Then** the engine re-executes the generation nodes
**And** injects the Feedback as a high-priority "Correction Context" into the system prompt

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
**And** a global banner appears in the Storefront UI

#### Story 7.1: Advanced LLM Configuration UI (Roadmap Item)
**As a** Bubble Admin,
**I want** a UI to configure multiple LLM Providers and API Keys per tenant or workflow,
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
