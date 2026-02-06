# Architect Review Package

**Project:** Bubble — AI-Powered Research Workflow Platform
**Date:** 2026-02-05
**Scope:** Full codebase + BMAD planning artifacts review
**Branch:** `main` (commit `602a62c`)

---

## 1. Product Overview & Phase 1 Scope

### What Bubble Is

Bubble is a multi-tenant SaaS platform that enables marketing research teams to run AI-powered workflows on their data. Users upload research materials (transcripts, documents), select a pre-built workflow (e.g., "Qualitative Data Analysis"), and receive structured reports with citations back to source material.

### Core Value Proposition

- **For Researchers:** Replace weeks of manual qualitative analysis with AI-generated reports that cite their sources
- **For Admins:** Define reusable YAML-based workflow templates that non-technical users can execute through a guided wizard
- **For Organizations:** Multi-tenant architecture with strict data isolation (PostgreSQL RLS) and role-based access

### Phase 1 (MVP) Scope

| Area | What's In | What's Out |
|------|-----------|------------|
| Workflows | Atomic workflows (single LLM call), chains (sequential composition) | LangGraph orchestration, conditional branching |
| File Support | PDF, DOCX, TXT, MD, CSV (text extraction) | Image/OCR, video, audio transcription |
| LLM Providers | Google Gemini (primary), OpenAI (fallback), Mock (testing) | Self-hosted models, Azure OpenAI |
| Knowledge | pgvector RAG with cosine similarity | Knowledge graph (nodes + edges), hybrid search |
| Reports | Markdown with inline citations | PDF export, slide deck generation |
| Sharing | Magic links (read-only, time-limited) | Collaborative editing, comments |
| Auth | JWT + RBAC (3 roles) | OAuth/SSO, MFA, SAML |

### User Roles

| Role | Scope | Access |
|------|-------|--------|
| Bubble Admin | Global | Tenant management, system settings, LLM config, impersonation |
| Customer Admin | Tenant | User management, billing, tenant settings |
| Creator | Tenant | Run workflows, upload files, view reports |
| Guest | Report | Read-only report access via magic link (Phase 1 deferred) |

---

## 2. Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Angular 21 SPA (apps/web)                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │ Zone A   │ │ Zone B   │ │ Zone C   │                        │
│  │ /auth    │ │ /app     │ │ /admin   │                        │
│  │ (Public) │ │ (Tenant) │ │ (Admin)  │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
│         │             │             │                            │
│         └─────────────┼─────────────┘                            │
│                       │ HTTP + JWT                                │
└───────────────────────┼──────────────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────────────┐
│                   API GATEWAY (apps/api-gateway)                  │
│  NestJS 11 — Port 3000                                           │
│                                                                   │
│  ┌─────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ Guards  │→│ Interceptors │→│ Controllers  │                │
│  │ JWT     │  │ TenantContext│  │ 16 total     │                │
│  │ Roles   │  │ (RLS setup)  │  │              │                │
│  │ API Key │  └──────────────┘  └──────┬───────┘                │
│  └─────────┘                           │                         │
│                                        ▼                         │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              Services + TransactionManager           │        │
│  │  (All DB access via TransactionManager.run())       │        │
│  └──────────────────────┬──────────────────────────────┘        │
│                         │                                        │
│            ┌────────────┼────────────┐                           │
│            ▼            ▼            ▼                            │
│     ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│     │PostgreSQL│ │  Redis   │ │  BullMQ  │                     │
│     │ + RLS    │ │ (cache)  │ │ (jobs)   │                     │
│     │+pgvector │ │          │ │          │                     │
│     └──────────┘ └──────────┘ └──────────┘                     │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│               WORKER ENGINE (apps/worker-engine)                  │
│  NestJS 11 — Port 3001                                           │
│  BullMQ processor for async jobs (ingestion, workflow execution) │
│  ⚠ Currently empty shell — jobs run in api-gateway for MVP      │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow: User Runs a Workflow

