import { LlmProviderConfigController } from './llm-provider-config.controller';
import { LlmProviderConfigService } from './llm-provider-config.service';
import { ProviderRegistry } from '../workflow-execution/llm/provider-registry.service';
import { LlmModelsService } from '../workflows/llm-models.service';
import { ModelReassignmentService } from '../workflows/model-reassignment.service';
import type { LlmProviderConfigResponseDto, LlmModelResponseDto, DeactivateModelResponseDto } from '@project-bubble/shared';

const providerId = '550e8400-e29b-41d4-a716-446655440000';
const replacementId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const mockResponse: LlmProviderConfigResponseDto = {
  id: providerId,
  providerKey: 'google-ai-studio',
  displayName: 'Google AI Studio',
  maskedCredentials: { apiKey: '***********3456' },
  rateLimitRpm: null,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockProviderEntity = {
  id: providerId,
  providerKey: 'google-ai-studio',
  displayName: 'Google AI Studio',
  isActive: true,
};

const mockModelResponse: LlmModelResponseDto = {
  id: 'model-1',
  providerKey: 'google-ai-studio',
  modelId: 'models/gemini-2.0-flash',
  displayName: 'Gemini 2.0 Flash',
  contextWindow: 1000000,
  maxOutputTokens: 8192,
  isActive: true,
  costPer1kInput: null,
  costPer1kOutput: null,
  generationDefaults: null,
  createdAt: new Date('2026-02-02'),
  updatedAt: new Date('2026-02-02'),
};

describe('LlmProviderConfigController [P1]', () => {
  let controller: LlmProviderConfigController;
  let service: jest.Mocked<LlmProviderConfigService>;
  let providerRegistry: ProviderRegistry;
  let llmModelsService: jest.Mocked<LlmModelsService>;
  let reassignmentService: jest.Mocked<ModelReassignmentService>;

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([mockResponse]),
      findById: jest.fn().mockResolvedValue(mockProviderEntity),
      create: jest.fn().mockResolvedValue(mockResponse),
      update: jest.fn().mockResolvedValue(mockResponse),
      getDecryptedCredentials: jest.fn(),
    } as unknown as jest.Mocked<LlmProviderConfigService>;

    llmModelsService = {
      findAll: jest.fn().mockResolvedValue([mockModelResponse]),
    } as unknown as jest.Mocked<LlmModelsService>;

    reassignmentService = {
      findAffectedVersions: jest.fn().mockResolvedValue([]),
      reassignAndDeactivate: jest.fn(),
      reassignMultipleAndDeactivate: jest.fn().mockResolvedValue([]),
      getActiveModelCount: jest.fn(),
    } as unknown as jest.Mocked<ModelReassignmentService>;

    providerRegistry = new ProviderRegistry();
    providerRegistry.onModuleInit();

    controller = new LlmProviderConfigController(
      service,
      providerRegistry,
      llmModelsService,
      reassignmentService,
    );
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
      const id = providerId;
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

  describe('getAffectedWorkflows', () => {
    it('[4-H1-UNIT-029] should find provider config, get active model IDs, and query affected versions', async () => {
      // When
      const result = await controller.getAffectedWorkflows(providerId);

      // Then
      expect(service.findById).toHaveBeenCalledWith(providerId);
      expect(llmModelsService.findAll).toHaveBeenCalled();
      expect(reassignmentService.findAffectedVersions).toHaveBeenCalledWith(['model-1']);
      expect(result).toEqual([]);
    });

    it('[4-H1-UNIT-030] should return empty array when provider has no active models', async () => {
      // Given — model for a different provider
      llmModelsService.findAll.mockResolvedValue([
        { ...mockModelResponse, providerKey: 'openai' },
      ]);

      // When
      const result = await controller.getAffectedWorkflows(providerId);

      // Then
      expect(reassignmentService.findAffectedVersions).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('deactivateProvider', () => {
    it('[4-H1-UNIT-031] should atomically deactivate all active models and provider config in single transaction', async () => {
      // Given
      const mockDeactivateResult = {
        versionsReassigned: 2,
        deactivatedModelId: 'model-1',
        replacementModelId: replacementId,
      } as DeactivateModelResponseDto;
      reassignmentService.reassignMultipleAndDeactivate.mockResolvedValue([mockDeactivateResult]);

      // When
      const result = await controller.deactivateProvider(providerId, {
        replacementModelId: replacementId,
      });

      // Then
      expect(service.findById).toHaveBeenCalledWith(providerId);
      expect(reassignmentService.reassignMultipleAndDeactivate).toHaveBeenCalledWith(
        ['model-1'],
        replacementId,
        providerId, // provider config ID passed for atomic deactivation
      );
      // Provider config deactivation is now inside the transaction — no separate update call
      expect(service.update).not.toHaveBeenCalledWith(providerId, { isActive: false });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockDeactivateResult);
    });

    it('[4-H1-UNIT-032] should pass empty array when no active models and still deactivate provider', async () => {
      // Given — no models for this provider
      llmModelsService.findAll.mockResolvedValue([]);

      // When
      const result = await controller.deactivateProvider(providerId, {
        replacementModelId: replacementId,
      });

      // Then
      expect(reassignmentService.reassignMultipleAndDeactivate).toHaveBeenCalledWith(
        [],
        replacementId,
        providerId, // provider config ID passed for atomic deactivation
      );
      expect(result).toHaveLength(0);
    });
  });
});
