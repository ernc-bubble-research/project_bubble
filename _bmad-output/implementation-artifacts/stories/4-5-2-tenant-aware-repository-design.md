# Story 4.5-2: TenantAwareRepository — Base Class Design & Implementation

Status: done

## Story

As a **developer implementing Story 4-5-3 (service migration)**,
I want **a `TenantAwareRepository<T>` base class that automatically merges `tenantId` into every TypeORM WHERE clause**,
so that **Rule 2c compliance is structurally enforced at the TypeScript type level — making it impossible to write a TypeORM call on a tenant-scoped entity without tenantId in the WHERE clause**.

## Context

This is Story 2 of Epic 4.5 (Tenant Hardening). It delivers the **base class only** — the reusable foundation that entity-specific repository subclasses will extend in Story 4-5-3.

**Design is LOCKED** from the Epic 4.5 kickoff party mode session (2026-03-01), confirmed by erinc. No re-evaluation needed. The design decisions below are final.

**Why this story exists:** Epic 4 had 12 Rule 2c violations across 6 stories — every single one was a human forgetting `tenantId` in WHERE. Honor-system code review cannot prevent this at scale. `TenantAwareRepository` makes the compliant path the ONLY path — you cannot call `assetRepo.findOne(tenantId, { where: { id } })` without providing tenantId as the first argument. TypeScript enforces it at compile time.

**Locked design decisions:**

| Decision | Chosen | Rejected | Rationale |
|----------|--------|----------|-----------|
| Pattern | Wrapper/composition | Class extension | TypeORM's `Repository<T>` is sealed by its factory system. Subclassing causes "cannot read property 'metadata' of undefined" at runtime — TypeORM's entity manager doesn't know how to instantiate the subclass via its factory. NOT a workaround-able problem. |
| `tenantId` placement | Required first parameter per method | Stored on instance | Singleton-safe: same NestJS `@Injectable()` singleton handles concurrent requests with different tenantIds. Stored instance state = data leak between requests. |
| CLS (`@nestjs/cls`) | REJECTED | — | CLS propagation failure is a runtime error (silent null = no rows returned, not an exception). TypeScript first-parameter is a compile-time error. BullMQ worker CLS propagation adds setup complexity for zero benefit over explicit params. |
| No-manager path | `txManager.run(tenantId, ...)` | Raw `dataSource.transaction()` | `txManager.run` sets `SET LOCAL app.current_tenant` → RLS active. Raw `dataSource.transaction()` does not set RLS. Defense-in-depth requires both layers. |

**Winston architectural review pre-fulfilled:** erinc confirmed via party mode session (2026-03-01). dev-story Winston gate is satisfied — do NOT re-open architectural review.

**Relationship to Story 4-5-1:** The CI grep script (`scripts/check-tenant-id.js`) will NOT flag `TenantAwareRepository`'s internal `manager.findOne(this.entityClass, opts)` calls as violations — because the `opts` object is assembled on the **preceding** line, so `where:` does not appear in the 10-line forward window after the call. The linter's `isFindLike && !window.includes('where:')` skip guard fires, classifying it as an RLS-context-only call. Zero violations expected. Verify in Task 4.

**What this story does NOT do:**
- Does NOT create entity-specific repositories (e.g., `AssetRepository`) — that is Story 4-5-3
- Does NOT migrate any services — that is Story 4-5-3
- Does NOT register anything new in `DbLayerModule` — entity repos are registered in 4-5-3
- Does NOT modify any existing service files

## Acceptance Criteria

1. `TenantAwareRepository<T extends ObjectLiteral>` class exists at `libs/db-layer/src/lib/repositories/tenant-aware.repository.ts`. It is a plain TypeScript class — NOT extending TypeORM's `Repository<T>`. Wrapper/composition only.

2. Constructor signature: `constructor(protected readonly entityClass: EntityTarget<T>, protected readonly txManager: TransactionManager)`. No per-request state stored on the instance — the class is a singleton-safe, stateless wrapper.

3. `tenantId: string` is the FIRST parameter in every public method signature. Optional `manager?: EntityManager` is the LAST parameter. When `manager` is provided: delegates to that manager directly (caller is inside a `txManager.run()` transaction with `SET LOCAL` already applied). When `manager` is omitted: wraps the operation in `this.txManager.run(tenantId, ...)` which creates a new transaction with `SET LOCAL app.current_tenant` applied.

