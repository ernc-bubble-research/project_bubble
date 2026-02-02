---
title: 'Workflow Definition Schema'
slug: 'workflow-definition-schema'
created: '2026-02-01'
updated: '2026-02-02'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - NestJS 11+ (API Gateway)
  - Angular 21+ (Workflow Builder UI)
  - PostgreSQL 16+ (pgvector)
  - BullMQ 5.66.5 (Redis-backed, FlowProducer supported)
  - TypeORM (Repository pattern via TransactionManager)
  - Hexagonal LLMProvider interface
files_to_modify:
  - libs/db-layer/src/lib/entities/workflow-template.entity.ts (NEW)
  - libs/db-layer/src/lib/entities/workflow-version.entity.ts (NEW)
  - libs/db-layer/src/lib/entities/workflow-chain.entity.ts (NEW)
  - libs/db-layer/src/lib/entities/workflow-run.entity.ts (NEW)
  - libs/db-layer/src/lib/entities/llm-model.entity.ts (NEW)
  - libs/db-layer/src/lib/entities/asset.entity.ts (MODIFY)
  - libs/db-layer/src/lib/entities/index.ts (MODIFY)
  - libs/db-layer/src/lib/rls-setup.service.ts (MODIFY)
  - libs/shared/src/lib/dtos/workflow/ (NEW directory)
  - libs/shared/src/lib/dtos/index.ts (MODIFY)
  - libs/shared/src/lib/types/workflow-definition.interface.ts (NEW)
  - libs/shared/src/lib/types/workflow-job.interface.ts (NEW)
  - libs/shared/src/lib/validators/workflow-schema.validator.ts (NEW)
code_patterns:
  - EmbeddingProvider hexagonal interface (mirror for LLMProvider)
  - BullMQ queue/processor pattern (IngestionService/IngestionProcessor)
  - TransactionManager for all tenant-scoped DB operations
  - Shared DTOs in libs/shared/src/lib/dtos
  - AssetEntity pattern for workflow output storage
  - Entity enum pattern (AssetStatus -> WorkflowStatus, RunStatus)
  - JSONB columns for flexible schema storage (workflow_definition, chain_definition)
test_patterns:
  - Co-located *.spec.ts unit tests
  - Structured test IDs [story-UNIT-seq]
  - Priority markers [P0]-[P3]
  - BDD Given/When/Then format (Epic 3+)
  - Controller tests via direct instantiation
  - DTO validation via plainToInstance + validate
---

# Tech-Spec: Workflow Definition Schema

**Created:** 2026-02-01
**Updated:** 2026-02-02 (Review feedback incorporated)
**Gate:** `gate-workflow-definition-schema` (Pre-Epic-3 blocker)

## Overview

### Problem Statement

Epic 3 (Workflow Definition UI) builds a form-based wizard that *produces* workflow definitions. Epic 4 (Workflow Execution Engine) builds the engine that *consumes* those definitions to run LLM-orchestrated analysis. Without a formal schema contract between these two epics, the builder UI and execution engine will diverge — the UI will produce definitions the engine can't consume, requiring costly rework.

The party mode architectural pivot (2026-02-01) replaced LangGraph.js with LLM-orchestrated execution, where YAML prompts are sent directly to the LLM. This spec defines the YAML schema that serves as the contract between the two epics.

### Solution

Define a complete Workflow Definition Schema covering: (1) atomic workflow YAML structure with typed inputs, prompt body, and output spec; (2) input role taxonomy distinguishing context from subject inputs; (3) execution pattern derivation from input configuration; (4) workflow chain composition as metadata linking atomic workflows; (5) structural output validation with automatic LLM retry; (6) context window token budget management; (7) LLM model management; (8) credit pre-check; (9) admin execution inspector for debugging.

### Scope

**In Scope:**
- Atomic workflow YAML schema (complete field definitions)
- Admin workflow builder wizard flow (how the schema is produced)
- Input role taxonomy (context vs subject, source types: asset/upload/text)
- Execution pattern derivation (fan-out parallel, fan-in batch)
- Workflow chain composition schema (metadata-only linking, explicit context mapping)
- Output spec and structural validation with automatic retry
- Context window token budget check design
- LLM model management (DB-driven, admin-configurable)
- Credit pre-check before job creation
- Admin Execution Inspector for debugging/tuning
- DB entity design (WorkflowTemplate, WorkflowVersion, WorkflowChain, WorkflowRun, LlmModel)
- Integration with existing AssetEntity for workflow output storage

**Out of Scope:**
- Map-reduce execution pattern (deferred to post-MVP)
- LangGraph.js implementation (deferred to future epic)
- Actual Epic 3 or Epic 4 story implementation code
- Prompt engineering or prompt authoring guidelines
- LLMProvider interface implementation (covered by Epic 4 gate)
- Visual graph canvas (Epic 10, future)
- Quality overseer / confidence scoring (see Future Considerations)

---

## 1. Atomic Workflow Definition Schema

An atomic workflow is the fundamental unit. It represents a single LLM interaction pattern with defined inputs, a prompt, and an expected output structure.

> **IMPORTANT:** The YAML example below is an *illustrative instance*, not a fixed template. The `inputs` array, `prompt` content, and `output.sections` are completely dynamic — defined by the admin per workflow. A workflow can have 1 input or 10, any combination of context and subject inputs, and any prompt structure. The only structural constraint is exactly ONE subject input.

### 1.1 Complete YAML Schema (Example: Analyze Transcript)

