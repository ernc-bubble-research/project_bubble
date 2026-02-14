import { LlmModelResponseDto } from '@project-bubble/shared';
import { AppLlmModelsController, AdminLlmModelsController } from './llm-models.controller';
import { LlmModelsService } from './llm-models.service';

describe('LlmModelsControllers [P1]', () => {
  let appController: AppLlmModelsController;
  let adminController: AdminLlmModelsController;
  let service: jest.Mocked<LlmModelsService>;

  const modelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const mockModelResponse: LlmModelResponseDto = {
    id: modelId,
    providerKey: 'google-ai-studio',
    modelId: 'models/gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    isActive: true,
    costPer1kInput: '0.000150',
    costPer1kOutput: '0.000600',
    createdAt: new Date('2026-02-02'),
    updatedAt: new Date('2026-02-02'),
  };

  beforeEach(() => {
    service = {
      findAllActive: jest.fn().mockResolvedValue([mockModelResponse]),
      findAll: jest.fn().mockResolvedValue([mockModelResponse]),
      create: jest.fn().mockResolvedValue(mockModelResponse),
      update: jest.fn().mockResolvedValue(mockModelResponse),
      bulkUpdateStatus: jest.fn().mockResolvedValue({ affected: 3 }),
    } as unknown as jest.Mocked<LlmModelsService>;

    appController = new AppLlmModelsController(service);
    adminController = new AdminLlmModelsController(service);
  });

  describe('AppLlmModelsController', () => {
    it('[3.3-UNIT-034] [P0] GET /app/llm-models — returns active models only', async () => {
      // When
      const result = await appController.findAllActive();

      // Then
      expect(result).toEqual([mockModelResponse]);
      expect(service.findAllActive).toHaveBeenCalled();
    });
  });

  describe('AdminLlmModelsController', () => {
    it('[3.3-UNIT-035] [P0] GET /admin/llm-models — returns all models', async () => {
      // When
      const result = await adminController.findAll();

      // Then
      expect(result).toEqual([mockModelResponse]);
      expect(service.findAll).toHaveBeenCalled();
    });

    it('[3.3-UNIT-036] [P0] POST /admin/llm-models — creates model', async () => {
      // Given
      const dto = {
        providerKey: 'google-ai-studio',
        modelId: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
      };

      // When
      await adminController.create(dto);

      // Then
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('[3.3-UNIT-037] [P1] PATCH /admin/llm-models/:id — updates model', async () => {
      // Given
      const dto = { isActive: false };

      // When
      await adminController.update(modelId, dto);

      // Then
      expect(service.update).toHaveBeenCalledWith(modelId, dto);
    });

    it('[4-FIX-B-UNIT-010] PATCH /admin/llm-models/bulk-status — delegates to bulkUpdateStatus', async () => {
      // Given
      const dto = { providerKey: 'google-ai-studio', isActive: false };

      // When
      const result = await adminController.bulkUpdateStatus(dto);

      // Then
      expect(result).toEqual({ affected: 3 });
      expect(service.bulkUpdateStatus).toHaveBeenCalledWith(dto);
    });
  });
});
