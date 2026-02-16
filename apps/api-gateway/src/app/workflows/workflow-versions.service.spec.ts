import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  WorkflowVersionEntity,
  TransactionManager,
} from '@project-bubble/db-layer';
import { WorkflowVersionsService } from './workflow-versions.service';

// Valid minimal workflow definition that passes schema validation
const validDefinition = {
  metadata: { name: 'Test Workflow', description: 'A test workflow', version: 1 },
  inputs: [
    {
      name: 'transcript',
      label: 'Transcript',
      role: 'subject',
      source: ['upload'],
      required: true,
    },
  ],
  execution: { processing: 'parallel', model: 'gemini-2.0-flash' },
  knowledge: { enabled: false },
  prompt: 'Analyze the following transcript: {transcript}',
  output: {
    format: 'markdown',
    filename_template: '{transcript}_analysis.md',
    sections: [{ name: 'summary', label: 'Summary', required: true }],
  },
};

describe('WorkflowVersionsService [P0]', () => {
  let service: WorkflowVersionsService;
  let txManager: jest.Mocked<TransactionManager>;
  let mockManager: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockQb: {
    select: jest.Mock;
    where: jest.Mock;
    getRawOne: jest.Mock;
  };

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const templateId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const versionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  const mockTemplate = {
    id: templateId,
    tenantId,
    status: WorkflowTemplateStatus.DRAFT,
    currentVersionId: null,
  } as WorkflowTemplateEntity;

  const mockVersion: WorkflowVersionEntity = {
    id: versionId,
    tenantId,
    templateId,
    versionNumber: 1,
    definition: validDefinition,
    createdBy: userId,
    createdAt: new Date('2026-02-02'),
  } as WorkflowVersionEntity;

  beforeEach(() => {
    mockQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maxVersion: null }),
    };

    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };

    txManager = {
      run: jest.fn().mockImplementation(
        (_tenantId: string, cb: (m: typeof mockManager) => Promise<unknown>) =>
          cb(mockManager),
      ),
    } as unknown as jest.Mocked<TransactionManager>;

    service = new WorkflowVersionsService(txManager);
  });

  describe('createVersion', () => {
    it('[3.3-UNIT-013] [P0] Given valid definition, when createVersion is called, then version created and template currentVersionId updated', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(mockTemplate);
      mockQb.getRawOne.mockResolvedValue({ maxVersion: null });
      mockManager.create.mockReturnValue(mockVersion);
      mockManager.save.mockResolvedValue(mockVersion);
      mockManager.update.mockResolvedValue({ affected: 1 });

      // When
      const result = await service.createVersion(templateId, validDefinition, tenantId, userId);

      // Then
      expect(result.id).toBe(versionId);
      expect(result.versionNumber).toBe(1);
      expect(mockManager.update).toHaveBeenCalledWith(
        WorkflowTemplateEntity,
        { id: templateId },
        { currentVersionId: versionId },
      );
      expect(mockManager.findOne).toHaveBeenCalledWith(WorkflowTemplateEntity, {
        where: { id: templateId, tenantId },
        withDeleted: false,
      });
    });

    it('[3.3-UNIT-014] [P0] Given existing v1, when createVersion is called, then auto-increments to v2', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(mockTemplate);
      mockQb.getRawOne.mockResolvedValue({ maxVersion: 1 });
      const v2 = { ...mockVersion, id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', versionNumber: 2 };
      mockManager.create.mockReturnValue(v2);
      mockManager.save.mockResolvedValue(v2);
      mockManager.update.mockResolvedValue({ affected: 1 });

      // When
      const result = await service.createVersion(templateId, validDefinition, tenantId, userId);

      // Then
      expect(result.versionNumber).toBe(2);
    });

    it('[3.3-UNIT-015] [P0] Given invalid definition, when createVersion is called, then throws BadRequestException', async () => {
      // Given — missing metadata, inputs, etc.
      const invalidDefinition = { prompt: 'just a prompt' };

      // When/Then
      await expect(
        service.createVersion(templateId, invalidDefinition, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[3.3-UNIT-016] [P0] Given template not found, when createVersion is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(
        service.createVersion('nonexistent-id', validDefinition, tenantId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[3.3-UNIT-016a] [P1] Given concurrent version creation (23505), when save fails, then throws ConflictException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(mockTemplate);
      mockQb.getRawOne.mockResolvedValue({ maxVersion: 1 });
      mockManager.create.mockReturnValue(mockVersion);
      mockManager.save.mockRejectedValue({ code: '23505' });

      // When/Then
      await expect(
        service.createVersion(templateId, validDefinition, tenantId, userId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllByTemplate', () => {
    it('[3.3-UNIT-017] [P0] Given versions exist, when findAllByTemplate is called, then returns versions ordered by versionNumber DESC', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(mockTemplate);
      const v1 = { ...mockVersion, versionNumber: 1 };
      const v2 = { ...mockVersion, id: 'eeee', versionNumber: 2 };
      mockManager.find.mockResolvedValue([v2, v1]);

      // When
      const result = await service.findAllByTemplate(templateId, tenantId);

      // Then
      expect(result).toHaveLength(2);
      expect(mockManager.find).toHaveBeenCalledWith(WorkflowVersionEntity, {
        where: { templateId },
        order: { versionNumber: 'DESC' },
      });
    });

    it('[3.3-UNIT-017b] [P0] Given findAllByTemplate is called, when template lookup executes, then includes tenantId in WHERE clause', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(mockTemplate);
      mockManager.find.mockResolvedValue([]);

      // When
      await service.findAllByTemplate(templateId, tenantId);

      // Then
      expect(mockManager.findOne).toHaveBeenCalledWith(WorkflowTemplateEntity, {
        where: { id: templateId, tenantId },
        withDeleted: false,
      });
    });

    it('[3.3-UNIT-017a] [P1] Given template does not exist, when findAllByTemplate is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(
        service.findAllByTemplate('nonexistent-id', tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('[3.3-UNIT-018] [P1] Given version exists, when findOne is called, then returns version with tenantId in WHERE', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(mockVersion);

      // When
      const result = await service.findOne(versionId, tenantId);

      // Then
      expect(result.id).toBe(versionId);
      expect(result.definition).toBeDefined();
      expect(mockManager.findOne).toHaveBeenCalledWith(WorkflowVersionEntity, {
        where: { id: versionId, tenantId },
      });
    });

    it('[3.3-UNIT-019] [P1] Given version does not exist, when findOne is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(
        service.findOne('nonexistent-id', tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createVersion — conditional auto-update', () => {
    it('[3.4-UNIT-015] [P0] Given draft template, when createVersion is called, then auto-updates currentVersionId', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({ ...mockTemplate, status: WorkflowTemplateStatus.DRAFT });
      mockQb.getRawOne.mockResolvedValue({ maxVersion: null });
      mockManager.create.mockReturnValue(mockVersion);
      mockManager.save.mockResolvedValue(mockVersion);
      mockManager.update.mockResolvedValue({ affected: 1 });

      // When
      await service.createVersion(templateId, validDefinition, tenantId, userId);

      // Then
      expect(mockManager.update).toHaveBeenCalledWith(
        WorkflowTemplateEntity,
        { id: templateId },
        { currentVersionId: versionId },
      );
    });

    it('[3.4-UNIT-016] [P0] Given published template, when createVersion is called, then does NOT update currentVersionId', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({
        ...mockTemplate,
        status: WorkflowTemplateStatus.PUBLISHED,
        currentVersionId: 'existing-version-id',
      });
      mockQb.getRawOne.mockResolvedValue({ maxVersion: 1 });
      const newVersion = { ...mockVersion, id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', versionNumber: 2 };
      mockManager.create.mockReturnValue(newVersion);
      mockManager.save.mockResolvedValue(newVersion);

      // When
      const result = await service.createVersion(templateId, validDefinition, tenantId, userId);

      // Then
      expect(result.id).toBe('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
      expect(mockManager.update).not.toHaveBeenCalled();
    });
  });

  describe('soft-delete exclusion (withDeleted:false)', () => {
    it('[4-FIX-404-UNIT-011] [P0] createVersion passes withDeleted:false for template lookup', async () => {
      mockManager.findOne.mockResolvedValueOnce({ ...mockTemplate });
      mockQb.getRawOne.mockResolvedValue({ maxVersion: 0 });
      const newVersion = { ...mockVersion, versionNumber: 1 };
      mockManager.create.mockReturnValue(newVersion);
      mockManager.save.mockResolvedValue(newVersion);

      await service.createVersion(templateId, validDefinition, tenantId, userId);

      expect(mockManager.findOne).toHaveBeenCalledWith(WorkflowTemplateEntity, {
        where: { id: templateId, tenantId },
        withDeleted: false,
      });
    });

    it('[4-FIX-404-UNIT-012] [P0] findAllByTemplate passes withDeleted:false for template lookup', async () => {
      mockManager.findOne.mockResolvedValueOnce({ ...mockTemplate });
      mockManager.find.mockResolvedValueOnce([mockVersion]);

      await service.findAllByTemplate(templateId, tenantId);

      expect(mockManager.findOne).toHaveBeenCalledWith(WorkflowTemplateEntity, {
        where: { id: templateId, tenantId },
        withDeleted: false,
      });
    });
  });
});
