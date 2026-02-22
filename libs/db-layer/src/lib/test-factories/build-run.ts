import { faker } from '@faker-js/faker';
import { WorkflowRunEntity, WorkflowRunStatus } from '../entities/workflow-run.entity';

export function buildRun(overrides: Partial<WorkflowRunEntity> = {}): WorkflowRunEntity {
  return {
    id: faker.string.uuid(),
    tenantId: faker.string.uuid(),
    versionId: faker.string.uuid(),
    chainId: null,
    chainStepIndex: null,
    status: WorkflowRunStatus.QUEUED,
    startedBy: faker.string.uuid(),
    inputSnapshot: { templateName: 'Test Workflow', creditsPerRun: 1 },
    outputAssetIds: null,
    assembledPrompt: null,
    rawLlmResponse: null,
    retryHistory: null,
    errorMessage: null,
    validationWarnings: null,
    tokenUsage: null,
    modelId: null,
    creditsConsumed: 0,
    isTestRun: false,
    creditsFromMonthly: 0,
    creditsFromPurchased: 0,
    startedAt: null,
    completedAt: null,
    lastRetriedAt: null,
    durationMs: null,
    totalJobs: null,
    completedJobs: null,
    failedJobs: null,
    perFileResults: null,
    maxRetryCount: 3,
    createdAt: new Date(),
    ...overrides,
  } as WorkflowRunEntity;
}
