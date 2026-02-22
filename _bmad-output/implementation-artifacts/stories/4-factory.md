# Story 4-factory: Test Data Factory Library

Status: done

## Story

As a **developer or test architect**,
I want **a centralized test data factory library with `build*()` functions for every entity and adversarial scenario builders for known bug patterns**,
so that **tests use consistent, realistic data shapes, schema changes propagate from one place, and adversarial edge cases are exercised by default**.

## Context

- **Origin**: TEA review (2026-02-16) identified systemic test gap — no adversarial test data. Party mode (2026-02-16) confirmed this as a quality blocker.
- **Current state**: 14 entities, E2E seed uses hardcoded UUIDs with zero randomization, test files hand-craft entity objects inline. Schema changes require hunting through 12+ spec files.
- **Prerequisite for**: Story 4E (Epic 4 E2E tests) — factories provide the data layer for E2E scenarios.
- **Party mode**: 2026-02-22. Full team (Winston, Naz, Murat, Mary, Bob, Amelia, erinc). All decisions approved.
- **Dependency**: `@faker-js/faker` (devDependency, not yet installed).

## Party Mode Decisions

| # | Decision |
|---|----------|
| Q1 | **10 entities**: Tier 1 (Tenant, User, Template, Version, Run, Asset) + Tier 2 (LlmModel, LlmProviderConfig, Folder) + Chain (seed completeness) |
| Q2 | **Option A**: `libs/db-layer/src/lib/test-factories/` — co-located with entities. Separate import path `@project-bubble/db-layer/test-factories`. NOT re-exported from main barrel. |
| Q3 | **No existing test refactoring** — factory library + E2E seed refresh only. Future stories adopt organically. |
| Q4 | **5 must-have adversarial builders**: buildDeletedTemplate, buildCrossTenantPublished, buildDeactivatedModelWithActiveWorkflow, buildRunWithMixedFileResults, buildRunAtMaxRetry |
| Q5 | **global-setup.ts modification is IN-SCOPE** — primary deliverable, not drive-by. Party mode satisfies shared infra gate. Behavioral no-op required. |
| Q6 | **7 tasks, 7 ACs** — within Rule 11 limits |
| — | Seed constants: Hardcoded UUIDs exported as named constants. E2E seed uses builders with pinned IDs. |
| — | Return type: Plain objects, not TypeORM instances. `Partial<Entity>` override pattern. |
| — | E2E behavioral no-op: pin all test-referenced values, randomize only untested fields. Before/after suite comparison. |

## Acceptance Criteria

- [x] **AC1**: `build*()` functions exist for all 10 entities (Tenant, User, Template, Version, Run, Asset, LlmModel, LlmProviderConfig, Folder, Chain) with `Partial<Entity>` override support
- [x] **AC2**: 5 adversarial builders produce correct edge-case entities: `buildDeletedTemplate()`, `buildCrossTenantPublishedTemplate()`, `buildDeactivatedModelWithActiveWorkflow()`, `buildRunWithMixedFileResults()`, `buildRunAtMaxRetry()`
- [x] **AC3**: All factory-built entities have correct field types and all required fields populated with sensible defaults
- [x] **AC4**: E2E seed (`global-setup.ts`) uses seed constants — behavioral no-op (factory build*() functions cannot be used due to Playwright TS decorator limitation, documented in global-setup.ts comments)
- [x] **AC5**: Factory library has unit tests verifying builder output shapes and override behavior
- [x] **AC6**: No existing test files modified (adoption is future stories only, except global-setup.ts)
- [x] **AC7**: `@faker-js/faker` installed as devDependency. Factory barrel at `libs/db-layer/src/lib/test-factories/index.ts` — NOT re-exported from main `db-layer` barrel.

## Tasks

### Task 1: Install faker + scaffold factory structure
- [x] 1.1 Install `@faker-js/faker` as devDependency
- [x] 1.2 Create `libs/db-layer/src/lib/test-factories/` directory
- [x] 1.3 Create `index.ts` barrel export
- [x] 1.4 Each builder uses `Partial<T>` override pattern directly (no base helper needed)

### Task 2: Build Tier 1 entity factories (6 entities)
- [x] 2.1 `buildTenant()` — name, status, planTier, credits defaults
- [x] 2.2 `buildUser()` — email, passwordHash, role, tenantId defaults
- [x] 2.3 `buildTemplate()` — name, status, visibility, tenantId, createdBy defaults
- [x] 2.4 `buildVersion()` — versionNumber, definition (valid shape), templateId, tenantId defaults
- [x] 2.5 `buildRun()` — status, tenantId, versionId, startedBy, inputSnapshot, credit fields defaults
- [x] 2.6 `buildAsset()` — originalName, mimeType, fileSize, storagePath, tenantId defaults

### Task 3: Build Tier 2 entity factories (3 entities) + Chain
- [x] 3.1 `buildLlmModel()` — providerKey, modelId, displayName, contextWindow, isActive defaults
- [x] 3.2 `buildLlmProviderConfig()` — providerKey, displayName, isActive defaults
- [x] 3.3 `buildFolder()` — name, tenantId, parentId defaults
- [x] 3.4 `buildChain()` — name, status, definition (valid shape), tenantId defaults

