import { DataSource, EntityManager } from 'typeorm';
import { TransactionManager } from './transaction-manager';
import { tenantContextStorage, TenantContext } from './tenant-context';

describe('TransactionManager [P0]', () => {
  let txManager: TransactionManager;
  let dataSource: jest.Mocked<DataSource>;
  let mockManager: jest.Mocked<EntityManager>;

  beforeEach(() => {
    mockManager = {
      query: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
    } as unknown as jest.Mocked<DataSource>;

    txManager = new TransactionManager(dataSource);
  });

  describe('run(tenantId, callback)', () => {
    it('[1H.1-UNIT-001] should execute SET LOCAL with the provided tenant ID', async () => {
      const callback = jest.fn().mockResolvedValue('result');
      const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      const result = await txManager.run(tenantId, callback);

      expect(result).toBe('result');
      expect(mockManager.query).toHaveBeenCalledWith(
        `SET LOCAL app.current_tenant = '${tenantId}'`,
      );
      expect(callback).toHaveBeenCalledWith(mockManager);
    });

    it('[1H.1-UNIT-007] should reject non-UUID tenant IDs to prevent SQL injection', async () => {
      const callback = jest.fn().mockResolvedValue('result');

      await expect(
        txManager.run("'; DROP TABLE users; --", callback),
      ).rejects.toThrow('Invalid tenant ID format');
    });
  });

  describe('run(callback) — reads from AsyncLocalStorage', () => {
    it('[1H.1-UNIT-002] should read tenant from AsyncLocalStorage context', async () => {
      const callback = jest.fn().mockResolvedValue('result');
      const tenantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      const ctx: TenantContext = {
        tenantId,
        bypassRls: false,
      };

      const result = await tenantContextStorage.run(ctx, () =>
        txManager.run(callback),
      );

      expect(result).toBe('result');
      expect(mockManager.query).toHaveBeenCalledWith(
        `SET LOCAL app.current_tenant = '${tenantId}'`,
      );
    });

    it('[1H.1-UNIT-003] should skip SET LOCAL when bypassRls is true (bubble_admin)', async () => {
      const callback = jest.fn().mockResolvedValue('result');

      const ctx: TenantContext = {
        tenantId: 'admin-tenant',
        bypassRls: true,
      };

      const result = await tenantContextStorage.run(ctx, () =>
        txManager.run(callback),
      );

      expect(result).toBe('result');
      expect(mockManager.query).not.toHaveBeenCalled();
    });

    it('[1H.1-UNIT-004] should skip SET LOCAL when no AsyncLocalStorage context', async () => {
      const callback = jest.fn().mockResolvedValue('result');

      const result = await txManager.run(callback);

      expect(result).toBe('result');
      expect(mockManager.query).not.toHaveBeenCalled();
    });
  });

  describe('callback receives scoped EntityManager', () => {
    it('[1H.1-UNIT-005] should pass the transaction EntityManager to the callback', async () => {
      let receivedManager: EntityManager | undefined;

      await txManager.run('cccccccc-cccc-cccc-cccc-cccccccccccc', async (manager) => {
        receivedManager = manager;
      });

      expect(receivedManager).toBe(mockManager);
    });
  });

  describe('transaction rollback on error', () => {
    it('[1H.1-UNIT-006] should propagate errors from the callback', async () => {
      await expect(
        txManager.run('cccccccc-cccc-cccc-cccc-cccccccccccc', async () => {
          throw new Error('DB failure');
        }),
      ).rejects.toThrow('DB failure');
    });
  });
});
