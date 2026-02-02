import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { LlmModelEntity } from '@project-bubble/db-layer';
import { LlmModelsService } from './llm-models.service';

describe('LlmModelsService [P1]', () => {
  let service: LlmModelsService;
  let repo: jest.Mocked<Repository<LlmModelEntity>>;

  const modelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const mockModel: LlmModelEntity = {
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

  const inactiveModel: LlmModelEntity = {
    ...mockModel,
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    displayName: 'Inactive Model',
    isActive: false,
  };

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<LlmModelEntity>>;

    service = new LlmModelsService(repo);
  });

  describe('findAllActive', () => {
    it('[3.3-UNIT-020] [P0] Given active models exist, when findAllActive is called, then returns only active models', async () => {
      // Given
      repo.find.mockResolvedValue([mockModel]);

      // When
      const result = await service.findAllActive();

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
      expect(repo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { displayName: 'ASC' },
      });
    });
  });

  describe('findAll', () => {
    it('[3.3-UNIT-021] [P1] Given models exist, when findAll is called, then returns all models including inactive', async () => {
      // Given
      repo.find.mockResolvedValue([mockModel, inactiveModel]);

      // When
      const result = await service.findAll();

      // Then
      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith({
        order: { displayName: 'ASC' },
      });
    });
  });

  describe('create', () => {
    it('[3.3-UNIT-022] [P0] Given valid input, when create is called, then model is created', async () => {
      // Given
      repo.create.mockReturnValue(mockModel);
      repo.save.mockResolvedValue(mockModel);

      // When
      const result = await service.create({
        providerKey: 'google-ai-studio',
        modelId: 'models/gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        maxOutputTokens: 8192,
      });

      // Then
      expect(result.id).toBe(modelId);
      expect(result.providerKey).toBe('google-ai-studio');
    });

    it('[3.3-UNIT-023] [P0] Given duplicate provider_key+model_id, when create is called, then throws ConflictException', async () => {
      // Given
      repo.create.mockReturnValue(mockModel);
      repo.save.mockRejectedValue({ code: '23505' });

      // When/Then
      await expect(
        service.create({
          providerKey: 'google-ai-studio',
          modelId: 'models/gemini-2.0-flash',
          displayName: 'Duplicate',
          contextWindow: 1000000,
          maxOutputTokens: 8192,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('[3.3-UNIT-024] [P1] Given valid update, when update is called, then toggles isActive', async () => {
      // Given
      const updatedModel = { ...mockModel, isActive: false };
      repo.findOne.mockResolvedValue({ ...mockModel });
      repo.save.mockResolvedValue(updatedModel);

      // When
      const result = await service.update(modelId, { isActive: false });

      // Then
      expect(result.isActive).toBe(false);
    });

    it('[3.3-UNIT-024a] [P1] Given model not found, when update is called, then throws NotFoundException', async () => {
      // Given
      repo.findOne.mockResolvedValue(null);

      // When/Then
      await expect(
        service.update('nonexistent-id', { isActive: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