4. Find-like methods — `findOne`, `find`, `findAndCount`, `count` — all merge `tenantId` into `options.where` via the `mergeWhere` private helper before passing to the EntityManager. Method signatures:
   - `findOne(tenantId: string, options: FindOneOptions<T>, manager?: EntityManager): Promise<T | null>`
   - `find(tenantId: string, options?: FindManyOptions<T>, manager?: EntityManager): Promise<T[]>`
   - `findAndCount(tenantId: string, options?: FindManyOptions<T>, manager?: EntityManager): Promise<[T[], number]>`
   - `count(tenantId: string, options?: FindManyOptions<T>, manager?: EntityManager): Promise<number>`

5. Write-like methods — `countBy`, `update`, `delete`, `softDelete`, `restore` — all merge `tenantId` into the `criteria` / `where` parameter via `mergeWhere` before passing to the EntityManager. Method signatures:
   - `countBy(tenantId: string, where: FindOptionsWhere<T> | FindOptionsWhere<T>[], manager?: EntityManager): Promise<number>`
   - `update(tenantId: string, criteria: FindOptionsWhere<T>, partial: QueryDeepPartialEntity<T>, manager?: EntityManager): Promise<UpdateResult>`
   - `delete(tenantId: string, criteria: FindOptionsWhere<T>, manager?: EntityManager): Promise<DeleteResult>`
   - `softDelete(tenantId: string, criteria: FindOptionsWhere<T>, manager?: EntityManager): Promise<UpdateResult>`
   - `restore(tenantId: string, criteria: FindOptionsWhere<T>, manager?: EntityManager): Promise<UpdateResult>`

6. `private mergeWhere(where, tenantId)` internal helper handles exactly three cases: (a) `undefined` → returns `{ tenantId }` cast to `FindOptionsWhere<T>`; (b) array → returns `where.map(w => ({ ...w, tenantId }))` — **NOT** `[...where, { tenantId }]` (spread appends a tenantId-only element to the OR list, which is wrong — each OR branch must include tenantId); (c) plain object → returns `{ ...where, tenantId }`.

7. Unit tests in `libs/db-layer/src/lib/repositories/tenant-aware.repository.spec.ts` cover: all three `mergeWhere` paths (undefined, single, array); all 9 methods delegate to EntityManager with tenantId merged into WHERE; the manager-provided path (passes to manager directly) **and** the manager-omitted path (calls `txManager.run(tenantId, ...)`) — the manager-omitted path must be tested for **all 9 methods**, with explicit `toHaveBeenCalledWith(tenantId, expect.any(Function))` assertion on `txManager.run` for each. Minimum **20** test cases with IDs `[4-5-2-UNIT-001]` through `[4-5-2-UNIT-020+]`. Priority: `[P1]`.

8. `TenantAwareRepository` exported from `libs/db-layer/src/lib/repositories/index.ts` and from `libs/db-layer/src/index.ts` (add `export * from './lib/repositories'`).

9. Running `npm run lint:tenant-id` against the full codebase after this story is implemented produces zero new violations — specifically zero violations in `tenant-aware.repository.ts`. Confirm and document the output in the Dev Agent Record.

10. `DbLayerModule` (`libs/db-layer/src/lib/db-layer.module.ts`) is **NOT modified** in this story. Entity-specific repository `@Injectable()` classes and their module registrations are created in Story 4-5-3.

## Tasks / Subtasks

