# 📋 Handover Context: Session 2026-01-15
**From:** BMad Master
**To:** Solution Architect (Aris)
**Project:** project_bubble
**Status:** Planning Review (Restarted)

## 🚨 Critical Protocols
1.  **Strict File Lock:** `Kill Watcher` -> `Edit` -> `Verify`. Never write while watcher is running. Nx environment is unstable.
2.  **Persona Behavior:** Detailed, transparent, explanatory (use analogies). DO NOT simplify.
3.  **Role:** You are the Architect. Master is the Orchestrator (who failed to route earlier).

## 🏗️ Project Definitions (The "Platform" Vision)
*   **Infrastructure Platform:** Bubble is a generic **Agentic Workflow Engine**, not a "QDA Tool".
*   **Flexibility:** The Engine runs defining graphs (JSON). The UI renders `InputSchema`. "QDA" is just the *first* workflow.
*   **Asset Logic (Epic 2 - Revised):**
    *   **Shared Drive:** All uploads are `Tenant_Public`. No private runs.
    *   **MVP Scope:** Text/PDF Only. (Smart Ingestion/Vision deferred to Phase 2).
    *   **Deletion:** Soft Delete / Archive (Admin Configurable Retention).
    *   **Reference:** Vectorized for RAG (Text chunks).

## 📅 Roadmap Phasing (Strict Separation)

### Phase 1 (Prototype / MVP v1)
*   **User Creation:** **Admin-Only via API**. No email service.
    *   `POST /api/users` -> Create User -> Hash Password -> Return to Admin -> Admin shares manually.
*   **Knowledge:** **Vector Base (RAG)**. Flat structure. `pgvector`.
    *   Goal: Semantic Search.
*   **Roles:**
    *   `Bubble Admin` (Super Admin): Can bypass RLS (logged). Needed for provisioning.
    *   `Customer Admin`: Tenant-bound.
    *   `Creator`: Standard user.

### Phase 2 (Integrated MVP / "The Moat")
*   **User Creation:** **Email Invitations**.
    *   SendGrid/SES integration. Magic Link -> Set Password.
*   **Knowledge:** **Hybrid Knowledge Graph**.
    *   Add `node_relationships` (Edges) and Graph Traversal logic.
    *   This is the critical "Moat".

## 📝 Recent Disputes & Resolutions
1.  **Master's Error:** Master simplified "Knowledge Graph" to "Knowledge Base" and deleted the Graph vision. **FIX:** Restored Graph to Phase 2.
2.  **Master's Error:** Master deleted "User Invitations". **FIX:** Restored Invitations to Phase 2.
3.  **Master's Error:** Master failed to document "Bubble Admin" super-powers. **FIX:** Added to Architecture.

## ⏭️ Next Steps
1.  Review **Epic 1 (System Foundation)** from scratch with Architect eye.
2.  Review **Epics 2-8** with Architect eye.
3.  Ensure strict adherence to the "Platform" flexibility constraints.
