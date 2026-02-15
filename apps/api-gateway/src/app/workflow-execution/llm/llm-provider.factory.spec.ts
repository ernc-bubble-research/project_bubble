/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LlmModelEntity, LlmProviderConfigEntity } from '@project-bubble/db-layer';
import { LlmProviderConfigService } from '../../settings/llm-provider-config.service';
import { LlmProviderFactory } from './llm-provider.factory';
import { ProviderRegistry } from './provider-registry.service';
import { MockLlmProvider } from './mock-llm.provider';

describe('LlmProviderFactory', () => {
  let factory: LlmProviderFactory;
  let modelRepo: { findOne: jest.Mock };
  let providerConfigRepo: { findOne: jest.Mock };
  let providerConfigService: { getDecryptedCredentials: jest.Mock };
  let providerRegistry: { get: jest.Mock };

  const mockProvider = new MockLlmProvider(0);

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
    providerRegistry = {
      get: jest.fn().mockReturnValue({
        providerKey: 'google-ai-studio',
        createProvider: jest.fn().mockReturnValue(mockProvider),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmProviderFactory,
        { provide: getRepositoryToken(LlmModelEntity), useValue: modelRepo },
        { provide: getRepositoryToken(LlmProviderConfigEntity), useValue: providerConfigRepo },
        { provide: LlmProviderConfigService, useValue: providerConfigService },
        { provide: ProviderRegistry, useValue: providerRegistry },
      ],
    }).compile();

    factory = module.get(LlmProviderFactory);
  });

  // [4.2-UNIT-021] Happy path: resolves provider via registry
  it('should resolve a provider via registry for google-ai-studio model', async () => {
    modelRepo.findOne.mockResolvedValue(mockModel);
    providerConfigRepo.findOne.mockResolvedValue(mockProviderConfig);

    const result = await factory.getProvider('model-uuid-1');

    expect(result.provider).toBe(mockProvider);
    expect(result.model).toEqual(mockModel);
    expect(providerConfigService.getDecryptedCredentials).toHaveBeenCalledWith('google-ai-studio');
    expect(providerRegistry.get).toHaveBeenCalledWith('google-ai-studio');
  });

  // [4.2-UNIT-022] Happy path: resolves MockLlmProvider via registry
  it('should resolve a provider for mock model via registry', async () => {
    const mockRegistryEntry = {
      providerKey: 'mock',
      createProvider: jest.fn().mockReturnValue(mockProvider),
    };
    providerRegistry.get.mockReturnValue(mockRegistryEntry);
    modelRepo.findOne.mockResolvedValue({ ...mockModel, providerKey: 'mock' });
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, providerKey: 'mock' });

    const result = await factory.getProvider('model-uuid-1');

    expect(result.provider).toBe(mockProvider);
    expect(providerRegistry.get).toHaveBeenCalledWith('mock');
  });

  // [4.2-UNIT-023] Model not found
  it('should throw NotFoundException when model UUID does not exist', async () => {
    modelRepo.findOne.mockResolvedValue(null);

    await expect(factory.getProvider('non-existent-uuid')).rejects.toThrow(
      NotFoundException,
    );
  });

  // [4.2-UNIT-024] Model inactive — user-friendly error referencing model displayName
  it('should throw BadRequestException with user-friendly message when model is inactive', async () => {
    modelRepo.findOne.mockResolvedValue({ ...mockModel, isActive: false });

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /The configured model 'Gemini 1\.5 Pro' is currently disabled by your administrator/,
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

  // [4.2-UNIT-026] Provider config inactive — user-friendly error referencing MODEL displayName (not provider)
  it('should throw BadRequestException with user-friendly message referencing model name when provider is inactive', async () => {
    modelRepo.findOne.mockResolvedValue(mockModel);
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, isActive: false });

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /The configured model 'Gemini 1\.5 Pro' is currently disabled by your administrator/,
    );
  });

  // [4.2-UNIT-027] Registry entry's createProvider is called with modelId and credentials
  it('should pass modelId and credentials to registry createProvider', async () => {
    const createProviderFn = jest.fn().mockReturnValue(mockProvider);
    providerRegistry.get.mockReturnValue({
      providerKey: 'google-ai-studio',
      createProvider: createProviderFn,
    });
    modelRepo.findOne.mockResolvedValue(mockModel);
    providerConfigRepo.findOne.mockResolvedValue(mockProviderConfig);

    await factory.getProvider('model-uuid-1');

    expect(createProviderFn).toHaveBeenCalledWith('gemini-1.5-pro', { apiKey: 'test-key' });
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
    const newProvider = new MockLlmProvider(0);
    let callCount = 0;
    providerRegistry.get.mockReturnValue({
      providerKey: 'mock',
      createProvider: jest.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockProvider : newProvider;
      }),
    });
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
    const providerA = new MockLlmProvider(0);
    const providerB = new MockLlmProvider(0);
    let callCount = 0;
    providerRegistry.get.mockReturnValue({
      providerKey: 'mock',
      createProvider: jest.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? providerA : providerB;
      }),
    });

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

  // [4.2-UNIT-030] Vertex provider — registry delegates to entry which throws
  it('should throw for vertex provider when registry entry throws', async () => {
    providerRegistry.get.mockReturnValue({
      providerKey: 'vertex',
      createProvider: jest.fn().mockImplementation(() => {
        throw new BadRequestException('Vertex provider is not yet implemented');
      }),
    });
    modelRepo.findOne.mockResolvedValue({ ...mockModel, providerKey: 'vertex' });
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, providerKey: 'vertex' });

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /not yet implemented/,
    );
  });

  // [4.2-UNIT-031] OpenAI provider — registry delegates to entry which throws
  it('should throw for openai provider when registry entry throws', async () => {
    providerRegistry.get.mockReturnValue({
      providerKey: 'openai',
      createProvider: jest.fn().mockImplementation(() => {
        throw new BadRequestException('OpenAI provider is not yet implemented');
      }),
    });
    modelRepo.findOne.mockResolvedValue({ ...mockModel, providerKey: 'openai' });
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, providerKey: 'openai' });

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /not yet implemented/,
    );
  });

  // [4.2-UNIT-032] Unknown provider key — registry returns undefined
  it('should throw for unknown provider key when registry returns undefined', async () => {
    providerRegistry.get.mockReturnValue(undefined);
    modelRepo.findOne.mockResolvedValue({ ...mockModel, providerKey: 'unknown' });
    providerConfigRepo.findOne.mockResolvedValue({ ...mockProviderConfig, providerKey: 'unknown' });

    await expect(factory.getProvider('model-uuid-1')).rejects.toThrow(
      /Unknown provider key/,
    );
  });
});
