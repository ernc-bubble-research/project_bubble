/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LlmModelEntity, LlmProviderConfigEntity } from '@project-bubble/db-layer';
import { LlmProviderConfigService } from '../../settings/llm-provider-config.service';
import { LlmProviderFactory } from './llm-provider.factory';
import { MockLlmProvider } from './mock-llm.provider';
import { GoogleAIStudioLlmProvider } from './google-ai-studio-llm.provider';

describe('LlmProviderFactory', () => {
  let factory: LlmProviderFactory;
  let modelRepo: { findOne: jest.Mock };
  let providerConfigRepo: { findOne: jest.Mock };
  let providerConfigService: { getDecryptedCredentials: jest.Mock };

  const mockModel: Partial<LlmModelEntity> = {
    id: 'model-uuid-1',
    providerKey: 'google-ai-studio',
    modelId: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    isActive: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockProviderConfig: Partial<LlmProviderConfigEntity> = {
    id: 'config-uuid-1',
    providerKey: 'google-ai-studio',
    displayName: 'Google AI Studio',
    isActive: true,
    updatedAt: new Date('2025-01-01'),
  };

  beforeEach(async () => {
    modelRepo = { findOne: jest.fn() };
    providerConfigRepo = { findOne: jest.fn() };
    providerConfigService = {
      getDecryptedCredentials: jest.fn().mockResolvedValue({ apiKey: 'test-key' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmProviderFactory,
        { provide: getRepositoryToken(LlmModelEntity), useValue: modelRepo },
        { provide: getRepositoryToken(LlmProviderConfigEntity), useValue: providerConfigRepo },
        { provide: LlmProviderConfigService, useValue: providerConfigService },
      ],
    }).compile();

    factory = module.get(LlmProviderFactory);
  });

  // [4.2-UNIT-021] Happy path: resolves Google AI Studio provider
  it('should resolve a GoogleAIStudioLlmProvider for google-ai-studio model', async () => {
    modelRepo.findOne.mockResolvedValue(mockModel);
    providerConfigRepo.findOne.mockResolvedValue(mockProviderConfig);

    const result = await factory.getProvider('model-uuid-1');

    expect(result.provider).toBeInstanceOf(GoogleAIStudioLlmProvider);
    expect(result.model).toEqual(mockModel);
    expect(providerConfigService.getDecryptedCredentials).toHaveBeenCalledWith('google-ai-studio');
  });

  // [4.2-UNIT-022] Happy path: resolves MockLlmProvider
  it('should resolve a MockLlmProvider for mock model', async () => {
    modelRepo.findOne.mockResolvedValue({ ...mockModel, providerKey: 'mock' });
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, providerKey: 'mock' });

    const result = await factory.getProvider('model-uuid-1');

    expect(result.provider).toBeInstanceOf(MockLlmProvider);
  });

  // [4.2-UNIT-023] Model not found
  it('should throw NotFoundException when model UUID does not exist', async () => {
    modelRepo.findOne.mockResolvedValue(null);

    await expect(factory.getProvider('non-existent-uuid')).rejects.toThrow(
      NotFoundException,
    );
  });

  // [4.2-UNIT-024] Model inactive
  it('should throw BadRequestException when model is inactive', async () => {
    modelRepo.findOne.mockResolvedValue({ ...mockModel, isActive: false });

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /inactive/,
    );
  });

  // [4.2-UNIT-025] Provider config not found
  it('should throw NotFoundException when provider config does not exist', async () => {
    modelRepo.findOne.mockResolvedValue(mockModel);
    providerConfigRepo.findOne.mockResolvedValue(null);

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  // [4.2-UNIT-026] Provider config inactive
  it('should throw BadRequestException when provider config is inactive', async () => {
    modelRepo.findOne.mockResolvedValue(mockModel);
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, isActive: false });

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /inactive/,
    );
  });

  // [4.2-UNIT-027] Missing apiKey for google-ai-studio
  it('should throw BadRequestException when google-ai-studio credentials lack apiKey', async () => {
    modelRepo.findOne.mockResolvedValue(mockModel);
    providerConfigRepo.findOne.mockResolvedValue(mockProviderConfig);
    providerConfigService.getDecryptedCredentials.mockResolvedValue({});

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /apiKey/,
    );
  });

  // [4.2-UNIT-028] Cache hit — returns cached provider without re-fetching credentials
  it('should return cached provider on second call without refetching credentials', async () => {
    modelRepo.findOne.mockResolvedValue({ ...mockModel, providerKey: 'mock' });
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, providerKey: 'mock' });

    const result1 = await factory.getProvider('model-uuid-1');
    const result2 = await factory.getProvider('model-uuid-1');

    expect(result1.provider).toBe(result2.provider); // same instance
    expect(providerConfigService.getDecryptedCredentials).toHaveBeenCalledTimes(1); // only called once
  });

  // [4.2-UNIT-029] Cache invalidation — rebuilds when config.updatedAt > cachedAt
  it('should rebuild provider when config updatedAt is newer than cache', async () => {
    modelRepo.findOne.mockResolvedValue({ ...mockModel, providerKey: 'mock' });

    const oldConfig = { ...mockProviderConfig, providerKey: 'mock', updatedAt: new Date('2025-01-01') };
    providerConfigRepo.findOne.mockResolvedValue(oldConfig);

    const result1 = await factory.getProvider('model-uuid-1');

    // Simulate config update — updatedAt must be AFTER cachedAt (which is "now")
    const newConfig = { ...mockProviderConfig, providerKey: 'mock', updatedAt: new Date('2099-01-01') };
    providerConfigRepo.findOne.mockResolvedValue(newConfig);

    const result2 = await factory.getProvider('model-uuid-1');

    // Provider should be different instance
    expect(result1.provider).not.toBe(result2.provider);
    expect(providerConfigService.getDecryptedCredentials).toHaveBeenCalledTimes(2);
  });

  // [4.2-UNIT-065] Cache key includes modelId — different models under same provider get separate instances
  it('should cache separately for different models under the same provider', async () => {
    const modelA = { ...mockModel, id: 'model-uuid-a', providerKey: 'mock', modelId: 'mock-model-a' };
    const modelB = { ...mockModel, id: 'model-uuid-b', providerKey: 'mock', modelId: 'mock-model-b' };
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, providerKey: 'mock' });

    // First call with model A
    modelRepo.findOne.mockResolvedValue(modelA);
    const resultA = await factory.getProvider('model-uuid-a');

    // Second call with model B (same provider, different modelId)
    modelRepo.findOne.mockResolvedValue(modelB);
    const resultB = await factory.getProvider('model-uuid-b');

    // Should be different instances (different cache keys)
    expect(resultA.provider).not.toBe(resultB.provider);
    expect(resultA.model.modelId).toBe('mock-model-a');
    expect(resultB.model.modelId).toBe('mock-model-b');
  });

  // [4.2-UNIT-030] Vertex provider throws "not yet implemented"
  it('should throw for vertex provider (not yet implemented)', async () => {
    modelRepo.findOne.mockResolvedValue({ ...mockModel, providerKey: 'vertex' });
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, providerKey: 'vertex' });

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /not yet implemented/,
    );
  });

  // [4.2-UNIT-031] OpenAI provider throws "not yet implemented"
  it('should throw for openai provider (not yet implemented)', async () => {
    modelRepo.findOne.mockResolvedValue({ ...mockModel, providerKey: 'openai' });
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, providerKey: 'openai' });

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /not yet implemented/,
    );
  });

  // [4.2-UNIT-032] Unknown provider key throws
  it('should throw for unknown provider key', async () => {
    modelRepo.findOne.mockResolvedValue({ ...mockModel, providerKey: 'unknown' });
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, providerKey: 'unknown' });

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /Unknown provider key/,
    );
  });
});
