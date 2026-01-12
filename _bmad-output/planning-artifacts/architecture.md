---
stepsCompleted: [1]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/product-brief-project_bubble-2026-01-09.md
  - docs/Bubble - general specifications_v01.md
workflowType: 'architecture'
project_name: 'project_bubble'
user_name: 'User'
date: '2026-01-12'
---

# Architecture Decision Document

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The Core Domain is an **Agentic Workflow Engine**.
- **Admin Context (Write):** JSON/YAML schema definitions for Graphs.
- **Run Context (Execute):** Robust "Job Runner" handling long-running processes (LLM) and "Wait States" (Feedback).
- **Report Context (Read):** High-responsiveness Read API (<200ms) aggregating Relational + Vector data.

**Non-Functional Requirements:**
- **Performance:** Strict separation of UI (Synchronous) vs AI (Asynchronous Worker).
- **Security:** RLS (Row Level Security) is mandatory. Must use `SET LOCAL app.current_tenant` to prevent Connection Pool leaks.
- **Reliability:** State Persistence (Checkpointing) prevents data loss on restart.

**Scale & Complexity:**
- Primary domain: **SaaS B2B / Agentic AI**
- Complexity level: **High (Stateful Distributed System)**
- Components: **API Service, Worker Service, Redis (Queue), Postgres (Data+Vector)**

### Technical Constraints & Dependencies
- **Stack:** Node.js (NestJS) + Angular (Nx Monorepo).
- **Service Model:** Strict separation of `API Service` (Express/Fastify) and `Worker Service` (BullMQ Processor) to prevent Event Loop blocking.
- **Database:** PostgreSQL with `pgvector`.
- **Interoperability:** Queue Payload design must support future Polyglot (Python) workers.

### Cross-Cutting Concerns Identified
- **Tenant Isolation:** Enforced at Middleware/Transaction Interceptor level.
- **Observability:** Distributed Tracing required across API -> Queue -> Output.

## Architecture Decisions

### 1. Core Architecture Pattern: "The Async Engine"

We will implement a **Command-Query Responsibility Segregation (CQRS)-lite** style architecture using a Monorepo.

*   **Service A: `api-gateway` (NestJS)**
    *   **Role:** The "Front of House". Handles HTTP/WebSockets, Auth (RLS), and quickly offloads heavy tasks.
    *   **Constraint:** ZERO heavy lifting. If a task takes >200ms, it must be pushed to a Queue.
    *   **Scale:** Horizontal scaling (Stateless).

*   **Service B: `worker-engine` (NestJS)**
    *   **Role:** The "Back of House". Runs the Agents (LangGraph), processes large files, and updates the DB.
    *   **Constraint:** Isolated Process. It can block its own Event Loop without killing the API.
    *   **Scale:** Worker-count scaling based on Queue Depth.

*   **Shared Libraries (Nx)**
    *   **Role:** Shared Type definitions (DTOs) and Domain Logic ensures the API and Worker speak the "Same Language" without code duplication.

### 2. Technology Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Monorepo** | **Nx** | Official best practice for Angular+NestJS functional parity (Shared DTOs). |
| **Frontend** | **Angular 18+** | Strict typing and enterprise readiness matches the backend patterns. |
| **Backend** | **NestJS** | Modular architecture perfect for microservice split (API vs Worker). |
| **Queue** | **BullMQ (Redis)** | The industry standard for Node.js job queues. Supports "Sandboxed Processors" for stability. |
| **Database** | **PostgreSQL** | The "Everything Store". Handles Relational (Users), Vector (PGVector), and Graph (Adjacency List). |
| **Agents** | **LangGraph.js** | Provides the "Checkpointing" state management required by our Reliability NFR. |

### 3. Data Model Strategy

*   **Tenant Isolation:**
    *   Refusing to use "Separate Schemas" (Process heavy).
    *   Using **Discriminator Column (`tenant_id`)** with mandatory RLS Policies.
*   **Vector Data:**
## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
*   **Monorepo Strategy:** **Nx**. Use Shared Libraries for DTO parity.
*   **Database Strategy:** **Postgres Only**. Handles Auth, Relational Data, and Vector Search (pgvector).
*   **Async Pattern:** **BullMQ**. Strict split between API and Worker services.

**Important Decisions (Shape Architecture):**
*   **State Persistence:** **Postgres JSONB**. No separate Mongo DB.
*   **RLS Pattern:** **Set Local Tenant**. Middleware must enforce tenant context on every request.

**Deferred Decisions (Post-MVP):**
*   **Python Workers:** Defer until Data Science needs arise. Built-in "Polyglot Readiness" in Queue design.
*   **Dedicated Vector DB:** Defer until >100M vectors.

### Data Architecture
*   **Database:** PostgreSQL 16+ (Host: EU Region / Supabase or RDS)
*   **Schema Design:**
    *   **Single Schema:** No `schema_per_tenant` complexity.
    *   **Tenant Discriminator:** Every table has `tenant_id`.
    *   **RLS Policies:** Enabled on ALL Tables.
*   **Vector Strategy:**
    *   `embedding` column (vector(1536)) on `knowledge_nodes` table.
    *   Hybrid Search Query: `SELECT * FROM nodes WHERE tenant_id = $1 ORDER BY embedding <=> $2`.

### Authentication & Security
*   **Auth Provider:** Supabase Auth / custom JWT (to be finalized in Implementation).
*   **RLS Enforcement:** `TransactionInterceptor` in NestJS injects `SET LOCAL app.current_tenant`.
*   **API Security:** Standard Helmet/CORS + Rate Limiting (ThrottlerGuard).