```yaml
# ==================================================
# ATOMIC WORKFLOW DEFINITION
# This YAML is stored in workflow_versions.definition (JSONB)
# The prompt section is sent to the LLM AS-IS
# ==================================================
# NOTE: This is an EXAMPLE workflow. Every field under inputs[],
# the prompt content, and output.sections are defined by the admin.
# Different workflows will have completely different inputs and prompts.
# ==================================================

metadata:
  name: "analyze-transcript"                    # Required. Display name.
  description: "Analyze a single interview..."  # Required. Shown in workflow catalog.
  version: 1                                    # Auto-incremented by platform.
  tags: ["qualitative", "research"]             # Optional. For filtering/search.

# --------------------------------------------------
# INPUTS: What the user provides when running this workflow
# The admin defines these via the builder wizard (Section 1.4).
# Any number of context inputs. Exactly ONE subject input.
# --------------------------------------------------
inputs:
  - name: "codebook"                    # Required. Unique within this workflow.
    label: "Codebook"                   # Required. Display label in run form.
    role: "context"                     # Required. "context" | "subject"
    source:                             # Required. Allowed source types.
      - "asset"                         # Pick from existing data vault files
      - "upload"                        # Upload a new file
    required: true                      # Required. Boolean.
    description: "The coding framework" # Optional. Help text in run form.
    accept:                             # Optional. File type restrictions.
      extensions: [".pdf", ".docx", ".txt", ".md"]
      max_size_mb: 10

  - name: "research_goal"
    label: "Research Goal"
    role: "context"
    source:
      - "asset"
      - "upload"
      - "text"                          # Free-form text entry in run form
    required: true
    description: "What are you investigating?"
    text_config:                        # Only when "text" is in source[].
      placeholder: "Describe your research objective..."
      max_length: 5000

  - name: "transcript"
    label: "Interview Transcript"
    role: "subject"                     # THIS determines execution pattern
    source:
      - "upload"
    required: true
    accept:
      extensions: [".pdf", ".docx", ".txt", ".md"]
      max_size_mb: 10

# --------------------------------------------------
# EXECUTION: How subject inputs are processed
# --------------------------------------------------
execution:
  processing: "parallel"               # Required. "parallel" | "batch"
                                       #   parallel: 1 BullMQ job per subject file
                                       #   batch: 1 BullMQ job with all subject files
  max_concurrency: 5                   # Optional. For parallel only. Default: 5.
  model: "gemini-2.0-flash"            # Required. LLM model identifier (from llm_models table).
  temperature: 0.3                     # Optional. Default: 0.7.
  max_output_tokens: 8192              # Optional. Default: 4096.
  max_retries: 2                       # Optional. Validation retry attempts. Default: system setting.

# --------------------------------------------------
# KNOWLEDGE: RAG context injection settings
# --------------------------------------------------
knowledge:
  enabled: true                        # Required. Whether to query knowledge base.
  query_strategy: "auto"               # Optional. "auto" | "custom"
                                       #   auto: Platform generates query from subject content
                                       #   custom: Use knowledge.query_template below
  query_template: ""                   # Optional. Custom query for knowledge retrieval.
  max_chunks: 10                       # Optional. Max knowledge chunks to inject. Default: 10.
  similarity_threshold: 0.7            # Optional. Min similarity score. Default: 0.7.

# --------------------------------------------------
# PROMPT: The actual LLM instructions (sent AS-IS)
# This is where the admin pastes their entire instruction set.
# Variable placeholders {input_name} match inputs[].name above.
# Can contain detailed multi-step algorithms, examples, constraints.
# --------------------------------------------------
prompt: |
  You are a qualitative data analyst. Analyze the following interview
  transcript using the provided codebook and research goal.

  ## Codebook
  {codebook}

  ## Research Goal
  {research_goal}

  ## Knowledge Context
  {knowledge_context}

  ## Transcript
  {transcript}

  ## Instructions
  1. Identify all themes from the codebook present in the transcript
  2. Extract supporting quotes with speaker attribution
  3. Note any emergent themes not in the codebook
  4. Flag low-confidence interpretations as assumptions

  ## Output Format
  Follow the output specification exactly.

# --------------------------------------------------
# OUTPUT: Expected output structure for platform validation
# Defines what the platform checks AFTER the LLM responds.
# The admin defines these sections separately from the prompt
# (see Section 1.4 Wizard Step 6).
# --------------------------------------------------
output:
  format: "markdown"                   # Required. "markdown" | "json" (mutually exclusive)
  filename_template: "analysis-{subject_name}-{timestamp}"  # Required.
  # --- Use 'sections' when format="markdown" ---
  sections:                            # Required when format=markdown. Ignored when format=json.
    - name: "themes"
      label: "Identified Themes"
      required: true
    - name: "quotes"
      label: "Supporting Quotes"
      required: true
    - name: "emergent_themes"
      label: "Emergent Themes"
      required: false
    - name: "assumptions"
      label: "Flagged Assumptions"
      required: true
  # --- Use 'json_schema' when format="json" ---
  # json_schema: { ... }               # Required when format=json. Ignored when format=markdown.
                                       # Provide a JSON Schema object that defines the expected
                                       # JSON output structure (field names, types, required fields).
                                       # The platform validates the LLM's JSON output against this schema.
```

### 1.2 Schema Field Reference

This table is a developer reference for Epic 3 (builder UI) and Epic 4 (execution engine) implementation. It documents every schema field, its type, and constraints.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metadata.name` | string | Yes | Workflow display name |
| `metadata.description` | string | Yes | Workflow description for catalog |
| `metadata.version` | integer | Auto | Auto-incremented on save |
| `metadata.tags` | string[] | No | Filtering/search tags |
| `inputs[].name` | string | Yes | Unique identifier for this input |
| `inputs[].label` | string | Yes | Display label in run form UI |
| `inputs[].role` | enum | Yes | `"context"` or `"subject"` |
| `inputs[].source` | string[] | Yes | Allowed: `"asset"`, `"upload"`, `"text"` |
| `inputs[].required` | boolean | Yes | Whether input is mandatory |
| `inputs[].description` | string | No | Help text for run form |
| `inputs[].accept.extensions` | string[] | No | Allowed file extensions |
| `inputs[].accept.max_size_mb` | number | No | Max file size in MB |
| `inputs[].text_config.placeholder` | string | No | Placeholder for text input |
| `inputs[].text_config.max_length` | number | No | Max character length |
| `execution.processing` | enum | Yes | `"parallel"` or `"batch"` |
| `execution.max_concurrency` | integer | No | Max parallel jobs (default: 5) |
| `execution.model` | string | Yes | LLM model identifier (from `llm_models` table) |
| `execution.temperature` | number | No | LLM temperature (default: 0.7) |
| `execution.max_output_tokens` | number | No | Max output tokens (default: 4096) |
| `execution.max_retries` | integer | No | Validation retry attempts (default: system setting) |
| `knowledge.enabled` | boolean | Yes | Enable RAG context injection |
| `knowledge.query_strategy` | enum | No | `"auto"` or `"custom"` (default: auto) |
| `knowledge.query_template` | string | No | Custom RAG query template |
| `knowledge.max_chunks` | integer | No | Max chunks to inject (default: 10) |
| `knowledge.similarity_threshold` | number | No | Min similarity (default: 0.7) |
| `prompt` | string | Yes | LLM prompt template (multiline YAML block) |
| `output.format` | enum | Yes | `"markdown"` or `"json"` (mutually exclusive) |
| `output.filename_template` | string | Yes | Output file naming pattern |
| `output.sections` | object[] | Conditional | Required when format=markdown. Ignored when format=json. |
| `output.json_schema` | object | Conditional | Required when format=json. Ignored when format=markdown. |

### 1.3 Prompt Variable Injection

The platform assembles the final LLM payload by replacing variables in the `prompt` field:

| Variable | Source | Description |
|----------|--------|-------------|
| `{input_name}` | User-provided input | Replaced with file content or text value. Variable name matches `inputs[].name`. |
| `{knowledge_context}` | RAG query result | Replaced with retrieved knowledge chunks (if `knowledge.enabled: true`). |
| `{subject_name}` | Current subject file | Original filename of the subject being processed. |

**Assembly rules:**
1. For each `context` input: read file content or text value, inject into `{input_name}` placeholder
2. For each `subject` input: read file content, inject into `{input_name}` placeholder
3. If `knowledge.enabled`: run similarity search scoped to tenant, inject top chunks into `{knowledge_context}`
4. The assembled prompt string is sent to the LLM via `LLMProvider.generate()`
5. **No transformation** — the YAML prompt section plus injected content IS the full LLM message

### 1.4 Admin Workflow Builder Wizard Flow

The admin does NOT write YAML directly. The Workflow Studio wizard (Epic 3) provides a step-by-step form that produces the YAML behind the scenes:

| Step | Wizard Section | What the Admin Does |
|------|---------------|---------------------|
| 1 | **Metadata** | Fills in name, description, tags |
| 2 | **Inputs** | Clicks "Add Input" for each input. Configures: name, label, role (context/subject dropdown), source types (checkboxes), required toggle, file restrictions, text config. Repeat for each input. |
| 3 | **Execution** | Selects processing mode (parallel/batch), picks LLM model (dropdown from `llm_models` table), sets temperature, max output tokens, max retries |
| 4 | **Knowledge** | Toggles RAG on/off, configures query strategy, similarity threshold, max chunks |
| 5 | **Prompt** | Large text area. Admin pastes their full instruction set (MD-based algorithms, multi-step procedures, examples). Uses `{input_name}` placeholders matching Step 2 input names. |
| 6 | **Output** | Selects format (markdown/json). For markdown: adds required/optional section names. For json: provides JSON Schema. Sets filename template. |

**Output sections (Step 6) are defined separately from the prompt (Step 5).** The prompt tells the LLM what to produce. Step 6 tells the platform what to validate. They should align, but they serve different purposes.

**Optional power-user feature (future enhancement):** "Import YAML" button that lets advanced users paste a raw YAML workflow definition to bootstrap the wizard fields. Not required for MVP but noted for convenience.

> **UX RULE (applies to all wizard steps and all admin/user UI):** Every non-obvious field, button, or configuration option MUST have an info tooltip (`i` icon with hover explanation). This applies to: wizard fields, execution config, chain builder controls, system settings, and run form fields. This is a general UX requirement for the entire platform, not just the workflow builder.

---

## 2. Input Role Taxonomy

### 2.1 Context Inputs

**Purpose:** Shared reference material that provides background for the analysis. Included in EVERY job when processing multiple subject files.

**Characteristics:**
- Role: `"context"`
- Sources: `"asset"` (pick from data vault), `"upload"` (new file), `"text"` (free-form)
- Cardinality: exactly 1 value per input per run (one codebook, one research goal)
- Behavior: content injected into prompt via `{input_name}` variable

### 2.2 Subject Inputs

**Purpose:** The primary items being analyzed. Subject inputs determine the execution pattern.

**Characteristics:**
- Role: `"subject"`
- Sources: typically `"upload"` (new files to analyze)
- Cardinality: 1 or more files provided by the user at runtime
- Behavior: determines number of BullMQ jobs

**Constraint:** A workflow MUST have exactly ONE subject input definition. Having zero or multiple subject inputs is invalid.

### 2.3 Execution Pattern Derivation

The execution pattern is derived from the `execution.processing` field combined with how many subject files the user provides:

| `execution.processing` | User provides 1 file | User provides N files |
|------------------------|---------------------|-----------------------|
| `"parallel"` | 1 BullMQ job | N parallel BullMQ jobs (1 per file) |
| `"batch"` | 1 BullMQ job | 1 BullMQ job (all files as context) |

**Fan-out (parallel):** Each job receives ALL context inputs + ONE subject file. Jobs run concurrently up to `max_concurrency`.

**Fan-in (batch):** One job receives ALL context inputs + ALL subject files concatenated. The prompt must be designed to handle multiple subjects.

---

## 3. Workflow Chain Composition

### 3.1 Chain Definition Schema

A chain links atomic workflows sequentially. It is metadata only — no file uploads, no prompt editing. The chain is built via the Chain Builder UI, not by writing YAML files.

```yaml
# ==================================================
# WORKFLOW CHAIN DEFINITION
# Stored in workflow_chains.definition (JSONB)
# Produced by the Chain Builder UI, NOT hand-written.
# ==================================================

