import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RlsSetupService } from './rls-setup.service';

describe('RlsSetupService [P0]', () => {
  let service: RlsSetupService;
  let dataSource: jest.Mocked<DataSource>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    dataSource = {
      query: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;

    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    service = new RlsSetupService(dataSource, configService);
  });

  it('[1H.1-UNIT-001] should execute RLS SQL on module init in development mode', async () => {
    configService.get.mockReturnValue('development');

    await service.onModuleInit();

    // 1 pgvector extension + 3 calls each for enableRls(users, invitations, assets, folders, knowledge_chunks) = 16
    // + 1 createAuthSelectPolicy + 1 createAuthAcceptInvitationsPolicy
    // + 1 createAuthInsertUsersPolicy + 1 createAuthUpdateInvitationsPolicy = 4
    expect(dataSource.query).toHaveBeenCalledTimes(20);
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "users" ENABLE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "users" FORCE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_isolation_users'),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_isolation_invitations'),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('auth_select_all'),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('auth_accept_invitations'),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('auth_insert_users'),
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('auth_update_invitations'),
    );
  });

  it('[1H.1-UNIT-002] should skip RLS setup in production', async () => {
    configService.get.mockReturnValue('production');

    await service.onModuleInit();

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('[1H.1-UNIT-003] should skip RLS setup in test environment', async () => {
    configService.get.mockReturnValue('test');

    await service.onModuleInit();

    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('[1H.1-UNIT-004] should propagate database errors', async () => {
    configService.get.mockReturnValue('development');
    dataSource.query.mockRejectedValue(new Error('DB connection failed'));

    await expect(service.onModuleInit()).rejects.toThrow(
      'DB connection failed',
    );
  });

  describe('RLS policy scope verification', () => {
    beforeEach(() => {
      configService.get.mockReturnValue('development');
    });

    it('[1H.1-UNIT-005] auth_select_all targets users table with FOR SELECT only', async () => {
      await service.onModuleInit();

      const authSelectCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('auth_select_all'),
      );
      expect(authSelectCall).toBeDefined();
      const sql = authSelectCall![0] as string;
      expect(sql).toContain("tablename = 'users'");
      expect(sql).toContain('FOR SELECT');
      expect(sql).not.toContain('FOR INSERT');
      expect(sql).not.toContain('FOR UPDATE');
      expect(sql).not.toContain('FOR DELETE');
    });

    it('[1H.1-UNIT-006] auth_accept_invitations targets invitations table with FOR SELECT only', async () => {
      await service.onModuleInit();

      const authAcceptCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('auth_accept_invitations'),
      );
      expect(authAcceptCall).toBeDefined();
      const sql = authAcceptCall![0] as string;
      expect(sql).toContain("tablename = 'invitations'");
      expect(sql).toContain('FOR SELECT');
      expect(sql).not.toContain('FOR INSERT');
      expect(sql).not.toContain('FOR DELETE');
    });

    it('[1H.1-UNIT-007] auth_insert_users targets users table with FOR INSERT only', async () => {
      await service.onModuleInit();

      const authInsertCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('auth_insert_users'),
      );
      expect(authInsertCall).toBeDefined();
      const sql = authInsertCall![0] as string;
      expect(sql).toContain("tablename = 'users'");
      expect(sql).toContain('FOR INSERT');
      expect(sql).not.toContain('FOR SELECT');
      expect(sql).not.toContain('FOR DELETE');
    });

    it('[1H.1-UNIT-008] auth_update_invitations targets invitations table with FOR UPDATE only', async () => {
      await service.onModuleInit();

      const authUpdateCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('auth_update_invitations'),
      );
      expect(authUpdateCall).toBeDefined();
      const sql = authUpdateCall![0] as string;
      expect(sql).toContain("tablename = 'invitations'");
      expect(sql).toContain('FOR UPDATE');
      expect(sql).not.toContain('FOR INSERT');
      expect(sql).not.toContain('FOR DELETE');
    });

    it('[1H.1-UNIT-009] tenant_isolation policies use current_setting for tenant scoping', async () => {
      await service.onModuleInit();

      const tenantPolicyCalls = dataSource.query.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('tenant_isolation'),
      );
      expect(tenantPolicyCalls).toHaveLength(5);

      for (const call of tenantPolicyCalls) {
        const sql = call[0] as string;
        expect(sql).toContain('current_setting');
        expect(sql).toContain('app.current_tenant');
      }
    });
  });
});
