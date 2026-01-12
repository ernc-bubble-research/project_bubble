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