metadata:
  name: "full-qualitative-analysis"
  description: "Analyze transcripts then consolidate findings"

steps:
  - workflow_id: "uuid-of-analyze-transcript"    # Reference to atomic workflow
    alias: "analyze"                             # Short name for referencing
    # No input_mapping for first step — inputs come from user at runtime

  - workflow_id: "uuid-of-consolidate-reports"
    alias: "consolidate"
    input_mapping:
      # Maps this step's inputs to sources
      reports:                                   # Input name in consolidate workflow
        from_step: "analyze"                     # Alias of previous step
        from_output: "outputs"                   # "outputs" = all output assets from that step
      consolidation_format:                      # Context input unique to this step
        from_chain_config: true                  # Value provided at chain definition time
        value: "executive-summary"               # Fixed value set by admin when building chain
```

### 3.2 Chain Execution Flow

1. User initiates chain run -> provides inputs for Step 0 (first workflow) + any runtime chain inputs
2. Platform runs Step 0 as normal atomic workflow
3. Step 0 completes -> outputs stored as assets (`source_type: workflow_output`)
4. Chain orchestrator reads `input_mapping` for Step 1
5. Step 1's mapped inputs are populated from their designated sources
6. Step 1 runs -> outputs stored
7. Repeat until all steps complete

### 3.3 Chain Input Mapping Rules

Each input for Step 1+ can come from one of three sources:

| Source | Schema | Description |
|--------|--------|-------------|
| **Previous step outputs** | `from_step: "alias", from_output: "outputs"` | Maps ALL output assets from the referenced step as subject files |
| **Inherited from chain initial inputs** | `from_step: "initial", from_input: "input_name"` | Reuses a value the user provided for Step 0 (if input names match) |
| **Fixed at chain definition time** | `from_chain_config: true, value: "..."` | Admin provides a fixed value when building the chain (not at runtime). For text values or asset references. |
| **Runtime (user-provided)** | No mapping entry | Input appears in the chain run form for the user to provide |

**Key rules:**
- No file uploads in chain builder — chain builder only shows workflow boxes, connections, and fixed-value fields
- Intermediate outputs visible — users can inspect/download outputs between steps after the chain completes
- Each step's inputs are explicitly mapped — no implicit inheritance by default. The chain builder UI shows all required inputs for each step and forces the admin to specify the source for each one.

### 3.4 Context Input Inheritance

Context input inheritance is NOT automatic. When building a chain, the admin explicitly maps each input for Step 1+. The Chain Builder UI shows:

1. All required inputs for each workflow step
2. For each input, a dropdown: "Where does this come from?"
   - Previous step outputs (for subject inputs)
   - Same-named input from Step 0 (convenient shortcut, admin confirms)
   - Fixed value (admin types/selects at chain build time)
   - User provides at runtime

This avoids the ambiguity of automatic inheritance. If WorkflowA needs `codebook` and WorkflowB also needs `codebook`, the admin explicitly says "WorkflowB's codebook comes from the same input as WorkflowA's." If WorkflowB needs a different context input (`consolidation_format`), the admin provides it at chain definition time or marks it for runtime input.

---

## 4. Output Specification & Validation

### 4.1 Output Storage

Every workflow run produces output files stored as assets:

```typescript
// Stored in existing AssetEntity with additional fields
{
  tenantId: "...",
  originalName: "analysis-interview-01-2026-02-01T10-30.md",  // from filename_template
  storagePath: "workflows/{run_id}/{output_filename}",
  mimeType: "text/markdown",                                   // or application/json
  fileSize: ...,
  sha256Hash: "...",
  isIndexed: false,
  status: "active",
  uploadedBy: "{user_id_who_started_run}",
  sourceType: "workflow_output",                                // NEW field on AssetEntity
  workflowRunId: "uuid-of-the-run",                            // NEW field on AssetEntity
}
```

### 4.2 Structural Validation with Automatic Retry

After the LLM returns a response, the platform validates structure — NOT content quality. If validation fails, the platform **automatically retries** with a correction prompt rather than passing a broken report to the user.

**For `format: "markdown"`:**
1. Parse output as markdown
2. For each `sections[].required: true`, check that a heading matching `sections[].label` exists
3. If all required sections present -> validation PASSES -> store output
4. If any required section is missing -> RETRY (see retry flow below)

**For `format: "json"`:**
1. Parse output as JSON (if parse fails -> RETRY)
2. Validate against `output.json_schema` using JSON Schema validation
3. If validation passes -> store output
4. If validation fails -> RETRY (see retry flow below)

**Retry Flow:**
1. Validation fails -> platform constructs a correction prompt:
   ```
   Your previous output was missing the following required sections: [list of missing sections].
   Please regenerate the COMPLETE output including ALL required sections.
   Here is the output specification you must follow: [output.sections from workflow definition]
   Previous output for reference:
   [previous LLM output]
   ```
2. Send correction prompt to LLM (same model, same context)
3. Validate again
4. Repeat up to `execution.max_retries` times (default: 2, configurable per-workflow and system-wide)
5. If still failing after all retries:
   - Store the **best attempt** (last output)
   - Mark with `validation_warning` flag
   - Show to user WITH a visible banner: "Output may be incomplete — sections [X, Y] were not generated as expected. You can re-run this workflow."
   - The user gets a report, not an error page

**Retry count configuration:**
- **System default:** Configured in System Settings (LLM Configuration panel) — `LLM_VALIDATION_RETRY_COUNT` (default: 2)
- **Per-workflow override:** In the wizard's Execution config step (Step 3), an optional "Max validation retries" field with info tooltip: "Number of times the platform will automatically retry if the LLM output doesn't match the expected structure. Higher values increase reliability but also cost and latency."

---

## 5. Context Window Token Budget

### 5.1 Pre-Execution Check

Before creating BullMQ jobs, the platform calculates token budget per job:

```
total_tokens_per_job =
    tokens(prompt_template)
  + tokens(all_context_inputs)
  + tokens(subject_file)                    # for parallel: 1 file; for batch: all files
  + tokens(knowledge_chunks)                # estimated based on max_chunks setting
  + execution.max_output_tokens             # reserved for output