- [x] Task 1: Implement `TenantAwareRepository<T>` base class (AC: 1, 2, 3, 4, 5, 6)
  - [x] 1.1: Create `libs/db-layer/src/lib/repositories/tenant-aware.repository.ts` as a plain TypeScript class (no `@Injectable()`, no TypeORM `@InjectRepository`, no extension of TypeORM `Repository<T>`). **Do NOT add `@Injectable()` to the base class** — only concrete subclasses created in Story 4-5-3 are `@Injectable()`. Adding it to the base class causes NestJS generic type erasure to break DI resolution at runtime (not a TypeScript error — a silent runtime failure).
  - [x] 1.2: Implement `private mergeWhere()` helper — handle undefined, single object, and array cases. Array case MUST use `map()`, not spread. Add inline comment explaining why: "spreading adds a tenantId-only element to the OR list — each OR branch must include tenantId individually via map"
  - [x] 1.3: Implement find-like methods: `findOne`, `find`, `findAndCount`, `count`. Each calls `this.mergeWhere(options?.where, tenantId)` and assigns result back into the options object before delegating to manager
  - [x] 1.4: Implement write-like methods: `countBy`, `update`, `delete`, `softDelete`, `restore`. Each calls `this.mergeWhere(criteria, tenantId)` before delegating to manager. **IMPORTANT — `countBy` is different from other write-like methods**: TypeORM's `countBy` signature accepts `FindOptionsWhere<T> | FindOptionsWhere<T>[]` (array-aware). Do NOT cast its result to `FindOptionsWhere<T>` — pass the `mergeWhere` result directly. Only `update`, `delete`, `softDelete`, `restore` use the `as FindOptionsWhere<T>` cast (they accept single only).
  - [x] 1.5: Implement both execution paths for every method: (a) `if (manager)` → delegate to provided manager; (b) else → `return this.txManager.run(tenantId, (mgr) => mgr.METHOD(...))`. The `else` path creates a fresh transaction with `SET LOCAL` applied.

- [x] Task 2: Write unit tests (AC: 7)
  - [x] 2.1: Create `libs/db-layer/src/lib/repositories/tenant-aware.repository.spec.ts`. Define a minimal `TestEntity` type and a concrete `TestRepository extends TenantAwareRepository<TestEntity>` subclass purely for testing. Mock both `txManager` and `entityManager` with `jest.fn()`.
  - [x] 2.2: Test `mergeWhere` private helper via method calls (indirect): write tests for `findOne` with `undefined` where, single where, and array where — verify the EntityManager call receives the merged WHERE object
  - [x] 2.3: Test manager-provided path: each method, when called with a mock manager, must call `mockManager.METHODNAME(entityClass, opts_with_tenantId)` and NOT call `txManager.run()`
  - [x] 2.4: Test manager-omitted path: each method, when called without manager, must verify **both** (a) `expect(mockTxManager.run).toHaveBeenCalledWith(tenantId, expect.any(Function))` — correct tenantId forwarded to txManager — AND (b) the EntityManager method receives the merged WHERE. The mock must capture tenantId: `run: jest.fn().mockImplementation((capturedTenantId, cb) => cb(mockManager))` — use the captured value in your assertion. Write explicit no-manager path tests for at minimum `update` and `delete` (in addition to the find-like methods).
  - [x] 2.5: Test the array-WHERE path specifically: `find(tenantId, { where: [{ id: '1' }, { status: 'active' }] })` must produce `[{ id: '1', tenantId }, { status: 'active', tenantId }]` in the EntityManager call — verify the array has 2 elements (not 3)

- [x] Task 3: Update barrel exports (AC: 8)
  - [x] 3.1: Update `libs/db-layer/src/lib/repositories/index.ts` to export `TenantAwareRepository`
  - [x] 3.2: Add `export * from './lib/repositories';` to `libs/db-layer/src/index.ts`

- [x] Task 4: Validate CI script produces zero violations (AC: 9)
  - [x] 4.0: Verify Nx project name before running tests: `npx nx show projects | grep db` — confirm the project name to use (expected: `db-layer`). Update test run command if different.
  - [x] 4.1: Run `npm run lint:tenant-id` after implementation. Confirm zero violations in `libs/db-layer/src/lib/repositories/tenant-aware.repository.ts`
  - [x] 4.2: Confirm total violation count matches the Story 4-5-1 baseline (13 violations in api-gateway — no new violations introduced). Document output in Dev Agent Record.

## Dev Notes

### Implementation Guide

**Class skeleton:**

