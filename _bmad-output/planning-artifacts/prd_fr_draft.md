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