```

### 5.2 Token Estimation & Model Management

- Use a simple character-based estimator: `tokens ~ characters / 4` (conservative for English text)
- Model context limits are **DB-driven**, not hardcoded (see Section 5.4 LLM Model Management)
- Hardcoded fallback defaults exist only for bootstrap (first startup before admin configures models)

### 5.3 Over-Budget Handling

If `total_tokens_per_job > model_context_limit`:

1. Platform calculates which files push the budget over
2. Returns a `TOKEN_BUDGET_EXCEEDED` response to the UI with:
   - Total estimated tokens
   - Per-file token breakdown (sorted largest first)
   - Model context limit
3. UI shows interactive file selection: user can deselect files until under budget
4. User clicks "Run" again with reduced file set
5. **No silent rejection.** No automatic file removal.

### 5.4 LLM Model Management

Model configuration is **database-driven and admin-managed**, not hardcoded.

#### LlmModelEntity

```
Table: llm_models
Purpose: Registry of available LLM models with their capabilities and limits.
RLS: No (system-wide configuration, not tenant-scoped)

Columns:
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  provider_key    VARCHAR(50) NOT NULL      -- e.g., 'google-ai-studio', 'vertex', 'mock'
  model_id        VARCHAR(100) NOT NULL     -- API model identifier, e.g., 'models/gemini-2.0-flash'
  display_name    VARCHAR(100) NOT NULL     -- Human-readable, e.g., 'Gemini 2.0 Flash'
  context_window  INTEGER NOT NULL          -- Max input tokens
  max_output_tokens INTEGER NOT NULL        -- Max output tokens
  is_active       BOOLEAN DEFAULT true      -- Whether available for workflow selection
  cost_per_1k_input  DECIMAL(10,6)          -- Optional. For cost tracking.
  cost_per_1k_output DECIMAL(10,6)          -- Optional. For cost tracking.
  created_at      TIMESTAMP DEFAULT now()
  updated_at      TIMESTAMP DEFAULT now()

Unique constraint: (provider_key, model_id)
```

#### Provider Architecture

```
Coded Providers (require development to add new ones):
  google-ai-studio  -> GoogleAIStudioLlmProvider   (free tier, for admin testing)
  vertex             -> VertexLlmProvider           (production, paid)
  mock               -> MockLlmProvider             (unit tests, deterministic)
  (future)           -> ClaudeLlmProvider, OpenAILlmProvider, etc.

Each provider:
  - Implements LLMProvider interface (hexagonal pattern)
  - Knows its API auth, request format, error handling
  - Registered via LLM_PROVIDER env var or per-model in llm_models table
```

#### Adding New Models

**Same provider (e.g., Google releases Gemini 4):** No code needed.
1. Admin opens System Settings -> LLM Models
2. Clicks "Add Model"
3. Fills in: display name, API model ID (from Google's docs), context window, max output tokens, provider (dropdown of coded providers), cost
4. Model appears in workflow builder's model dropdown immediately

Info tooltip on "Add Model" button: "To add a model from an existing provider, enter its API model ID (found in the provider's documentation), context window size, and max output tokens. The model will be available for workflow selection immediately."

**New provider (e.g., adding Anthropic Claude):** Code required.
1. Implement new `LlmProvider` class extending the `LLMProvider` interface
2. Deploy updated code
3. New provider_key appears in the admin UI
4. Admin adds models for the new provider via UI

**Initial seeded models (on first startup):**

| Provider | Model ID | Display Name | Context Window |
|----------|----------|-------------|----------------|
| google-ai-studio | models/gemini-2.0-flash | Gemini 2.0 Flash | 1,000,000 |
| google-ai-studio | models/gemini-2.0-pro | Gemini 2.0 Pro | 1,000,000 |
| vertex | gemini-2.0-flash | Gemini 2.0 Flash (Vertex) | 1,000,000 |
| vertex | gemini-2.0-pro | Gemini 2.0 Pro (Vertex) | 1,000,000 |
| mock | mock-model | Mock LLM (Testing) | 1,000,000 |

---

## 6. Database Entity Design

> **REVIEWED:** Party mode review completed 2026-02-02 with full team (Architect Winston, TEA Murat, Dev Amelia). 10 findings applied — see implementation notes in §6.7.

### 6.1 WorkflowTemplateEntity

```
Table: workflow_templates
Purpose: Container for a workflow definition. Points to current active version.
RLS: Yes (tenant_id)

Columns:
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       UUID NOT NULL              -- RLS scoped. Admin tenant for global templates.
  name            VARCHAR(255) NOT NULL
  description     TEXT
  visibility      ENUM('public','private') DEFAULT 'public'
  allowed_tenants UUID[]                     -- Only when visibility='private'
  status          ENUM('draft','published','archived') DEFAULT 'draft'
  current_version_id UUID                    -- FK to workflow_versions.id
  created_by      UUID NOT NULL              -- FK to users.id
  created_at      TIMESTAMP DEFAULT now()
  updated_at      TIMESTAMP DEFAULT now()
  deleted_at      TIMESTAMP                  -- Soft delete (FR42)
```

**Notes:**
- `visibility` + `allowed_tenants` implements workflow-centric access control (design decision from Story 1.5)
- `tenant_id` is the OWNING tenant (Bubble Admin's admin tenant for global templates)
- `deleted_at` supports soft-delete per FR42 — use TypeORM `@DeleteDateColumn` decorator (not raw `@Column`) for automatic soft-delete integration with `.softDelete()` / `.restore()` repository methods
- **Custom RLS policy required** (see §6.6) — standard `tenant_isolation` policy would block tenant access to public templates. Custom policy must allow: `tenant_id = current_tenant OR visibility = 'public' OR current_tenant = ANY(allowed_tenants)`
- **Indexes:** `(status, visibility)` composite index for template discovery queries; `(tenant_id)` covered by RLS

### 6.2 WorkflowVersionEntity

```
Table: workflow_versions
Purpose: Immutable snapshot of a workflow definition at a point in time.
RLS: Yes (tenant_id)

Columns:
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       UUID NOT NULL
  template_id     UUID NOT NULL              -- FK to workflow_templates.id
  version_number  INTEGER NOT NULL           -- Auto-incremented per template
  definition      JSONB NOT NULL             -- The full YAML schema (Section 1.1) stored as JSON
  created_by      UUID NOT NULL
  created_at      TIMESTAMP DEFAULT now()

Unique constraint: (template_id, version_number)
```

**Notes:**
- `definition` stores the parsed YAML as JSONB (YAML parsed to JSON on save, reconstructed for display)
- Immutable — versions are never updated, only new versions created
- Active runs lock to a specific `version_id` (Story 3.6)

### 6.3 WorkflowChainEntity

```
Table: workflow_chains
Purpose: Defines a chain of atomic workflows linked sequentially.
RLS: Yes (tenant_id) — custom policy (same pattern as workflow_templates)

