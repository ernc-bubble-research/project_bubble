import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  WorkflowVisibility,
  WorkflowVersionEntity,
  TransactionManager,
} from '@project-bubble/db-layer';
import { WorkflowTemplatesService } from './workflow-templates.service';

describe('WorkflowTemplatesService [P0]', () => {
  let service: WorkflowTemplatesService;
  let txManager: jest.Mocked<TransactionManager>;
  let mockManager: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
    restore: jest.Mock;
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
  };
  let mockQb: {
    andWhere: jest.Mock;
    take: jest.Mock;
    skip: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const templateId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const versionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  const mockTemplate: WorkflowTemplateEntity = {
    id: templateId,
    tenantId,
    name: 'Analyze Transcript',
    description: 'Analyze interview transcripts',
    visibility: WorkflowVisibility.PUBLIC,
    allowedTenants: null,
    status: WorkflowTemplateStatus.DRAFT,
    currentVersionId: null,
    createdBy: userId,
    createdAt: new Date('2026-02-02'),
    updatedAt: new Date('2026-02-02'),
    deletedAt: null,
  };

  const mockVersion: WorkflowVersionEntity = {
    id: versionId,
    tenantId,
    templateId,
    versionNumber: 1,
    definition: { metadata: { name: 'test', description: 'test', version: 1 } },
    createdBy: userId,
    createdAt: new Date('2026-02-02'),
  } as WorkflowVersionEntity;

  beforeEach(() => {
    mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      update: jest.fn(),
    };

    txManager = {
      run: jest.fn().mockImplementation(
        (_tenantId: string, cb: (m: typeof mockManager) => Promise<unknown>) =>
          cb(mockManager),
      ),
    } as unknown as jest.Mocked<TransactionManager>;

    service = new WorkflowTemplatesService(txManager);
  });

  describe('create', () => {
    it('[3.3-UNIT-001] [P0] Given valid input, when create is called, then template is created with draft status', async () => {
      // Given
      mockManager.create.mockReturnValue(mockTemplate);
      mockManager.save.mockResolvedValue(mockTemplate);

      // When
      const result = await service.create(
        { name: 'Analyze Transcript', description: 'Analyze interview transcripts' },
        tenantId,
        userId,
      );

      // Then
      expect(result.id).toBe(templateId);
      expect(result.status).toBe(WorkflowTemplateStatus.DRAFT);
      expect(result.visibility).toBe(WorkflowVisibility.PUBLIC);
      expect(result.createdBy).toBe(userId);
      expect(txManager.run).toHaveBeenCalledWith(tenantId, expect.any(Function));
    });

    it('[3.3-UNIT-002] [P2] Given duplicate name, when create is called, then it succeeds (names are not unique)', async () => {
      // Given
      mockManager.create.mockReturnValue(mockTemplate);
      mockManager.save.mockResolvedValue(mockTemplate);

      // When
      const result = await service.create(
        { name: 'Analyze Transcript' },
        tenantId,
        userId,
      );

      // Then
      expect(result.name).toBe('Analyze Transcript');
    });
  });

  describe('findAll', () => {
    it('[3.3-UNIT-003] [P0] Given templates exist, when findAll is called, then returns paginated results', async () => {
      // Given
      mockQb.getMany.mockResolvedValue([mockTemplate]);

      // When
      const result = await service.findAll(tenantId, { limit: 10, offset: 0 });

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(templateId);
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.andWhere).toHaveBeenCalledWith('wt.deleted_at IS NULL');
    });

    it('[3.3-UNIT-004] [P1] Given status filter, when findAll is called, then filters by status', async () => {
      // Given
      mockQb.getMany.mockResolvedValue([]);

      // When
      await service.findAll(tenantId, { status: 'draft' });

      // Then
      expect(mockQb.andWhere).toHaveBeenCalledWith('wt.status = :status', { status: 'draft' });
    });

    it('[3.3-UNIT-005] [P1] Given visibility filter, when findAll is called, then filters by visibility', async () => {
      // Given
      mockQb.getMany.mockResolvedValue([]);

      // When
      await service.findAll(tenantId, { visibility: 'public' });

      // Then
      expect(mockQb.andWhere).toHaveBeenCalledWith('wt.visibility = :visibility', { visibility: 'public' });
    });
  });

  describe('findOne', () => {
    it('[3.3-UNIT-006] [P0] Given template with currentVersion, when findOne is called, then returns template with version loaded', async () => {
      // Given
      const templateWithVersion = { ...mockTemplate, currentVersionId: versionId };
      mockManager.findOne
        .mockResolvedValueOnce(templateWithVersion)
        .mockResolvedValueOnce(mockVersion);

      // When
      const result = await service.findOne(templateId, tenantId);

      // Then
      expect(result.id).toBe(templateId);
      expect(result.currentVersion).toBeDefined();
      const cv = result.currentVersion as NonNullable<typeof result.currentVersion>;
      expect(cv.id).toBe(versionId);
      expect(cv.versionNumber).toBe(1);
    });

    it('[3.3-UNIT-007] [P0] Given template does not exist, when findOne is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(service.findOne('nonexistent-id', tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('[3.3-UNIT-008] [P0] Given valid update data, when update is called, then updates metadata fields', async () => {
      // Given — draft template with a version can transition to published
      const templateWithVersion = { ...mockTemplate, currentVersionId: versionId };
      const updated = { ...templateWithVersion, name: 'Updated Name', status: WorkflowTemplateStatus.PUBLISHED };
      mockManager.findOne.mockResolvedValue({ ...templateWithVersion });
      mockManager.save.mockResolvedValue(updated);

      // When
      const result = await service.update(templateId, tenantId, {
        name: 'Updated Name',
        status: 'published',
      });

      // Then
      expect(result.name).toBe('Updated Name');
      expect(result.status).toBe(WorkflowTemplateStatus.PUBLISHED);
    });

    it('[3.3-UNIT-009] [P0] Given template does not exist, when update is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(
        service.update('nonexistent-id', tenantId, { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('[3.3-UNIT-009a] [P1] Given invalid status enum, when update is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({ ...mockTemplate });

      // When/Then — programmatic call bypasses DTO validation
      await expect(
        service.update(templateId, tenantId, { status: 'invalid_status' as 'draft' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('[3.3-UNIT-009b] [P1] Given invalid visibility enum, when update is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({ ...mockTemplate });

      // When/Then — programmatic call bypasses DTO validation
      await expect(
        service.update(templateId, tenantId, { visibility: 'internal' as 'public' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('softDelete', () => {
    it('[3.3-UNIT-010] [P0] Given template exists, when softDelete is called, then calls manager.softDelete', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(mockTemplate);
      mockManager.softDelete.mockResolvedValue({ affected: 1 });

      // When
      await service.softDelete(templateId, tenantId);

      // Then
      expect(mockManager.softDelete).toHaveBeenCalledWith(WorkflowTemplateEntity, { id: templateId, tenantId });
    });

    it('[3.3-UNIT-011] [P0] Given template does not exist, when softDelete is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(
        service.softDelete('nonexistent-id', tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('restore', () => {
    it('[3.3-UNIT-012] [P1] Given soft-deleted template, when restore is called, then restores it', async () => {
      // Given
      const deletedTemplate = { ...mockTemplate, deletedAt: new Date() };
      mockManager.findOne.mockResolvedValue(deletedTemplate);
      mockManager.restore.mockResolvedValue({ affected: 1 });

      // When
      const result = await service.restore(templateId, tenantId);

      // Then
      expect(result.id).toBe(templateId);
      expect(mockManager.findOne).toHaveBeenCalledWith(WorkflowTemplateEntity, {
        where: { id: templateId, tenantId },
        withDeleted: true,
      });
      expect(mockManager.restore).toHaveBeenCalledWith(WorkflowTemplateEntity, { id: templateId, tenantId });
    });
  });

  describe('publish', () => {
    it('[3.4-UNIT-001] [P0] Given draft template with version, when publish is called, then sets status to published with currentVersion loaded', async () => {
      // Given
      const draftWithVersion = { ...mockTemplate, currentVersionId: versionId };
      const published = { ...draftWithVersion, status: WorkflowTemplateStatus.PUBLISHED };
      mockManager.findOne
        .mockResolvedValueOnce({ ...draftWithVersion })  // template lookup
        .mockResolvedValueOnce(mockVersion);               // currentVersion load
      mockManager.save.mockResolvedValue(published);

      // When
      const result = await service.publish(templateId, tenantId);

      // Then
      expect(result.status).toBe(WorkflowTemplateStatus.PUBLISHED);
      expect(result.currentVersionId).toBe(versionId);
      expect(result.currentVersion).toBeDefined();
      expect(result.currentVersion?.id).toBe(versionId);
    });

    it('[3.4-UNIT-002] [P0] Given draft template without version, when publish is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({ ...mockTemplate, currentVersionId: null });

      // When/Then
      await expect(
        service.publish(templateId, tenantId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[3.4-UNIT-003] [P0] Given published template with new versionId, when publish is called, then updates currentVersionId with currentVersion loaded', async () => {
      // Given
      const newVersionId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
      const publishedTemplate = {
        ...mockTemplate,
        status: WorkflowTemplateStatus.PUBLISHED,
        currentVersionId: versionId,
      };
      const newVersion = { ...mockVersion, id: newVersionId };
      mockManager.findOne
        .mockResolvedValueOnce({ ...publishedTemplate })  // template lookup
        .mockResolvedValueOnce(newVersion)                  // version validation
        .mockResolvedValueOnce(newVersion);                 // currentVersion load
      mockManager.save.mockResolvedValue({
        ...publishedTemplate,
        currentVersionId: newVersionId,
      });

      // When
      const result = await service.publish(templateId, tenantId, newVersionId);

      // Then
      expect(result.currentVersionId).toBe(newVersionId);
      expect(result.status).toBe(WorkflowTemplateStatus.PUBLISHED);
      expect(result.currentVersion).toBeDefined();
    });

    it('[3.4-UNIT-004] [P0] Given archived template, when publish is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({
        ...mockTemplate,
        status: WorkflowTemplateStatus.ARCHIVED,
      });

      // When/Then
      await expect(
        service.publish(templateId, tenantId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[3.4-UNIT-005] [P0] Given versionId that does not belong to template, when publish is called, then throws NotFoundException', async () => {
      // Given
      const foreignVersionId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
      mockManager.findOne
        .mockResolvedValueOnce({
          ...mockTemplate,
          status: WorkflowTemplateStatus.PUBLISHED,
          currentVersionId: versionId,
        })
        .mockResolvedValueOnce(null); // version not found for this template

      // When/Then
      await expect(
        service.publish(templateId, tenantId, foreignVersionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[3.4-UNIT-005a] [P1] Given template not found, when publish is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(
        service.publish(templateId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rollback', () => {
    it('[3.4-UNIT-006] [P0] Given published template with valid version, when rollback is called, then updates currentVersionId with currentVersion loaded', async () => {
      // Given
      const previousVersionId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
      const publishedTemplate = {
        ...mockTemplate,
        status: WorkflowTemplateStatus.PUBLISHED,
        currentVersionId: versionId,
      };
      const previousVersion = { ...mockVersion, id: previousVersionId };
      mockManager.findOne
        .mockResolvedValueOnce({ ...publishedTemplate })
        .mockResolvedValueOnce(previousVersion);
      mockManager.save.mockResolvedValue({
        ...publishedTemplate,
        currentVersionId: previousVersionId,
      });

      // When
      const result = await service.rollback(templateId, tenantId, previousVersionId);

      // Then
      expect(result.currentVersionId).toBe(previousVersionId);
      expect(result.status).toBe(WorkflowTemplateStatus.PUBLISHED);
      expect(result.currentVersion).toBeDefined();
      expect(result.currentVersion?.id).toBe(previousVersionId);
    });

    it('[3.4-UNIT-006a] [P1] Given rollback to same versionId already set, when rollback is called, then skips save and returns response', async () => {
      // Given — currentVersionId already equals the rollback target
      const publishedTemplate = {
        ...mockTemplate,
        status: WorkflowTemplateStatus.PUBLISHED,
        currentVersionId: versionId,
      };
      mockManager.findOne
        .mockResolvedValueOnce({ ...publishedTemplate })
        .mockResolvedValueOnce(mockVersion); // version validation

      // When
      const result = await service.rollback(templateId, tenantId, versionId);

      // Then
      expect(result.currentVersionId).toBe(versionId);
      expect(result.currentVersion).toBeDefined();
      expect(mockManager.save).not.toHaveBeenCalled();
    });

    it('[3.4-UNIT-007] [P0] Given version not belonging to template, when rollback is called, then throws NotFoundException', async () => {
      // Given
      const foreignVersionId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
      mockManager.findOne
        .mockResolvedValueOnce({
          ...mockTemplate,
          status: WorkflowTemplateStatus.PUBLISHED,
          currentVersionId: versionId,
        })
        .mockResolvedValueOnce(null);

      // When/Then
      await expect(
        service.rollback(templateId, tenantId, foreignVersionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[3.4-UNIT-008] [P0] Given draft template, when rollback is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({ ...mockTemplate });

      // When/Then
      await expect(
        service.rollback(templateId, tenantId, versionId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[3.4-UNIT-008a] [P1] Given template not found, when rollback is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(
        service.rollback(templateId, tenantId, versionId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateStatusTransition (via update)', () => {
    it('[3.4-UNIT-009] [P0] Given draft template with version, when status set to published, then transition allowed', async () => {
      // Given
      const templateWithVersion = { ...mockTemplate, currentVersionId: versionId };
      mockManager.findOne.mockResolvedValue({ ...templateWithVersion });
      mockManager.save.mockResolvedValue({
        ...templateWithVersion,
        status: WorkflowTemplateStatus.PUBLISHED,
      });

      // When
      const result = await service.update(templateId, tenantId, { status: 'published' });

      // Then
      expect(result.status).toBe(WorkflowTemplateStatus.PUBLISHED);
    });

    it('[3.4-UNIT-010] [P0] Given published template, when status set to archived, then transition allowed', async () => {
      // Given
      const publishedTemplate = {
        ...mockTemplate,
        status: WorkflowTemplateStatus.PUBLISHED,
      };
      mockManager.findOne.mockResolvedValue({ ...publishedTemplate });
      mockManager.save.mockResolvedValue({
        ...publishedTemplate,
        status: WorkflowTemplateStatus.ARCHIVED,
      });

      // When
      const result = await service.update(templateId, tenantId, { status: 'archived' });

      // Then
      expect(result.status).toBe(WorkflowTemplateStatus.ARCHIVED);
    });

    it('[3.4-UNIT-011] [P0] Given archived template, when status set to draft, then transition allowed', async () => {
      // Given
      const archivedTemplate = {
        ...mockTemplate,
        status: WorkflowTemplateStatus.ARCHIVED,
      };
      mockManager.findOne.mockResolvedValue({ ...archivedTemplate });
      mockManager.save.mockResolvedValue({
        ...archivedTemplate,
        status: WorkflowTemplateStatus.DRAFT,
      });

      // When
      const result = await service.update(templateId, tenantId, { status: 'draft' });

      // Then
      expect(result.status).toBe(WorkflowTemplateStatus.DRAFT);
    });

    it('[3.4-UNIT-012] [P0] Given draft template, when status set to archived, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({ ...mockTemplate });

      // When/Then
      await expect(
        service.update(templateId, tenantId, { status: 'archived' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('[3.4-UNIT-013] [P0] Given published template, when status set to draft, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({
        ...mockTemplate,
        status: WorkflowTemplateStatus.PUBLISHED,
      });

      // When/Then
      await expect(
        service.update(templateId, tenantId, { status: 'draft' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('[3.4-UNIT-014] [P0] Given draft template without version, when status set to published via update, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({ ...mockTemplate, currentVersionId: null });

      // When/Then
      await expect(
        service.update(templateId, tenantId, { status: 'published' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