### API & Communication Patterns
*   **Interface:** REST API (JSON) for standard interactions.
*   **Real-time:** WebSockets (Socket.io) for "Workflow Progress" updates.
*   **Inter-Service:** Redis (BullMQ) for async tasks. No direct HTTP calls between API and Worker.

### Infrastructure & Deployment
*   **Hosting:** Dockerized Containers (Render/Railway/AWS AppRunner).
*   **CI/CD:** Nx Cloud + GitHub Actions.
    *   `nx affected:build` ensures we only build changed services.
*   **Observability:** OpenTelemetry (traces spanning API -> Queue -> Worker).

### Decision Impact Analysis

**Implementation Sequence:**
1.  **Repo Setup:** Initialize Nx Workspace + Shared Libs + Linters.
2.  **Core Module:** Build `DatabaseModule` with RLS Interceptor (The Foundation).
3.  **Identity:** Implement Auth + User/Tenant Management.
4.  **Async Engine:** Setup BullMQ + Worker Service structure.
5.  **Domain:** Implement the "Graph Execution" logic.
6.  **UI:** Connect Angular Frontend.

**Cross-Component Dependencies:**
*   The **Shared DTO Library** is the critical dependency. API and Worker cannot start until the DTOs (e.g., `WorkflowPayload`) are defined.

## Implementation Patterns & Consistency Rules

### 1. The "Shared Brain" Pattern (DTOs)
**Goal:** Prevent "Frontend/Backend Mismatch" bugs.
**Rule:** NEVER define an interface in the functionality app. ALWAYS in the Shared Lib.
*   **Path:** `libs/shared/src/lib/dtos/`
*   **Class:** `export class CreateWorkflowDto`
*   **Decorators:** Use `class-validator` (e.g., `@IsString()`, `@IsNotEmpty()`).
*   **Usage:**
    *   **Backend:** Use as Controller Body: `create(@Body() dto: CreateWorkflowDto)`
    *   **Frontend:** Use as Form Model: `formBuilder.group<CreateWorkflowDto>(...)`

### 2. The "Secure Transaction" Pattern (RLS)
**Goal:** Prevent leaking data between tenants.
**Rule:** NEVER inject the `Repository` directly in Service logic. ALWAYS wrap DB calls in the `TransactionManager`.
**Code Snippet:**
```typescript
// BAD (Risk of Leak)
await this.repo.find();

// GOOD (Safe)
await this.isolation.runInTransaction(currentTenantId, async (manager) => {
    // 'manager' is pre-configured with "SET LOCAL current_tenant"
    return await manager.find(WorkflowEntity);
});
```

### 3. The "Fire & Forget" Pattern (Queues)
**Goal:** Keep the API fast.
**Rule:** Any task taking >200ms MUST go to BullMQ.
*   **Flow:**
    1.  User clicks "Run".
    2.  API creates `JobId`, saves "Pending" status to DB.
    3.  API pushes `{ jobId, type: 'RUN_AGENT' }` to Redis.
    4.  API returns `202 Accepted` + `JobId` to UI.
    5.  Worker picks up Job -> Updates process.

### 4. The "Hexagonal" Pattern (Agents)
**Goal:** Allow swapping AI Providers.
**Rule:** Agents never talk to "OpenAI" directly. They talk to `LLMService` interface.
*   **Interface:** `generateText(prompt: string): Promise<string>`
*   **Impl:** `OpenAIService`, `AnthropicService`, `LocalLlamaService`.
*   **Interface:** `generateText(prompt: string): Promise<string>`
*   **Impl:** `OpenAIService`, `AnthropicService`, `LocalLlamaService`.
*   **Benefit:** One line config change to switch from GPT-4 to Claude 3.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
project_bubble/
├── apps/
│   ├── web-client/          (Angular 18+ Frontend)
│   │   └── src/app/         (Pages, Components)
│   ├── api-gateway/         (NestJS HTTP API)
│   │   └── src/app/         (Controllers, Gateway Logic)
│   └── worker-engine/       (NestJS Job Processor)
│       └── src/app/         (Graph Execution Logic)
├── libs/
│   ├── shared/
│   │   ├── dtos/            (Shared DTOs - The "API Contract")
│   │   └── types/           (Shared Interfaces)
│   ├── db-layer/            (Shared Database Module)
│   │   ├── entities/        (TypeORM Entities)
│   │   └── repositories/    (Custom Repositories)
│   └── util-auth/           (Shared Guards/Interceptors)
└── tools/                   (Nx Scripts, Docker Compose)
```

### Architectural Boundaries

**API Boundaries:**
*   **External:** `api-gateway` exposes REST/WebSocket at port 3000.
*   **Internal:** `api-gateway` talks to `worker-engine` ONLY via Redis (BullMQ). No direct TCP connection.

**Data Boundaries:**
*   **Database:** Only `libs/db-layer` is allowed to touch `pg`.
*   **Safety:** `apps/web-client` MUST use DTOs. It cannot import TypeORM entities.

### File Organization Patterns

**Source Organization:**
*   Feature Modules (e.g., `UsersModule`) contain their own Controllers, Services, and Tests.
*   "Clean Architecture": `Controller` -> `Service` -> `Repository`.

**Test Organization:**
*   **Unit Tests:** Co-located (`user.service.spec.ts` next to `user.service.ts`).
*   **E2E Tests:** `apps/api-gateway-e2e/`.

**Deployment Structure:**
*   **Docker:** 3 Containers (Web, API, Worker).
*   **Nx Graph:** `nx graph` will visualize dependencies to ensure strict boundaries.





