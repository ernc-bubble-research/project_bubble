import { faker } from '@faker-js/faker';
import {
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  WorkflowVisibility,
} from '../entities/workflow-template.entity';

export function buildTemplate(overrides: Partial<WorkflowTemplateEntity> = {}): WorkflowTemplateEntity {
  return {
    id: faker.string.uuid(),
    tenantId: faker.string.uuid(),
    name: `${faker.word.adjective()} ${faker.word.noun()} Workflow`,
    description: faker.lorem.sentence(),
    visibility: WorkflowVisibility.PUBLIC,
    allowedTenants: null,
    status: WorkflowTemplateStatus.DRAFT,
    currentVersionId: null,
    creditsPerRun: 1,
    createdBy: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as WorkflowTemplateEntity;
}