```
1. User selects workflow from Storefront (/app/workflows)
2. Run Wizard collects inputs (files, assets, form responses)
3. Frontend POSTs to /api/app/workflow-runs
4. API Gateway creates WorkflowRunEntity (status: queued)
5. Job dispatched to BullMQ queue
6. Worker picks up job:
   a. Fetches uploaded files (text extraction)
   b. Queries pgvector knowledge base (if RAG enabled)
   c. Assembles YAML prompt template + variables
   d. Calls LLM provider (Gemini/OpenAI/Mock)
   e. Validates output against OutputSchema
   f. Extracts citations → materializes quotes
7. WorkflowRunEntity updated (status: completed, output stored)
8. User views interactive report with Evidence Drawer
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | Nx workspace | Single repo for frontend, backend, shared libs |
| Multi-tenancy | Shared DB + RLS | Cost-efficient; PostgreSQL RLS enforces isolation |
| Auth | JWT (7-day expiry) | Stateless; refresh tokens deferred to Epic 7 |
| LLM integration | Hexagonal pattern | Provider-agnostic; swap implementations without code changes |
| Job processing | BullMQ + Redis | Async workflow execution; retries built in |
| Vector search | pgvector (HNSW) | PostgreSQL-native; no separate vector DB needed |
| Workflow definition | YAML prompts | LLM-orchestrated execution; no LangGraph needed for MVP |
| Frontend state | Angular Signals | No NgRx; signals sufficient for current complexity |
| Styling | Custom design system | No UI framework (Material, PrimeNG); full control |
| Testing | Jest (backend) + Jest (frontend) | Vitest configured but not primary |

---

## 3. Full Tech Stack with Versions

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **Frontend** | | |
| @angular/core | ~21.0.0 | SPA framework |
| @angular/router | ~21.0.0 | Client-side routing |
| rxjs | ^7.8.0 | Reactive programming |
| lucide-angular | ^0.563.0 | Icon library |
| jwt-decode | ^4.0.0 | JWT parsing on client |
| **Backend** | | |
| @nestjs/core | ^11.0.0 | API framework |
| @nestjs/jwt | ^11.0.2 | JWT authentication |
| @nestjs/passport | ^11.0.5 | Auth strategies |
| @nestjs/swagger | ^11.2.5 | API documentation |
| @nestjs/throttler | ^6.5.0 | Rate limiting |
| @nestjs/typeorm | ^11.0.0 | ORM integration |
| @nestjs/bullmq | ^11.0.4 | Job queue integration |
| typeorm | ^0.3.28 | Database ORM |
| pg | ^8.17.2 | PostgreSQL driver |
| bullmq | ^5.66.5 | Job queue |
| bcrypt | ^6.0.0 | Password hashing |
| helmet | ^8.1.0 | HTTP security headers |
| passport-jwt | ^4.0.1 | JWT passport strategy |
| **LLM / AI** | | |
| @google/generative-ai | ^0.24.1 | Gemini API client |
| **Document Processing** | | |
| mammoth | ^1.11.0 | DOCX → text |
| pdf-parse | ^2.4.5 | PDF → text |
| sanitize-html | ^2.17.0 | XSS prevention |
| **Email** | | |
| nodemailer | ^7.0.13 | SMTP email sending |
| **Shared** | | |
| class-validator | ^0.14.3 | DTO validation |
| class-transformer | ^0.5.1 | DTO transformation |
| tslib | ^2.3.0 | TypeScript runtime helpers |

### Build & Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ~5.9.2 | Language |
| nx | 22.3.3 | Monorepo orchestration |
| jest | ^30.0.2 | Unit testing |
| cypress | ^15.8.0 | E2E testing (configured, not used) |
| vitest | ^4.0.8 | Alternative test runner |
| vite | ^7.0.0 | Build tool |
| eslint | ^9.8.0 | Linting (flat config) |
| prettier | ~3.6.2 | Code formatting |
| tailwindcss | ^3.0.2 | CSS utility (installed, not actively used) |

### Infrastructure

| Component | Image/Version | Purpose |
|-----------|--------------|---------|
| PostgreSQL | pgvector/pgvector:pg16 | Primary database with vector extension |
| Redis | redis:alpine | Job queue backend + caching |

---

## 4. Database Schema

### Entity Summary

| Entity | Table | Columns | RLS | Soft Delete |
|--------|-------|---------|-----|-------------|
| TenantEntity | `tenants` | 10 | NO | NO |
| UserEntity | `users` | 11 | YES | NO |
| InvitationEntity | `invitations` | 12 | YES | NO |
| AssetEntity | `assets` | 15 | YES | NO |
| FolderEntity | `folders` | 5 | YES | NO |
| KnowledgeChunkEntity | `knowledge_chunks` | 10 | YES | NO |
| WorkflowTemplateEntity | `workflow_templates` | 12 | YES | YES |
| WorkflowVersionEntity | `workflow_versions` | 6 | YES | NO |
| WorkflowChainEntity | `workflow_chains` | 12 | YES | YES |
| WorkflowRunEntity | `workflow_runs` | 20 | YES | NO |
| LlmModelEntity | `llm_models` | 10 | NO | NO |

### RLS Policies (Explicit)

#### Standard Tenant Isolation (7 tables)

Applied to: `users`, `invitations`, `assets`, `folders`, `knowledge_chunks`, `workflow_versions`, `workflow_runs`

```sql
-- Policy: tenant_isolation_{table}
-- Type: USING (applies to all operations)
tenant_id = current_setting('app.current_tenant', true)::uuid
```

RLS is ENABLED with FORCE on all 7 tables. The `app.current_tenant` session variable is set per-transaction via `TransactionManager.run()` → `SET LOCAL app.current_tenant = $1`.

#### Auth Bypass Policies (Permissive) — SECURITY FLAG

| Policy | Table | Operation | Condition | Purpose |
|--------|-------|-----------|-----------|---------|
| `auth_select_all` | users | SELECT | `true` | Pre-auth login queries |
| `auth_insert_users` | users | INSERT | `true` | User creation (seed, invitation accept) |
| `auth_accept_invitations` | invitations | SELECT | `true` | Pre-auth invitation lookup |
| `auth_update_invitations` | invitations | UPDATE | `true` | Invitation status updates |

> **SECURITY FLAG:** These policies use `condition: true`, meaning **any database connection** — regardless of tenant context — can SELECT all users and all invitations. This is intentional for the pre-authentication flow (login needs to find users by email across all tenants, invitation accept needs to look up tokens globally). However, this has implications:
>
> 1. **`auth_select_all` on `users`:** Any query without `SET LOCAL app.current_tenant` can read the entire `users` table (emails, password hashes, roles). The application layer (AuthService) is the only barrier. If a service accidentally queries `users` without going through TransactionManager, RLS won't stop it.
> 2. **`auth_insert_users`:** Any connection can INSERT into `users` without tenant context. The application validates tenant existence, but the DB won't reject orphan inserts.
> 3. **Mitigation in place:** The `bypassRls` flag in `TenantContext` is only set for `bubble_admin` role. Regular service calls go through `TransactionManager.run()` which always sets the tenant context.
> 4. **Recommended review:** Consider restricting these permissive policies to specific database roles or adding application-level safeguards (e.g., a dedicated `auth_user` DB role with limited permissions vs. the `app_user` role used for tenant-scoped queries).

#### Custom Visibility Policies (2 tables)

Applied to: `workflow_templates`, `workflow_chains`

```sql
-- Policy: template_access / chain_access
-- Type: SELECT (Using)
tenant_id = current_setting('app.current_tenant', true)::uuid
OR visibility = 'public'
OR current_setting('app.current_tenant', true)::uuid = ANY(allowed_tenants)
```

#### Tables Without RLS

| Table | Reason |
|-------|--------|
| `tenants` | Root table — no tenant_id column |
| `llm_models` | Global registry — shared across all tenants |

### pgvector Configuration

- **Column:** `knowledge_chunks.embedding` — stored as `float8[]` in TypeORM, converted to `vector(768)` by RlsSetupService on startup
- **Index:** HNSW on embedding column (cosine similarity)
- **Query:** Raw SQL with `<=>` operator for cosine distance

### Tenant Context Flow

```
HTTP Request
  → JwtAuthGuard (extracts user from JWT)
  → TenantContextInterceptor (sets AsyncLocalStorage context)
    → { tenantId: user.tenant_id, bypassRls: role === 'bubble_admin' }
  → Controller → Service → TransactionManager.run()
    → SET LOCAL app.current_tenant = $tenantId
    → RLS policies automatically filter all queries
