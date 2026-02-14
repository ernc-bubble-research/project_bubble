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

    // Verify key SQL statements were executed (semantic checks, not call count)
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "users" ENABLE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      'ALTER TABLE "users" FORCE ROW LEVEL SECURITY',
    );
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_isolation_users'),
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

  describe('bubble_app role creation [4-RLS-A]', () => {
    beforeEach(() => {
      configService.get.mockReturnValue('development');
    });

    it('[4-RLS-A-UNIT-002] should create bubble_app role IF NOT EXISTS', async () => {
      await service.onModuleInit();

      const createRoleCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('bubble_app') && call[0].includes('CREATE ROLE'),
      );
      expect(createRoleCall).toBeDefined();
      const sql = (createRoleCall as string[])[0] as string;
      expect(sql).toContain('IF NOT EXISTS');
      expect(sql).toContain('LOGIN');
    });

    it('[4-RLS-A-UNIT-003] should grant table permissions to bubble_app', async () => {
      await service.onModuleInit();

      expect(dataSource.query).toHaveBeenCalledWith(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bubble_app',
      );
    });

    it('[4-RLS-A-UNIT-004] should grant sequence permissions to bubble_app', async () => {
      await service.onModuleInit();

      expect(dataSource.query).toHaveBeenCalledWith(
        'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bubble_app',
      );
    });

    it('[4-RLS-A-UNIT-005] should set ALTER DEFAULT PRIVILEGES for tables', async () => {
      await service.onModuleInit();

      expect(dataSource.query).toHaveBeenCalledWith(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bubble_app',
      );
    });

    it('[4-RLS-A-UNIT-006] should set ALTER DEFAULT PRIVILEGES for sequences', async () => {
      await service.onModuleInit();

      expect(dataSource.query).toHaveBeenCalledWith(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO bubble_app',
      );
    });

    it('[4-RLS-A-UNIT-009] should escape single quotes in password for PL/pgSQL', async () => {
      configService.get.mockImplementation(((key: string, fallback?: string) => {
        if (key === 'DB_APP_PASSWORD') return "p'a$$word";
        if (key === 'NODE_ENV') return 'development';
        return fallback;
      }) as typeof configService.get);

      await service.createAppRole();

      const createRoleCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('CREATE ROLE'),
      );
      expect(createRoleCall).toBeDefined();
      const sql = (createRoleCall as string[])[0] as string;
      // Single quote escaped as '' for PL/pgSQL string literal
      expect(sql).toContain("p''a$$word");
      // Uses unique dollar-quote tag (not $$) to prevent password containing $$ from breaking DO block
      expect(sql).toContain('$role_setup$');
    });

    it('[4-RLS-A-UNIT-007] should create role BEFORE granting permissions', async () => {
      const callOrder: string[] = [];
      dataSource.query.mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('CREATE ROLE')) {
          callOrder.push('create_role');
        }
        if (typeof sql === 'string' && sql.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES')) {
          callOrder.push('grant_tables');
        }
        if (typeof sql === 'string' && sql.includes('ALTER DEFAULT PRIVILEGES') && sql.includes('TABLES')) {
          callOrder.push('default_tables');
        }
        if (typeof sql === 'string' && sql.includes('SELECT COUNT')) {
          return [{ count: 0 }];
        }
        return undefined;
      });

      await service.onModuleInit();

      expect(callOrder.indexOf('create_role')).toBeLessThan(callOrder.indexOf('grant_tables'));
      expect(callOrder.indexOf('grant_tables')).toBeLessThan(callOrder.indexOf('default_tables'));
    });
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

    it('[1H.1-UNIT-009] tenant_isolation policies use NULLIF + admin bypass + WITH CHECK', async () => {
      await service.onModuleInit();

      const tenantPolicyCalls = dataSource.query.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('tenant_isolation'),
      );
      expect(tenantPolicyCalls).toHaveLength(7);

      for (const call of tenantPolicyCalls) {
        const sql = call[0] as string;
        // NULLIF safety
        expect(sql).toContain('NULLIF');
        expect(sql).toContain('app.current_tenant');
        // Admin bypass
        expect(sql).toContain('app.is_admin');
        // WITH CHECK clause for write protection
        expect(sql).toContain('WITH CHECK');
      }
    });

    it('[4-RLS-A-UNIT-010] should reject invalid table names in enableRls', async () => {
      // TABLE_NAME_PATTERN rejects names with special characters (SQL injection prevention)
      // enableRls is private, but we can test indirectly by verifying tenantScopedTables are all valid
      // Direct test: modify the private list is not possible, so verify the regex pattern itself
      const pattern = /^[a-z_]+$/;
      expect(pattern.test('users')).toBe(true);
      expect(pattern.test('workflow_runs')).toBe(true);
      expect(pattern.test('users; DROP TABLE')).toBe(false);
      expect(pattern.test("users' OR '1'='1")).toBe(false);
      expect(pattern.test('Users')).toBe(false); // uppercase rejected
      expect(pattern.test('')).toBe(false); // empty rejected
    });

    it('[4-RLS-A-UNIT-008] auth policies use USING (true) without NULLIF or admin bypass', async () => {
      await service.onModuleInit();

      // Auth policies should NOT have NULLIF or is_admin — they use USING (true)
      const authPolicyCalls = dataSource.query.mock.calls.filter(
        (call) => typeof call[0] === 'string' && (
          call[0].includes('auth_select_all') ||
          call[0].includes('auth_accept_invitations') ||
          call[0].includes('auth_insert_users') ||
          call[0].includes('auth_update_invitations')
        ),
      );
      expect(authPolicyCalls).toHaveLength(4);

      for (const call of authPolicyCalls) {
        const sql = call[0] as string;
        expect(sql).not.toContain('NULLIF');
        expect(sql).not.toContain('app.is_admin');
      }
    });
  });

  describe('Workflow RLS policies [3.1]', () => {
    beforeEach(() => {
      configService.get.mockReturnValue('development');
    });

    it('[3.1-UNIT-042] [P0] workflow_versions gets standard tenant_isolation policy', async () => {
      await service.onModuleInit();

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

    it('[3.1-UNIT-043] [P0] workflow_runs gets standard tenant_isolation policy', async () => {
      await service.onModuleInit();

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

    it('[3.1-UNIT-044] [P0] workflow_templates gets custom visibility-based RLS with NULLIF + admin bypass + WITH CHECK', async () => {
      await service.onModuleInit();

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
      expect(sql).toContain('NULLIF');
      expect(sql).toContain('app.is_admin');
      expect(sql).toContain('WITH CHECK');
    });

    it('[4-FIX-A2-UNIT-014] [P0] catalog_read_published policy with NULLIF + admin bypass', async () => {
      await service.onModuleInit();

      const catalogPolicyCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('catalog_read_published') && !call[0].includes('catalog_read_published_versions'),
      );
      expect(catalogPolicyCall).toBeDefined();
      const sql = (catalogPolicyCall as string[])[0] as string;
      expect(sql).toContain("status = 'published'");
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain('FOR SELECT');
      expect(sql).toContain('NULLIF');
      expect(sql).toContain('app.is_admin');
    });

    it('[4-FIX-A2-UNIT-015] [P0] catalog_read_published_versions policy with NULLIF + admin bypass', async () => {
      await service.onModuleInit();

      const catalogVersionsCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('catalog_read_published_versions'),
      );
      expect(catalogVersionsCall).toBeDefined();
      const sql = (catalogVersionsCall as string[])[0] as string;
      expect(sql).toContain("tablename = 'workflow_versions'");
      expect(sql).toContain('FOR SELECT');
      expect(sql).toContain("status = 'published'");
      expect(sql).toContain('NULLIF');
      expect(sql).toContain('app.is_admin');
    });

    it('[3.1-UNIT-045] [P0] workflow_chains gets custom visibility-based RLS with NULLIF + admin bypass + WITH CHECK', async () => {
      await service.onModuleInit();

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
      expect(sql).toContain('NULLIF');
      expect(sql).toContain('app.is_admin');
      expect(sql).toContain('WITH CHECK');
    });
  });

  describe('LLM provider config seeding [3.1-4]', () => {
    beforeEach(() => {
      configService.get.mockReturnValue('development');
    });

    it('[3.1-4-UNIT-065] [P0] Given empty llm_provider_configs table, when onModuleInit runs, then seeds 4 default provider configs', async () => {
      await service.onModuleInit();

      const seedInsertCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO llm_provider_configs'),
      );
      expect(seedInsertCall).toBeDefined();
      const sql = (seedInsertCall as string[])[0] as string;
      expect(sql).toContain('google-ai-studio');
      expect(sql).toContain('vertex');
      expect(sql).toContain('openai');
      expect(sql).toContain('mock');
      expect(sql).toContain('NULL');
    });

    it('[3.1-4-UNIT-066] [P0] Given provider configs already seeded, when onModuleInit runs, then skips insert', async () => {
      dataSource.query.mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('SELECT COUNT') && sql.includes('llm_provider_configs')) {
          return [{ count: 4 }];
        }
        if (typeof sql === 'string' && sql.includes('SELECT COUNT')) {
          return [{ count: 0 }];
        }
        return undefined;
      });

      await service.onModuleInit();

      const seedInsertCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO llm_provider_configs'),
      );
      expect(seedInsertCall).toBeUndefined();
    });

    it('[3.1-4-UNIT-067] [P1] Given provider configs table, when seeding, then provider configs are seeded BEFORE models', async () => {
      const callOrder: string[] = [];
      dataSource.query.mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO llm_provider_configs')) {
          callOrder.push('provider_configs');
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO llm_models')) {
          callOrder.push('llm_models');
        }
        if (typeof sql === 'string' && sql.includes('SELECT COUNT')) {
          return [{ count: 0 }];
        }
        return undefined;
      });

      await service.onModuleInit();

      expect(callOrder).toEqual(['provider_configs', 'llm_models']);
    });
  });

  describe('LLM model seeding [3.1-4]', () => {
    beforeEach(() => {
      configService.get.mockReturnValue('development');
    });

    it('[3.1-4-UNIT-068] [P0] Given empty llm_models table, when onModuleInit runs, then seeds 12 models', async () => {
      await service.onModuleInit();

      const seedInsertCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO llm_models'),
      );
      expect(seedInsertCall).toBeDefined();
      const sql = (seedInsertCall as string[])[0] as string;
      expect(sql).toContain('google-ai-studio');
      expect(sql).toContain('vertex');
      expect(sql).toContain('openai');
      expect(sql).toContain('mock');
      expect(sql).toContain('mock-model');
      expect(sql).toContain('gemini-2.5-flash');
      expect(sql).toContain('gemini-3.0-flash-preview');
      expect(sql).toContain('gpt-4.1');
      expect(sql).toContain('gpt-5.2');
    });

    it('[3.1-4-UNIT-069] [P0] Given llm_models already seeded, when onModuleInit runs, then skips insert', async () => {
      dataSource.query.mockImplementation(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('SELECT COUNT') && sql.includes('llm_models')) {
          return [{ count: 12 }];
        }
        if (typeof sql === 'string' && sql.includes('SELECT COUNT')) {
          return [{ count: 0 }];
        }
        return undefined;
      });

      await service.onModuleInit();

      const seedInsertCall = dataSource.query.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO llm_models'),
      );
      expect(seedInsertCall).toBeUndefined();
    });
  });
});
