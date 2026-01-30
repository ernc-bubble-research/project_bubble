---
project_name: 'project_bubble'
user_name: 'Erinckaratoprak'
date: '2026-01-12'
sections_completed: ['technology_stack', 'implementation_rules', 'testing', 'quality', 'workflow', 'security']
existing_patterns_found: 4
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

## 🚨 CRITICAL: ANTI-HALLUCINATION & STORY LOCK PROTOCOL 🚨

**FAILURE TO FOLLOW THESE RULES LEADS TO IMMEDIATE FAILURE.**

### 1. The "Story Lock" Rule
*   **NEVER** start coding without identifying the specific `stories/story-XXX.md` file you are working on.
*   **NEVER** invent features, routes, or names that are not explicitly in the Story or PRD.
*   **IF** you cannot find a Story for your task, **STOP** and ask the user.
*   **YOU MUST** read the Story file using `view_file` before writing code.

### 2. The "Strict Naming" Rule
*   **DO NOT** use generic names like "Library" if the Story says "Storefront".
*   **DO NOT** create routes like `/ops` if the Story says `/admin`.
*   **CHECK** `epics.md` and `ux-design-specification.md` for exact terminology.

### 3. The "Verification First" Rule
*   **BEFORE** marking a task done, you must explicitly check off the **Acceptance Criteria** in the Story.
*   **IF** a criteria fails, you are NOT done.

---

## Technology Stack & Versions

*   **Monorepo:** Nx 19+ (Integrated Repo)
*   **Web Client:** Angular 18+ (Standalone Components, Signals)
*   **API Gateway:** NestJS 10+ (Fastify Adapter preferred)
*   **Worker Engine:** NestJS 10+ (Standalone Application)
*   **Database:** PostgreSQL 16+ (with `pgvector` extension)
*   **Queue:** BullMQ (Redis-backed)
*   **ORM:** TypeORM (Active Record pattern NOT allowed; use Repository pattern)
*   **AI Engine:** LangGraph.js

## Critical Implementation Rules

### 1. The "Shared Brain" Rule (DTOs)
*   **NEVER** define DTOs/Interfaces inside `apps/`.
*   **ALWAYS** define them in `libs/shared/src/lib/dtos`.
*   **REASON:** The Frontend (Angular) and Backend (NestJS) must share the *exact same class* to prevent contract drift.
*   **PATTERN:**
    ```typescript
    // libs/shared/src/lib/dtos/create-workflow.dto.ts
    import { IsString } from 'class-validator';
    export class CreateWorkflowDto {
      @IsString()
      name: string;
    }
    ```

### 2. The "Security by Consumption" Rule (RLS)
*   **NEVER** inject `Repository<T>` directly into a Service.
*   **ALWAYS** inject `TransactionManager`.
*   **REASON:** We use Postgres Row Level Security (RLS). A raw connection bypasses RLS. The `TransactionManager` forces `SET LOCAL app.current_tenant` before every query.
*   **PATTERN:**
    ```typescript
    // BAD
    // constructor(private repo: Repository<User>) {}

    // GOOD
    await this.txManager.run(tenantId, async (manager) => {
        return manager.find(User);
    });
    ```

### 3. The "200ms" Rule (Async)
*   **NEVER** run long logic (>200ms) in the `api-gateway`.
*   **ALWAYS** offload to `worker-engine`.
*   **PATTERN:** API pushes `{ jobId }` to Redis -> Returns `202 Accepted` -> Worker processes data.

### 4. The "Hexagonal" Rule (AI)
*   **NEVER** import `openai` or `langchain` directly in feature modules.
*   **ALWAYS** use the `LLMProvider` interface.
*   **REASON:** We need to swap between GPT-4, Claude-3, and Local Llama without rewriting business logic.

## File Organization & Naming

*   **Directory Structure:**
    *   `apps/web`: Angular SPA
    *   `apps/api-gateway`: NestJS HTTP API
    *   `apps/worker-engine`: NestJS Background Processor
    *   `libs/shared`: DTOs, Types
    *   `libs/db-layer`: Entities, Migrations, Repositories
*   **Naming:**
    *   Files: `kebab-case` (e.g., `user-profile.component.ts`)
    *   Classes: `PascalCase` (e.g., `UserProfileComponent`)
    *   Interfaces: `I` prefix is **BANNED**. Use `User` not `IUser`.

## Testing Rules

*   **Unit Tests:** Co-located with code (`*.spec.ts`).
*   **E2E Tests:** In `apps/*-e2e/`.
*   **Mocks:** Use `jest.mock` or `MockProvider` from `@golevelup/ts-jest`. NEVER connect to real DB in Unit Tests.

## Anti-Patterns (Do Not Do)

*   ❌ **No Schema per Tenant:** Do not create dynamic schemas. Use `tenant_id` column.
*   ❌ **No Active Record:** Do not use `user.save()`. Use `repository.save(user)`.
*   ❌ **No Direct Worker HTTP:** The API must not HTTP call the Worker. Use Redis.

### SYSTEM OVERRIDE: FILE LOCK PREVENTION PROTOCOL
**You are working in an unstable Nx environment.**
Whenever you need to EDIT or CREATE any file (not just main.ts), you MUST follow this strict sequence:
1.  **KILL THE WATCHER FIRST:** Without asking, execute `./node_modules/.bin/nx reset || pkill -f nx`
2.  **PERFORM THE EDIT:** Write the code.
3.  **VERIFY AND FIX:** Only AFTER the write is complete, run build/lint. If errors occur, repeat Step 1 before fixing.
**EXCEPTION:** This rule may be skipped for BMAD-related `.md` artifacts.

