# Story 1.1: Monorepo & Infrastructure Initialization

Status: ready-for-dev

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

- [ ] Task 1: Nx Workspace Initialization (AC: 1, 6)
  - [ ] Initialize new Nx workspace (Integrated Repo, ts preset).
  - [ ] Generate `apps/web` (Angular application).
  - [ ] Generate `apps/api-gateway` (NestJS application).
  - [ ] Generate `apps/worker-engine` (NestJS application).
  - [ ] Create `libs/shared` library.
  - [ ] Verify `project.json` configurations match architectural naming (`web`, `api-gateway`, `worker-engine`).

- [ ] Task 2: Docker Environment Setup (AC: 2)
  - [ ] Create `docker-compose.yml` in root.
  - [ ] Configure `postgres` service with image `pgvector/pgvector:pg16` (or equivalent).
  - [ ] Configure `redis` service for BullMQ.
  - [ ] Ensure non-root user setup or standard ports (5432, 6379) exposed to host.

- [ ] Task 3: Backend Configuration & Connectivity (AC: 3, 4, 5)
  - [ ] Install `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`.
  - [ ] Configure `api-gateway` to load `.env`.
  - [ ] Configure `TypeOrmModule` in `api-gateway` to connect to Docker Postgres.
  - [ ] Replicate configuration in `worker-engine`.
  - [ ] Verify connection logs on startup.

- [ ] Task 4: Shared Library Setup (AC: 1)
  - [ ] Configure `tsconfig.base.json` paths for `@project-bubble/shared`.
  - [ ] Create a dummy DTO in `libs/shared` and import it in both API and Web to verify sharing works.

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
- [To be filled by Dev Agent]

### File List
- [To be filled by Dev Agent]