```typescript
// libs/db-layer/src/lib/repositories/tenant-aware.repository.ts
import {
  DeleteResult,
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  UpdateResult,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TransactionManager } from '../transaction-manager';

export class TenantAwareRepository<T extends ObjectLiteral> {
  constructor(
    protected readonly entityClass: EntityTarget<T>,
    protected readonly txManager: TransactionManager,
  ) {}

  private mergeWhere(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined,
    tenantId: string,
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    if (!where) {
      return { tenantId } as unknown as FindOptionsWhere<T>;
    }
    if (Array.isArray(where)) {
      // Map — NOT spread. Spread would add a tenantId-only element to the OR list.
      // Each OR branch must individually include tenantId.
      return where.map((w) => ({ ...w, tenantId }));
    }
    return { ...where, tenantId };
  }

  findOne(
    tenantId: string,
    options: FindOneOptions<T>,
    manager?: EntityManager,
  ): Promise<T | null> {
    const opts = { ...options, where: this.mergeWhere(options.where, tenantId) };
    if (manager) {
      return manager.findOne(this.entityClass, opts);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.findOne(this.entityClass, opts));
  }

  // ... find, findAndCount, count follow same pattern ...

  update(
    tenantId: string,
    criteria: FindOptionsWhere<T>,
    partial: QueryDeepPartialEntity<T>,
    manager?: EntityManager,
  ): Promise<UpdateResult> {
    const where = this.mergeWhere(criteria, tenantId) as FindOptionsWhere<T>;
    if (manager) {
      return manager.update(this.entityClass, where, partial);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.update(this.entityClass, where, partial));
  }

  // ... delete, softDelete, restore, countBy follow same write-like pattern ...
}
```

**⚠️ NESTED TRANSACTION WARNING — critical for Story 4-5-3 authors:**
When a caller is already inside a `txManager.run()` block and calls a repo method **without** passing `manager`, `TenantAwareRepository` creates a **new inner transaction** (PostgreSQL backs these with SAVEPOINTs — functionally safe but wasteful: extra round-trip + SAVEPOINT overhead per call). Always pass the outer `manager` into repo method calls when you are already inside a transaction. Omitting `manager` inside an existing `txManager.run()` is never incorrect, but it is inefficient. The multi-op transaction example below shows the correct pattern.

**How entity-specific repos will look (4-5-3 pattern — for reference):**

```typescript
// Future (Story 4-5-3): libs/db-layer/src/lib/repositories/asset.repository.ts
@Injectable()
export class AssetRepository extends TenantAwareRepository<AssetEntity> {
  constructor(txManager: TransactionManager) {
    super(AssetEntity, txManager);
  }
}

// Future (Story 4-5-3): Service usage
// BEFORE (raw manager):
await this.txManager.run(tenantId, async (manager) =>
  manager.findOne(AssetEntity, { where: { id, tenantId } })
);

// AFTER (TenantAwareRepository):
// Single-op standalone read:
await this.assetRepo.findOne(tenantId, { where: { id } });

// Multi-op transaction (manager passed through):
await this.txManager.run(tenantId, async (manager) => {
  const asset = await this.assetRepo.findOne(tenantId, { where: { id } }, manager);
  await this.assetRepo.update(tenantId, { id }, { isIndexed: true }, manager);
});
```

**TypeScript type note:** `QueryDeepPartialEntity<T>` is TypeORM's internal type for partial entity updates. It's imported from `'typeorm/query-builder/QueryPartialEntity'` (not the main typeorm barrel). This is a TypeORM implementation detail — import it as shown.

**Why `as FindOptionsWhere<T>` cast in write-like methods — and why `countBy` is the exception:**
- `update`, `delete`, `softDelete`, `restore`: TypeORM accepts single `FindOptionsWhere<T>` only. Cast the `mergeWhere` result: `const where = this.mergeWhere(criteria, tenantId) as FindOptionsWhere<T>`. In practice criteria are always a single object, so the array case won't occur — but TypeScript doesn't know this. The cast is safe.
- **`countBy` — do NOT cast**: TypeORM's `countBy` accepts `FindOptionsWhere<T> | FindOptionsWhere<T>[]` (it is array-aware). Pass the `mergeWhere` result directly without casting. Casting to `FindOptionsWhere<T>` would silently break array-WHERE calls at the TypeScript type level.

### CI Script Compatibility

`TenantAwareRepository`'s internal calls to `manager.findOne(this.entityClass, opts)` will NOT be flagged by the 4-5-1 CI script because:
1. The linter extracts a 10-line forward window after each `FIND_OPS` match
2. In `TenantAwareRepository`, the `opts` object is assembled on the **preceding** line (`const opts = ...`) — so `where:` does NOT appear in the forward window after the `manager.findOne(...)` call
3. The linter's `isFindLike && !window.includes('where:')` skip guard then fires: no `where:` in window → the call is classified as an RLS-context-only call (safe) and skipped
4. This is the same guard that covers `.findOne(entityClass, options)` calls throughout the codebase (UNIT-008 scenario)

