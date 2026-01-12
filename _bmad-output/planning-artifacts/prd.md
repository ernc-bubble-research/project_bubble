---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-project_bubble-2026-01-09.md
  - docs/Bubble - general specifications_v01.md
  - docs/Bubble_ Initial Product Definition - Brainstorm.md
  - docs/Product Charter Bubble.md
workflowType: 'prd'
lastStep: 0
---

# Product Requirements Document - project_bubble

**Author:** User
**Date:** 2026-01-09

## Executive Summary

Bubble is an enterprise-grade **Agentic Workflow Engine** delivered via a **"Storefront" interface**. It transforms B2B market research from a chaotic mix of gut feelings and "loudest voice wins" into rigorous, factual strategy.

### What Makes This Special

*   **The "Smart Colleague" Model:** Bubble isn't just a tool; it's a digital worker. You assign it a heavy task (e.g., "Analyze these 20 interviews"), it processes them rigorously using **Admin-Defined Workflows**, and presents a draft for your review and feedback—just like a human analyst.
*   **Strategic Authority:** With **"Traceable Truth,"** every claim is linked to raw evidence. This transforms PMMs from reactive defenders into **strategic drivers**, wielding factual data to lead organizational strategy rather than being drowned out by the "loudest voice wins" dynamic.
*   **Production-Grade Foundation from Day 1:** We are building on a robust **Nx/Hexagonal Architecture** from the start. While we roll out with limited features and users (the "Prototype" phase), the foundation is production-ready, ensuring enterprise-grade data isolation and scalability for our **MVP → PLG** evolution.

## Project Classification

**Technical Type:** saas_b2b
**Domain:** Marketing Analytics / Agentic Workflows
**Complexity:** Medium-High
**Project Context:** Greenfield Codebase implementing a Brownfield Specification (Strict Functional Parity).

## Success Criteria

### User Success
*   **Activation:** Users generate their first report within 7 days of signup.
*   **Power User Conversion:** % of users who grow from small tests (<10 inputs) to substantial projects (≥10 inputs).
*   **Campaign Reactivation Rate:** 60% of users return within 6 months for their next research cycle.
*   **Storefront Engagement:** 40% of signups browse ≥3 workflows (discovery signal).

### Business Success
*   **Revenue:** €25K MRR within 3 months, with ≥70% from recurring projects.
*   **Unit Economics:** Establish baseline CAC by Month 3, achieve LTV:CAC ≥ 3:1 by Month 6.
*   **Margin:** Gross Margin ≥ 70%.

### Technical Success
*   **LLM Abstraction:** Multi-provider support with zero workflow downtime during switches.
*   **Parallel Processing:** Support concurrent workflow execution (scale TBD based on tier).
*   **Uptime:** 99.5% availability during business hours.

**Note:** Detailed metrics (conversion rates, error rates, processing SLAs) will be refined during Prototype and MVP phases based on real user behavior.

## Product Scope

### MVP - Minimum Viable Product (Phase 1)
*   **Storefront:** Read-only library of admin-defined workflows.
*   **Wizard:** Upload interface with Company Asset selection.
*   **Report:** Interactive output with Citation Sidebar.
*   **Admin Panel:** Internal workflow/codebook builder.

### Growth Features (Phase 2)
*   User-facing Canvas Builder
*   Native integrations (Salesforce, HubSpot)
*   Collaboration features

### Vision (Future)
*   Workflow Marketplace
*   AI-suggested workflows

## User Journeys

### Journey 1: The Architect (Admin) - "Programming the Engine"
**Context:** The Admin needs to migrate a complex "Qualitative Data Analysis" (QDA) methodology—originally a Google Gemini Gem—into the robust Bubble infrastructure.
**The Flow:**
1.  **Workflow Creation:** The Admin initiates a new "QDA Analyzer" workflow. instead of just prompting, they define a **Graph Topology**:
    *   **Node 1 (Scanner):** Scans inputs for context.
    *   **Node 2 (Doer):** Executes the SPICED analysis using the uploaded "Knowledge File" instructions.
    *   **Node 3 (Reviewer):** Flags low-confidence assumptions.
