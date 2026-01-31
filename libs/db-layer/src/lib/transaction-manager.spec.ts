import { DataSource, EntityManager } from 'typeorm';
import { TransactionManager } from './transaction-manager';
import { tenantContextStorage, TenantContext } from './tenant-context';

describe('TransactionManager', () => {
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
    it('should execute SET LOCAL with the provided tenant ID', async () => {
      const callback = jest.fn().mockResolvedValue('result');

      const result = await txManager.run('tenant-123', callback);

      expect(result).toBe('result');
      expect(mockManager.query).toHaveBeenCalledWith(
        'SET LOCAL app.current_tenant = $1',
        ['tenant-123'],
      );
      expect(callback).toHaveBeenCalledWith(mockManager);
    });
  });

  describe('run(callback) — reads from AsyncLocalStorage', () => {
    it('should read tenant from AsyncLocalStorage context', async () => {
      const callback = jest.fn().mockResolvedValue('result');

      const ctx: TenantContext = {
        tenantId: 'als-tenant',
        bypassRls: false,
      };

      const result = await tenantContextStorage.run(ctx, () =>
        txManager.run(callback),
      );

      expect(result).toBe('result');
      expect(mockManager.query).toHaveBeenCalledWith(
        'SET LOCAL app.current_tenant = $1',
        ['als-tenant'],
      );
    });

    it('should skip SET LOCAL when bypassRls is true (bubble_admin)', async () => {
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

    it('should skip SET LOCAL when no AsyncLocalStorage context', async () => {
      const callback = jest.fn().mockResolvedValue('result');

      const result = await txManager.run(callback);

      expect(result).toBe('result');
      expect(mockManager.query).not.toHaveBeenCalled();
    });
  });

  describe('callback receives scoped EntityManager', () => {
    it('should pass the transaction EntityManager to the callback', async () => {
      let receivedManager: EntityManager | undefined;

      await txManager.run('tenant-1', async (manager) => {
        receivedManager = manager;
      });

      expect(receivedManager).toBe(mockManager);
    });
  });

  describe('transaction rollback on error', () => {
    it('should propagate errors from the callback', async () => {
      await expect(
        txManager.run('tenant-1', async () => {
          throw new Error('DB failure');
        }),
      ).rejects.toThrow('DB failure');
    });
  });
});