Result: Zero violations expected. Verify in Task 4.

### Test Patterns

**Concrete test subclass pattern (mirrors TransactionManager.spec.ts style):**

```typescript
// In the spec file — define minimal test types.
// IMPORTANT: Must be a CLASS, not an interface — EntityTarget<T> needs a constructor value.
// Interfaces cannot be used as values (TypeScript TS2693 error).
class TestEntity implements ObjectLiteral {
  id!: string;
  tenantId!: string;
  status?: string;
}

class TestRepository extends TenantAwareRepository<TestEntity> {
  constructor(txManager: TransactionManager) {
    super(TestEntity, txManager); // No double cast needed — class is a valid value
  }
}

// In beforeEach:
let mockTxManager: jest.Mocked<TransactionManager>;
let mockManager: jest.Mocked<EntityManager>;
let repo: TestRepository;

beforeEach(() => {
  mockManager = {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    countBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
  } as unknown as jest.Mocked<EntityManager>;

  mockTxManager = {
    // Capture tenantId so tests can assert it was forwarded correctly
    run: jest.fn().mockImplementation((capturedTenantId, cb) => cb(mockManager)),
  } as unknown as jest.Mocked<TransactionManager>;

  repo = new TestRepository(mockTxManager);
});
```

**Array-WHERE critical test (UNIT-015 equivalent):**

```typescript
it('[4-5-2-UNIT-015] array WHERE: each element gets tenantId via map, not spread', async () => {
  // Given
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const where = [{ id: 'id-1' }, { status: 'active' }];
  mockManager.find.mockResolvedValue([]);

  // When
  await repo.find(tenantId, { where }, mockManager);

  // Then
  const callArgs = mockManager.find.mock.calls[0];
  const passedOptions = callArgs[1] as FindManyOptions<TestEntity>;
  expect(Array.isArray(passedOptions.where)).toBe(true);
  expect((passedOptions.where as FindOptionsWhere<TestEntity>[]).length).toBe(2); // NOT 3 (spread trap)
  expect(passedOptions.where).toEqual([
    { id: 'id-1', tenantId },
    { status: 'active', tenantId },
  ]);
});
```

**No-manager path assertion pattern (required for all 9 methods):**

```typescript
it('[4-5-2-UNIT-016] update: no-manager path forwards tenantId to txManager.run', async () => {
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  mockManager.update.mockResolvedValue({ affected: 1 } as UpdateResult);

  await repo.update(tenantId, { id: 'some-id' }, { status: 'done' });

  // tenantId must be forwarded to txManager.run — not just embedded in WHERE
  expect(mockTxManager.run).toHaveBeenCalledWith(tenantId, expect.any(Function));
  // EntityManager must receive merged WHERE
  expect(mockManager.update).toHaveBeenCalledWith(
    expect.anything(),
    { id: 'some-id', tenantId },
    { status: 'done' },
  );
});
```

### Testing Notes

- Story test ID prefix: `[4-5-2-UNIT-NNN]`
- Priority: `[P1]`
- No DB needed — pure unit tests of WHERE-merging logic
- Test file runs via `npx nx test db-layer --testFile libs/db-layer/src/lib/repositories/tenant-aware.repository.spec.ts`

### Project Structure Notes

- **New file:** `libs/db-layer/src/lib/repositories/tenant-aware.repository.ts`
- **New file:** `libs/db-layer/src/lib/repositories/tenant-aware.repository.spec.ts`
- **Modified:** `libs/db-layer/src/lib/repositories/index.ts` (add export)
- **Modified:** `libs/db-layer/src/index.ts` (add `export * from './lib/repositories'`)
- **NOT modified:** `libs/db-layer/src/lib/db-layer.module.ts` (entity repos registered in 4-5-3)
- The `libs/db-layer/src/lib/repositories/` directory already exists with a placeholder `index.ts`

### Out-of-Scope

