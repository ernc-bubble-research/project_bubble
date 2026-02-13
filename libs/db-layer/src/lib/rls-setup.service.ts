import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class RlsSetupService implements OnModuleInit {
  private readonly logger = new Logger(RlsSetupService.name);

  /** Tables that have a tenant_id column and require standard tenant_isolation RLS. Names must match ^[a-z_]+$ */
  private readonly tenantScopedTables = ['users', 'invitations', 'assets', 'folders', 'knowledge_chunks', 'workflow_versions', 'workflow_runs'];

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

    // Workflow tables with custom visibility-based RLS (not standard tenant_isolation).
    await this.createWorkflowTemplateAccessPolicy();
    await this.createWorkflowChainAccessPolicy();

    // Catalog RLS: tenant users can SELECT published templates and their versions.
    // These are forward-looking for Story 4-RLS (non-superuser role).
    // Currently bypassed by superuser — WHERE clauses are the active security layer.
    await this.createCatalogReadPublishedPolicy();
    await this.createCatalogReadPublishedVersionsPolicy();

    // Seed provider configs BEFORE models (idempotent).
    await this.seedProviderConfigs();

    // Seed LLM model registry (idempotent).
    await this.seedLlmModels();
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

  private async createWorkflowTemplateAccessPolicy(): Promise<void> {
    try {
      // Enable + force RLS on workflow_templates
      await this.dataSource.query(`ALTER TABLE "workflow_templates" ENABLE ROW LEVEL SECURITY`);
      await this.dataSource.query(`ALTER TABLE "workflow_templates" FORCE ROW LEVEL SECURITY`);

      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'workflow_templates' AND policyname = 'template_access'
          ) THEN
            CREATE POLICY template_access ON workflow_templates
              USING (
                tenant_id = current_setting('app.current_tenant', true)::uuid
                OR visibility = 'public'
                OR current_setting('app.current_tenant', true)::uuid = ANY(allowed_tenants)
              );
          END IF;
        END
        $$;
      `);
      this.logger.log(
        'Custom RLS policy created on "workflow_templates" — visibility-based access',
      );
    } catch (error) {
      this.logger.error('Failed to create workflow template access policy:', error);
      throw error;
    }
  }

  private async createWorkflowChainAccessPolicy(): Promise<void> {
    try {
      // Enable + force RLS on workflow_chains
      await this.dataSource.query(`ALTER TABLE "workflow_chains" ENABLE ROW LEVEL SECURITY`);
      await this.dataSource.query(`ALTER TABLE "workflow_chains" FORCE ROW LEVEL SECURITY`);

      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'workflow_chains' AND policyname = 'chain_access'
          ) THEN
            CREATE POLICY chain_access ON workflow_chains
              USING (
                tenant_id = current_setting('app.current_tenant', true)::uuid
                OR visibility = 'public'
                OR current_setting('app.current_tenant', true)::uuid = ANY(allowed_tenants)
              );
          END IF;
        END
        $$;
      `);
      this.logger.log(
        'Custom RLS policy created on "workflow_chains" — visibility-based access',
      );
    } catch (error) {
      this.logger.error('Failed to create workflow chain access policy:', error);
      throw error;
    }
  }

  /**
   * Catalog RLS: allow tenant users to SELECT published + public templates,
   * or published + restricted templates where their tenant is in allowed_tenants.
   * This is a documented Rule 2c exception (Story 4-FIX-A2).
   */
  private async createCatalogReadPublishedPolicy(): Promise<void> {
    try {
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'workflow_templates' AND policyname = 'catalog_read_published'
          ) THEN
            CREATE POLICY catalog_read_published ON workflow_templates
              FOR SELECT USING (
                status = 'published'
                AND deleted_at IS NULL
                AND (
                  visibility = 'public'
                  OR current_setting('app.current_tenant', true)::uuid = ANY(allowed_tenants)
                )
              );
          END IF;
        END
        $$;
      `);
      this.logger.log(
        'Catalog SELECT policy created on "workflow_templates" — published + visibility check',
      );
    } catch (error) {
      this.logger.error('Failed to create catalog read published policy:', error);
      throw error;
    }
  }

  /**
   * Catalog RLS: allow tenant users to SELECT versions whose parent template
   * is published. Uses a subquery to check the template's status.
   */
  private async createCatalogReadPublishedVersionsPolicy(): Promise<void> {
    try {
      await this.dataSource.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'workflow_versions' AND policyname = 'catalog_read_published_versions'
          ) THEN
            CREATE POLICY catalog_read_published_versions ON workflow_versions
              FOR SELECT USING (
                EXISTS (
                  SELECT 1 FROM workflow_templates wt
                  WHERE wt.id = template_id
                    AND wt.status = 'published'
                    AND wt.deleted_at IS NULL
                    AND (
                      wt.visibility = 'public'
                      OR current_setting('app.current_tenant', true)::uuid = ANY(wt.allowed_tenants)
                    )
                )
              );
          END IF;
        END
        $$;
      `);
      this.logger.log(
        'Catalog SELECT policy created on "workflow_versions" — parent template must be published',
      );
    } catch (error) {
      this.logger.error('Failed to create catalog read published versions policy:', error);
      throw error;
    }
  }

  private async seedProviderConfigs(): Promise<void> {
    try {
      const result = await this.dataSource.query(`SELECT COUNT(*)::int as count FROM llm_provider_configs`);
      const count = result[0]?.count ?? 0;
      if (count > 0) {
        this.logger.log(`LLM provider configs already seeded (${count} configs found)`);
        return;
      }

      await this.dataSource.query(`
        INSERT INTO llm_provider_configs (id, provider_key, display_name, encrypted_credentials, is_active)
        VALUES
          (gen_random_uuid(), 'google-ai-studio', 'Google AI Studio', NULL, true),
          (gen_random_uuid(), 'vertex', 'Vertex AI', NULL, true),
          (gen_random_uuid(), 'openai', 'OpenAI', NULL, true),
          (gen_random_uuid(), 'mock', 'Mock Provider', NULL, true)
      `);
      this.logger.log('Seeded 4 default LLM provider configs (no credentials)');
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === '42P01') {
        this.logger.warn('LLM provider configs table does not exist yet — will seed after synchronize');
        return;
      }
      this.logger.error('Failed to seed LLM provider configs:', error);
      throw error;
    }
  }

  private async seedLlmModels(): Promise<void> {
    try {
      // Idempotent seed — only inserts if table is empty
      const result = await this.dataSource.query(`SELECT COUNT(*)::int as count FROM llm_models`);
      const count = result[0]?.count ?? 0;
      if (count > 0) {
        this.logger.log(`LLM models already seeded (${count} models found)`);
        return;
      }

      await this.dataSource.query(`
        INSERT INTO llm_models (id, provider_key, model_id, display_name, context_window, max_output_tokens, is_active, cost_per_1k_input, cost_per_1k_output)
        VALUES
          -- Google AI Studio (Gemini 2.5 GA + 3.0 Preview)
          (gen_random_uuid(), 'google-ai-studio', 'models/gemini-2.5-flash', 'Gemini 2.5 Flash', 1000000, 8192, true, NULL, NULL),
          (gen_random_uuid(), 'google-ai-studio', 'models/gemini-2.5-pro', 'Gemini 2.5 Pro', 1000000, 8192, true, NULL, NULL),
          (gen_random_uuid(), 'google-ai-studio', 'models/gemini-3.0-flash-preview', 'Gemini 3.0 Flash (Preview)', 1000000, 8192, true, NULL, NULL),
          (gen_random_uuid(), 'google-ai-studio', 'models/gemini-3.0-pro-preview', 'Gemini 3.0 Pro (Preview)', 1000000, 8192, true, NULL, NULL),
          -- Vertex AI (Gemini 2.5 GA + 3.0 Preview)
          (gen_random_uuid(), 'vertex', 'gemini-2.5-flash', 'Gemini 2.5 Flash (Vertex)', 1000000, 8192, true, NULL, NULL),
          (gen_random_uuid(), 'vertex', 'gemini-2.5-pro', 'Gemini 2.5 Pro (Vertex)', 1000000, 8192, true, NULL, NULL),
          (gen_random_uuid(), 'vertex', 'gemini-3.0-flash-preview', 'Gemini 3.0 Flash (Vertex, Preview)', 1000000, 8192, true, NULL, NULL),
          (gen_random_uuid(), 'vertex', 'gemini-3.0-pro-preview', 'Gemini 3.0 Pro (Vertex, Preview)', 1000000, 8192, true, NULL, NULL),
          -- OpenAI
          (gen_random_uuid(), 'openai', 'gpt-5.2', 'GPT-5.2', 128000, 16384, true, NULL, NULL),
          (gen_random_uuid(), 'openai', 'gpt-4.1', 'GPT-4.1', 128000, 16384, true, NULL, NULL),
          (gen_random_uuid(), 'openai', 'gpt-4.1-mini', 'GPT-4.1 Mini', 128000, 16384, true, NULL, NULL),
          -- Mock
          (gen_random_uuid(), 'mock', 'mock-model', 'Mock LLM (Testing)', 1000000, 8192, true, NULL, NULL)
      `);
      this.logger.log('Seeded 12 LLM models (google-ai-studio, vertex, openai, mock)');
    } catch (error: unknown) {
      // Only swallow "relation does not exist" (42P01) — table may not exist on first startup
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === '42P01') {
        this.logger.warn('LLM models table does not exist yet — will seed after synchronize');
        return;
      }
      this.logger.error('Failed to seed LLM models:', error);
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
      // TypeORM synchronize creates embedding as float8[] because it doesn't support
      // the pgvector 'vector' type natively. We ALTER the column to vector(768) so that
      // HNSW indexes and pgvector operators (<=> cosine distance) work correctly.
      await this.dataSource.query(`
        DO $$
        BEGIN
          -- Convert float8[] to vector(768) if needed (TypeORM creates float8[])
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'knowledge_chunks' AND column_name = 'embedding'
              AND data_type != 'USER-DEFINED'
          ) THEN
            ALTER TABLE knowledge_chunks ALTER COLUMN embedding TYPE vector(768)
              USING embedding::vector(768);
            RAISE NOTICE 'Converted knowledge_chunks.embedding from float8[] to vector(768)';
          END IF;

          -- Create HNSW index for cosine similarity search
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
