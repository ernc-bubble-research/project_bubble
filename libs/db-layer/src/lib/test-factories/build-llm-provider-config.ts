import { faker } from '@faker-js/faker';
import { LlmProviderConfigEntity } from '../entities/llm-provider-config.entity';

export function buildLlmProviderConfig(overrides: Partial<LlmProviderConfigEntity> = {}): LlmProviderConfigEntity {
  return {
    id: faker.string.uuid(),
    providerKey: 'mock',
    displayName: 'Mock Provider',
    encryptedCredentials: null,
    rateLimitRpm: 60,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as LlmProviderConfigEntity;
}
