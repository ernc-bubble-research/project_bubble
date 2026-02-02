import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { RlsSetupService } from './rls-setup.service';

describe('RlsSetupService [P0]', () => {
  let service: RlsSetupService;
  let dataSource: jest.Mocked<DataSource>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    dataSource = {
      query: jest.fn().mockResolvedValue([{ count: 0 }]),
    } as unknown as jest.Mocked<DataSource>;

    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    service = new RlsSetupService(dataSource, configService);
  });

  it('[1H.1-UNIT-001] should execute RLS SQL on module init in development mode', async () => {
    configService.get.mockReturnValue('development');

    await service.onModuleInit();

    // 1 pgvector extension + 1 vector index
    // + 3 calls each for 7 tenant-scoped tables (users, invitations, assets, folders, knowledge_chunks, workflow_versions, workflow_runs) = 21
    // + 4 auth policies (auth_select_all, auth_accept_invitations, auth_insert_users, auth_update_invitations)
    // + 3 workflow_templates custom RLS (enable, force, policy)
    // + 3 workflow_chains custom RLS (enable, force, policy)
    // + 1 llm_models seed SELECT COUNT + 1 llm_models seed INSERT (count=0 → inserts)
    // = 2 + 21 + 4 + 3 + 3 + 2 = 35
    expect(dataSource.query).toHaveBeenCalledTimes(35);
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
      const sql = (authSelectCall as string[])[0] as string;
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
      const sql = (authAcceptCall as string[])[0] as string;
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
      const sql = (authInsertCall as string[])[0] as string;
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
      const sql = (authUpdateCall as string[])[0] as string;
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
      expect(tenantPolicyCalls).toHaveLength(7);

      for (const call of tenantPolicyCalls) {
        const sql = call[0] as string;
        expect(sql).toContain('current_setting');
        expect(sql).toContain('app.current_tenant');
      }
    });
  });

  describe('Workflow RLS policies [3.1]', () => {
    beforeEach(() => {
      configService.get.mockReturnValue('development');
    });

    it('[3.1-UNIT-042] [P0] Given development mode, when onModuleInit runs, then workflow_versions gets standard tenant_isolation policy', async () => {
      // When
      await service.onModuleInit();

      // Then
      expect(dataSource.query).toHaveBeenCalledWith(
        'ALTER TABLE "workflow_versions" ENABLE ROW LEVEL SECURITY',
      );
      expect(dataSource.query).toHaveBeenCalledWith(
        'ALTER TABLE "workflow_versions" FORCE ROW LEVEL SECURITY',
      );
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_isolation_workflow_versions'),
      );
    });

    it('[3.1-UNIT-043] [P0] Given development mode, when onModuleInit runs, then workflow_runs gets standard tenant_isolation policy', async () => {
      // When
      await service.onModuleInit();

      // Then
      expect(dataSource.query).toHaveBeenCalledWith(
        'ALTER TABLE "workflow_runs" ENABLE ROW LEVEL SECURITY',
      );
      expect(dataSource.query).toHaveBeenCalledWith(
        'ALTER TABLE "workflow_runs" FORCE ROW LEVEL SECURITY',
      );
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_isolation_workflow_runs'),
      );
    });

    it('[3.1-UNIT-044] [P0] Given development mode, when onModuleInit runs, then workflow_templates gets custom visibility-based RLS', async () => {
      // When
      await service.onModuleInit();

      // Then
      expect(dataSource.query).toHaveBeenCalledWith(
        'ALTER TABLE "workflow_templates" ENABLE ROW LEVEL SECURITY',
      );
      expect(dataSource.query).toHaveBeenCalledWith(
        'ALTER TABLE "workflow_templates" FORCE ROW LEVEL SECURITY',
      );
      const templatePolicyCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('template_access'),
      );
      expect(templatePolicyCall).toBeDefined();
      const sql = (templatePolicyCall as string[])[0] as string;
      expect(sql).toContain("visibility = 'public'");
      expect(sql).toContain('ANY(allowed_tenants)');
      expect(sql).toContain('current_setting');
    });

    it('[3.1-UNIT-045] [P0] Given development mode, when onModuleInit runs, then workflow_chains gets custom visibility-based RLS', async () => {
      // When
      await service.onModuleInit();

      // Then
      expect(dataSource.query).toHaveBeenCalledWith(
        'ALTER TABLE "workflow_chains" ENABLE ROW LEVEL SECURITY',
      );
      expect(dataSource.query).toHaveBeenCalledWith(
        'ALTER TABLE "workflow_chains" FORCE ROW LEVEL SECURITY',
      );
      const chainPolicyCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('chain_access'),
      );
      expect(chainPolicyCall).toBeDefined();
      const sql = (chainPolicyCall as string[])[0] as string;
      expect(sql).toContain("visibility = 'public'");
      expect(sql).toContain('ANY(allowed_tenants)');
      expect(sql).toContain('current_setting');
    });
  });

  describe('LLM model seeding [3.1]', () => {
    beforeEach(() => {
      configService.get.mockReturnValue('development');
    });

    it('[3.1-UNIT-046] [P0] Given empty llm_models table, when onModuleInit runs, then seeds 5 models', async () => {
      // Given — default mock returns [{count: 0}]

      // When
      await service.onModuleInit();

      // Then
      const seedInsertCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO llm_models'),
      );
      expect(seedInsertCall).toBeDefined();
      const sql = (seedInsertCall as string[])[0] as string;
      expect(sql).toContain('google-ai-studio');
      expect(sql).toContain('vertex');
      expect(sql).toContain('mock');
      expect(sql).toContain('mock-model');
    });

    it('[3.1-UNIT-047] [P0] Given llm_models already seeded, when onModuleInit runs, then skips insert', async () => {
      // Given — seed check returns non-zero count
      // We need to mock specifically: the SELECT COUNT query returns 5
      // All other queries return default. We use mockImplementation to detect the seed query.
      dataSource.query.mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('SELECT COUNT')) {
          return [{ count: 5 }];
        }
        return undefined;
      });

      // When
      await service.onModuleInit();

      // Then — no INSERT INTO llm_models
      const seedInsertCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO llm_models'),
      );
      expect(seedInsertCall).toBeUndefined();
    });
  });
});
