import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class RlsSetupService implements OnModuleInit {
  private readonly logger = new Logger(RlsSetupService.name);

  /** Tables that have a tenant_id column and require RLS. Names must match ^[a-z_]+$ */
  private readonly tenantScopedTables = ['users'];

  private static readonly TABLE_NAME_PATTERN = /^[a-z_]+$/;

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') !== 'development') {
      this.logger.log(
        'Skipping RLS setup — use migrations in non-development environments',
      );
      return;
    }

    for (const table of this.tenantScopedTables) {
      await this.enableRls(table);
    }

    // Auth login needs cross-tenant SELECT on users (pre-auth, no tenant context).
    // This permissive policy allows SELECT without SET LOCAL while INSERT/UPDATE/DELETE
    // still require tenant context via the restrictive tenant_isolation policy.
    await this.createAuthSelectPolicy();
  }

  private async createAuthSelectPolicy(): Promise<void> {
    try {
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'users' AND policyname = 'auth_select_all'
          ) THEN
            CREATE POLICY auth_select_all ON "users" FOR SELECT USING (true);
          END IF;
        END
        $$;
      `);
      this.logger.log(
        'Auth SELECT policy created on "users" — allows pre-auth login queries',
      );
    } catch (error) {
      this.logger.error('Failed to create auth SELECT policy:', error);
      throw error;
    }
  }

  private async enableRls(table: string): Promise<void> {
    if (!RlsSetupService.TABLE_NAME_PATTERN.test(table)) {
      throw new Error(
        `Invalid table name "${table}" — must match /^[a-z_]+$/`,
      );
    }

    const policyName = `tenant_isolation_${table}`;

    try {
      await this.dataSource.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
      await this.dataSource.query(
        `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`,
      );

      // Table name is validated by TABLE_NAME_PATTERN regex — safe for interpolation.
      // PL/pgSQL DO blocks do not support parameterized queries from the outer call.
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = '${table}' AND policyname = '${policyName}'
          ) THEN
            EXECUTE format(
              'CREATE POLICY %I ON %I USING (tenant_id = current_setting(''app.current_tenant'', true)::uuid)',
              '${policyName}', '${table}'
            );
          END IF;
        END
        $$;
      `);

      this.logger.log(`RLS enabled on "${table}" with tenant isolation policy`);
    } catch (error) {
      this.logger.error(`Failed to enable RLS on "${table}":`, error);
      throw error;
    }
  }
}
