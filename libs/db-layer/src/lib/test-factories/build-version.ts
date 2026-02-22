import { faker } from '@faker-js/faker';
import { WorkflowVersionEntity } from '../entities/workflow-version.entity';

const DEFAULT_DEFINITION = {
  metadata: { name: 'Test Workflow', description: 'Auto-generated', version: 1, tags: [] },
  inputs: [{ name: 'subject', label: 'Subject', role: 'subject', source: ['text'], required: true }],
  execution: { processing: 'parallel', model: 'mock-model', temperature: 0.7, max_output_tokens: 4096 },
  knowledge: { enabled: false },
  prompt: 'Analyze {subject}',
  output: {
    format: 'markdown',
    filename_template: 'output-{subject}',
    sections: [{ name: 'analysis', label: 'Analysis', required: true }],
  },
};

export function buildVersion(overrides: Partial<WorkflowVersionEntity> = {}): WorkflowVersionEntity {
  return {
    id: faker.string.uuid(),
    tenantId: faker.string.uuid(),
    templateId: faker.string.uuid(),
    versionNumber: 1,
    definition: structuredClone(DEFAULT_DEFINITION),
    previousGenerationConfig: null,
    createdBy: faker.string.uuid(),
    createdAt: new Date(),
    ...overrides,
  } as WorkflowVersionEntity;
}