2.  **Input Definition:** The Admin configures strict input schemas:
    *   **File Input:** `.txt, .docx` (Transcripts).
    *   **Company Asset Binding:** "Codebook" (Required).
    *   **Modal Form:** Adds a custom field for "Research Focus Question" that the user must answer before running.
3.  **Output Definition:** Defines the interactive report schema, mapping the "SPICED Table" to the UI and linking "Assumptions" to a feedback form.
**System Value:** Bubble acts as the **Runtime Container**, managing the complex state (LangGraph-style) while providing a clean definition interface.

### Journey 2: Amy (PMM) - The "Smart Colleague" Feedback Loop
**Context:** Amy uploads 20 interviews for analysis. She wants "Board-Ready" insights, not just a raw summary.
**The Flow:**
1.  **Submission:** On the Storefront, she selects the "QDA Analyzer." The Wizard guides her to upload 20 transcripts, select her "Q1 2026 Codebook" (Company Asset), and answer the "Research Focus" form question.
2.  **Initial Run:** Bubble processes the batch asynchronously.
3.  **Interactive Review:** Amy opens the generated report.
    *   **Traceable Truth:** She sees an insight "Customers hate the pricing," clicks the superscript, and the **Evidence Drawer** slides out on the right showing the exact quote.
    *   **Assumption Checking:** The system highlights: "I assumed 'Project Alpha' refers to the new UI. Is this correct?" Amy clicks "Yes."
    *   **Refinement:** She types a generic request: "Focus more on the 'Enterprise' segment pains."
4.  **The Loop:** She hits "Update." The system **Re-runs the workflow**, injecting her feedback as new context, and generates v2 of the report.
5.  **Completion:** satisfied, she exports the final version to PDF.

### Journey Requirements Summary
*   **Infrastructure:** flexible "Graph Definition" engine (Node/Edge configuration).
*   **Input Handling:** Support for Files, Associated Assets, and Custom Forms.
*   **Interactive UI:** Report viewer with "Evidence Drawer" (Right-hand side) and "Assumption Verification" forms.
*   **State Management:** Ability to "Re-run" a workflow maintaining previous context + new feedback.

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. The "Strategic Flywheel" (Cumulative Value)**
Most AI tools are transactional (Input → Output → Forget). Bubble is cumulative:
*   **Usage Generates Memory:** Every validated interaction (e.g., verifying an assumption) enters the **Knowledge Graph**.
*   **Smarter Methodology:** The next time a workflow runs, it checks the Graph first. "Based on last quarter's correction, I know 'Project Alpha' is the new UI."
*   **Result:** The product gets harder to leave the more it is used (Data Moat).

**2. Context-Aware Memory with "Hygiene Layer"**
We don't just dump data. We implement a **"Gatekeeper Protocol"**:
*   **Assessment:** New inputs are checked against known facts. Contradictions trigger a "Human Verification" request.
*   **Versioning:** The Graph supports snapshots. If a bad batch of data corrupts the brain, we can **"Revert to Last Known Good State."**
*   **Consensus Logic:** Storing conflicting truths with context (e.g., "Sales says Price is High" vs "Finance says Price is Low" - both are true in their context).

**3. The "Methodology Engine" (Feature as Asset)**
We do not sell "AI Generation"; we sell **"Virtual Senior Analysts."**
*   Users don't prompt; they select a vetted methodology (e.g., "QDA Dual-Stream").
*   The system enforces rigor (e.g., mandatory dual-stream verification) that a generic chatbot would skip.
*   **Innovation:** Democratizing Senior PMM expertise into executable software assets.

### Market Context & Competitive Landscape
*   **status_quo:** PMMs use generic LLMs (ChatGPT/Claude) for one-off tasks.
*   **gap:** These tools lack "Institutional Memory" and "Methodology Enforcement." They hallucinate citations and forget context between sessions.
*   **threats:** Ops-heavy platforms (e.g., Dovetail) have great data management but weak "Agentic Reasoning." Bubble uniquely combines **Deep Reasoning** with **Structured Memory**.

### Validation Approach
*   **Trust Metrics:** Measure "Citation Click Rate" and "Assumption Correction Rate." High interaction = High Trust.
*   **Hygiene Validator:** Automated tests that inject conflicting data to verify the "Gatekeeper Protocol" catches it.
*   **Flywheel tracking:** Track "Insight Quality Score" over time (Month 1 vs Month 6) to prove cumulative intelligence.

