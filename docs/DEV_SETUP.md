# Development Setup

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm (comes with Node.js)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd project_bubble
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your actual values (GEMINI_API_KEY, etc.)

# 3. Start infrastructure
docker-compose up -d

# 4. Verify infrastructure
docker exec project_bubble-postgres psql -U bubble_user -d bubble_db -c "SELECT 1;"
redis-cli ping  # Should return PONG

# 5. Serve applications
npx nx serve api-gateway    # NestJS API → http://localhost:3000/api
npx nx serve web            # Angular SPA → http://localhost:4200
npx nx serve worker-engine  # Background processor → http://localhost:3001
```

## Build & Test

```bash
npx nx build api-gateway
npx nx build worker-engine
npx nx build web

npx nx run-many -t lint --all
npx nx run-many -t test --all
```

## Infrastructure

| Service    | Port | Credentials                      |
|:-----------|:-----|:---------------------------------|
| PostgreSQL | 5432 | bubble_user / bubble_password    |
| Redis      | 6379 | No auth (dev only)               |
| API Gateway| 3000 | —                                |
| Worker     | 3001 | —                                |
| Angular    | 4200 | —                                |

## Project Structure

```
apps/api-gateway/    — NestJS HTTP API (Express)
apps/worker-engine/  — NestJS Background Processor
apps/web/            — Angular 21 SPA
libs/shared/         — Shared DTOs & Types (@project-bubble/shared)
libs/db-layer/       — Database Entities & Repos (@project-bubble/db-layer)
```
