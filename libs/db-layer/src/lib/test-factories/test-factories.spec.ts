import { buildTenant } from './build-tenant';
import { buildUser } from './build-user';
import { buildTemplate } from './build-template';
import { buildVersion } from './build-version';
import { buildRun } from './build-run';
import { buildAsset } from './build-asset';
import { buildLlmModel } from './build-llm-model';
import { buildLlmProviderConfig } from './build-llm-provider-config';
import { buildFolder } from './build-folder';
import { buildChain } from './build-chain';
import {
  buildDeletedTemplate,
  buildCrossTenantPublishedTemplate,
  buildDeactivatedModelWithActiveWorkflow,
  buildRunWithMixedFileResults,
  buildRunAtMaxRetry,
} from './adversarial';
import {
  SEED_SYSTEM_TENANT_ID,
  SEED_ADMIN_USER_ID,
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD,
  SEED_TENANT_A_ID,
  SEED_TENANT_A_USER_ID,
  SEED_TENANT_A_EMAIL,
  SEED_TENANT_A_PASSWORD,
  SEED_TENANT_B_ID,
  SEED_TENANT_B_USER_ID,
  SEED_TENANT_B_EMAIL,
  SEED_TENANT_B_PASSWORD,
  SEED_PUBLISHED_TEMPLATE_ID,
  SEED_PUBLISHED_VERSION_ID,
  SEED_DRAFT_TEMPLATE_ID,
  SEED_DRAFT_VERSION_ID,
  SEED_CHAIN_ID,
  SEED_RUN_COMPLETED_ID,
  SEED_RUN_COMPLETED_WITH_ERRORS_ID,
  SEED_RUN_FAILED_ID,
  SEED_OUTPUT_ASSET_1_ID,
  SEED_OUTPUT_ASSET_2_ID,
  SEED_LLM_MODEL_UUID,
} from './seed-constants';
import { TenantStatus, PlanTier } from '../entities/tenant.entity';
import { UserRole, UserStatus } from '../entities/user.entity';
import { WorkflowTemplateStatus, WorkflowVisibility } from '../entities/workflow-template.entity';
import { WorkflowRunStatus } from '../entities/workflow-run.entity';
import { AssetStatus } from '../entities/asset.entity';
import { WorkflowChainStatus } from '../entities/workflow-chain.entity';