### Risk Mitigation
*   **Graph Corruption:** Mitigated via "Graph Snapshots" and "Revert" functionality.
*   **Complexity Overload:** Mitigated by hiding the logic (JSON) behind a clean "Storefront" UI that speaks the user's language.

## SaaS B2B Specific Requirements

### Project-Type Overview
Enterprise-grade **Agentic Workflow Platform** designed for B2B usage. Focus on multi-tenancy, strict data isolation, and role-based governance.

### Technical Architecture Considerations
*   **Foundation:** **Nx Monorepo** managing a **NestJS** (Backend) and **Angular** (Frontend) stack.
*   **Hexagonal Architecture:** Strict "Ports & Adapters" pattern to ensure specific technologies (like the LLM provider or Database) can be swapped without rewriting business logic.
*   **LLM Abstraction Layer:** A dedicated adapter to allow switching between providers (OpenAI, Anthropic, Gemini) per workflow or tenant.

### Multi-Tenancy & Data Isolation
*   **Model:** **Logical Separation** using PostgreSQL **Row-Level Security (RLS)**.
*   **Rationale:** Provides enterprise-grade security (enforced at the DB engine level) while maintaining the cost efficiency and management simplicity of a single database.

### RBAC Permission Matrix
| Role | Scope | Key Capabilities |
| :--- | :--- | :--- |
| **Bubble Admin** | Global | Manage tenants, system-wide settings, LLM providers. |
| **Customer Admin** | Tenant | Manage users, billing, Codebook assets, default workflow settings. |
| **Creator** | Tenant | Run workflows, upload files, interact with reports. |
| **Guest** | Report | Read/Interact with specific reports via **Secure Magic Link** (No login required). |

### Integration Strategy
*   **Prototype Phase:**
    *   **Inputs:** Text-based files only (`.txt`, `.csv`, `.md`, `.docx`, simple `.pdf`).
    *   **Logic:** File text extraction only.
*   **MVP Phase:**
    *   **Connectors:** Native OAuth integrations for **HubSpot**, **Google Drive**, **OneDrive**.
    *   **Advanced Inputs:** Multimodal PDF support (Charts/Slides) dependent on LLM vision capabilities.

### Compliance & Security
*   **GDPR:** Architecture supports Data Residency options (EU/US availability zones).
*   **Audit Logging:** Comprehensive logging of all "Agent Actions" (who ran what, when, using which prompt version) to support future SOC2 readiness.
*   **SOC2:** Deferred for Prototype; architecture built to be "SOC2 Ready."

## Project Scoping & Phased Development

### MVP Strategy & Philosophy
**Approach:** **"Infrastructure First"**
We are building the **Engine** (Bubble) separately from the **Fuel** (Workflows).
*   **Prototype (MVP v1):** Validates the *Infrastructure* (Can we run complex graphs reliable?) + *Methodology* (Do users value the output?).
*   **Full MVP (MVP v2):** Validates the *Integration* (Does it fit the workflow?) + *Scale* (Can we handle enterprise load?).

### MVP Feature Set (Phase 1 - Prototype)
**Focus:** Manual Input / High-Value Output
*   **Engine:** Executing Admin-defined graphs, handling State/Re-runs.
*   **Storefront:** Seed Library of 3-5 Expert Workflows (e.g., QDA, Competitor Analysis, Messaging Audit).
*   **Input:** File Upload (Text-heavy: CSV/DOCX/PDF).
*   **Output:** Interactive Report with Evidence Drawer + Human Feedback Loop.
*   **Governance:** **Simple Admin UI** (Form-based) for defining workflow parameters (not just YAML).

### Phase 2: The Integrated MVP
**Focus:** Friction Reduction / Data Connection
*   **Connectors:** HubSpot, Google Drive, OneDrive.
*   **Input Normalization Layer:** Vision Agent that ingests graphical docs (PPTs/Charts) and converts them to Normalized Text for workflow consumption.
*   **Expansion:** Seed Library expands to Sales/Onboarding workflows using CRM data.

