# 📋 Handover Protocol: Session Close (2026-01-15)

**To:** Incoming Architect
**From:** Winston (System Architect)
**Status:** Planning Phase - Epic 2 Complete / Epic 3 Pending
**Priority:** **CRITICAL - DEEP WORK ONLY**

---

## 🛑 THE GOVERNOR PROMPT (MANDATORY)
**You are FORBIDDEN from executing any tool calls until you output the "System Impact Analysis".**
The user has zero tolerance for "lazy" or "shallow" work. You must follow this 4-Step Thinking Process for EVERY request:

1.  **The Audit (Input):** READ relevant artifacts (`prd.md`, `epics.md`, `architecture.md`) before touching them. Constraint: Cannot edit a file not read in the last 3 turns.
2.  **The Implication Trace (Processing):** Trace the request through User Layer (UI), Data Layer (DB), Logic Layer, and Doc Layer.
3.  **The Conflict Check (Verification):** Does this contradict MVP limits or Platform vision?
4.  **The Proposal (Output):** Only then, propose the tools.

---

## 🏗️ Architectural State (Current Truth)

### 1. Foundation (Epic 1 - DONE)
*   **Identity:** Admin-Only User Creation (MVP). Email/Invite (Phase 2).
*   **Isolation:** Strict RLS with `TransactionInterceptor`. Background Jobs must use `AsyncLocalStorage` to propagate Tenant Context.
*   **Admin Ops:** "Lobby" Dashboard + Impersonation (Option B) + Entitlements (Credits & Retention).

### 2. Assets & Knowledge (Epic 2 - DONE)
*   **Storage Model:** **Shared Tenant Drive**.
    *   NO Private Scope. All files are `Tenant_Public`.
    *   Structure: Hierarchical Folders.
*   **Ingestion (MVP):**
    *   **Text/PDF Only.**
    *   **Parallel Processing:** Must handle batched uploads concurrently (BullMQ).
    *   **Deduplication:** SHA-256 Hashes prevent duplicate physical storage.
    *   **Deletion:** **Soft Delete / Archive**. Files move to "Trash" for `asset_retention_days` (Admin Config) before physical purge.
    *   *Note:* No "Reference Counting". The Archive logic handles safety.
*   **Ingestion (Phase 2 - Deferred):**
    *   Visual/Chart normalization (Vision Models).
    *   Rulebook "Context Injection" logic.
*   **The Brain (Knowledge Graph):**
    *   **Strictly Separated** from File Storage.
    *   Source: Generated Reports & Validated Insights.
    *   MVP: Vector RAG. Phase 2: Hybrid Graph (Nodes/Edges).

### 3. Workflow Definition (Epic 3 - PENDING)
*   **Status:** Not Started.
*   **Goal:** Define the "Factory" (Admin defines Graph & Input Schema).
*   **Key Risks:**
    *   Versioning (Live Edits).
    *   Structured Outputs (Gatekeeper Logic).
    *   Condition Complexity (Code vs No-Code).

---

## 📝 Document Status
*   `task.md`: Epic 2 marked [x].
*   `epics.md`: Fully synced with Shared Drive, Archive, and Parallel logic.
*   `prd.md`: Fully synced with Admin capabilities (Retention Policy) and Asset requirements.
*   `architecture.md`: Fully synced with Component Separation (Ingestion vs Brain).

## ⏭️ Immediate Next Step
1.  **Start a new Conversation.**
2.  **Activate Deep Work Protocol.**
3.  **Begin Epic 3 (Workflow Definition).**