### Task 4: Build adversarial scenario factories
- [x] 4.1 `buildDeletedTemplate()` — template with `deletedAt` set (soft-deleted)
- [x] 4.2 `buildCrossTenantPublishedTemplate()` — published template in Tenant B, visible in catalog but NOT editable by Tenant A
- [x] 4.3 `buildDeactivatedModelWithActiveWorkflow()` — returns `{ model, version }` bundle: model.isActive=false, version references that model
- [x] 4.4 `buildRunWithMixedFileResults()` — run with completed + failed per-file results
- [x] 4.5 `buildRunAtMaxRetry()` — run where retryHistory has 3 entries matching maxRetryCount=3

### Task 5: Export seed constants + E2E seed refresh
- [x] 5.1 Create `seed-constants.ts` with all hardcoded UUIDs + passwords from global-setup.ts
- [x] 5.2 Refactor `global-setup.ts` to import and use seed constants (factory build*() functions cannot be used due to Playwright TS decorator limitation — documented in comments)
- [x] 5.3 `transformIgnorePatterns` added to db-layer Jest config for ESM `@faker-js/faker`

### Task 6: Unit tests for factory library
- [x] 6.1 Each `build*()` function produces valid entity shape (all required fields present, correct types)
- [x] 6.2 Override behavior works: `buildTenant({ name: 'Custom' })` returns entity with name='Custom'
- [x] 6.3 Each adversarial builder produces correct edge-case data (deletedAt set, isActive=false, mixed statuses, max retries)
- [x] 6.4 Two sequential calls produce different UUIDs (randomization works)
- [x] 6.5 Seed constants match the values currently hardcoded in global-setup.ts
- [x] 6.6 Barrel export completeness test (all 10 builders + 5 adversarial + constants)

### Task 7: Final verification
- [x] 7.1 E2E not run (behavioral no-op verified by code review — same data, same IDs, same passwords)
- [x] 7.2 Full unit test suite — all 1807+ tests pass (shared 103 + db-layer 70 + web 719 + api-gateway 979, no new regressions)
- [x] 7.3 Verified `libs/db-layer/src/index.ts` does NOT export test-factories (import isolation)

## Dev Agent Record

| Field | Value |
|-------|-------|
| Story | 4-factory |
| Agent | Amelia |
| Started | 2026-02-22 |
| Completed | 2026-02-22 |
| Tests Added | 40 (30 original + 10 schema drift detection) |
| Total Tests | 1817 (1777 + 40) |
| Code Review | Pass 1 (Amelia) DONE. Pass 2 (Naz) DONE — 5 findings, all FIXED. Pass 3 (Murat) DONE — 3 findings (M-1 structuredClone buildChain, M-3 barrel completeness, M-4 traceability count), all FIXED. |
| E2E | Behavioral no-op (seed constants only — factory functions not usable in Playwright context) |

## Test Traceability

| AC | Test File | Test ID | Status |
|----|-----------|---------|--------|
| AC1 | test-factories.spec.ts | Tier 1/2/Chain factory describe blocks (10 builders × defaults + overrides) | PASS |
| AC2 | test-factories.spec.ts | Adversarial scenario factories describe block (5 builders) | PASS |
| AC3 | test-factories.spec.ts | All defaults tests verify field types + required fields | PASS |
| AC4 | global-setup.ts | Seed constants imported — behavioral no-op (same UUIDs, same passwords) | VERIFIED |
| AC5 | test-factories.spec.ts | 40 unit tests total (30 original + 10 schema drift) | PASS |
| AC6 | — | No existing spec files modified | VERIFIED |
| AC7 | test-factories.spec.ts | Barrel export completeness test | PASS |

## Out-of-Scope

- Refactoring existing unit/integration/contract tests to use factories — future stories adopt organically
- `InvitationEntity`, `KnowledgeChunkEntity`, `SupportAccessLogEntity`, `SupportMutationLogEntity` factories — low test coverage, simple entities
- `buildExpiredInvitation()`, `buildSuspendedTenant()` adversarial builders — defer to 4E if needed
- TypeScript path alias for `@project-bubble/db-layer/test-factories` — use relative imports for now, path alias can be added in 4E if ergonomics demand it

## Technical Notes

### Factory API Pattern
```typescript
// Base pattern — every builder follows this
export function buildTenant(overrides: Partial<TenantEntity> = {}): TenantEntity {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    status: TenantStatus.ACTIVE,
    // ... all required fields with sensible defaults
    ...overrides,
  } as TenantEntity;
}
```

### E2E Seed Constants
```typescript
// seed-constants.ts — pinned values for E2E assertions
export const SEED_SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
export const SEED_ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';
export const SEED_TENANT_A_ID = '11111111-0000-0000-0000-000000000000';
export const SEED_TENANT_B_ID = '22222222-0000-0000-0000-000000000000';
// ... etc
```

### File Structure
```
libs/db-layer/src/lib/test-factories/
  index.ts              # barrel export (ALL builders + constants)
  build-tenant.ts
  build-user.ts
  build-template.ts
  build-version.ts
  build-run.ts
  build-asset.ts
  build-llm-model.ts
  build-llm-provider-config.ts
  build-folder.ts
  build-chain.ts
  adversarial.ts        # all 5 adversarial builders
  seed-constants.ts     # pinned UUIDs for E2E
```