### Phase 3: The "Orchestration" Vision
**Focus:** Composable Workflows (Zapier-style)
*   **The Chain Builder:** Users **cannot** edit prompts (IP protection), but they can **chain** workflows.
    *   *Example:* Trigger "QDA Workflow" (Run 20 times) → Pipe outputs to → "Synthesis Workflow" (Consolidate to 1 Report).
*   **Marketplace:** Users share "Chains" (Recipes), not the underlying Prompt IP.
*   **Presentation Export:** Export interactive reports directly to Slide Decks.

### Risk Mitigation Strategy
*   **Technical Risks:** "Graph Complexity" handled by robust LangGraph backend from day 1 (Walking Skeleton).
*   **Market Risks:** "Adoption Friction" mitigated by **Zero-Prompt Interface** (Storefront).
*   **Resource Risks:** Phasing integrations (Phase 2) allows small team to focus on Engine Core first.

## Functional Requirements

Requirements are tagged by implementation phase: 
- **[Prototype]**: Mandatory for Initial Prototype (MVP v1).
- **[MVP]**: Mandatory for Full MVP (MVP v2).
- **[Future]**: Deferred to post-MVP roadmap.

### Workflow Administration (The Architect)

- FR1: [Prototype] Bubble Admin can define workflow graph topology using nodes and edges.
- FR2: [Prototype] Bubble Admin can configure specific node types (Scanner, Doer, Reviewer) with execution instructions.
- FR42: [MVP] System soft-deletes Admin objects (Workflows, Assets) allowing restoration within a grace period (e.g., 30 days).
- FR3: [Prototype] Bubble Admin can define strict input allow-lists (e.g., "only .txt, .docx") and max file size limits; System rejects non-compliant files at upload.
- FR4: [Prototype] Bubble Admin can create custom form inputs (text fields, multiple choice) for workflow initialization.
- FR5: [Prototype] Bubble Admin can define output report schemas mapping analysis results to UI components.
- FR6: [Prototype] Bubble Admin can update validation rules for "Gatekeeper Protocol" within workflows.
- FR35: [Prototype] Bubble Admin can configure retry policies (count, backoff) for specific node types.

### Workflow Execution (The Creator)

- FR7: [Prototype] Creator can browse available admin-defined workflows in the Storefront.
- FR8: [Prototype] Creator can initiate a new workflow run from the Storefront.
- FR9: [Prototype] Creator can upload required files (supporting .txt, .csv, .md, .docx, .pdf) for a run.
- FR10: [Prototype] Creator can select necessary Company Assets (e.g., Codebooks, Knowledge Files) to bind to the run.
- FR11: [Prototype] Creator can provide text responses to mandatory custom form questions.
- FR46: [Prototype] System validates all mandatory inputs (Files, Forms) are present before allowing Workflow submission.
- FR36: [Prototype] Creator can view remaining run quota (e.g. "Runs: 5/10") in the Storefront.
- FR37: [Prototype] System pauses execution if tenant usage exceeds Admin-defined hard limits (e.g., max runs/month).
- FR47: [Prototype] System enforces a "Max Steps per Model Run" limit (e.g., 50 steps) to prevent infinite loops.
- FR12: [Prototype] System queues workflow execution for asynchronous processing.
- FR13: [Prototype] System supports concurrent execution of multiple workflow runs.
- FR34: [Prototype] System can persist intermediate state at each node completion to allow resumption after failure.

### Report & Analysis (The Creator / Guest)

- FR14: [Prototype] Creator can view generated reports in an interactive web interface.
- FR15: [Prototype] Creator can click citation superscripts to reveal source text in a side-panel "Evidence Drawer".
- FR16: [Prototype] Creator can verify or correct system-flagged assumptions via inline feedback forms.
- FR17: [Prototype] Creator can provide natural language feedback to request specific refinements or corrections.
- FR18: [Prototype] System re-runs workflow execution incorporating user feedback as new context.
- FR19: [Prototype] Creator can export final reports to PDF format.
- FR41: [MVP] Creator can target feedback to specific report sections or specific data nodes (e.g., "Fix only the 'Pricing' section").
- FR20: [Prototype] Guest can access specific reports via a secure magic link that expires after a configurable duration (default 7 days).
- FR39: [Prototype] Guest access is strictly scoped to the specific Report UUID linked in the magic link.
- FR40: [Prototype] Creator can revoke active magic links to terminate Guest access.

