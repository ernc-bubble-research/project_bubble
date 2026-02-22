import { faker } from '@faker-js/faker';
import { WorkflowTemplateStatus, WorkflowVisibility } from '../entities/workflow-template.entity';
import { WorkflowRunStatus } from '../entities/workflow-run.entity';
import { buildTemplate } from './build-template';
import { buildRun } from './build-run';
import { buildLlmModel } from './build-llm-model';
import { buildVersion } from './build-version';
import { WorkflowTemplateEntity } from '../entities/workflow-template.entity';
import { WorkflowRunEntity } from '../entities/workflow-run.entity';
import { LlmModelEntity } from '../entities/llm-model.entity';
import { WorkflowVersionEntity } from '../entities/workflow-version.entity';

/**
 * Soft-deleted template — exercises DeleteDateColumn filtering.
 * Tests should verify this template is excluded from normal queries.
 */
export function buildDeletedTemplate(
  overrides: Partial<WorkflowTemplateEntity> = {},
): WorkflowTemplateEntity {
  return buildTemplate({
    status: WorkflowTemplateStatus.ARCHIVED,
    deletedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  });
}

/**
 * Published template owned by a DIFFERENT tenant — exercises RLS
 * and cross-tenant catalog access (findPublishedOne Rule 2c exception).
 */
export function buildCrossTenantPublishedTemplate(
  ownerTenantId: string,
  overrides: Partial<WorkflowTemplateEntity> = {},
): WorkflowTemplateEntity {
  return buildTemplate({
    tenantId: ownerTenantId,
    status: WorkflowTemplateStatus.PUBLISHED,
    visibility: WorkflowVisibility.PUBLIC,
    currentVersionId: faker.string.uuid(),
    ...overrides,
  });
}

/**
 * Deactivated model referenced by an active workflow version —
 * exercises pre-flight validation (model must be active to run).
 * Returns { model, version } pair for test setup.
 */
export function buildDeactivatedModelWithActiveWorkflow(
  overrides?: { model?: Partial<LlmModelEntity>; version?: Partial<WorkflowVersionEntity> },
): { model: LlmModelEntity; version: WorkflowVersionEntity } {
  const model = buildLlmModel({
    isActive: false,
    modelId: 'deactivated-model',
    ...overrides?.model,
  });

  const version = buildVersion({
    definition: {
      metadata: { name: 'Uses Deactivated Model', description: 'Test', version: 1, tags: [] },
      inputs: [{ name: 'subject', label: 'Subject', role: 'subject', source: ['text'], required: true }],
      execution: { processing: 'parallel', model: model.modelId, temperature: 0.7, max_output_tokens: 4096 },
      knowledge: { enabled: false },
      prompt: 'Analyze {subject}',
      output: { format: 'markdown', filename_template: 'output-{subject}', sections: [{ name: 'analysis', label: 'Analysis', required: true }] },
    },
    ...overrides?.version,
  });

  return { model, version };
}

/**
 * Run with mixed per-file results — exercises completed_with_errors status
 * and "Retry failed" button logic.
 */
export function buildRunWithMixedFileResults(
  overrides: Partial<WorkflowRunEntity> = {},
): WorkflowRunEntity {
  return buildRun({
    status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
    totalJobs: 5,
    completedJobs: 3,
    failedJobs: 2,
    perFileResults: [
      { index: 0, fileName: 'doc1.pdf', status: 'completed', outputAssetId: faker.string.uuid() },
      { index: 1, fileName: 'doc2.pdf', status: 'completed', outputAssetId: faker.string.uuid() },
      { index: 2, fileName: 'doc3.pdf', status: 'completed', outputAssetId: faker.string.uuid() },
      { index: 3, fileName: 'doc4.pdf', status: 'failed', errorMessage: 'Token budget exceeded' },
      { index: 4, fileName: 'doc5.pdf', status: 'failed', errorMessage: 'Provider rate limit' },
    ],
    completedAt: new Date(),
    durationMs: 45000,
    ...overrides,
  });
}

/**
 * Run at maximum retry count — exercises retry exhaustion logic.
 * Next failure should NOT trigger another retry.
 */
export function buildRunAtMaxRetry(
  overrides: Partial<WorkflowRunEntity> = {},
): WorkflowRunEntity {
  return buildRun({
    status: WorkflowRunStatus.FAILED,
    maxRetryCount: 3,
    retryHistory: [
      { attempt: 1, failedAt: new Date('2025-06-01T10:00:00Z').toISOString(), error: 'Provider timeout' },
      { attempt: 2, failedAt: new Date('2025-06-01T10:01:00Z').toISOString(), error: 'Provider timeout' },
      { attempt: 3, failedAt: new Date('2025-06-01T10:02:00Z').toISOString(), error: 'Provider timeout' },
    ],
    lastRetriedAt: new Date('2025-06-01T10:02:00Z'),
    errorMessage: 'Max retries exhausted',
    ...overrides,
  });
}
