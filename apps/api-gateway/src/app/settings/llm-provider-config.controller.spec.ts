import { LlmProviderConfigController } from './llm-provider-config.controller';
import { LlmProviderConfigService } from './llm-provider-config.service';
import { ProviderRegistry } from '../workflow-execution/llm/provider-registry.service';
import type { LlmProviderConfigResponseDto } from '@project-bubble/shared';

const mockResponse: LlmProviderConfigResponseDto = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  providerKey: 'google-ai-studio',
  displayName: 'Google AI Studio',
  maskedCredentials: { apiKey: '***********3456' },
  rateLimitRpm: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('LlmProviderConfigController [P1]', () => {
  let controller: LlmProviderConfigController;
  let service: jest.Mocked<LlmProviderConfigService>;
  let providerRegistry: ProviderRegistry;

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([mockResponse]),
      create: jest.fn().mockResolvedValue(mockResponse),
      update: jest.fn().mockResolvedValue(mockResponse),
      getDecryptedCredentials: jest.fn(),
    } as unknown as jest.Mocked<LlmProviderConfigService>;

    providerRegistry = new ProviderRegistry();
    providerRegistry.onModuleInit();

    controller = new LlmProviderConfigController(service, providerRegistry);
  });

  describe('findAll', () => {
    it('[3.1-4-UNIT-038] [P1] should return all provider configs', async () => {
      // When
      const result = await controller.findAll();

      // Then
      expect(result).toEqual([mockResponse]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('[3.1-4-UNIT-039] [P1] should create a provider config and return response', async () => {
      // Given
      const dto = {
        providerKey: 'google-ai-studio',
        displayName: 'Google AI Studio',
        credentials: { apiKey: 'test-key' },
      };

      // When
      const result = await controller.create(dto);

      // Then
      expect(result).toEqual(mockResponse);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('[3.1-4-UNIT-040] [P1] should update a provider config and return response', async () => {
      // Given
      const id = '550e8400-e29b-41d4-a716-446655440000';
      const dto = { displayName: 'Updated Name', isActive: false };

      // When
      const result = await controller.update(id, dto);

      // Then
      expect(result).toEqual(mockResponse);
      expect(service.update).toHaveBeenCalledWith(id, dto);
    });
  });

  describe('getProviderTypes', () => {
    it('[4-PR-UNIT-CT01] should return all provider types sorted by displayName', () => {
      // When
      const result = controller.getProviderTypes();

      // Then
      expect(result).toHaveLength(4);
      // Sorted alphabetically by displayName
      expect(result[0].providerKey).toBe('google-ai-studio');
      expect(result[0].displayName).toBe('Google AI Studio');
      expect(result[0].isDevelopmentOnly).toBe(false);
      expect(result[0].credentialFields).toHaveLength(1);
      expect(result[0].credentialFields[0].key).toBe('apiKey');
    });

    it('[4-PR-UNIT-CT02] should include credentialFields for each provider type', () => {
      // When
      const result = controller.getProviderTypes();

      // Then
      const googleEntry = result.find((r) => r.providerKey === 'google-ai-studio');
      expect(googleEntry!.credentialFields).toEqual([
        { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      ]);

      const mockEntry = result.find((r) => r.providerKey === 'mock');
      expect(mockEntry!.credentialFields).toEqual([]);
      expect(mockEntry!.isDevelopmentOnly).toBe(true);
    });

    it('[4-GP-UNIT-017] should include supportedGenerationParams for each provider type', () => {
      // When
      const result = controller.getProviderTypes();

      // Then
      const googleEntry = result.find((r) => r.providerKey === 'google-ai-studio');
      expect(googleEntry!.supportedGenerationParams).toBeDefined();
      expect(googleEntry!.supportedGenerationParams.length).toBe(5);
      expect(googleEntry!.supportedGenerationParams[0].key).toBe('temperature');

      const mockEntry = result.find((r) => r.providerKey === 'mock');
      expect(mockEntry!.supportedGenerationParams).toBeDefined();
      expect(mockEntry!.supportedGenerationParams.length).toBe(3);

      const openaiEntry = result.find((r) => r.providerKey === 'openai');
      expect(openaiEntry!.supportedGenerationParams).toBeDefined();
      expect(openaiEntry!.supportedGenerationParams.length).toBe(4);
    });

    it('[4-PR-UNIT-CT03] should return results sorted by displayName', () => {
      // When
      const result = controller.getProviderTypes();

      // Then
      const names = result.map((r) => r.displayName);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });
  });
});
