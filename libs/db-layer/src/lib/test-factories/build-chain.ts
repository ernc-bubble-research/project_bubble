import { faker } from '@faker-js/faker';
import { WorkflowChainEntity, WorkflowChainStatus } from '../entities/workflow-chain.entity';
import { WorkflowVisibility } from '../entities/workflow-template.entity';

const DEFAULT_DEFINITION = {
  metadata: { name: 'Test Chain', description: 'Auto-generated' },
  steps: [
    { workflow_id: '00000000-0000-0000-0000-000000000000', alias: 'Step 1' },
  ],
};

export function buildChain(overrides: Partial<WorkflowChainEntity> = {}): WorkflowChainEntity {
  return {
    id: faker.string.uuid(),
    tenantId: faker.string.uuid(),
    name: `${faker.word.adjective()} Chain`,
    description: faker.lorem.sentence(),
    visibility: WorkflowVisibility.PUBLIC,
    allowedTenants: null,
    definition: structuredClone(DEFAULT_DEFINITION),
    status: WorkflowChainStatus.DRAFT,
    createdBy: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as WorkflowChainEntity;
}