```

---

## 5. API Route Inventory

### Authentication

| Method | Path | Auth | Guard Chain | Purpose |
|--------|------|------|-------------|---------|
| POST | `/api/auth/login` | None | Throttle(5/60s) | User login |
| POST | `/api/auth/set-password` | None | Throttle(5/60s) | Accept invitation |
| GET | `/api/` | None | None | Health check |

### Admin Routes (`/api/admin/*`)

All admin routes require: `OptionalJwtAuthGuard → AdminApiKeyGuard → RolesGuard(BUBBLE_ADMIN)`

Two auth paths: (1) JWT with `bubble_admin` role, or (2) `x-admin-api-key` header.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/admin/tenants` | Create tenant |
| GET | `/api/admin/tenants` | List all tenants |
| GET | `/api/admin/tenants/:id` | Get tenant detail |
| PATCH | `/api/admin/tenants/:id` | Update tenant |
| POST | `/api/admin/tenants/:id/impersonate` | Impersonate tenant |
| GET | `/api/admin/tenants/:id/accessible-workflows` | List tenant's accessible workflows |
| POST | `/api/admin/tenants/:tenantId/users` | Create user in tenant |
| GET | `/api/admin/tenants/:tenantId/users` | List tenant users |
| PATCH | `/api/admin/tenants/:tenantId/users/:id` | Update user |
| DELETE | `/api/admin/tenants/:tenantId/users/:id` | Deactivate user |
| POST | `/api/admin/tenants/:tenantId/users/:id/reset-password` | Reset password |
| POST | `/api/admin/tenants/:tenantId/invitations` | Create invitation |
| GET | `/api/admin/tenants/:tenantId/invitations` | List invitations |
| POST | `/api/admin/tenants/:tenantId/invitations/:id/resend` | Resend invitation |
| DELETE | `/api/admin/tenants/:tenantId/invitations/:id` | Revoke invitation |
| POST | `/api/admin/workflow-templates` | Create template |
| GET | `/api/admin/workflow-templates` | List templates (filterable) |
| GET | `/api/admin/workflow-templates/:id` | Get template + current version |
| PATCH | `/api/admin/workflow-templates/:id` | Update template |
| DELETE | `/api/admin/workflow-templates/:id` | Soft-delete template |
| POST | `/api/admin/workflow-templates/:id/restore` | Restore template |
| POST | `/api/admin/workflow-templates/:id/publish` | Publish version |
| POST | `/api/admin/workflow-templates/:id/rollback/:versionId` | Rollback to version |
| POST | `/api/admin/workflow-templates/:templateId/versions` | Create version |
| GET | `/api/admin/workflow-templates/:templateId/versions` | List versions |
| GET | `/api/admin/workflow-templates/:templateId/versions/:versionId` | Get version |
| POST | `/api/admin/workflow-chains` | Create chain |
| GET | `/api/admin/workflow-chains` | List chains (filterable) |
| GET | `/api/admin/workflow-chains/:id` | Get chain |
| PUT | `/api/admin/workflow-chains/:id` | Update chain |
| DELETE | `/api/admin/workflow-chains/:id` | Soft-delete chain |
| PATCH | `/api/admin/workflow-chains/:id/restore` | Restore chain |
| PATCH | `/api/admin/workflow-chains/:id/publish` | Publish chain |
| GET | `/api/admin/llm-models` | List all LLM models |
| POST | `/api/admin/llm-models` | Create LLM model |
| PATCH | `/api/admin/llm-models/:id` | Update LLM model |

### App Routes (`/api/app/*`)

All app routes require: `JwtAuthGuard → RolesGuard(BUBBLE_ADMIN, CUSTOMER_ADMIN, CREATOR)`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/app/users` | Create user (tenant-scoped) |
| GET | `/api/app/users` | List users (tenant-scoped) |
| PATCH | `/api/app/users/:id` | Update user |
| DELETE | `/api/app/users/:id` | Deactivate user |
| POST | `/api/app/users/:id/reset-password` | Reset password |
| POST | `/api/app/invitations` | Create invitation (tenant-scoped) |
| GET | `/api/app/invitations` | List invitations |
| POST | `/api/app/invitations/:id/resend` | Resend invitation |
| DELETE | `/api/app/invitations/:id` | Revoke invitation |
| POST | `/api/app/assets` | Upload file (multipart, 10MB limit) |
| GET | `/api/app/assets` | List assets (filterable by folder, status) |
| GET | `/api/app/assets/:id` | Get asset |
| PATCH | `/api/app/assets/:id` | Update asset |
| DELETE | `/api/app/assets/:id` | Archive asset |
| POST | `/api/app/assets/:id/restore` | Restore asset |
| POST | `/api/app/assets/:id/index` | Queue for knowledge indexing (202) |
| DELETE | `/api/app/assets/:id/index` | Remove from knowledge index |
| POST | `/api/app/folders` | Create folder |
| GET | `/api/app/folders` | List folders |
| PATCH | `/api/app/folders/:id` | Update folder |
| DELETE | `/api/app/folders/:id` | Delete folder |
| POST | `/api/app/knowledge/search` | Semantic search |
| POST | `/api/app/knowledge/insights` | Store validated insight |
| GET | `/api/app/knowledge/insights` | List insights |
| GET | `/api/app/knowledge/insights/run/:runId` | Get insights by run |
| DELETE | `/api/app/knowledge/insights/:id` | Delete insight |
| GET | `/api/app/llm-models` | List active LLM models |
| GET | `/api/app/workflow-templates` | Browse published workflows (catalog) |

### Rate Limiting

- Global: 10 requests per 60 seconds (ThrottlerGuard)
- Login/set-password: 5 requests per 60 seconds (additional)

---

## 6. Deployment Setup & CI/CD

### Deployment Target

**No production deployment exists.** The architecture doc mentions potential targets but no decision has been made:

| Option Mentioned | Source | Status |
|-----------------|--------|--------|
| Render / Railway / AWS AppRunner | architecture.md line 157 | Mentioned, not decided |
| Supabase or RDS | architecture.md line 120 | Mentioned for managed PostgreSQL |
| EU Region (Frankfurt/Dublin) | PRD NFRs | Required for GDPR compliance |

> **Flag:** The project uses Google Vertex AI / Gemini as its primary LLM provider, which implies a GCP affinity. However, no explicit GCP deployment decision exists. The architect should decide on a target cloud and establish: container registry, managed PostgreSQL (Cloud SQL / RDS / Supabase), managed Redis (Memorystore / ElastiCache), and a compute target (Cloud Run / App Runner / Railway). This decision cascades into file storage, secrets management, and CI/CD choices.

### Current Local Setup

```yaml
# docker-compose.yml (development only)
services:
  postgres:
    image: pgvector/pgvector:pg16
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck: pg_isready -U bubble_user -d bubble_db

  redis:
    image: redis:alpine
    ports: ["6379:6379"]
    volumes: [redis_data:/data]
```

```bash
docker compose up -d              # Start PostgreSQL + Redis
nx serve api-gateway              # Backend on :3000
nx serve web                      # Frontend on :4200 (proxies /api → :3000)
```

No Dockerfiles exist for the application services themselves — only infrastructure containers.

### File Storage Strategy

**Current: Local filesystem. Not production-ready.**

Uploaded files are stored on the API gateway's local disk:

```
uploads/<tenantId>/<uuid>-<sanitized-filename>
```

- **Upload handling:** Multer with `memoryStorage()` → file loaded into memory → written to disk via `fs/promises.writeFile()`
- **Max file size:** 10MB (hardcoded in controller)
- **Allowed types:** PDF, TXT, MD, DOCX only
- **Deduplication:** SHA-256 hash per tenant prevents duplicate uploads
- **Tenant isolation:** Files stored in tenant-specific subdirectories
- **Cleanup:** Orphan file deleted if DB save fails

> **Flag:** Local filesystem storage means: (1) files are lost if the container restarts without persistent volumes, (2) horizontal scaling is impossible (each instance has its own disk), (3) no backup/versioning, (4) no CDN for delivery. Migration to cloud object storage (GCS, S3) is required before production. The `AssetEntity.storage_path` column stores the relative path, so the migration is straightforward — swap the storage backend, keep the path format.

### Secrets Management

**Current: `.env` files and environment variables. No secrets manager.**

| Sensitive Variable | Current Handling |
|-------------------|------------------|
| `JWT_SECRET` | Env var; app refuses to start on default value |
| `ADMIN_API_KEY` | Env var; app refuses to start on default value |
| `DATABASE_URL` | Env var; contains password in connection string |
| `GEMINI_API_KEY` | Env var; optional for dev (mock provider) |
| `SMTP_PASS` | Env var; empty in dev |
| `POSTGRES_PASSWORD` | Env var; `bubble_password` in dev |

> **Flag:** No secrets rotation, no encryption at rest for credentials, no audit trail for secret access. For production: use the cloud provider's secrets manager (GCP Secret Manager, AWS Secrets Manager, etc.), implement key rotation for JWT signing keys, and remove seed credentials from any deployed environment.

### Environment Variables (25 total)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection |
| `JWT_SECRET` | Yes | - | JWT signing (fails on default) |
| `ADMIN_API_KEY` | Yes | - | Admin API auth (fails on default) |
| `PORT` | No | 3000 | API gateway port |
| `WORKER_PORT` | No | 3001 | Worker engine port |
| `CORS_ORIGIN` | No | http://localhost:4200 | CORS allowed origin |
| `REDIS_HOST` | No | localhost | Redis host |
| `REDIS_PORT` | No | 6379 | Redis port |
| `POSTGRES_HOST` | No | localhost | DB host |
| `POSTGRES_PORT` | No | 5432 | DB port |
| `POSTGRES_USER` | No | bubble_user | DB user |
| `POSTGRES_PASSWORD` | No | bubble_password | DB password |
| `POSTGRES_DB` | No | bubble_db | DB name |
| `SEED_ADMIN_EMAIL` | No | admin@bubble.io | Dev seed user |
| `SEED_ADMIN_PASSWORD` | No | Admin123! | Dev seed password |
| `SMTP_HOST` | No | sandbox.smtp.mailtrap.io | Email provider |
| `SMTP_PORT` | No | 2525 | SMTP port |
| `SMTP_USER` | No | - | SMTP credentials |
| `SMTP_PASS` | No | - | SMTP credentials |
| `SMTP_FROM` | No | noreply@bubble.app | Email sender |
| `FRONTEND_URL` | No | http://localhost:4200 | Invitation link base |
| `INVITATION_EXPIRY_HOURS` | No | 72 | Invitation TTL |
| `GEMINI_API_KEY` | No | - | Google AI Studio key |
| `EMBEDDING_PROVIDER` | No | mock | Embedding backend |
| `EMBEDDING_MODEL` | No | text-embedding-004 | Embedding model ID |
| `CHUNK_SIZE` | No | 2000 | Text chunk size |
| `CHUNK_OVERLAP` | No | 400 | Chunk overlap |

### Backup & Disaster Recovery

**Not implemented. No strategy documented.**

- PostgreSQL data persists in a Docker volume (`postgres_data`) — no automated backups
- Redis data persists in a Docker volume (`redis_data`) — no persistence config beyond default
- Uploaded files on local filesystem — no backup
- Knowledge Base snapshots mentioned as `[Future]` in architecture docs (FR24, FR25) — not implemented

> **Flag:** A single `docker compose down -v` destroys all data. For production: automated pg_dump or managed DB backups with point-in-time recovery, cloud storage with versioning for uploads, and Redis AOF/RDB persistence configuration.

### CI/CD

**None configured.** No GitHub Actions, Jenkins, or other CI files exist. No Dockerfiles for application services.

> **Flag:** The BMAD dev-story workflow provides lint/test/build verification per story, but there is no automated pipeline for pull requests or deployments. Story 1.11 (CI/CD Pipeline Setup) was deferred to post-MVP.

---

## 7. Folder Structure

```
project_bubble/
├── apps/
│   ├── api-gateway/                    # NestJS API backend
│   │   └── src/app/
│   │       ├── auth/                   # JWT strategy, login, set-password
│   │       │   ├── guards/             # JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard
│   │       │   ├── strategies/         # JwtStrategy (Passport)
│   │       │   └── decorators/         # @Roles() decorator
│   │       ├── guards/                 # AdminApiKeyGuard
│   │       ├── interceptors/           # TenantContextInterceptor
│   │       ├── tenants/                # Tenant CRUD + impersonation
│   │       ├── users/                  # User CRUD (app + admin controllers)
│   │       ├── invitations/            # Invitation CRUD (app + admin controllers)
│   │       ├── assets/                 # File upload/management
│   │       ├── ingestion/              # Document processing, embedding, BullMQ
│   │       ├── knowledge/              # Semantic search, validated insights
│   │       ├── workflows/              # Templates, versions, chains, catalog, runs
│   │       └── email/                  # SMTP email service
│   │
│   ├── web/                            # Angular 21 SPA
│   │   └── src/app/
│   │       ├── admin/                  # Admin portal (Zone C)
│   │       │   ├── dashboard/          # Stats, tenant list, create modal
│   │       │   ├── tenants/            # Tenant detail, user mgmt, impersonation
│   │       │   ├── workflows/          # Wizard, chain builder, studio, templates
│   │       │   └── settings/           # Settings page shell (3.1-1)
│   │       ├── app/                    # Tenant app (Zone B)
│   │       │   └── data-vault/         # File manager, folders, upload
│   │       ├── auth/                   # Login, set-password (Zone A)
│   │       ├── core/                   # Services, guards, interceptors
│   │       │   ├── services/           # 9 services (auth, tenant, asset, etc.)
│   │       │   ├── guards/             # 4 guards (auth, admin, noAuth, unsaved)
│   │       │   └── interceptors/       # JWT interceptor
│   │       └── shared/                 # Reusable components (badge, tooltip, etc.)
│   │
│   └── worker-engine/                  # BullMQ worker (empty shell)
│       └── src/app/                    # Placeholder for Epic 4
│
├── libs/
│   ├── db-layer/                       # Database layer
│   │   └── src/lib/
│   │       ├── entities/               # 11 TypeORM entities
│   │       ├── repositories/           # Custom repositories
│   │       ├── rls-setup.service.ts    # RLS policy initialization
│   │       ├── tenant-context.ts       # AsyncLocalStorage for tenant context
│   │       └── transaction-manager.ts  # Tenant-aware transaction wrapper
│   │
│   └── shared/                         # Shared types & DTOs
│       └── src/lib/
│           ├── dtos/                   # 31 DTOs (auth, user, tenant, workflow, etc.)
│           ├── types/                  # TypeScript interfaces
│           └── validators/             # Schema validators
│
├── _bmad/                              # BMAD multi-agent framework
│   ├── bmm/                            # Project-specific agents, workflows, data
│   └── core/                           # Framework core (tasks, agents, resources)
│
├── _bmad-output/                       # Generated artifacts
│   ├── planning-artifacts/             # PRD, architecture, epics, UX spec
│   └── implementation-artifacts/       # Stories, sprint status, test reviews
│
├── docker-compose.yml                  # PostgreSQL (pgvector) + Redis
├── nx.json                             # Nx workspace config
├── tsconfig.base.json                  # Root TypeScript config
├── project-context.md                  # AI agent rules & patterns
└── package.json                        # 41 prod + 64 dev dependencies
```

---

## 8. Technical Debt & Known Issues

### Critical Issues

#### 1. E2E Test Coverage is Zero

- **575+ unit tests pass**, but zero E2E/integration tests exist
- Unit tests mock all HTTP calls — actual API can return 500 on every endpoint without tests catching it
- Three startup crashes were discovered during manual UI testing, not by tests:
  - TypeORM entity registration missing (WorkflowRun, WorkflowChain, KnowledgeChunk)
  - pgvector column type mismatch (float8[] vs vector(768))
  - Circular dependency in lazy-loaded routes
- **Stories created:** 1E, 2E, 3E (all `ready-for-dev`)

> **Flag:** This is the single biggest risk. The test suite provides false confidence. A single `nx serve api-gateway && curl /api/admin/tenants` would have caught the startup crashes.

#### 2. No CI/CD Pipeline

- No GitHub Actions, no automated checks on push/PR
- BMAD workflow provides per-story lint/test/build, but nothing prevents regressions between stories
- **Deferred:** Story 1.11 (post-MVP)

#### 3. Swagger @ApiResponse Gaps

- 11 controllers missing error response decorators (400, 401, 403, 500)
- API documentation is incomplete for error scenarios
- **Status:** Not started

#### 4. Worker Engine is Empty Shell

- BullMQ jobs (ingestion, workflow execution) run inside api-gateway process
- `apps/worker-engine/` exists but has no real job processors
- **Pragmatic MVP decision** — will be activated in Epic 4

### High Priority

#### 5. JWT Claims Missing User Info

- JWT only contains `sub`, `tenant_id`, `role`
- No `email` or `name` in claims — `getCurrentUser()` returns empty email
- Blocks Story 3.1-2 (avatar dropdown showing user name/email)
- **Fix needed:** Either add claims to JWT or create `/api/users/me` endpoint

#### 6. No Provider Credential Storage

- Only `GEMINI_API_KEY` env var exists
- No encrypted credential storage for multiple LLM providers
- **Blocked by:** Story 3.1-4 (Provider Credential Storage)

#### 7. Missing Tenant Lifecycle

- No archive/suspend/hard-delete flows for tenants
- **Story 1-13** created but not started

#### 8. Refresh Token Rotation Absent

- JWT has 7-day expiry (interim hardening)
- No refresh tokens, no session extension, no revocation
- **Deferred to:** Epic 7 Story 7.5

### Medium Priority

#### 9. Defense-in-Depth Gaps

- Some raw SQL queries in knowledge search and ingestion lack explicit `tenant_id` in WHERE clauses
- RLS provides the safety net, but best practice requires belt-and-suspenders
- Recurring issue: flagged in Stories 2.4, 3.3, 3.4

#### 10. Audit Logging Not Implemented

- Impersonation logged via `logger.warn` (placeholder)
- No structured audit trail for admin actions
- **Deferred to:** Epic 7 Story 7.2

#### 11. Health Check Endpoint Missing

- No `/health` endpoint for monitoring
- **Deferred to:** Epic 7 Story 7.3

#### 12. Log Sanitization for PII

- Document content and user data may appear in logs
- No sanitization layer implemented
- **Deferred to:** Story 2.1 AC (when real document data flows through)

### Low Priority

- Tailwind CSS installed but not actively used (custom design system instead)
- Budget warning on `tenant-detail.component.scss` (6.50 kB vs 4.00 kB)
- `app-layout.component.ts` has no logout functionality (Story 3.1-2 will add)

### Deferred Architectural Decisions

| Decision | Status | Target |
|----------|--------|--------|
| LangGraph.js for workflow execution | Deferred indefinitely | YAML prompts to LLM instead |
| Hexagonal LLM Provider interface | **GATE for Epic 4** | Must build before execution engine |
| Knowledge graph (nodes + edges) | Phase 2 | Vectors only for MVP |
| Conversational intelligence ("Chat with Data") | Phase 2 | Epic 8 |
| Advanced visual workflow canvas | Phase 2 | Epic 10 |
| Plan tier management system | Future | Epic 11 |
| CI/CD pipeline | Post-MVP | Story 1.11 |
| BullMQ worker service extraction | Epic 4 | When dedicated workers needed |

### Process Issues (Documented, Actions Taken)

1. **"Acceptable for MVP" mindset** — Phrase permanently banned. Used 3 times in Epic 2 to lower standards.
2. **Code review auto-fix without consent** — Code review now must present findings before fixing.
3. **39 unsubscribed RxJS subscriptions** — All fixed in Story 3H. ESLint rule + project-context.md Rule 13 now enforced.
4. **Story codebase verification gaps** — Stories referenced non-existent code/routes. Rules 14-20 added.

---

## 9. Operational Gaps

### Performance & Scale Expectations

**Documented targets from PRD (not tested or validated):**

| Metric | Target | Source |
|--------|--------|--------|
| Evidence Drawer interactions | < 200ms | PRD NFR |
| Workflow submission acknowledgment | < 2 seconds | PRD NFR |
| Report rendering (up to 50 citations) | < 3 seconds | PRD NFR |
| Knowledge Base per tenant | Up to 10,000 nodes/edges | PRD NFR |
| Concurrent runs per tenant | Configurable by plan tier (e.g., Tier 1: 5, Tier 2: 20) | PRD NFR |
| API offloading rule | Any task > 200ms → BullMQ queue | Architecture decision |

**What's missing:**

- **Expected user volume:** No documented target for concurrent users, total tenants, or peak load. The PRD mentions a revenue target (€25K MRR, 3 months) but doesn't translate that into infrastructure numbers. Rough estimate: if average customer pays ~€170/mo, that's ~150 customers. At 5-10 users per tenant, that's 750-1500 total users.
- **No load testing:** Zero performance benchmarks exist. No k6, Artillery, or JMeter configs.
- **No capacity planning:** Unknown how many tenants a single API gateway instance can serve.
- **No monitoring:** No APM (DataDog, New Relic), no Prometheus metrics, no structured logging beyond console. Health check endpoint deferred to Epic 7.
- **File size distribution:** 10MB limit is hardcoded but no analysis of typical file sizes or total storage per tenant.

> **Flag:** The architect needs concrete numbers to size infrastructure. Recommended: define target for Year 1 (e.g., 200 tenants, 2000 users, 500 workflow runs/day, 50GB total file storage), then validate with load testing before production launch.

### Error Handling & Retry Strategy

**BullMQ ingestion queue (the only queue currently configured):**

```typescript
// ingestion.module.ts
defaultJobOptions: {
  attempts: 3,                                    // 3 retries after initial failure
  backoff: { type: 'exponential', delay: 5000 }, // 5s → 10s → 20s
  removeOnComplete: 100,                          // Keep last 100 completed
  removeOnFail: 500,                              // Keep last 500 failed
}
```

**Embedding service (LLM call retries):**

- Timeout: 30 seconds per batch (`EMBED_TIMEOUT_MS = 30_000`)
- Custom exponential backoff: 3 attempts, 1s base delay
- Batch size: max 100 texts per embedding call

**What's missing:**

| Gap | Impact |
|-----|--------|
| No dead letter queue | Failed jobs sit in `failed` state with no routing or alerting. After 3 retries, the job is abandoned silently. |
| No circuit breaker | If the LLM provider is down, every queued job burns through all retry attempts before failing. No fast-fail mechanism. |
| No alerting on failures | Failed jobs are only visible in BullMQ dashboard (not configured) or Redis directly. No email/Slack notification. |
| No workflow execution queue | Only the `ingestion` queue exists. Workflow run execution (Epic 4) doesn't have a queue config yet. |
| No partial failure recovery | If a chain workflow fails on step 3 of 5, there's no mechanism to resume from step 3. The entire chain must be re-run. |
| No idempotency keys | Retried jobs could produce duplicate results if the first attempt partially succeeded (e.g., LLM call returned but DB write failed). |

> **Flag:** The retry strategy for ingestion is reasonable for MVP. However, before Epic 4 (workflow execution with real LLM calls and customer-facing credit charges), the architect should define: (1) dead letter queue routing, (2) circuit breaker thresholds per provider, (3) alerting integration, (4) idempotency guarantees for charged operations.

---

## Summary

### What's Working Well

- RLS architecture is solid — tenant isolation enforced at DB level with TransactionManager
- Shared DTO library prevents frontend/backend drift
- Hexagonal provider pattern (embedding) ready for LLM extension
- 575+ unit tests with consistent BDD format
- BMAD workflow provides structured dev process with code review
- BullMQ ingestion pipeline has sensible retry defaults (3 attempts, exponential backoff)

### What Needs Architect Decisions

These items require deliberate architectural decisions before production:

| Decision | Options | Blocking |
|----------|---------|----------|
| Deployment target | GCP (Cloud Run + Cloud SQL) vs AWS (AppRunner + RDS) vs Render/Railway | Everything below |
| File storage backend | GCS bucket vs S3 vs managed service | Production readiness |
| Secrets management | GCP Secret Manager vs AWS Secrets Manager vs Vault | Production readiness |
| Database hosting | Cloud SQL vs RDS vs Supabase | Backup/DR strategy |
| Auth bypass RLS policies | Restrict to dedicated DB role vs accept current design | Security posture |
| Monitoring stack | DataDog vs Prometheus+Grafana vs cloud-native | Observability |

### What Needs Attention Before Epic 4

| Priority | Item | Effort |
|----------|------|--------|
| 1 | Complete Epic 3.1 (Settings shell done; 3 stories remain) | 3 stories |
| 2 | E2E test foundation (Stories 1E, 2E, 3E) | 3 stories |
| 3 | Build LLM Provider interface (MockLlmProvider + GoogleAIStudioProvider) | 1-2 stories |
| 4 | Swagger @ApiResponse gaps | 1 story |
| **Total** | | **8-9 stories** |

### What Needs Attention Before Production

| Priority | Item | Severity |
|----------|------|----------|
| 1 | Choose deployment target and create Dockerfiles | Critical |
| 2 | Migrate file storage to cloud object storage | Critical |
| 3 | Implement secrets management | Critical |
| 4 | Set up automated database backups | Critical |
| 5 | Add dead letter queue + alerting for BullMQ | High |
| 6 | Load test against performance NFRs | High |
| 7 | Review auth bypass RLS policies with security lens | High |
| 8 | CI/CD pipeline (Story 1.11) | High |
| 9 | Health check endpoint (Story 7.3) | Medium |
| 10 | Monitoring and observability (Epic 7) | Medium |
