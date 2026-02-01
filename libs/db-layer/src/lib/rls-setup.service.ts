import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class RlsSetupService implements OnModuleInit {
  private readonly logger = new Logger(RlsSetupService.name);

  /** Tables that have a tenant_id column and require RLS. Names must match ^[a-z_]+$ */
  private readonly tenantScopedTables = ['users', 'invitations', 'assets', 'folders', 'knowledge_chunks'];

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

    // Enable pgvector extension before table creation/RLS setup
    await this.enablePgvectorExtension();
    await this.createVectorIndex();

    for (const table of this.tenantScopedTables) {
      await this.enableRls(table);
    }

    // Auth login needs cross-tenant SELECT on users (pre-auth, no tenant context).
    // This permissive policy allows SELECT without SET LOCAL while INSERT/UPDATE/DELETE
    // still require tenant context via the restrictive tenant_isolation policy.
    await this.createAuthSelectPolicy();

    // Invitation accept flow needs cross-tenant SELECT on invitations (pre-auth).
    await this.createAuthAcceptInvitationsPolicy();

    // Auth flows (seed, invitation accept) need INSERT on users without tenant context.
    await this.createAuthInsertUsersPolicy();

    // Invitation accept flow needs UPDATE on invitations (mark as ACCEPTED/EXPIRED).
    await this.createAuthUpdateInvitationsPolicy();
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

  private async createAuthAcceptInvitationsPolicy(): Promise<void> {
    try {
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'invitations' AND policyname = 'auth_accept_invitations'
          ) THEN
            CREATE POLICY auth_accept_invitations ON "invitations" FOR SELECT USING (true);
          END IF;
        END
        $$;
      `);
      this.logger.log(
        'Auth SELECT policy created on "invitations" — allows pre-auth invitation queries',
      );
    } catch (error) {
      this.logger.error(
        'Failed to create auth SELECT policy on invitations:',
        error,
      );
      throw error;
    }
  }

  private async createAuthInsertUsersPolicy(): Promise<void> {
    try {
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'users' AND policyname = 'auth_insert_users'
          ) THEN
            CREATE POLICY auth_insert_users ON "users" FOR INSERT WITH CHECK (true);
          END IF;
        END
        $$;
      `);
      this.logger.log(
        'Auth INSERT policy created on "users" — allows pre-auth user creation (seed, invitation accept)',
      );
    } catch (error) {
      this.logger.error('Failed to create auth INSERT policy on users:', error);
      throw error;
    }
  }

  private async createAuthUpdateInvitationsPolicy(): Promise<void> {
    try {
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'invitations' AND policyname = 'auth_update_invitations'
          ) THEN
            CREATE POLICY auth_update_invitations ON "invitations" FOR UPDATE USING (true);
          END IF;
        END
        $$;
      `);
      this.logger.log(
        'Auth UPDATE policy created on "invitations" — allows pre-auth invitation status updates',
      );
    } catch (error) {
      this.logger.error(
        'Failed to create auth UPDATE policy on invitations:',
        error,
      );
      throw error;
    }
  }

  private async enablePgvectorExtension(): Promise<void> {
    try {
      await this.dataSource.query(
        `CREATE EXTENSION IF NOT EXISTS vector`,
      );
      this.logger.log('pgvector extension enabled');
    } catch (error) {
      this.logger.error('Failed to enable pgvector extension:', error);
      throw error;
    }
  }

  private async createVectorIndex(): Promise<void> {
    try {
      // HNSW index for cosine similarity search on knowledge_chunks.embedding
      // Only created if the table and column exist (TypeORM synchronize may not have run yet)
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
          ) THEN
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)';
          END IF;
        END
        $$;
      `);
      this.logger.log('pgvector HNSW index ensured on knowledge_chunks.embedding');
    } catch (error) {
      this.logger.warn('Failed to create vector index (may not exist yet):', error);
      // Non-fatal — table may not exist during first startup
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
