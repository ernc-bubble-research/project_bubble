# Advanced Elicitation Results: Architectural Constraints

## 1. 🏗️ Architecture Decision Record: Node.js vs Python

**Context:** The system requires "Agentic" capabilities (traditionally Python) but operates within a NestJS/Angular ecosystem (Node.js).
**Decision:** Use Node.js for the Core Engine.
**Consequences:**
*   **(+) Velocity:** Single language (Typescript) across Frontend/Backend/Agents.
*   **(-) Data Science Gap:** We cannot easily use Pandas/Scikit-learn.
*   **The "Eject Button":** If a specific workflow step requires heavy python libraries (e.g., "Run local LlamaIndex ingestion"), we will NOT rewrite the engine. Instead, we typically define a **"Python Worker Node."** The Node.js engine will queue a job, and a Python container will pick it up, process it, and return the result.
*   **Constraint:** The architecture must support **Polyglot Workers** via the Job Queue (BullMQ) from Day 1, even if we only deploy Node workers initially.

## 2. 💥 Failure Mode Analysis: The "Long Wait"

**Scenario:** User runs a workflow -> Node A (AI) finishes -> Node B (Human Feedback) starts -> User goes to sleep for 2 days -> Server Restarts.
**Failure:** If the "Wait State" is held in memory (e.g., a Javascript Promise), it is lost on restart. The workflow dies.
**Mitigation:**
*   **LangGraph Checkpointing:** We must use a Postgres-backed Checkpointer.
*   **The "Wake Up" Signal:** When the User submits the form 2 days later, the API must:
    1.  Load the Graph State from Postgres (using the ThreadID).
    2.  Inject the User Input.
    3.  "Rehydrate" the Graph and resume execution.
*   **Constraint:** The `FeedbackSubmissionDTO` must include the `ThreadID` and `CheckpointID` to ensure we resume the *correct* version of the workflow.

## 3. 🛡️ Security Audit: The RLS Trap

**Scenario:** An Admin triggers a "Cleanup" job to delete old logs.
**Vulnerability:** If the "Cleanup Job" runs as a Superuser (bypassing RLS), it might delete *active* logs from a specific paying tenant if the query is malformed (`DELETE WHERE user_id = null`).
**Mitigation:**
*   **"Least Privilege" Connection:** The Application should *never* have the DB Superuser password.
*   **Session Setting:** Every DB transaction *must* start with `SET app.current_tenant = 'tenant_123';`.
*   **Constraint:** The NestJS Database Module must implement a **Transaction Interceptor** that enforces this `SET` command before any query runs. If no Tenant is found in the Request Context, the query must fail by default.

## Summary of Architectural Drivers
1.  **Polyglot-Ready Queue:** BullMQ must allow future Python workers.
2.  **State-First Design:** No in-memory waiting; everything persists to DB immediately.
3.  **RLS-First Middleware:** Database connections must strictly enforce Tenant Context.
