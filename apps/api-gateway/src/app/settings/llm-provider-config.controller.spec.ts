import { LlmProviderConfigController } from './llm-provider-config.controller';
import { LlmProviderConfigService } from './llm-provider-config.service';
import type { LlmProviderConfigResponseDto } from '@project-bubble/shared';

const mockResponse: LlmProviderConfigResponseDto = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  providerKey: 'google-ai-studio',
  displayName: 'Google AI Studio',
  maskedCredentials: { apiKey: '***********3456' },
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('LlmProviderConfigController [P1]', () => {
  let controller: LlmProviderConfigController;
  let service: jest.Mocked<LlmProviderConfigService>;

  beforeEach(() => {
    service = {
      findAll: jest.fn().mockResolvedValue([mockResponse]),
      create: jest.fn().mockResolvedValue(mockResponse),
      update: jest.fn().mockResolvedValue(mockResponse),
      getDecryptedCredentials: jest.fn(),
    } as unknown as jest.Mocked<LlmProviderConfigService>;

    controller = new LlmProviderConfigController(service);
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
});
