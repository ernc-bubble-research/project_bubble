import { faker } from '@faker-js/faker';
import { LlmModelEntity } from '../entities/llm-model.entity';

export function buildLlmModel(overrides: Partial<LlmModelEntity> = {}): LlmModelEntity {
  return {
    id: faker.string.uuid(),
    providerKey: 'mock',
    modelId: `model-${faker.string.alphanumeric(6)}`,
    displayName: `${faker.word.adjective()} Model`,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    isActive: true,
    costPer1kInput: '0.001000',
    costPer1kOutput: '0.002000',
    generationDefaults: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as LlmModelEntity;
}