### Knowledge & Asset Management (Strategic Flywheel)

- FR21: [Prototype] System stores validated interaction data (corrections, verified assumptions) into the Knowledge Graph.
- FR48: [Prototype] System ingests and indexes Company Assets (text extraction + embedding) upon upload for retrieval.
- FR22: [Prototype] Workflow execution queries Knowledge Graph for historical context before processing new inputs.
- FR23: [Prototype] Customer Admin can manage Company Assets (Codebooks, Knowledge Files) available to the tenant.
- FR24: [Future] System creates versioned snapshots of the Knowledge Graph state.
- FR25: [Future] Bubble Admin can revert the Knowledge Graph to a previous version/snapshot ("Last Known Good State").
- FR50: [Future] Bubble Admin can execute "Right to be Forgotten" commands to scrub specific user PII from Logs and Knowledge Graph.
- FR44: [Future] Bubble Admin can configure data retention policies (e.g., "Auto-archive runs older than 1 year").

### User & System Administration

- FR26: [Prototype] Bubble Admin can provision new tenants and configure tenant-level settings.
- FR51: [Prototype] System initializes new Tenants with a set of "Template Workflows" and "Sample Assets" to aid onboarding.
- FR27: [Prototype] Customer Admin can invite and manage users within their tenant.
- FR28: [Prototype] System enforces unique IDs for all interactive elements to support automated testing.
- FR29: [Prototype] Bubble Admin can configure LLM provider settings per workflow or tenant.
- FR38: [Prototype] Customer Admin can view full execution traces (Input -> Prompt -> Raw Output) for debugging purposes.
- FR49: [MVP] System displays "Service Status" banners for downstream dependencies (e.g., "LLM Provider API Degraded").

### Security & Compliance

- FR30: [Prototype] System enforces logical isolation of tenant data using Row-Level Security (RLS).
- FR31: [Prototype] System logs all agent actions (user, timestamp, prompt version, input) for audit trails.
- FR32: [Prototype] System supports configuration for data residency (processing region).
- FR33: [Prototype] System authenticates users based on assigned roles (Bubble Admin, Customer Admin, Creator).
- FR43: [MVP] System applies a watermark (User Email + Timestamp) to all PDF exports.
- FR45: [Prototype] System sanitizes and validates all user text inputs (Feedback, Forms) to prevent prompt injection attacks.

## Non-Functional Requirements

### Performance
*   **UI Lateny:** "Evidence Drawer" and "Citation Sidebar" interactions must render within **< 200ms** to ensure a "native app" feel.
*   **Submission Acknowledgement:** Workflow submission must return a "Queued" status within **2 seconds**, regardless of input file size.
*   **Report Rendering:** Completed reports (including up to 50 citations) must load within **3 seconds**.

### Security
*   **Strict Isolation:** **100%** of database queries must be executed via the RLS-enabled user context (no superuser connections in application code).
*   **Encryption:** All Company Assets and Knowledge Graph data must be encrypted **AES-256 at rest** and **TLS 1.3 in transit**.
*   **Ephemeral Access:** Magic Links must be cryptographically secure (256-bit entropy) and strictly adhere to the expiration window (default 7 days).

### Reliability
*   **State Persistence:** The Workflow Engine (LangGraph) must persist state to Postgres after **every single node transition** to ensure zero data loss on crash.
*   **Error Handling:** Downstream failures (LLM Provider 500 errors) must trigger a **Exponential Backoff** retry policy (up to 3 attempts) before failing user-visibly.

### Scalability (Prototype)
*   **Concurrency:** System must support **Admin-configurable concurrent run limits** per tenant (e.g., Tier 1 = 5 runs, Tier 2 = 20 runs), enforced by the job queue.
*   **Graph Size:** System must handle Knowledge Graphs up to **10,000 nodes/edges** per tenant with sub-second query performance.

### Compliance
*   **Data Residency:** System infrastructure (DB + LLM Region) will be hosted in **EU (Frankfurt/Dublin)** for Prototype/MVP. (Regional Routing is deferred to [Future]).
