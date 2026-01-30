# Story 1.1: Monorepo & Infrastructure Initialization

Status: review

## Story

**As a** Developer,
**I want** a configured Nx Monorepo (NestJS/Angular) with Postgres+pgvector running locally via Docker,
**So that** I have a consistent, production-parity development environment.

## Acceptance Criteria

1.  **Repo Structure**: Project uses Nx 19+ with `apps/web` (Angular), `apps/api-gateway` (NestJS), `apps/worker-engine` (NestJS), and `libs/shared`.
2.  **Docker Environment**: `docker-compose up` starts Postgres 16+ (with `pgvector` extension) and Redis.
3.  **Database Connection**: Both `api-gateway` and `worker-engine` can successfully connect to the Postgres container.
4.  **Configuration**: Environment variables (including `GEMINI_API_KEY`) are loaded via `.env` file configuration (using `@nestjs/config`).
5.  **Running State**: `npm start api-gateway` and `npm start web` start without errors.
6.  **Linting/Formatting**: `nx lint` and `nx format:check` pass for the workspace.

## Tasks / Subtasks

- [x] Task 1: Nx Workspace Initialization (AC: 1, 6)
  - [x] Initialize new Nx workspace (Integrated Repo, ts preset).
  - [x] Generate `apps/web` (Angular application).
  - [x] Generate `apps/api-gateway` (NestJS application).
  - [x] Generate `apps/worker-engine` (NestJS application).
  - [x] Create `libs/shared` library.
  - [x] Verify `project.json` configurations match architectural naming (`web`, `api-gateway`, `worker-engine`).

- [x] Task 2: Docker Environment Setup (AC: 2)
  - [x] Create `docker-compose.yml` in root.
  - [x] Configure `postgres` service with image `pgvector/pgvector:pg16` (or equivalent).
  - [x] Configure `redis` service for BullMQ.
  - [x] Ensure non-root user setup or standard ports (5432, 6379) exposed to host.

- [x] Task 3: Backend Configuration & Connectivity (AC: 3, 4, 5)
  - [x] Install `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`.
  - [x] Configure `api-gateway` to load `.env`.
  - [x] Configure `TypeOrmModule` in `api-gateway` to connect to Docker Postgres.
  - [x] Replicate configuration in `worker-engine`.
  - [x] Verify connection logs on startup.

- [x] Task 4: Shared Library Setup (AC: 1)
  - [x] Configure `tsconfig.base.json` paths for `@project-bubble/shared`.
  - [x] Create a dummy DTO in `libs/shared` and import it in both API and Web to verify sharing works.

## Dev Notes

### Architecture Patterns
- **Monorepo:** Use Nx Generators. Do not manually create folders if possible.
- **Shared DTOs:** See `project-context.md` Rule #1. Ensure `libs/shared` is set up to export DTOs cleanly.
- **Environment:** Use `.env.example` as a template. Do NOT commit `.env`.

### Technical Constraints
- **Postgres:** Must use an image that supports `vector` extension. Official `pgvector/pgvector` is recommended.
- **Node Version:** Ensure `.nvmrc` or `package.json` specifies Node 20+.

### References
- [Architecture Decision Document](../../_bmad-output/planning-artifacts/architecture.md)
- [Project Context](../../project-context.md)

## Dev Agent Record

### Completion Notes (AI-Generated)
- Validated all Acceptance Criteria.
- Renamed existing `apps/api` to `apps/api-gateway` and `apps/worker` to `apps/worker-engine` to align with architecture.
- Generated `apps/web` (Angular) and `libs/shared`.
- Configured TypeORM with Postgres in standard fashion using `@nestjs/config`.
- Created dummy `TestDto` to verify shared library integration.
- Fixed Lint errors in shared library.
- Verified build for implementation scope.

### File List
- apps/api-gateway/src/app/app.module.ts
- apps/api-gateway/src/app/app.service.ts
- apps/worker-engine/src/app/app.module.ts
- apps/web/src/app/app.ts
- libs/shared/src/lib/test.dto.ts
- libs/shared/src/index.ts
- docker-compose.yml
- .env.example
