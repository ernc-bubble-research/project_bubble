/**
 * API Contract Tests — Tier 3: Story B (Remaining Endpoints)
 *
 * Extends the P0 template tests from api-contract.spec.ts with coverage for:
 * auth, tenant management, LLM settings/models, and workflow chains.
 *
 * Story: 4-tier3-api-coverage
 * DB: project_bubble_contract_test (shared with api-contract.spec.ts — run with --runInBand)
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
  PROVIDER_CONFIG_ID,
  MODEL_ACTIVE_ID,
  MODEL_INACTIVE_ID,
  CHAIN_DRAFT_ID,
  TEMPLATE_PUBLIC_PUBLISHED_ID,
  TEMPLATE_DRAFT_ID,
  USER_A_EMAIL,
  USER_A_PASSWORD,
  TEST_DB_NAME,
} from './contract-test-helpers';
import {
  createTestDatabase,
  dropTestDatabase,
} from './test-db-helpers';

describe('API Contract Tests — Tier 3 [Story B]', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let seedDs: DataSource;

  let adminToken: string;
  let tenantAToken: string;

  beforeAll(async () => {
    await createTestDatabase(TEST_DB_NAME);

    const result = await createContractApp();
    app = result.app;
    module = result.module;
    jwtService = result.jwtService;
    seedDs = result.seedDs;

    await seedContractData(seedDs);

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
  }, 120_000);

  afterAll(async () => {
    if (seedDs?.isInitialized) {
      await seedDs.destroy();
    }

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

    await dropTestDatabase(TEST_DB_NAME);
  }, 30_000);

  // ── Task 2: Auth Endpoint Tests ──────────────────────────────────

  describe('Auth endpoints', () => {
    it('[CT-101] Login with valid credentials → 201, returned JWT authenticates subsequent request', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: USER_A_EMAIL, password: USER_A_PASSWORD })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(USER_A_EMAIL);
      expect(res.body.user.role).toBe('customer_admin');
      expect(res.body.user.tenantId).toBe(TENANT_A_ID);

      // Verify the returned token actually works for authenticated requests
      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);

      expect(meRes.body.id).toBe(USER_A_ID);
      expect(meRes.body.email).toBe(USER_A_EMAIL);
    });

    it('[CT-102] Login with wrong password → 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: USER_A_EMAIL, password: 'WrongPassword999!' })
        .expect(401);
    });

    it('[CT-103] GET /auth/me with valid token → 200, returns user profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(200);

      expect(res.body.id).toBe(USER_A_ID);
      expect(res.body.email).toBe(USER_A_EMAIL);
      expect(res.body.role).toBe('customer_admin');
    });

    it('[CT-104] GET /auth/me without token → 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);
    });
  });

  // ── Task 3: Tenant Management Tests ──────────────────────────────

  describe('Tenant management (admin)', () => {
    it('[CT-201] Admin creates tenant → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Contract Test Tenant' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Contract Test Tenant');
      expect(res.body.status).toBe('active');
    });

    it('[CT-202] Admin lists tenants → 200, includes seeded tenants', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.map((t: { id: string }) => t.id);
      expect(ids).toContain(TENANT_A_ID);
      expect(ids).toContain(TENANT_B_ID);
    });

    it('[CT-203] Customer admin cannot access admin tenants → 401 (AdminApiKeyGuard rejects non-admin)', async () => {
      await request(app.getHttpServer())
        .get('/admin/tenants')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(401);
    });

    it('[CT-204] Admin impersonate tenant → 201, JWT has impersonated tenant_id', async () => {
      const res = await request(app.getHttpServer())
        .post(`/admin/tenants/${TENANT_A_ID}/impersonate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(res.body.tenant).toBeDefined();
      expect(res.body.tenant.id).toBe(TENANT_A_ID);
      expect(res.body).toHaveProperty('sessionId');

      // Verify the impersonation token works for tenant-scoped requests
      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.token}`)
        .expect(200);

      expect(meRes.body.id).toBe(ADMIN_USER_ID);
    });
  });

  // ── Task 4: LLM Provider Settings Tests ──────────────────────────

  describe('LLM provider settings (admin)', () => {
    it('[CT-301] Admin lists providers → 200, credentials masked', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/settings/llm-providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const mockProvider = res.body.find(
        (p: { providerKey: string }) => p.providerKey === 'mock',
      );
      expect(mockProvider).toBeDefined();
      expect(mockProvider.id).toBe(PROVIDER_CONFIG_ID);

      // Credential masking: must be an object with masked values, not raw keys
      expect(mockProvider.maskedCredentials).toBeDefined();
      expect(typeof mockProvider.maskedCredentials).toBe('object');
      expect(mockProvider.maskedCredentials).toHaveProperty('api_key');
      expect(mockProvider.maskedCredentials.api_key).toMatch(/^\*+/);
      expect(mockProvider.maskedCredentials.api_key).not.toContain('test-mock-api-key');
    });

    it('[CT-302] Admin creates provider with unknown key → 400 (registry validation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/settings/llm-providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          providerKey: 'unknown-provider-key',
          displayName: 'Unknown Provider',
          credentials: { apiKey: 'sk-test-key' },
        })
        .expect(400);

      expect(res.body.message).toContain('Unknown provider key');
    });

    it('[CT-303] Customer admin cannot access settings → 403', async () => {
      await request(app.getHttpServer())
        .get('/admin/settings/llm-providers')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(403);
    });

    it('[CT-304] Admin GET provider types → 200, returns known types', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/settings/llm-providers/types')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const keys = res.body.map((t: { providerKey: string }) => t.providerKey);
      expect(keys).toContain('mock');
    });
  });

  // ── Task 5: LLM Model Tests ──────────────────────────────────────

  describe('LLM models (admin + app)', () => {
    it('[CT-401] Admin lists all models (includes inactive) → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/llm-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.map((m: { id: string }) => m.id);
      expect(ids).toContain(MODEL_ACTIVE_ID);
      expect(ids).toContain(MODEL_INACTIVE_ID);
    });

    it('[CT-402] App lists models (active only) → 200, excludes inactive', async () => {
      // Note: RlsSetupService.onModuleInit() seeds default models if table is empty.
      // Our seed inserts AFTER app init, so auto-seeded active models may also appear.
      // We assert contains/not-contains on OUR known IDs — not exact list equality.
      const res = await request(app.getHttpServer())
        .get('/app/llm-models')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(200);

      const ids = res.body.map((m: { id: string }) => m.id);
      expect(ids).toContain(MODEL_ACTIVE_ID);
      expect(ids).not.toContain(MODEL_INACTIVE_ID);
    });

    it('[CT-403] Admin creates model → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/llm-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          providerKey: 'mock',
          modelId: 'mock-model-contract-test',
          displayName: 'Contract Test Model',
          contextWindow: 16000,
          maxOutputTokens: 4096,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.modelId).toBe('mock-model-contract-test');
      expect(res.body.isActive).toBe(false); // models start inactive by default
    });

    it('[CT-404] Admin bulk status toggle → 200', async () => {
      await request(app.getHttpServer())
        .patch('/admin/llm-models/bulk-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ providerKey: 'mock', isActive: false })
        .expect(200);

      // Verify: all mock models should now be inactive
      const res = await request(app.getHttpServer())
        .get('/admin/llm-models')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const mockModels = res.body.filter(
        (m: { providerKey: string }) => m.providerKey === 'mock',
      );
      for (const model of mockModels) {
        expect(model.isActive).toBe(false);
      }

      // Restore MODEL_ACTIVE_ID to active (prevent shared DB state corruption)
      await seedDs.query(
        `UPDATE llm_models SET is_active = true WHERE id = $1`,
        [MODEL_ACTIVE_ID],
      );
    });
  });

  // ── Task 6: Workflow Chain Tests ─────────────────────────────────

  describe('Workflow chains (admin)', () => {
    it('[CT-501] Admin creates chain → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/workflow-chains')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Contract Test Chain',
          description: 'Created via contract test',
          definition: {
            metadata: { name: 'Test Chain', description: 'For testing' },
            steps: [
              { workflow_id: TEMPLATE_PUBLIC_PUBLISHED_ID, alias: 'first' },
              {
                workflow_id: TEMPLATE_PUBLIC_PUBLISHED_ID, alias: 'second',
                input_mapping: { data: { from_step: 'first', from_output: 'outputs' } },
              },
            ],
          },
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Contract Test Chain');
      expect(res.body.status).toBe('draft');
    });

    it('[CT-502] Admin lists chains → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/workflow-chains')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).toContain(CHAIN_DRAFT_ID);
    });

    it('[CT-503] Admin publishes draft chain → 200', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/workflow-chains/${CHAIN_DRAFT_ID}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('published');
    });

    it('[CT-505] Admin creates chain with draft template → 400 (validation boundary)', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/workflow-chains')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Chain',
          description: 'References draft template',
          definition: {
            metadata: { name: 'Bad Chain', description: 'Should fail' },
            steps: [
              { workflow_id: TEMPLATE_DRAFT_ID, alias: 'first' },
              {
                workflow_id: TEMPLATE_DRAFT_ID, alias: 'second',
                input_mapping: { data: { from_step: 'first', from_output: 'outputs' } },
              },
            ],
          },
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('[CT-504] Customer admin cannot access admin chains → 403', async () => {
      await request(app.getHttpServer())
        .get('/admin/workflow-chains')
        .set('Authorization', `Bearer ${tenantAToken}`)
        .expect(403);
    });
  });
});