// ── Helper ────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Tier 1 entity factories ──────────────────────────────────────────────
describe('Tier 1 entity factories', () => {
  describe('buildTenant', () => {
    it('returns valid defaults', () => {
      const t = buildTenant();
      expect(t.id).toMatch(UUID_RE);
      expect(t.name).toBeTruthy();
      expect(t.status).toBe(TenantStatus.ACTIVE);
      expect(t.planTier).toBe(PlanTier.FREE);
      expect(t.dataResidency).toBe('eu-west');
      expect(t.purchasedCredits).toBe(0);
      expect(t.createdAt).toBeInstanceOf(Date);
      expect(t.updatedAt).toBeInstanceOf(Date);
    });

    it('applies overrides', () => {
      const t = buildTenant({ name: 'Custom', status: TenantStatus.SUSPENDED });
      expect(t.name).toBe('Custom');
      expect(t.status).toBe(TenantStatus.SUSPENDED);
    });

    it('produces unique IDs across calls', () => {
      const a = buildTenant();
      const b = buildTenant();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('buildUser', () => {
    it('returns valid defaults', () => {
      const u = buildUser();
      expect(u.id).toMatch(UUID_RE);
      expect(u.email).toContain('@');
      expect(u.passwordHash).toBeTruthy();
      expect(u.role).toBe(UserRole.CUSTOMER_ADMIN);
      expect(u.status).toBe(UserStatus.ACTIVE);
      expect(u.tenantId).toMatch(UUID_RE);
      expect(u.failedLoginAttempts).toBe(0);
      expect(u.lockedUntil).toBeNull();
    });

    it('applies overrides', () => {
      const u = buildUser({ role: UserRole.BUBBLE_ADMIN, email: 'test@x.io' });
      expect(u.role).toBe(UserRole.BUBBLE_ADMIN);
      expect(u.email).toBe('test@x.io');
    });
  });

  describe('buildTemplate', () => {
    it('returns valid defaults', () => {
      const t = buildTemplate();
      expect(t.id).toMatch(UUID_RE);
      expect(t.tenantId).toMatch(UUID_RE);
      expect(t.name).toBeTruthy();
      expect(t.status).toBe(WorkflowTemplateStatus.DRAFT);
      expect(t.visibility).toBe(WorkflowVisibility.PUBLIC);
      expect(t.creditsPerRun).toBe(1);
      expect(t.currentVersionId).toBeNull();
      expect(t.deletedAt).toBeNull();
    });

    it('applies overrides', () => {
      const t = buildTemplate({ status: WorkflowTemplateStatus.PUBLISHED });
      expect(t.status).toBe(WorkflowTemplateStatus.PUBLISHED);
    });
  });

  describe('buildVersion', () => {
    it('returns valid defaults with definition shape', () => {
      const v = buildVersion();
      expect(v.id).toMatch(UUID_RE);
      expect(v.tenantId).toMatch(UUID_RE);
      expect(v.templateId).toMatch(UUID_RE);
      expect(v.versionNumber).toBe(1);
      expect(v.definition).toHaveProperty('metadata');
      expect(v.definition).toHaveProperty('inputs');
      expect(v.definition).toHaveProperty('execution');
      expect(v.definition).toHaveProperty('prompt');
      expect(v.definition).toHaveProperty('output');
      expect(v.previousGenerationConfig).toBeNull();
    });

    it('applies overrides', () => {
      const v = buildVersion({ versionNumber: 5 });
      expect(v.versionNumber).toBe(5);
    });
  });

  describe('buildRun', () => {
    it('returns valid defaults', () => {
      const r = buildRun();
      expect(r.id).toMatch(UUID_RE);
      expect(r.tenantId).toMatch(UUID_RE);
      expect(r.versionId).toMatch(UUID_RE);
      expect(r.status).toBe(WorkflowRunStatus.QUEUED);
      expect(r.creditsConsumed).toBe(0);
      expect(r.isTestRun).toBe(false);
      expect(r.maxRetryCount).toBe(3);
      expect(r.startedAt).toBeNull();
      expect(r.completedAt).toBeNull();
      expect(r.perFileResults).toBeNull();
    });

    it('applies overrides', () => {
      const r = buildRun({ status: WorkflowRunStatus.RUNNING, isTestRun: true });
      expect(r.status).toBe(WorkflowRunStatus.RUNNING);
      expect(r.isTestRun).toBe(true);
    });
  });

  describe('buildAsset', () => {
    it('returns valid defaults', () => {
      const a = buildAsset();
      expect(a.id).toMatch(UUID_RE);
      expect(a.tenantId).toMatch(UUID_RE);
      expect(a.originalName).toBeTruthy();
      expect(a.storagePath).toContain('/uploads/');
      expect(a.mimeType).toBe('application/pdf');
      expect(a.sha256Hash).toHaveLength(64);
      expect(a.status).toBe(AssetStatus.ACTIVE);
      expect(a.sourceType).toBe('user_upload');
      expect(a.folderId).toBeNull();
      expect(a.workflowRunId).toBeNull();
    });

    it('applies overrides', () => {
      const fId = 'folder-123';
      const a = buildAsset({ folderId: fId, mimeType: 'text/plain' });
      expect(a.folderId).toBe(fId);
      expect(a.mimeType).toBe('text/plain');
    });
  });
});

// ── Tier 2 entity factories ──────────────────────────────────────────────
describe('Tier 2 entity factories', () => {
  describe('buildLlmModel', () => {
    it('returns valid defaults (system-wide, no tenantId)', () => {
      const m = buildLlmModel();
      expect(m.id).toMatch(UUID_RE);
      expect(m.providerKey).toBe('mock');
      expect(m.modelId).toBeTruthy();
      expect(m.displayName).toBeTruthy();
      expect(m.contextWindow).toBe(128000);
      expect(m.maxOutputTokens).toBe(8192);
      expect(m.isActive).toBe(true);
      expect(m.costPer1kInput).toBe('0.001000');
      expect(m.costPer1kOutput).toBe('0.002000');
      expect(m.generationDefaults).toBeNull();
      expect((m as unknown as Record<string, unknown>)['tenantId']).toBeUndefined();
    });

    it('applies overrides', () => {
      const m = buildLlmModel({ isActive: false, providerKey: 'openai' });
      expect(m.isActive).toBe(false);
      expect(m.providerKey).toBe('openai');
    });
  });

  describe('buildLlmProviderConfig', () => {
    it('returns valid defaults (system-wide, no tenantId)', () => {
      const p = buildLlmProviderConfig();
      expect(p.id).toMatch(UUID_RE);
      expect(p.providerKey).toBe('mock');
      expect(p.displayName).toBe('Mock Provider');
      expect(p.encryptedCredentials).toBeNull();
      expect(p.rateLimitRpm).toBe(60);
      expect(p.isActive).toBe(true);
      expect((p as unknown as Record<string, unknown>)['tenantId']).toBeUndefined();
    });

    it('applies overrides', () => {
      const p = buildLlmProviderConfig({ providerKey: 'openai', rateLimitRpm: 120 });
      expect(p.providerKey).toBe('openai');
      expect(p.rateLimitRpm).toBe(120);
    });
  });

  describe('buildFolder', () => {
    it('returns valid defaults', () => {
      const f = buildFolder();
      expect(f.id).toMatch(UUID_RE);
      expect(f.tenantId).toMatch(UUID_RE);
      expect(f.name).toBeTruthy();
      expect(f.parentId).toBeNull();
    });

    it('applies overrides', () => {
      const parentId = 'parent-abc';
      const f = buildFolder({ parentId, name: 'Sub Folder' });
      expect(f.parentId).toBe(parentId);
      expect(f.name).toBe('Sub Folder');
    });
  });
});

// ── Chain factory ────────────────────────────────────────────────────────
describe('Chain factory', () => {
  describe('buildChain', () => {
    it('returns valid defaults', () => {
      const c = buildChain();
      expect(c.id).toMatch(UUID_RE);
      expect(c.tenantId).toMatch(UUID_RE);
      expect(c.name).toBeTruthy();
      expect(c.status).toBe(WorkflowChainStatus.DRAFT);
      expect(c.visibility).toBe(WorkflowVisibility.PUBLIC);
      expect(c.definition).toHaveProperty('steps');
      expect(c.deletedAt).toBeNull();
      expect(c.createdBy).toMatch(UUID_RE);
    });

    it('applies overrides', () => {
      const c = buildChain({ status: WorkflowChainStatus.PUBLISHED, name: 'My Chain' });
      expect(c.status).toBe(WorkflowChainStatus.PUBLISHED);
      expect(c.name).toBe('My Chain');
    });
  });
});

// ── Adversarial scenario factories ───────────────────────────────────────
describe('Adversarial scenario factories', () => {
  describe('buildDeletedTemplate', () => {
    it('has deletedAt set and ARCHIVED status', () => {
      const t = buildDeletedTemplate();
      expect(t.deletedAt).toBeInstanceOf(Date);
      expect(t.status).toBe(WorkflowTemplateStatus.ARCHIVED);
    });

    it('applies additional overrides', () => {
      const t = buildDeletedTemplate({ name: 'Gone Template' });
      expect(t.name).toBe('Gone Template');
      expect(t.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('buildCrossTenantPublishedTemplate', () => {
    it('has specified owner tenantId and PUBLIC/PUBLISHED', () => {
      const ownerTid = 'aaaa-bbbb-cccc';
      const t = buildCrossTenantPublishedTemplate(ownerTid);
      expect(t.tenantId).toBe(ownerTid);
      expect(t.status).toBe(WorkflowTemplateStatus.PUBLISHED);
      expect(t.visibility).toBe(WorkflowVisibility.PUBLIC);
      expect(t.currentVersionId).toMatch(UUID_RE);
    });
  });

  describe('buildDeactivatedModelWithActiveWorkflow', () => {
    it('returns deactivated model + version referencing it', () => {
      const { model, version } = buildDeactivatedModelWithActiveWorkflow();
      expect(model.isActive).toBe(false);
      expect(model.modelId).toBe('deactivated-model');
      expect((version.definition as Record<string, Record<string, string>>)['execution']['model']).toBe(model.modelId);
    });

    it('applies overrides to both model and version', () => {
      const { model, version } = buildDeactivatedModelWithActiveWorkflow({
        model: { providerKey: 'openai' },
        version: { versionNumber: 3 },
      });
      expect(model.providerKey).toBe('openai');
      expect(version.versionNumber).toBe(3);
    });
  });

  describe('buildRunWithMixedFileResults', () => {
    it('has COMPLETED_WITH_ERRORS status and mixed perFileResults', () => {
      const r = buildRunWithMixedFileResults();
      expect(r.status).toBe(WorkflowRunStatus.COMPLETED_WITH_ERRORS);
      expect(r.totalJobs).toBe(5);
      expect(r.completedJobs).toBe(3);
      expect(r.failedJobs).toBe(2);
      expect(r.perFileResults).toHaveLength(5);

      const completed = (r.perFileResults as Array<{ status: string }>).filter(
        (f) => f.status === 'completed',
      );
      const failed = (r.perFileResults as Array<{ status: string }>).filter(
        (f) => f.status === 'failed',
      );
      expect(completed).toHaveLength(3);
      expect(failed).toHaveLength(2);
    });
  });

  describe('buildRunAtMaxRetry', () => {
    it('has FAILED status with retryHistory matching maxRetryCount', () => {
      const r = buildRunAtMaxRetry();
      expect(r.status).toBe(WorkflowRunStatus.FAILED);
      expect(r.maxRetryCount).toBe(3);
      expect(r.retryHistory).toHaveLength(3);
      expect(r.lastRetriedAt).toBeInstanceOf(Date);
      expect(r.errorMessage).toBe('Max retries exhausted');
    });
  });
});

// ── Seed constants ───────────────────────────────────────────────────────
describe('Seed constants', () => {
  it('exports all required seed UUIDs', () => {
    expect(SEED_SYSTEM_TENANT_ID).toBe('00000000-0000-0000-0000-000000000000');
    expect(SEED_ADMIN_USER_ID).toBe('00000000-0000-0000-0000-000000000001');
    expect(SEED_ADMIN_EMAIL).toBe('admin@bubble.io');
    expect(SEED_ADMIN_PASSWORD).toBe('Admin123!');
    expect(SEED_TENANT_A_ID).toBe('11111111-0000-0000-0000-000000000000');
    expect(SEED_TENANT_A_USER_ID).toBe('11111111-0000-0000-0000-000000000001');
    expect(SEED_TENANT_A_EMAIL).toBe('tenant-a@test.io');
    expect(SEED_TENANT_A_PASSWORD).toBe('TenantA123!');
    expect(SEED_TENANT_B_ID).toBe('22222222-0000-0000-0000-000000000000');
    expect(SEED_TENANT_B_USER_ID).toBe('22222222-0000-0000-0000-000000000001');
    expect(SEED_TENANT_B_EMAIL).toBe('tenant-b@test.io');
    expect(SEED_TENANT_B_PASSWORD).toBe('TenantB123!');
    expect(SEED_PUBLISHED_TEMPLATE_ID).toBe('33333333-0000-0000-0000-000000000001');
    expect(SEED_PUBLISHED_VERSION_ID).toBe('33333333-0000-0000-0000-000000000002');
    expect(SEED_DRAFT_TEMPLATE_ID).toBe('33333333-0000-0000-0000-000000000010');
    expect(SEED_DRAFT_VERSION_ID).toBe('33333333-0000-0000-0000-000000000011');
    expect(SEED_CHAIN_ID).toBe('33333333-0000-0000-0000-000000000003');
    expect(SEED_RUN_COMPLETED_ID).toBe('44444444-0000-0000-0000-000000000001');
    expect(SEED_RUN_COMPLETED_WITH_ERRORS_ID).toBe('44444444-0000-0000-0000-000000000002');
    expect(SEED_RUN_FAILED_ID).toBe('44444444-0000-0000-0000-000000000003');
    expect(SEED_OUTPUT_ASSET_1_ID).toBe('44444444-0000-0000-0000-000000000010');
    expect(SEED_OUTPUT_ASSET_2_ID).toBe('44444444-0000-0000-0000-000000000011');
    expect(SEED_LLM_MODEL_UUID).toBe('55555555-0000-0000-0000-000000000001');
  });
});

// ── Schema drift detection (exhaustive keys) ────────────────────────────
// Column-backed fields only — skip TypeORM relation navigation properties
// (e.g., version?, chain?, model?, folder?, workflowRun?, template?)
describe('Schema drift detection', () => {
  const TENANT_KEYS = [
    'id', 'name', 'status', 'primaryContact', 'planTier', 'dataResidency',
    'maxMonthlyRuns', 'assetRetentionDays', 'purchasedCredits',
    'maxCreditsPerRunLimit', 'maxCreditsPerRun', 'createdAt', 'updatedAt',
  ].sort();

  const USER_KEYS = [
    'id', 'email', 'passwordHash', 'role', 'name', 'tenantId', 'status',
    'failedLoginAttempts', 'lockedUntil', 'createdAt', 'updatedAt',
  ].sort();

  const TEMPLATE_KEYS = [
    'id', 'tenantId', 'name', 'description', 'visibility', 'allowedTenants',
    'status', 'currentVersionId', 'creditsPerRun', 'createdBy', 'createdAt',
    'updatedAt', 'deletedAt',
  ].sort();

  const VERSION_KEYS = [
    'id', 'tenantId', 'templateId', 'versionNumber', 'definition',
    'previousGenerationConfig', 'createdBy', 'createdAt',
  ].sort();

  const RUN_KEYS = [
    'id', 'tenantId', 'versionId', 'chainId', 'chainStepIndex', 'status',
    'startedBy', 'inputSnapshot', 'outputAssetIds', 'assembledPrompt',
    'rawLlmResponse', 'retryHistory', 'errorMessage', 'validationWarnings',
    'tokenUsage', 'modelId', 'creditsConsumed', 'isTestRun',
    'creditsFromMonthly', 'creditsFromPurchased', 'startedAt', 'completedAt',
    'lastRetriedAt', 'durationMs', 'totalJobs', 'completedJobs', 'failedJobs',
    'perFileResults', 'maxRetryCount', 'createdAt',
  ].sort();

  const ASSET_KEYS = [
    'id', 'tenantId', 'folderId', 'originalName', 'storagePath', 'mimeType',
    'fileSize', 'sha256Hash', 'isIndexed', 'status', 'archivedAt', 'sourceType',
    'workflowRunId', 'uploadedBy', 'createdAt', 'updatedAt',
  ].sort();

  const LLM_MODEL_KEYS = [
    'id', 'providerKey', 'modelId', 'displayName', 'contextWindow',
    'maxOutputTokens', 'isActive', 'costPer1kInput', 'costPer1kOutput',
    'generationDefaults', 'createdAt', 'updatedAt',
  ].sort();

  const LLM_PROVIDER_KEYS = [
    'id', 'providerKey', 'displayName', 'encryptedCredentials', 'rateLimitRpm',
    'isActive', 'createdAt', 'updatedAt',
  ].sort();

  const FOLDER_KEYS = [
    'id', 'tenantId', 'name', 'parentId', 'createdAt', 'updatedAt',
  ].sort();

  const CHAIN_KEYS = [
    'id', 'tenantId', 'name', 'description', 'visibility', 'allowedTenants',
    'definition', 'status', 'createdBy', 'createdAt', 'updatedAt', 'deletedAt',
  ].sort();

  it('buildTenant covers all TenantEntity columns', () => {
    expect(Object.keys(buildTenant()).sort()).toEqual(TENANT_KEYS);
  });

  it('buildUser covers all UserEntity columns', () => {
    expect(Object.keys(buildUser()).sort()).toEqual(USER_KEYS);
  });

  it('buildTemplate covers all WorkflowTemplateEntity columns', () => {
    expect(Object.keys(buildTemplate()).sort()).toEqual(TEMPLATE_KEYS);
  });

  it('buildVersion covers all WorkflowVersionEntity columns', () => {
    expect(Object.keys(buildVersion()).sort()).toEqual(VERSION_KEYS);
  });

  it('buildRun covers all WorkflowRunEntity columns', () => {
    expect(Object.keys(buildRun()).sort()).toEqual(RUN_KEYS);
  });

  it('buildAsset covers all AssetEntity columns', () => {
    expect(Object.keys(buildAsset()).sort()).toEqual(ASSET_KEYS);
  });

  it('buildLlmModel covers all LlmModelEntity columns', () => {
    expect(Object.keys(buildLlmModel()).sort()).toEqual(LLM_MODEL_KEYS);
  });

  it('buildLlmProviderConfig covers all LlmProviderConfigEntity columns', () => {
    expect(Object.keys(buildLlmProviderConfig()).sort()).toEqual(LLM_PROVIDER_KEYS);
  });

  it('buildFolder covers all FolderEntity columns', () => {
    expect(Object.keys(buildFolder()).sort()).toEqual(FOLDER_KEYS);
  });

  it('buildChain covers all WorkflowChainEntity columns', () => {
    expect(Object.keys(buildChain()).sort()).toEqual(CHAIN_KEYS);
  });
});

// ── Barrel export completeness ───────────────────────────────────────────
describe('Barrel export', () => {
  it('exports all factory functions and constants from index', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const barrel = require('./index');

    // Tier 1
    expect(barrel.buildTenant).toBeInstanceOf(Function);
    expect(barrel.buildUser).toBeInstanceOf(Function);
    expect(barrel.buildTemplate).toBeInstanceOf(Function);
    expect(barrel.buildVersion).toBeInstanceOf(Function);
    expect(barrel.buildRun).toBeInstanceOf(Function);
    expect(barrel.buildAsset).toBeInstanceOf(Function);

    // Tier 2
    expect(barrel.buildLlmModel).toBeInstanceOf(Function);
    expect(barrel.buildLlmProviderConfig).toBeInstanceOf(Function);
    expect(barrel.buildFolder).toBeInstanceOf(Function);

    // Chain
    expect(barrel.buildChain).toBeInstanceOf(Function);

    // Adversarial
    expect(barrel.buildDeletedTemplate).toBeInstanceOf(Function);
    expect(barrel.buildCrossTenantPublishedTemplate).toBeInstanceOf(Function);
    expect(barrel.buildDeactivatedModelWithActiveWorkflow).toBeInstanceOf(Function);
    expect(barrel.buildRunWithMixedFileResults).toBeInstanceOf(Function);
    expect(barrel.buildRunAtMaxRetry).toBeInstanceOf(Function);

    // Seed constants (all 23)
    expect(barrel.SEED_SYSTEM_TENANT_ID).toBeDefined();
    expect(barrel.SEED_ADMIN_USER_ID).toBeDefined();
    expect(barrel.SEED_ADMIN_EMAIL).toBeDefined();
    expect(barrel.SEED_ADMIN_PASSWORD).toBeDefined();
    expect(barrel.SEED_TENANT_A_ID).toBeDefined();
    expect(barrel.SEED_TENANT_A_USER_ID).toBeDefined();
    expect(barrel.SEED_TENANT_A_EMAIL).toBeDefined();
    expect(barrel.SEED_TENANT_A_PASSWORD).toBeDefined();
    expect(barrel.SEED_TENANT_B_ID).toBeDefined();
    expect(barrel.SEED_TENANT_B_USER_ID).toBeDefined();
    expect(barrel.SEED_TENANT_B_EMAIL).toBeDefined();
    expect(barrel.SEED_TENANT_B_PASSWORD).toBeDefined();
    expect(barrel.SEED_PUBLISHED_TEMPLATE_ID).toBeDefined();
    expect(barrel.SEED_PUBLISHED_VERSION_ID).toBeDefined();
    expect(barrel.SEED_DRAFT_TEMPLATE_ID).toBeDefined();
    expect(barrel.SEED_DRAFT_VERSION_ID).toBeDefined();
    expect(barrel.SEED_CHAIN_ID).toBeDefined();
    expect(barrel.SEED_RUN_COMPLETED_ID).toBeDefined();
    expect(barrel.SEED_RUN_COMPLETED_WITH_ERRORS_ID).toBeDefined();
    expect(barrel.SEED_RUN_FAILED_ID).toBeDefined();
    expect(barrel.SEED_OUTPUT_ASSET_1_ID).toBeDefined();
    expect(barrel.SEED_OUTPUT_ASSET_2_ID).toBeDefined();
    expect(barrel.SEED_LLM_MODEL_UUID).toBeDefined();
  });
});