Columns:
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       UUID NOT NULL
  name            VARCHAR(255) NOT NULL
  description     TEXT
  visibility      ENUM('public','private') DEFAULT 'public'   -- ADDED: same as templates
  allowed_tenants UUID[]                     -- ADDED: same as templates
  definition      JSONB NOT NULL             -- The chain definition (Section 3.1)
  status          ENUM('draft','published','archived') DEFAULT 'draft'
  created_by      UUID NOT NULL
  created_at      TIMESTAMP DEFAULT now()
  updated_at      TIMESTAMP DEFAULT now()
  deleted_at      TIMESTAMP                  -- Soft delete
```

**Notes:**
- Chains need `visibility` and `allowed_tenants` for the same reason as templates — an admin-published chain must be accessible to customer tenants
- Use TypeORM `@DeleteDateColumn` for `deleted_at` (same as templates)
- **Custom RLS policy required** — identical pattern to `workflow_templates` (see §6.6)
- **Indexes:** `(status, visibility)` composite index for chain discovery queries

### 6.4 WorkflowRunEntity

```
Table: workflow_runs
Purpose: Tracks a single execution of a workflow or chain.
RLS: Yes (tenant_id)

Columns:
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id       UUID NOT NULL
  version_id      UUID                       -- FK to workflow_versions.id (for atomic runs)
  chain_id        UUID                       -- FK to workflow_chains.id (for chain runs)
  chain_step_index INTEGER                   -- Current step in chain (0-based)
  status          ENUM('queued','running','completed','failed','cancelled') DEFAULT 'queued'
  started_by      UUID NOT NULL              -- FK to users.id
  input_snapshot  JSONB NOT NULL             -- Snapshot of user-provided inputs (asset IDs, text values)
  output_asset_ids UUID[]                    -- References to output assets
  assembled_prompt TEXT                      -- Full prompt after variable injection (for admin debugging)
  raw_llm_response TEXT                      -- Raw LLM response before validation (for admin debugging)
  retry_history   JSONB                      -- Array of { attempt, prompt_delta, response, validation_result }
  error_message   TEXT                       -- Set when status='failed'
  validation_warnings TEXT[]                 -- Structural validation warnings
  token_usage     JSONB                      -- { prompt_tokens, completion_tokens, total_tokens }
  model_id        UUID                       -- FK to llm_models.id (which model was used)
  credits_consumed INTEGER DEFAULT 0         -- Credits used for this run
  started_at      TIMESTAMP
  completed_at    TIMESTAMP
  duration_ms     INTEGER                    -- Total execution time in milliseconds
  created_at      TIMESTAMP DEFAULT now()

Check constraint: version_id IS NOT NULL OR chain_id IS NOT NULL
```

**Notes:**
- `model_id` FK tracks which LLM model was used — essential for cost analysis and debugging
- `output_asset_ids UUID[]` is a convenience cache for quick listing; the authoritative FK is `assets.workflow_run_id` pointing back to this run. Both must be kept in sync.
- `assembled_prompt` and `raw_llm_response` stored as TEXT in same table for MVP. At scale, consider moving to a separate `workflow_run_details` table or external storage (S3) if row size becomes a concern.
- **Indexes:** `(status)` for queue processing queries, `(started_by)` for user history, `(chain_id, chain_step_index)` for chain step lookups, `(tenant_id, created_at DESC)` for tenant run history

### 6.5 AssetEntity Extension

Add two nullable columns to the existing `assets` table:

```
New columns on assets table:
  source_type     VARCHAR(50) DEFAULT 'user_upload'   -- 'user_upload' | 'workflow_output'
  workflow_run_id UUID                                 -- FK to workflow_runs.id (when source_type='workflow_output')
```

### 6.6 RLS Registration

Add to `tenantScopedTables` in `rls-setup.service.ts`:

```typescript
private readonly tenantScopedTables = [
  'users',
  'invitations',
  'assets',
  'folders',
  'knowledge_chunks',
  'workflow_versions',     // NEW — standard tenant_isolation policy
  'workflow_runs',         // NEW — standard tenant_isolation policy
];
```

**Tables with custom RLS policies** (NOT in `tenantScopedTables` — custom methods instead):

```typescript
// workflow_templates and workflow_chains need custom policies
// that allow access when visibility='public' OR tenant is in allowed_tenants.
// Standard tenant_isolation would block public template access.

// Custom policy SQL (created in RlsSetupService):
CREATE POLICY template_access ON workflow_templates
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR visibility = 'public'
    OR current_setting('app.current_tenant', true)::uuid = ANY(allowed_tenants)
  );

// Same pattern for workflow_chains:
CREATE POLICY chain_access ON workflow_chains
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR visibility = 'public'
    OR current_setting('app.current_tenant', true)::uuid = ANY(allowed_tenants)
  );
```

**Tables excluded from RLS:**
- `llm_models` — system-wide configuration, not tenant-scoped. No `tenant_id` column. Accessed by all services directly without `TransactionManager`. Must be documented in `project-context.md` alongside `TenantsService` exemption.

### 6.7 Implementation Notes (from Party Mode Review)

1. **`@DeleteDateColumn` for soft-delete:** Use TypeORM's `@DeleteDateColumn({ name: 'deleted_at' })` on `WorkflowTemplateEntity` and `WorkflowChainEntity` instead of raw `@Column`. This enables `.softDelete()` / `.restore()` repository methods and automatic `WHERE deleted_at IS NULL` filtering. Note: existing `KnowledgeChunkEntity` uses raw `@Column` for `deleted_at` — consider migrating to `@DeleteDateColumn` in a future hardening story for consistency.

2. **`allowed_tenants UUID[]` scaling:** Array columns are acceptable for MVP. If the number of tenant-specific visibility rules grows beyond ~100 entries per template, migrate to a junction table (`workflow_template_tenants(template_id, tenant_id)`). This is a schema-only change — the custom RLS policy would reference the junction table instead of the array.

3. **`output_asset_ids UUID[]` redundancy:** This array on `WorkflowRunEntity` is a denormalized convenience cache. The authoritative relationship is the `workflow_run_id` FK on `AssetEntity`. Both must be kept in sync during output asset creation. The array enables quick listing without a JOIN.

4. **Large TEXT columns on `WorkflowRunEntity`:** `assembled_prompt` and `raw_llm_response` can be very large (100K+ chars for complex workflows). For MVP, storing as TEXT in the same row is acceptable. At scale (10K+ runs), consider:
   - Moving to a separate `workflow_run_details` table (1:1 FK) to keep the main runs table lean for status queries
   - Or external storage (S3) with a reference URL

5. **`LlmModelEntity` is NOT tenant-scoped:** This is a system-wide model registry table with no `tenant_id` column, no RLS policy, and no `TransactionManager` usage. It follows the same exemption pattern as `TenantsService`. Must be documented in `project-context.md`.

---

## 7. Execution Engine Design (Epic 4 Reference)

### 7.1 Job Creation Flow (with Pre-Checks)

```
User clicks "Run"
  -> API validates inputs (all required inputs provided, file types match accept config)
  -> CREDIT PRE-CHECK:
     - Calculate credits_needed (fan-out: N files = N credits; batch: 1 credit; chain: sum of all steps)
     - Query tenant's available credits (from entitlements)
     - If credits_needed > credits_available:
       -> Return INSUFFICIENT_CREDITS with:
          - credits_needed, credits_available
          - Per-file breakdown (for fan-out: user can reduce file count)
       -> No jobs created. User decides what to do.
  -> TOKEN BUDGET CHECK:
     - Calculate total_tokens_per_job (Section 5.1)
     - If over budget -> return TOKEN_BUDGET_EXCEEDED (Section 5.3)
  -> Creates WorkflowRun record (status: queued)
  -> if parallel: creates N BullMQ jobs (1 per subject file)
  -> if batch: creates 1 BullMQ job (all subject files)
  -> Returns { runId, status: 'queued' }
