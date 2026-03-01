import {
  DeleteResult,
  EntityManager,
  FindManyOptions,
  FindOptionsWhere,
  ObjectLiteral,
  UpdateResult,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TransactionManager } from '../transaction-manager';
import { TenantAwareRepository } from './tenant-aware.repository';

// Minimal test entity class (must be a class, not an interface — EntityTarget needs a constructor value)
class TestEntity implements ObjectLiteral {
  id!: string;
  tenantId!: string;
  status?: string;
}

// Concrete subclass for testing — no @Injectable on base class
class TestRepository extends TenantAwareRepository<TestEntity> {
  constructor(txManager: TransactionManager) {
    super(TestEntity, txManager);
  }
}

describe('TenantAwareRepository [P1]', () => {
  const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const OTHER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  let mockManager: jest.Mocked<EntityManager>;
  let mockTxManager: jest.Mocked<TransactionManager>;
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

  // ─────────────────────────────────────────────────────────────────────────
  // mergeWhere via findOne (indirect tests for all 3 cases)
  // ─────────────────────────────────────────────────────────────────────────

  describe('mergeWhere — undefined case', () => {
    it('[4-5-2-UNIT-001] findOne: undefined where → { tenantId }', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await repo.findOne(TENANT_ID, {}, mockManager);

      const opts = mockManager.findOne.mock.calls[0][1] as { where: unknown };
      expect(opts.where).toEqual({ tenantId: TENANT_ID });
    });
  });

  describe('mergeWhere — single object case', () => {
    it('[4-5-2-UNIT-002] findOne: single where object → merged with tenantId', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await repo.findOne(TENANT_ID, { where: { id: OTHER_ID } }, mockManager);

      const opts = mockManager.findOne.mock.calls[0][1] as { where: unknown };
      expect(opts.where).toEqual({ id: OTHER_ID, tenantId: TENANT_ID });
    });
  });

  describe('mergeWhere — array case (critical)', () => {
    it('[4-5-2-UNIT-003] find: array WHERE → each element gets tenantId via map, NOT spread (length must be 2 not 3)', async () => {
      mockManager.find.mockResolvedValue([]);

      await repo.find(TENANT_ID, { where: [{ id: 'id-1' }, { status: 'active' }] }, mockManager);

      const opts = mockManager.find.mock.calls[0][1] as FindManyOptions<TestEntity>;
      expect(Array.isArray(opts.where)).toBe(true);
      // Must be 2 elements (map), not 3 (spread would add tenantId-only element)
      expect((opts.where as FindOptionsWhere<TestEntity>[]).length).toBe(2);
      expect(opts.where).toEqual([
        { id: 'id-1', tenantId: TENANT_ID },
        { status: 'active', tenantId: TENANT_ID },
      ]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Find-like methods — manager-provided path
  // ─────────────────────────────────────────────────────────────────────────

  describe('find-like methods — manager provided (bypasses txManager)', () => {
    it('[4-5-2-UNIT-004] findOne: manager provided → calls manager.findOne, NOT txManager.run; return value propagated', async () => {
      const entity = { id: OTHER_ID, tenantId: TENANT_ID } as TestEntity;
      mockManager.findOne.mockResolvedValue(entity);

      const result = await repo.findOne(TENANT_ID, { where: { id: OTHER_ID } }, mockManager);

      expect(result).toBe(entity); // M1: delegation returns the manager's result
      expect(mockManager.findOne.mock.calls[0][0]).toBe(TestEntity); // L1: entityClass correctly forwarded
      expect(mockManager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        { where: { id: OTHER_ID, tenantId: TENANT_ID } },
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });

    it('[4-5-2-UNIT-005] find: manager provided → calls manager.find, NOT txManager.run', async () => {
      mockManager.find.mockResolvedValue([]);

      await repo.find(TENANT_ID, { where: { status: 'active' } }, mockManager);

      expect(mockManager.find).toHaveBeenCalledWith(
        expect.anything(),
        { where: { status: 'active', tenantId: TENANT_ID } },
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });

    it('[4-5-2-UNIT-006] findAndCount: manager provided → calls manager.findAndCount, NOT txManager.run', async () => {
      mockManager.findAndCount.mockResolvedValue([[], 0]);

      await repo.findAndCount(TENANT_ID, { where: { status: 'done' } }, mockManager);

      expect(mockManager.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        { where: { status: 'done', tenantId: TENANT_ID } },
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });

    it('[4-5-2-UNIT-007] count: manager provided → calls manager.count, NOT txManager.run', async () => {
      mockManager.count.mockResolvedValue(5);

      await repo.count(TENANT_ID, { where: { status: 'active' } }, mockManager);

      expect(mockManager.count).toHaveBeenCalledWith(
        expect.anything(),
        { where: { status: 'active', tenantId: TENANT_ID } },
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Find-like methods — manager-omitted path (txManager.run called)
  // ─────────────────────────────────────────────────────────────────────────

  describe('find-like methods — no manager (wraps in txManager.run)', () => {
    it('[4-5-2-UNIT-008] findOne: no manager → txManager.run(tenantId, ...) called; return value propagated', async () => {
      const entity = { id: OTHER_ID, tenantId: TENANT_ID } as TestEntity;
      mockManager.findOne.mockResolvedValue(entity);

      const result = await repo.findOne(TENANT_ID, { where: { id: OTHER_ID } });

      expect(result).toBe(entity); // M1: result propagates through txManager.run
      expect(mockManager.findOne.mock.calls[0][0]).toBe(TestEntity); // L1: entityClass correctly forwarded
      expect(mockTxManager.run).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(mockManager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        { where: { id: OTHER_ID, tenantId: TENANT_ID } },
      );
    });

    it('[4-5-2-UNIT-009] find: no manager → txManager.run(tenantId, ...) called with correct tenantId', async () => {
      mockManager.find.mockResolvedValue([]);

      await repo.find(TENANT_ID, { where: { status: 'active' } });

      expect(mockTxManager.run).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(mockManager.find).toHaveBeenCalledWith(
        expect.anything(),
        { where: { status: 'active', tenantId: TENANT_ID } },
      );
    });

    it('[4-5-2-UNIT-010] findAndCount: no manager → txManager.run(tenantId, ...) called with correct tenantId and merged WHERE forwarded', async () => {
      mockManager.findAndCount.mockResolvedValue([[], 0]);

      await repo.findAndCount(TENANT_ID, { where: { status: 'done' } });

      expect(mockTxManager.run).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(mockManager.findAndCount).toHaveBeenCalledWith(
        expect.anything(),
        { where: { status: 'done', tenantId: TENANT_ID } },
      );
    });

    it('[4-5-2-UNIT-011] count: no manager → txManager.run(tenantId, ...) called with correct tenantId and merged WHERE forwarded', async () => {
      mockManager.count.mockResolvedValue(3);

      await repo.count(TENANT_ID, { where: { status: 'active' } });

      expect(mockTxManager.run).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(mockManager.count).toHaveBeenCalledWith(
        expect.anything(),
        { where: { status: 'active', tenantId: TENANT_ID } },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Write-like methods — manager-provided path
  // ─────────────────────────────────────────────────────────────────────────

  describe('write-like methods — manager provided', () => {
    it('[4-5-2-UNIT-012] update: manager provided → calls manager.update with merged WHERE, NOT txManager.run; return value propagated', async () => {
      const updateResult = { affected: 1 } as UpdateResult;
      mockManager.update.mockResolvedValue(updateResult);

      const result = await repo.update(TENANT_ID, { id: OTHER_ID }, { status: 'done' } as QueryDeepPartialEntity<TestEntity>, mockManager);

      expect(result).toBe(updateResult); // M1: delegation returns the manager's result
      expect(mockManager.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: OTHER_ID, tenantId: TENANT_ID },
        { status: 'done' },
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });

    it('[4-5-2-UNIT-013] delete: manager provided → calls manager.delete with merged WHERE, NOT txManager.run', async () => {
      mockManager.delete.mockResolvedValue({ affected: 1 } as DeleteResult);

      await repo.delete(TENANT_ID, { id: OTHER_ID }, mockManager);

      expect(mockManager.delete).toHaveBeenCalledWith(
        expect.anything(),
        { id: OTHER_ID, tenantId: TENANT_ID },
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });

    it('[4-5-2-UNIT-014] softDelete: manager provided → calls manager.softDelete with merged WHERE', async () => {
      mockManager.softDelete.mockResolvedValue({ affected: 1 } as UpdateResult);

      await repo.softDelete(TENANT_ID, { id: OTHER_ID }, mockManager);

      expect(mockManager.softDelete).toHaveBeenCalledWith(
        expect.anything(),
        { id: OTHER_ID, tenantId: TENANT_ID },
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });

    it('[4-5-2-UNIT-015] restore: manager provided → calls manager.restore with merged WHERE', async () => {
      mockManager.restore.mockResolvedValue({ affected: 1 } as UpdateResult);

      await repo.restore(TENANT_ID, { id: OTHER_ID }, mockManager);

      expect(mockManager.restore).toHaveBeenCalledWith(
        expect.anything(),
        { id: OTHER_ID, tenantId: TENANT_ID },
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });

    it('[4-5-2-UNIT-016] countBy: manager provided → calls manager.countBy with merged WHERE (no single-type cast)', async () => {
      mockManager.countBy.mockResolvedValue(2);

      await repo.countBy(TENANT_ID, { status: 'active' }, mockManager);

      expect(mockManager.countBy).toHaveBeenCalledWith(
        expect.anything(),
        { status: 'active', tenantId: TENANT_ID },
      );
      expect(mockTxManager.run).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Write-like methods — manager-omitted path (txManager.run called)
  // ─────────────────────────────────────────────────────────────────────────

  describe('write-like methods — no manager (wraps in txManager.run)', () => {
    it('[4-5-2-UNIT-017] update: no manager → txManager.run(tenantId, ...) + merged WHERE forwarded; return value propagated', async () => {
      const updateResult = { affected: 1 } as UpdateResult;
      mockManager.update.mockResolvedValue(updateResult);

      const result = await repo.update(TENANT_ID, { id: OTHER_ID }, { status: 'done' } as QueryDeepPartialEntity<TestEntity>);

      expect(result).toBe(updateResult); // M1: result propagates through txManager.run
      expect(mockTxManager.run).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(mockManager.update).toHaveBeenCalledWith(
        expect.anything(),
        { id: OTHER_ID, tenantId: TENANT_ID },
        { status: 'done' },
      );
    });

    it('[4-5-2-UNIT-018] delete: no manager → txManager.run(tenantId, ...) + merged WHERE forwarded', async () => {
      mockManager.delete.mockResolvedValue({ affected: 1 } as DeleteResult);

      await repo.delete(TENANT_ID, { id: OTHER_ID });

      expect(mockTxManager.run).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(mockManager.delete).toHaveBeenCalledWith(
        expect.anything(),
        { id: OTHER_ID, tenantId: TENANT_ID },
      );
    });

    it('[4-5-2-UNIT-019] softDelete: no manager → txManager.run(tenantId, ...) called and merged WHERE forwarded', async () => {
      mockManager.softDelete.mockResolvedValue({ affected: 1 } as UpdateResult);

      await repo.softDelete(TENANT_ID, { id: OTHER_ID });

      expect(mockTxManager.run).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(mockManager.softDelete).toHaveBeenCalledWith(
        expect.anything(),
        { id: OTHER_ID, tenantId: TENANT_ID },
      );
    });

    it('[4-5-2-UNIT-020] restore: no manager → txManager.run(tenantId, ...) called and merged WHERE forwarded', async () => {
      mockManager.restore.mockResolvedValue({ affected: 1 } as UpdateResult);

      await repo.restore(TENANT_ID, { id: OTHER_ID });

      expect(mockTxManager.run).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(mockManager.restore).toHaveBeenCalledWith(
        expect.anything(),
        { id: OTHER_ID, tenantId: TENANT_ID },
      );
    });

    it('[4-5-2-UNIT-021] countBy: no manager → txManager.run(tenantId, ...) + array-safe (no cast)', async () => {
      mockManager.countBy.mockResolvedValue(3);

      await repo.countBy(TENANT_ID, [{ id: 'id-1' }, { status: 'active' }]);

      expect(mockTxManager.run).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      // Array must be preserved — countBy accepts FindOptionsWhere<T>[]
      expect(mockManager.countBy).toHaveBeenCalledWith(
        expect.anything(),
        [{ id: 'id-1', tenantId: TENANT_ID }, { status: 'active', tenantId: TENANT_ID }],
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // find: no options provided (undefined where)
  // ─────────────────────────────────────────────────────────────────────────

  describe('find with no options', () => {
    it('[4-5-2-UNIT-022] find: no options + manager provided → where defaults to { tenantId }', async () => {
      mockManager.find.mockResolvedValue([]);

      await repo.find(TENANT_ID, undefined, mockManager);

      expect(mockManager.find).toHaveBeenCalledWith(
        expect.anything(),
        { where: { tenantId: TENANT_ID } },
      );
    });

    it('[4-5-2-UNIT-027] find: no options + no manager → txManager.run called + { where: { tenantId } } forwarded', async () => {
      mockManager.find.mockResolvedValue([]);

      const result = await repo.find(TENANT_ID);

      expect(result).toEqual([]); // M1 coverage for this path
      expect(mockTxManager.run).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
      expect(mockManager.find).toHaveBeenCalledWith(
        expect.anything(),
        { where: { tenantId: TENANT_ID } },
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Empty-array WHERE edge case (N5)
  // ─────────────────────────────────────────────────────────────────────────

  describe('empty-array WHERE edge case', () => {
    it('[4-5-2-UNIT-023] countBy: empty array WHERE → passes empty array through (zero-result, tenantId irrelevant)', async () => {
      mockManager.countBy.mockResolvedValue(0);

      await repo.countBy(TENANT_ID, [], mockManager);

      // Empty array after map is still empty — TypeORM returns 0 rows for empty OR list.
      // tenantId is structurally correct (no rows to add it to), result is deterministic.
      expect(mockManager.countBy).toHaveBeenCalledWith(
        expect.anything(),
        [],
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // tenantId validation (N2 — covers manager-provided path, both empty and non-UUID)
  // ─────────────────────────────────────────────────────────────────────────

  describe('tenantId validation — invalid inputs throw before reaching EntityManager', () => {
    it('[4-5-2-UNIT-024] findOne: empty string tenantId → throws Invalid tenant ID format', () => {
      // mergeWhere throws synchronously — use toThrow, not rejects.toThrow
      expect(() =>
        repo.findOne('', { where: { id: OTHER_ID } }, mockManager),
      ).toThrow('Invalid tenant ID format');

      expect(mockManager.findOne).not.toHaveBeenCalled();
    });

    it('[4-5-2-UNIT-025] update: non-UUID tenantId → throws Invalid tenant ID format (manager-provided path)', () => {
      // mergeWhere throws synchronously — use toThrow, not rejects.toThrow
      expect(() =>
        repo.update(
          'not-a-uuid',
          { id: OTHER_ID },
          { status: 'done' } as QueryDeepPartialEntity<TestEntity>,
          mockManager,
        ),
      ).toThrow('Invalid tenant ID format');

      expect(mockManager.update).not.toHaveBeenCalled();
    });

    it('[4-5-2-UNIT-026] find: invalid tenantId + no manager → throws before reaching txManager.run (no-manager path validated)', () => {
      // mergeWhere is called before the if(manager) branch — validation applies to BOTH paths.
      // This test ensures a refactor cannot silently move validation inside the manager-only branch.
      expect(() => repo.find('not-a-uuid')).toThrow('Invalid tenant ID format');

      expect(mockTxManager.run).not.toHaveBeenCalled();
    });
  });
});
