/**
 * API Contract Tests — Tier 3: HTTP API Contract Tests (P0 Endpoints)
 *
 * Tests the full HTTP → Guards → Interceptor → Service → TransactionManager → RLS → DB chain
 * using supertest against a real NestJS HTTP server with real PostgreSQL.
 *
 * Story: 4-tier3-api-infra
 * DB: project_bubble_contract_test (separate from Tier 1/2/E2E)
 * Dual DataSource: superuser (bubble_user) for seeding, non-superuser (bubble_app) for app queries
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  createContractApp,
  seedContractData,
  mintToken,
  SYSTEM_TENANT_ID,
  ADMIN_USER_ID,
  TENANT_A_ID,
  USER_A_ID,
  TENANT_B_ID,
  USER_B_ID,
  TENANT_C_ID,
  USER_C_ID,
  TEMPLATE_PUBLIC_PUBLISHED_ID,
  TEMPLATE_DRAFT_ID,
  TEMPLATE_PRIVATE_ID,
  TEMPLATE_SOFT_DELETED_ID,
  TENANT_A_TEMPLATE_ID,
  TENANT_B_TEMPLATE_ID,
  TENANT_A_PRIVATE_PUBLISHED_ID,
  TEST_DB_NAME,
} from './contract-test-helpers';
import {
  createTestDatabase,
  dropTestDatabase,
} from './test-db-helpers';

describe('API Contract Tests — Tier 3 [P0]', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let seedDs: DataSource;

  // JWT tokens minted via injected JwtService
  let adminToken: string;
  let tenantAToken: string;
  let tenantBToken: string;
  let tenantCToken: string;

  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await createTestDatabase(TEST_DB_NAME);
      dbAvailable = true;
    } catch (err) {
      console.warn(`Tier 3 contract tests will be skipped — PostgreSQL unavailable: ${(err as Error).message}`);
      return;
    }

    const result = await createContractApp();
    app = result.app;
    module = result.module;
    jwtService = result.jwtService;
    seedDs = result.seedDs;

    await seedContractData(seedDs);

    // Mint tokens via injected JwtService (AC3)
    adminToken = mintToken(jwtService, {
      sub: ADMIN_USER_ID,
      tenant_id: SYSTEM_TENANT_ID,
      role: 'bubble_admin',
    });

    tenantAToken = mintToken(jwtService, {
      sub: USER_A_ID,
      tenant_id: TENANT_A_ID,
      role: 'customer_admin',
    });

    tenantBToken = mintToken(jwtService, {
      sub: USER_B_ID,
      tenant_id: TENANT_B_ID,
      role: 'customer_admin',
    });

    tenantCToken = mintToken(jwtService, {
      sub: USER_C_ID,
      tenant_id: TENANT_C_ID,
      role: 'customer_admin',
    });
  }, 120_000);

  afterAll(async () => {
    // Destroy seed DataSource first (not managed by NestJS)
    if (seedDs?.isInitialized) {
      await seedDs.destroy();
    }

    // Manually destroy DataSources before app.close() to avoid race with shutdown hooks.
    // TypeOrmCoreModule.onApplicationShutdown can throw if the DI token is unresolvable.
    if (module) {
      for (const token of [getDataSourceToken('migration'), DataSource]) {
        try {
          const ds = module.get<DataSource>(token);
          if (ds?.isInitialized) await ds.destroy();
        } catch { /* already destroyed or not registered */ }
      }
    }

    try {
      if (app) await app.close();
    } catch { /* suppress shutdown hook errors after manual DS destruction */ }

    if (dbAvailable) {
      await dropTestDatabase(TEST_DB_NAME);
    }
  }, 30_000);

  // Guard: skip all tests when PostgreSQL is unavailable
  beforeEach(() => {
    if (!dbAvailable) {
      // Jest does not have a native skip-at-runtime API.
      // Throwing a descriptive error is the clearest signal.
      throw new Error('SKIPPED: PostgreSQL unavailable — Tier 3 contract tests cannot run');
    }
  });

  // ── Task 2: Admin Template Endpoint Tests (P0 — these broke) ──────────

  describe('Admin template CRUD', () => {
    let createdTemplateId: string;

    it('[CT-001] Admin creates template → 201, returns template with tenantId', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/workflow-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Contract Test Template',
          description: 'Created via contract test',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Contract Test Template');
      expect(res.body.tenantId).toBe(SYSTEM_TENANT_ID);
      expect(res.body.status).toBe('draft');
      createdTemplateId = res.body.id;
    });

    it('[CT-002] Admin gets template by ID → 200 with correct data', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/workflow-templates/${createdTemplateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.id).toBe(createdTemplateId);
      expect(res.body.name).toBe('Contract Test Template');
    });

    it('[CT-003] Admin gets soft-deleted template by ID → 404', async () => {
      await request(app.getHttpServer())
        .get(`/admin/workflow-templates/${TEMPLATE_SOFT_DELETED_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ── Task 3: Publish + Catalog Endpoint Tests (P0 — ghost records) ──

  describe('Publish + catalog', () => {
    let publishableTemplateId: string;
    let publishableVersionId: string;

    beforeAll(async () => {
      // Create a template + version via API for publish testing
      const templateRes = await request(app.getHttpServer())
        .post('/admin/workflow-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Publishable Template' })
        .expect(201);
      publishableTemplateId = templateRes.body.id;

      // Create a version with a valid definition (passes validateWorkflowDefinition)
      const versionRes = await request(app.getHttpServer())
        .post(
          `/admin/workflow-templates/${publishableTemplateId}/versions`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          definition: {
            metadata: {
              name: 'Publishable Workflow',
              description: 'A test workflow for publish testing',
            },
            inputs: [
              {
                name: 'document',
                label: 'Document',
                role: 'subject',
                source: ['asset'],
                required: true,
              },
            ],
            execution: { processing: 'parallel', model: 'mock-model' },
            knowledge: { enabled: false },
            prompt: 'Analyze the following document: {document}',
          },
        })
        .expect(201);
      publishableVersionId = versionRes.body.id;
    });

    it('[CT-003b] Admin creates version with invalid definition → 400', async () => {
      await request(app.getHttpServer())
        .post(
          `/admin/workflow-templates/${publishableTemplateId}/versions`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ definition: {} })
        .expect(400);
    });

    it('[CT-004] Admin publishes draft template → 201, status PUBLISHED', async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/admin/workflow-templates/${publishableTemplateId}/publish`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ versionId: publishableVersionId })
        .expect(201);

      expect(res.body.status).toBe('published');
    });

    it('[CT-005] Admin publishes soft-deleted template → 404', async () => {
      await request(app.getHttpServer())
        .post(
          `/admin/workflow-templates/${TEMPLATE_SOFT_DELETED_ID}/publish`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(404);
    });

    it('[CT-006] Tenant A sees published PUBLIC template in catalog', async () => {
      const res = await request(app.getHttpServer())
        .get('/app/workflow-templates')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(200);

      const ids = res.body.map((t: { id: string }) => t.id);
      expect(ids).toContain(TEMPLATE_PUBLIC_PUBLISHED_ID);
    });

    it('[CT-007] Tenant B does NOT see PRIVATE template (not in allowedTenants)', async () => {
      const res = await request(app.getHttpServer())
        .get('/app/workflow-templates')
        .set('Authorization', `Bearer ${tenantBToken}`)
        .expect(200);

      const ids = res.body.map((t: { id: string }) => t.id);
      expect(ids).not.toContain(TEMPLATE_PRIVATE_ID);
    });

    it('[CT-008] Tenant A CAN see PRIVATE template (in allowedTenants)', async () => {
      const res = await request(app.getHttpServer())
        .get('/app/workflow-templates')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(200);

      const ids = res.body.map((t: { id: string }) => t.id);
      expect(ids).toContain(TEMPLATE_PRIVATE_ID);
    });
  });

  // ── Task 4: Cross-Tenant Isolation Tests (P0 — security boundary) ──

  describe('Cross-tenant isolation', () => {
    it('[CT-009] Tenant B cannot GET tenant A private template by ID → 404', async () => {
      // Tenant A's private published template — tenant B not in allowedTenants
      await request(app.getHttpServer())
        .get(
          `/app/workflow-templates/${TENANT_A_PRIVATE_PUBLISHED_ID}`,
        )
        .set('Authorization', `Bearer ${tenantBToken}`)
        .expect(404);
    });

    it('[CT-009b] Tenant A CAN see own private published template in catalog', async () => {
      const res = await request(app.getHttpServer())
        .get('/app/workflow-templates')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(200);

      const ids = res.body.map((t: { id: string }) => t.id);
      expect(ids).toContain(TENANT_A_PRIVATE_PUBLISHED_ID);
    });

    it('[CT-010] Customer admin cannot access admin endpoint → 403', async () => {
      // customer_admin cannot PATCH via admin endpoint (role check)
      await request(app.getHttpServer())
        .patch(
          `/admin/workflow-templates/${TENANT_A_TEMPLATE_ID}`,
        )
        .set('Authorization', `Bearer ${tenantAToken}`)
        .send({ name: 'Hijacked!' })
        .expect(403);
    });
  });

  // ── Task 5: Admin Bypass + Flow Tests ──

  describe('Admin bypass + flow', () => {
    it('[CT-011] Admin LIST includes templates from all tenants (RLS bypass)', async () => {
      // Admin's findAll does not filter by tenantId in WHERE — relies on RLS.
      // With bypassRls=true, admin sees templates from ALL tenants.
      const res = await request(app.getHttpServer())
        .get('/admin/workflow-templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.map((t: { id: string }) => t.id);
      // Admin sees system-tenant templates AND cross-tenant templates
      expect(ids).toContain(TEMPLATE_PUBLIC_PUBLISHED_ID); // system tenant
      expect(ids).toContain(TEMPLATE_DRAFT_ID); // draft template visible to admin
      expect(ids).toContain(TENANT_A_TEMPLATE_ID); // tenant A
      expect(ids).toContain(TENANT_B_TEMPLATE_ID); // tenant B
      // Soft-deleted template excluded even for admin
      expect(ids).not.toContain(TEMPLATE_SOFT_DELETED_ID);
    });

    it('[CT-012] Tenant A sees admin-created public template in catalog', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/app/workflow-templates/${TEMPLATE_PUBLIC_PUBLISHED_ID}`,
        )
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(200);

      expect(res.body.id).toBe(TEMPLATE_PUBLIC_PUBLISHED_ID);
      expect(res.body.name).toBe('Published Public Template');
    });
  });

  // ── Task 6: Negative / Edge Case Tests ──

  describe('Negative / edge cases', () => {
    it('[CT-013] Unauthenticated request → 401', async () => {
      await request(app.getHttpServer())
        .get('/admin/workflow-templates')
        .expect(401);
    });

    it('[CT-014] Customer role on admin endpoint → 403', async () => {
      await request(app.getHttpServer())
        .get('/admin/workflow-templates')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(403);
    });

    it('[CT-015] Suspended tenant on app endpoint → 403 (TenantStatusGuard)', async () => {
      await request(app.getHttpServer())
        .get('/app/workflow-templates')
        .set('Authorization', `Bearer ${tenantCToken}`)
        .expect(403);
    });
  });
});