```

### 7.2 Job Payload Schema

```typescript
interface WorkflowJobPayload {
  runId: string;
  tenantId: string;
  versionId: string;
  definition: WorkflowDefinition;   // Frozen copy of the YAML definition
  contextInputs: {
    [inputName: string]: {
      type: 'file' | 'text';
      assetId?: string;             // For file inputs
      content?: string;             // For text inputs (pre-loaded)
      storagePath?: string;         // For file inputs (to load content)
    };
  };
  subjectFile: {                    // For parallel: 1 file per job
    assetId?: string;
    originalName: string;
    storagePath: string;
  };
  // OR for batch:
  subjectFiles: Array<{
    assetId?: string;
    originalName: string;
    storagePath: string;
  }>;
  knowledgeContext?: string;         // Pre-fetched RAG chunks (if enabled)
}
```

### 7.3 Chain Orchestration

For chain runs, the platform uses BullMQ `FlowProducer`:

```
1. Create parent flow job for the chain
2. Add Step 0 jobs as children (atomic workflow execution)
3. On Step 0 completion callback:
   a. Collect output asset IDs
   b. Read Step 1 input_mapping from chain definition
   c. Build Step 1 input snapshot (mapped outputs + inherited context + chain config values)
   d. Check credits for Step 1 (deduct from pre-reserved total)
   e. Add Step 1 jobs as next children