| Item | Where Tracked |
|------|---------------|
| Entity-specific repository classes (AssetRepository, FolderRepository, etc.) | Story 4-5-3 |
| Service migration from TransactionManager to TenantAwareRepository | Story 4-5-3 |
| DbLayerModule registration of entity repos | Story 4-5-3 |
| Test mock updates for services using TenantAwareRepository | Story 4-5-4 |
| Switching CI script to `--strict` mode | Story 4-5-3 final AC |
| `save`, `insert`, `upsert` methods — omitted by design; write-path for new records uses `manager.save()` or `manager.insert()` directly inside `txManager.run()` where RLS is already set. These methods accept partial entities (not WHERE clauses) so mergeWhere doesn't apply. Add in a future story if a pattern emerges. | Future story (TBD if needed) |

### References

- Rule 2c (tenantId in ALL WHERE clauses): [project-context.md](../../project-context.md) §"2c. Defense-in-Depth"
- Rule 2a (TransactionManager injection): [project-context.md](../../project-context.md) §"2. Security by Consumption"
- `TransactionManager` implementation: [libs/db-layer/src/lib/transaction-manager.ts](../../../../libs/db-layer/src/lib/transaction-manager.ts)
- `TransactionManager` test pattern reference: [libs/db-layer/src/lib/transaction-manager.spec.ts](../../../../libs/db-layer/src/lib/transaction-manager.spec.ts)
- Story 4-5-1 (CI script that validates this story's output): [4-5-1-ci-tenantid-grep-allowlist.md](./4-5-1-ci-tenantid-grep-allowlist.md)
- Design decisions record: sprint-status.yaml line 702

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Winston Architectural Review

Design locked and confirmed by erinc via Epic 4.5 kickoff party mode session (2026-03-01). Key decisions confirmed: wrapper/composition pattern, method injection API (tenantId as first param), CLS rejected, `txManager.run()` for no-manager path, 9 methods. **Winston gate pre-fulfilled for this story — no re-review required.**

### Debug Log References

- TypeScript error TS2693: `TestEntity` defined as `interface` — can't be used as EntityTarget value. Fixed by converting to `class TestEntity implements ObjectLiteral`. No cast needed: `super(TestEntity, txManager)`.
- TypeScript error TS2345: `{ status: 'done' }` not assignable to `QueryDeepPartialEntity<TestEntity>`. Fixed by adding `as QueryDeepPartialEntity<TestEntity>` cast in test call sites (matchers unaffected).
- Naz Pass 2 — N1 (MEDIUM): UNIT-010, 011 (findAndCount/count no-manager) and UNIT-019, 020 (softDelete/restore no-manager) were missing the EntityManager `toHaveBeenCalledWith` merged-WHERE assertion. Added assertions. Fixed.
- Naz Pass 2 — N2 (MEDIUM): Manager-provided path had no tenantId validation — a programming error (empty string or non-UUID tenantId) would silently produce zero rows. Fixed by adding UUID validation guard at top of `mergeWhere` (same regex as TransactionManager). `mergeWhere` throws synchronously so test assertions use `expect(() => repo.METHOD(...)).toThrow()` — not `.rejects.toThrow()`. Tests: UNIT-024, 025 added.
- Naz Pass 2 — N3 (LOW): `EntityTarget` imported but unused in spec. Removed.
- Naz Pass 2 — N4 (LOW): `save`/`insert`/`upsert` not in Out-of-Scope table. Added to Out-of-Scope table with rationale.
- Naz Pass 2 — N5 (LOW): Empty-array WHERE edge case unverified. Added UNIT-023 (countBy with `[]` — maps to `[]`, TypeORM returns 0 rows, deterministic).
- Murat Pass 3 — M1 (MEDIUM): Return value never asserted — delegation correctness gap for wrapper class. Added `expect(result).toBe(...)` to UNIT-004, 008, 012, 017, 027. Fixed.
- Murat Pass 3 — M2 (MEDIUM): Validation tests only covered manager-provided path — no test verified no-manager path throws on invalid tenantId. Added UNIT-026 (`find('not-a-uuid')` with no manager → throws, `txManager.run` not called). Fixed.
- Murat Pass 3 — L1 (LOW): `entityClass` always `expect.anything()` — no test confirmed it's `TestEntity`. Added `mock.calls[0][0] === TestEntity` check to UNIT-004 (manager path) and UNIT-008 (no-manager path). Fixed.
- Murat Pass 3 — L2 (LOW): `find(TENANT_ID)` no-options + no-manager path untested. Added UNIT-027. Fixed.
- Murat Pass 3 — L3 (LOW): File List said "MODIFIED: story file" but file is new. Corrected to "NEW". Fixed.

### Completion Notes List

- ✅ `TenantAwareRepository<T>` implemented as wrapper/composition class (no TypeORM Repository extension). 9 methods: findOne, find, findAndCount, count, countBy, update, delete, softDelete, restore.
- ✅ `mergeWhere` private helper: 3 cases (undefined → `{tenantId}`, array → map each element NOT spread, object → `{...where, tenantId}`). Array comment explains the invariant.
- ✅ Both execution paths per method: `if (manager)` → delegate directly; else → `txManager.run(tenantId, ...)`.
- ✅ `countBy` is NOT cast to single `FindOptionsWhere<T>` — array-safe. All other write-ops use `as FindOptionsWhere<T>` cast.
- ✅ 27 unit tests, all pass. Coverage: all 3 mergeWhere paths + all 9 methods × both execution paths + countBy array-safe path + no-options find (manager + no-manager, UNIT-022, 027) + empty-array edge case (UNIT-023) + tenantId validation throws (UNIT-024, 025, 026) + return value propagation (UNIT-004, 008, 012, 017, 027) + entityClass verification (UNIT-004, 008).
- ✅ `txManager.run` assertions include `toHaveBeenCalledWith(tenantId, expect.any(Function))` for all no-manager tests.
- ✅ UUID validation in `mergeWhere` — throws `'Invalid tenant ID format'` on empty string or non-UUID input. Same regex as TransactionManager. Prevents silent empty-result bugs from programming errors.
- ✅ Return value propagation verified for both execution paths (Murat M1 resolved).
- ✅ No-manager path validation covered by UNIT-026 (Murat M2 resolved).
- ✅ Barrel exports updated: `lib/repositories/index.ts` + `src/index.ts`.
- ✅ `npm run lint:tenant-id` → 0 violations in tenant-aware.repository.ts. Total = 13 (unchanged baseline from 4-5-1).
- ✅ Nx project name verified: `db-layer`.
- ✅ db-layer: 107 tests pass (27 new + 80 pre-existing). Zero regressions.
- ✅ Naz Pass 2 — all 5 findings (N1-N5) addressed and verified passing.
- ✅ Murat Pass 3 — all 5 findings (M1, M2, L1, L2, L3) addressed and verified passing.

### Traceability

| AC | Test ID(s) | Status |
|----|-----------|--------|
| AC1 — class at correct path, wrapper only | [4-5-2-UNIT-004] (findOne manager path) | ✅ |
| AC2 — constructor signature, singleton-safe | [4-5-2-UNIT-004..007] (manager-provided, no txManager.run) | ✅ |
| AC3 — tenantId first, manager last, two paths | [4-5-2-UNIT-008..011, 017..021] (no-manager) / [004..007, 012..016] (manager) | ✅ |
| AC4 — find-like methods merge into options.where | [4-5-2-UNIT-001..003, 004..007, 008..011] | ✅ |
| AC5 — write-like methods merge criteria | [4-5-2-UNIT-012..016, 017..021] | ✅ |
| AC6 — mergeWhere: 3 cases, array uses map not spread | [4-5-2-UNIT-001, 002, 003] | ✅ |
| AC7 — 20+ unit tests, manager-omitted for all 9 | 27 tests (UNIT-001..027) incl. validation + edge cases + return value + entityClass | ✅ |
| AC8 — barrel exports | N/A (verified by lib compilation) | ✅ |
| AC9 — zero CI violations | `npm run lint:tenant-id` output: 13 (all pre-existing) | ✅ |
| AC10 — DbLayerModule NOT modified | `libs/db-layer/src/lib/db-layer.module.ts` untouched | ✅ |

### File List

- `libs/db-layer/src/lib/repositories/tenant-aware.repository.ts` — NEW: TenantAwareRepository<T> base class
- `libs/db-layer/src/lib/repositories/tenant-aware.repository.spec.ts` — NEW: 27 unit tests (incl. Naz N1-N5 + Murat M1-M2-L1-L2-L3 fixes)
- `libs/db-layer/src/lib/repositories/index.ts` — MODIFIED: add export
- `libs/db-layer/src/index.ts` — MODIFIED: add `export * from './lib/repositories'`
- `_bmad-output/implementation-artifacts/stories/4-5-2-tenant-aware-repository-design.md` — NEW: story file (created for this story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED: status in-progress → review