4. Repeat until all steps complete
5. Mark chain run as completed
```

---

## 8. Admin Execution Inspector

An admin-only view for debugging and tuning workflow prompts. Critical for the initial testing phase and ongoing prompt optimization.

### 8.1 Run Details View (Admin Only)

Accessible via: Admin Portal -> Workflow Runs -> Run Detail (or via impersonation when viewing tenant runs).

| Section | Content | Purpose |
|---------|---------|---------|
| **Summary** | Run ID, workflow name, version, status, started by, timestamps, duration | Quick overview |
| **Assembled Prompt** | Full prompt after variable injection (stored in `assembled_prompt` column) | See exactly what was sent to the LLM |
| **Raw LLM Response** | Complete LLM output before any validation (stored in `raw_llm_response` column) | See exactly what the LLM returned |
| **Validation Result** | Pass/fail status, which sections matched, which were missing | Understand validation behavior |
| **Retry History** | Each retry attempt: correction prompt sent, LLM response, validation result | Debug retry effectiveness |
| **Token Usage** | Prompt tokens, completion tokens, total tokens, model used | Cost tracking and context window utilization |
| **Timing** | Queue wait time, LLM call duration, validation time, total duration | Performance insights |
| **Input Files** | List of all input files with sizes, token estimates, source (asset/upload/text) | Understand context composition |
| **Credit Usage** | Credits consumed for this run | Cost tracking |

### 8.2 Implementation Notes

- Stored in `WorkflowRunEntity` columns: `assembled_prompt`, `raw_llm_response`, `retry_history`, `token_usage`, `duration_ms`
- Admin-only access: behind `BUBBLE_ADMIN` role guard
- For chain runs: each step has its own run record — inspector shows full chain with step-by-step details
- Data retention: consider configuring TTL for debug data (`assembled_prompt`, `raw_llm_response`) to manage storage — deferred to Epic 7

---

## Context for Development

### Codebase Patterns

1. **Hexagonal AI Provider Pattern** — `EmbeddingProvider` interface in `apps/api-gateway/src/app/ingestion/embedding.provider.ts` with factory-based injection via `ConfigService`. `LLMProvider` will follow the same pattern with `LLM_PROVIDER` env var.
2. **BullMQ Queue Pattern** — `IngestionService` creates jobs via `@InjectQueue('ingestion')`, `IngestionProcessor` (extends `WorkerHost`) executes them. Retry/backoff configured at queue registration. Same pattern reused for workflow execution queue.
3. **TransactionManager** — All tenant-scoped DB ops use `txManager.run(tenantId, callback)` with automatic RLS via `SET LOCAL app.current_tenant`. Overloaded signatures (explicit tenantId or read from AsyncLocalStorage).
4. **Shared DTOs** — All DTOs live in `libs/shared/src/lib/dtos/{domain}/`. Use `class-validator` decorators, `@ApiProperty` for Swagger, barrel file exports. Frontend and backend share exact same classes.
5. **Asset Storage** — `AssetEntity` with `tenantId`, `storagePath`, `status` enum, `isIndexed` flag. New workflow output fields (`sourceType`, `workflowRunId`) extend this entity.
6. **Entity Pattern** — UUID primary keys via `@PrimaryGeneratedColumn('uuid')`, `tenant_id` column, `@CreateDateColumn`/`@UpdateDateColumn`, enum-based status columns. Feature modules register via `TypeOrmModule.forFeature([Entity])`.
7. **RLS Setup** — `RlsSetupService.tenantScopedTables` array. New tables added here get automatic `tenant_isolation_{table}` policy on startup. BUBBLE_ADMIN bypasses RLS via `bypassRls` flag in `TenantContext`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `apps/api-gateway/src/app/ingestion/embedding.provider.ts` | Hexagonal provider interface pattern (mirror for LLMProvider) |
| `apps/api-gateway/src/app/ingestion/embedding.service.ts` | Provider implementations with factory injection |
| `apps/api-gateway/src/app/ingestion/ingestion.module.ts` | BullMQ queue registration + provider factory |
| `apps/api-gateway/src/app/ingestion/ingestion.service.ts` | Job creation + processing pipeline |
| `apps/api-gateway/src/app/ingestion/ingestion.processor.ts` | BullMQ processor (WorkerHost pattern) |
| `libs/db-layer/src/lib/entities/asset.entity.ts` | AssetEntity (extend with workflow output fields) |
| `libs/db-layer/src/lib/entities/knowledge-chunk.entity.ts` | JSONB metadata + embeddings pattern |
| `libs/db-layer/src/lib/entities/index.ts` | Entity barrel exports |
| `libs/db-layer/src/lib/rls-setup.service.ts` | RLS table registration |
| `libs/db-layer/src/lib/transaction-manager.ts` | TransactionManager (overloaded run signatures) |
| `libs/shared/src/lib/dtos/knowledge/create-validated-insight.dto.ts` | Complex DTO pattern with enums |
| `libs/shared/src/lib/dtos/asset/asset-response.dto.ts` | Response DTO pattern |
| `_bmad-output/planning-artifacts/architecture.md` | Architecture constraints (workflow versioning, queue design) |
| `project-context.md` | Section 5: Workflow Execution Architecture decisions |
| `HANDOVER.md` | Section 5: 17 party mode decisions |

### Technical Decisions

1. **LangGraph.js DEFERRED** — MVP uses LLM-orchestrated execution. YAML prompts sent directly to LLM.
2. **YAML IS the prompt** — No transformation layer. YAML goes to LLM as-is. Platform handles assembly only.
3. **Atomic workflows** — Each workflow = 1 LLM call pattern. Clear inputs, clear outputs.
4. **Workflow chains** — Link atomic workflows sequentially. Output of A -> input of B. Metadata-only.
5. **Input roles** — `context` (shared) vs `subject` (processed, determines execution pattern).
6. **Fan-out** — `processing: parallel` -> N BullMQ jobs, 1 per subject file.
7. **Fan-in** — `processing: batch` -> 1 BullMQ job with all subject files.
8. **Workflow outputs = assets** — Stored with `source_type: workflow_output`, linked to `workflow_run_id`.
9. **Chain orchestrator** — BullMQ `FlowProducer` watches step completion, triggers next step.
10. **Structural output validation with retry** — Platform validates required sections, retries automatically up to N times with correction prompt, then shows best attempt with warning if still failing.
11. **Context window** — Pre-execution token count per job. Interactive file selection UI if over limit.
12. **Prompt responsibility** — Platform = infrastructure. Prompt quality = Bubble's IP.
13. **YAML stored as JSONB** — Parsed on save, reconstructed for display. Enables querying/indexing.
14. **Single subject input constraint** — Exactly 1 subject input per workflow. Simplifies execution engine.
15. **Workflow-centric visibility** — `public`/`private` + `allowedTenants` on template entity (Story 1.5 decision).
16. **DB-driven LLM model management** — `llm_models` table with admin UI. Same-provider models added via UI without code. New providers require coded adapter.
17. **Credit pre-check** — Before job creation, verify tenant has sufficient credits. Return `INSUFFICIENT_CREDITS` with breakdown if not.
18. **Admin Execution Inspector** — Assembled prompt, raw response, validation result, retry history, token usage stored per run for debugging.
19. **Explicit chain input mapping** — No automatic context inheritance. Admin explicitly maps each chain step input in the Chain Builder UI.
20. **Info tooltips on all UI** — Every non-obvious field/button has an `i` icon hover explanation across all admin and user interfaces.

---

## Implementation Plan

### Tasks

- [ ] Task 1: Create WorkflowTemplateEntity
  - File: `libs/db-layer/src/lib/entities/workflow-template.entity.ts` (NEW)
  - Action: Define entity with columns from Section 6.1. Include `WorkflowTemplateStatus` and `WorkflowVisibility` enums. Add `ManyToOne` relation to `WorkflowVersionEntity` for `currentVersionId`.
  - Notes: `allowed_tenants` as `@Column({ type: 'uuid', array: true, nullable: true })`. `deleted_at` nullable timestamp for soft-delete.

- [ ] Task 2: Create WorkflowVersionEntity
  - File: `libs/db-layer/src/lib/entities/workflow-version.entity.ts` (NEW)
  - Action: Define entity with columns from Section 6.2. `definition` as `@Column({ type: 'jsonb' })`. Unique constraint on `(template_id, version_number)`.
  - Notes: Immutable entity — no `UpdateDateColumn`. `ManyToOne` to `WorkflowTemplateEntity`.

- [ ] Task 3: Create WorkflowChainEntity
  - File: `libs/db-layer/src/lib/entities/workflow-chain.entity.ts` (NEW)
  - Action: Define entity with columns from Section 6.3. Include `WorkflowChainStatus` enum (same values as template status). `definition` as JSONB.
  - Notes: `deleted_at` nullable timestamp for soft-delete.

- [ ] Task 4: Create WorkflowRunEntity
  - File: `libs/db-layer/src/lib/entities/workflow-run.entity.ts` (NEW)
  - Action: Define entity with columns from Section 6.4. Include `WorkflowRunStatus` enum. Relations to version, chain. `input_snapshot`, `token_usage`, `retry_history` as JSONB. `output_asset_ids`, `validation_warnings` as arrays. `assembled_prompt`, `raw_llm_response` as TEXT.
  - Notes: Check constraint `version_id IS NOT NULL OR chain_id IS NOT NULL` applied via `@Check` decorator.

- [ ] Task 5: Create LlmModelEntity
  - File: `libs/db-layer/src/lib/entities/llm-model.entity.ts` (NEW)
  - Action: Define entity with columns from Section 5.4. NOT tenant-scoped (no RLS). Unique constraint on `(provider_key, model_id)`. Seed initial models in `onModuleInit`.

- [ ] Task 6: Extend AssetEntity with workflow output fields
  - File: `libs/db-layer/src/lib/entities/asset.entity.ts` (MODIFY)
  - Action: Add `sourceType` (VARCHAR, default 'user_upload') and `workflowRunId` (UUID, nullable) columns.
  - Notes: Non-breaking — existing assets get default `sourceType: 'user_upload'`. Add `@ManyToOne` to `WorkflowRunEntity` for the FK.

- [ ] Task 7: Register entities and RLS
  - File: `libs/db-layer/src/lib/entities/index.ts` (MODIFY) — Export all new entities and enums
  - File: `libs/db-layer/src/lib/rls-setup.service.ts` (MODIFY) — Add 4 new tables to `tenantScopedTables` (workflow_templates, workflow_versions, workflow_chains, workflow_runs — NOT llm_models)
  - Notes: `autoLoadEntities: true` handles TypeORM registration. RLS policies auto-created on startup.

- [ ] Task 8: Create WorkflowDefinition TypeScript interface
  - File: `libs/shared/src/lib/types/workflow-definition.interface.ts` (NEW)
  - Action: Define typed interface matching YAML schema in Section 1.1. Include all sub-interfaces: `WorkflowInput`, `WorkflowExecution`, `WorkflowKnowledge`, `WorkflowOutput`, `WorkflowOutputSection`.
  - Notes: This is THE schema contract. Builder produces it, engine consumes it.

- [ ] Task 9: Define ChainDefinition TypeScript interface
  - File: `libs/shared/src/lib/types/workflow-chain.interface.ts` (NEW)
  - Action: Define typed interface matching chain schema in Section 3.1. Include `ChainStep`, `InputMapping` (with all three source types: from_step, from_chain_config, runtime).

- [ ] Task 10: Define WorkflowJobPayload interface
  - File: `libs/shared/src/lib/types/workflow-job.interface.ts` (NEW)
  - Action: Define typed interface matching Section 7.2.
  - Notes: Used by job creator (API) and job processor (worker).

- [ ] Task 11: Create workflow DTOs
  - Files: `libs/shared/src/lib/dtos/workflow/` (NEW directory)
  - Action: Create DTOs: `CreateWorkflowTemplateDto`, `UpdateWorkflowTemplateDto`, `WorkflowTemplateResponseDto`, `CreateWorkflowVersionDto`, `WorkflowVersionResponseDto`, `CreateWorkflowChainDto`, `WorkflowChainResponseDto`, `InitiateRunDto`, `WorkflowRunResponseDto`, `TokenBudgetResponseDto`, `InsufficientCreditsResponseDto`, `LlmModelResponseDto`, `CreateLlmModelDto`.
  - Notes: Follow existing DTO patterns. Export via barrel file. Add to `libs/shared/src/lib/dtos/index.ts`.

- [ ] Task 12: YAML schema validation utility
  - File: `libs/shared/src/lib/validators/workflow-schema.validator.ts` (NEW)
  - Action: Validation function that checks a `WorkflowDefinition` object: exactly 1 subject input, all required fields present, valid enum values, input names unique, prompt contains all `{input_name}` variables, output sections defined when format=markdown OR json_schema defined when format=json (mutually exclusive).
  - Notes: Used by both builder UI (client-side validation) and API (server-side validation on save).

### Acceptance Criteria

- [ ] AC 1: Given a valid atomic workflow YAML (Section 1.1), when parsed and stored as JSONB in `workflow_versions.definition`, then it can be retrieved and reconstructed without data loss
- [ ] AC 2: Given a workflow definition with `role: "context"` and `role: "subject"` inputs, when the schema validator runs, then it confirms exactly 1 subject input exists and all inputs have valid roles
- [ ] AC 3: Given `execution.processing: "parallel"` and a user provides 5 subject files, when the execution engine creates jobs, then 5 BullMQ jobs are created — each containing all context inputs plus 1 subject file
- [ ] AC 4: Given `execution.processing: "batch"` and a user provides 5 subject files, when the execution engine creates jobs, then 1 BullMQ job is created containing all context inputs plus all 5 subject files
- [ ] AC 5: Given a workflow chain definition (Section 3.1), when Step 0 completes with 3 output assets, then Step 1 receives those 3 assets as its subject input via `input_mapping`
- [ ] AC 6: Given a chain where Step 1 has a context input mapped via `from_step: "initial"` to Step 0's "codebook" input, when Step 1 runs, then it receives the same codebook value provided by the user for Step 0
- [ ] AC 7: Given a workflow output with `format: "markdown"` and required sections ["themes", "assumptions"], when the LLM output is missing "assumptions", then the platform retries with a correction prompt up to `max_retries` times. If still missing after retries, the output is stored with a `validation_warning` flag and the user sees a banner explaining the issue.
- [ ] AC 8: Given total estimated tokens exceed the model's context limit (from `llm_models` table), when the user initiates a run, then the API returns `TOKEN_BUDGET_EXCEEDED` with per-file token breakdown, and no jobs are created
- [ ] AC 9: Given a completed workflow run, when outputs are stored, then each output is saved as an `AssetEntity` with `sourceType: "workflow_output"` and `workflowRunId` set to the run's ID
- [ ] AC 10: Given new workflow entities (templates, versions, chains, runs), when queries are executed, then RLS enforces tenant isolation via `tenant_id = current_setting('app.current_tenant')`
- [ ] AC 11: Given a tenant with 20 credits and a fan-out run requiring 21 credits, when the user initiates the run, then the API returns `INSUFFICIENT_CREDITS` with credits_needed=21 and credits_available=20, and no jobs are created
- [ ] AC 12: Given an admin adds a new model via System Settings (display name, API model ID, context window, provider), when the model is saved, then it appears in the workflow builder's model dropdown and is used for token budget calculations
- [ ] AC 13: Given a completed workflow run, when an admin views the Run Details, then they see the assembled prompt, raw LLM response, validation result, retry history, token usage, and timing data

## Additional Context

### Dependencies

- **Epic 2 complete** — AssetEntity, KnowledgeChunkEntity, embedding pipeline, knowledge search in place (406 tests)
- **BullMQ 5.66.5** — Already installed, supports FlowProducer for chain orchestration
- **TypeORM with synchronize:true** — New entities auto-create tables in dev (migrations for production in Epic 7)
- **No new npm packages required** — All dependencies already installed
- **architecture.md** — Defines workflow versioning strategy (`workflow_versions` table, `current_version_id` pointer)

### Testing Strategy

- **Schema Validator Unit Tests:** Valid/invalid definitions, edge cases (missing subject, duplicate names, invalid enums, missing prompt variables, mutually exclusive output format)
- **Entity Unit Tests:** Entity creation, JSONB storage/retrieval, enum constraints, relation integrity
- **DTO Validation Tests:** All workflow DTOs with `plainToInstance` + `validate` from class-validator
- **Token Budget Calculator Tests:** Token estimation accuracy, over-budget detection, per-file breakdown generation, model limit lookup from DB
- **Chain Resolution Tests:** Input mapping resolution (all three source types), step sequencing logic
- **Credit Pre-Check Tests:** Sufficient/insufficient credits, fan-out credit calculation, chain credit calculation
- **Validation Retry Tests:** Successful retry, exhausted retries, retry history recording
- **Integration Tests (Epic 4):** End-to-end: run initiation -> credit check -> token check -> job creation -> LLM call -> validation -> retry -> output storage -> chain step progression

### Notes

- **This spec is a GATE document** — not a story. It defines the schema contract. Actual implementation happens in Epic 3 (builder UI) and Epic 4 (execution engine) stories.
- **Admin does NOT write YAML** — The Workflow Studio wizard (Section 1.4) provides a step-by-step form. YAML is the internal storage format produced by the wizard.
- **YAML stored as JSON** — The wizard produces a `WorkflowDefinition` object. Stored as JSONB. YAML is the conceptual format for documentation/discussion.
- **Prompt is NOT transformed** — The `prompt` field content is injected with variable values and sent to the LLM as-is. Platform does NOT add system messages, formatting, or instructions beyond what's in the definition.
- **Schema versioning is implicit** — The TypeScript `WorkflowDefinition` interface IS the schema version. If the schema evolves, the interface evolves with a migration path for existing definitions.
- **Single subject input constraint** — Exactly 1 subject input per workflow. Multiple analysis targets = separate atomic workflows chained together.
- **Global templates** — Bubble Admin creates templates with `visibility: "public"` under admin tenant. BUBBLE_ADMIN role bypasses RLS for cross-tenant template reads.
- **Output sections are separate from prompt** — The prompt tells the LLM what to produce. The output config tells the platform what to validate. They should align but serve different purposes (Section 1.4, Step 5 vs Step 6).
- **Output validation is top-level only (MVP)** — Step 6 captures top-level section names for basic heading-exists validation. Complex nested structures, repeating patterns, table column definitions, and conditional sections are enforced by the prompt itself, not the platform validator. The prompt is the primary structural contract; the platform catches gross failures (missing entire sections). A richer output schema with nested/repeating/conditional validation is a future enhancement if needed — may not be necessary if prompts produce consistent results.
- **Info tooltips everywhere** — All non-obvious UI elements across the entire platform (admin, tenant admin, user) must have `i` icon hover explanations.

### Concrete Example: Qualitative Data Analysis Chain

**WorkflowA: analyze-transcript**
- Context: codebook (asset), research_goal (asset|upload|text)
- Subject: transcript (upload, processing: parallel)
- Output: individual analysis report per transcript (markdown)

**WorkflowB: consolidate-reports**
- Context: codebook (from Step 0 via explicit mapping), executive_summary_style (fixed at chain config: "academic")
- Subject: reports (from WorkflowA outputs, processing: batch)
- Output: consolidated findings report (markdown)

**Chain: full-qualitative-analysis**
- Step 0: analyze-transcript -> user provides codebook + research_goal + N transcripts
- Step 1: consolidate-reports -> auto-receives N reports as subject; codebook explicitly mapped from Step 0; executive_summary_style fixed as "academic" at chain build time
- Result: user uploads files once, gets individual analyses AND consolidated report

---

## Future Considerations

### Confidence Scoring (Post-MVP)

A lightweight quality assurance mechanism to explore after MVP delivery:

- **Concept:** After a workflow produces output, a fast/cheap LLM model (e.g., Gemini Flash) scores the output on completeness and coherence (0-100 score)
- **Flagging:** Green (>80), Yellow (50-80), Red (<50)
- **Action:** Red-flagged reports could trigger automatic re-run, Yellow flagged visible to user with note, Green passes through
- **Cost consideration:** Uses cheapest model available, ~10% of main workflow cost per score
- **Decision:** This is an EXPLORE item — needs detailed analysis on cost/benefit, user perception, and implementation complexity before committing to build
- **Tracking:** Add as Epic 8+ candidate or dedicated exploration spike

### Rich Output Schema Validation (Post-MVP, If Needed)

If top-level section validation proves insufficient for complex report structures (nested sections, repeating segment-specific patterns, table column enforcement, conditional sections), consider a richer `output` schema supporting:
- Nested section definitions with depth
- Repeating patterns (`repeat_for: "dynamic_count"`)
- Table column definitions (`columns: [name, type, required]`)
- Conditional sections (`condition: "if_insights_exist"`)

**Decision:** Only pursue if prompt-driven structure enforcement proves unreliable in production use. May never be needed.

### Admin Manual (Post-MVP)

After MVP delivery (Epics 1-7 complete), produce a comprehensive admin manual documenting:
- All menus, pages, and navigation flows
- Configuration options with explanations
- Workflow builder wizard walkthrough
- Chain builder walkthrough
- System settings reference
- Troubleshooting guide

Can be generated using the BMAD `tech-writer` agent as a documentation sprint.
