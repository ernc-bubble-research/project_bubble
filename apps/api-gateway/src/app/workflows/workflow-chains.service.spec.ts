import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  WorkflowChainEntity,
  WorkflowChainStatus,
  WorkflowVisibility,
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  TransactionManager,
} from '@project-bubble/db-layer';
import { WorkflowChainsService } from './workflow-chains.service';
import { ChainDefinition } from '@project-bubble/shared';

describe('WorkflowChainsService [P0]', () => {
  let service: WorkflowChainsService;
  let txManager: jest.Mocked<TransactionManager>;
  let mockManager: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
    restore: jest.Mock;
    createQueryBuilder: jest.Mock;
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
  const chainId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const workflowId1 = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const workflowId2 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  const validDefinition: ChainDefinition = {
    metadata: { name: 'Test Chain', description: 'A test chain' },
    steps: [
      { workflow_id: workflowId1, alias: 'step1' },
      {
        workflow_id: workflowId2,
        alias: 'step2',
        input_mapping: {
          data: { from_step: 'step1', from_output: 'outputs' },
        },
      },
    ],
  };

  const mockChain: WorkflowChainEntity = {
    id: chainId,
    tenantId,
    name: 'Test Chain',
    description: 'A test chain',
    visibility: WorkflowVisibility.PUBLIC,
    allowedTenants: null,
    definition: validDefinition as unknown as Record<string, unknown>,
    status: WorkflowChainStatus.DRAFT,
    createdBy: userId,
    createdAt: new Date('2026-02-04'),
    updatedAt: new Date('2026-02-04'),
    deletedAt: null,
  };

  const mockPublishedTemplate: WorkflowTemplateEntity = {
    id: workflowId1,
    tenantId,
    name: 'Published Template',
    description: 'A published template',
    visibility: WorkflowVisibility.PUBLIC,
    allowedTenants: null,
    status: WorkflowTemplateStatus.PUBLISHED,
    currentVersionId: 'version-id',
    creditsPerRun: 1,
    createdBy: userId,
    createdAt: new Date('2026-02-04'),
    updatedAt: new Date('2026-02-04'),
    deletedAt: null,
  };

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
    };

    txManager = {
      run: jest.fn().mockImplementation(
        (_tenantId: string, cb: (m: typeof mockManager) => Promise<unknown>) =>
          cb(mockManager),
      ),
    } as unknown as jest.Mocked<TransactionManager>;

    service = new WorkflowChainsService(txManager);
  });

  describe('create', () => {
    it('[3.6a-UNIT-001] [P0] Given valid definition, when create is called, then chain is created with draft status', async () => {
      // Given
      mockManager.create.mockReturnValue(mockChain);
      mockManager.save.mockResolvedValue(mockChain);
      mockManager.findOne.mockResolvedValue(mockPublishedTemplate); // For semantic validation

      // When
      const result = await service.create(
        {
          name: 'Test Chain',
          description: 'A test chain',
          definition: validDefinition as unknown as Record<string, unknown>,
        },
        tenantId,
        userId,
      );

      // Then
      expect(result.id).toBe(chainId);
      expect(result.status).toBe(WorkflowChainStatus.DRAFT);
      expect(result.visibility).toBe(WorkflowVisibility.PUBLIC);
      expect(result.createdBy).toBe(userId);
      expect(txManager.run).toHaveBeenCalledWith(tenantId, expect.any(Function));
    });

    it('[3.6a-UNIT-002] [P0] Given definition with < 2 steps, when create is called, then throws BadRequestException', async () => {
      // Given
      const invalidDefinition = {
        metadata: { name: 'Test', description: 'Test' },
        steps: [{ workflow_id: workflowId1, alias: 'step1' }],
      };

      // When/Then
      await expect(
        service.create(
          {
            name: 'Test',
            definition: invalidDefinition as unknown as Record<string, unknown>,
          },
          tenantId,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('[3.6a-UNIT-003] [P0] Given non-existent workflow reference, when create is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null); // Workflow not found

      // When/Then
      await expect(
        service.create(
          {
            name: 'Test Chain',
            definition: validDefinition as unknown as Record<string, unknown>,
          },
          tenantId,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('[3.6a-UNIT-004] [P0] Given draft workflow reference, when create is called, then throws BadRequestException', async () => {
      // Given
      const draftTemplate = { ...mockPublishedTemplate, status: WorkflowTemplateStatus.DRAFT };
      mockManager.findOne.mockResolvedValue(draftTemplate);

      // When/Then
      await expect(
        service.create(
          {
            name: 'Test Chain',
            definition: validDefinition as unknown as Record<string, unknown>,
          },
          tenantId,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('[3.6a-UNIT-005] [P0] Given chains exist, when findAll is called, then returns paginated results', async () => {
      // Given
      mockQb.getMany.mockResolvedValue([mockChain]);

      // When
      const result = await service.findAll(tenantId, { limit: 10, offset: 0 });

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(chainId);
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.andWhere).toHaveBeenCalledWith('chain.deleted_at IS NULL');
    });
  });

  describe('findOne', () => {
    it('[3.6a-UNIT-006] [P0] Given chain exists, when findOne is called, then returns chain', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(mockChain);

      // When
      const result = await service.findOne(chainId, tenantId);

      // Then
      expect(result.id).toBe(chainId);
      expect(mockManager.findOne).toHaveBeenCalledWith(WorkflowChainEntity, {
        where: { id: chainId, tenantId },
      });
    });

    it('[3.6a-UNIT-007] [P0] Given chain does not exist, when findOne is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(service.findOne('nonexistent-id', tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('[3.6a-UNIT-008] [P0] Given draft chain, when update is called, then updates successfully', async () => {
      // Given
      const updatedChain = { ...mockChain, name: 'Updated Name' };
      mockManager.findOne.mockResolvedValue({ ...mockChain });
      mockManager.save.mockResolvedValue(updatedChain);

      // When
      const result = await service.update(chainId, tenantId, { name: 'Updated Name' });

      // Then
      expect(result.name).toBe('Updated Name');
    });

    it('[3.6a-UNIT-009] [P0] Given published chain, when update is called, then throws BadRequestException', async () => {
      // Given
      const publishedChain = { ...mockChain, status: WorkflowChainStatus.PUBLISHED };
      mockManager.findOne.mockResolvedValue(publishedChain);

      // When/Then
      await expect(
        service.update(chainId, tenantId, { name: 'Updated Name' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('[3.6a-UNIT-009a] [P1] Given draft chain, when visibility is updated, then applies change', async () => {
      // Given
      const updatedChain = { ...mockChain, visibility: WorkflowVisibility.PRIVATE };
      mockManager.findOne.mockResolvedValue({ ...mockChain });
      mockManager.save.mockResolvedValue(updatedChain);

      // When
      const result = await service.update(chainId, tenantId, { visibility: 'private' });

      // Then
      expect(result.visibility).toBe(WorkflowVisibility.PRIVATE);
    });

    it('[3.6a-UNIT-009b] [P1] Given draft chain, when allowedTenants is updated, then applies change', async () => {
      // Given
      const newAllowedTenants = ['11111111-1111-1111-1111-111111111111'];
      const updatedChain = { ...mockChain, allowedTenants: newAllowedTenants };
      mockManager.findOne.mockResolvedValue({ ...mockChain });
      mockManager.save.mockResolvedValue(updatedChain);

      // When
      const result = await service.update(chainId, tenantId, { allowedTenants: newAllowedTenants });

      // Then
      expect(result.allowedTenants).toEqual(newAllowedTenants);
    });
  });

  describe('softDelete', () => {
    it('[3.6a-UNIT-010] [P0] Given chain exists, when softDelete is called, then sets deletedAt', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(mockChain);
      mockManager.softDelete.mockResolvedValue({ affected: 1 });

      // When
      await service.softDelete(chainId, tenantId);

      // Then
      expect(mockManager.softDelete).toHaveBeenCalledWith(WorkflowChainEntity, {
        id: chainId,
        tenantId,
      });
    });
  });

  describe('restore', () => {
    it('[3.6a-UNIT-011] [P0] Given soft-deleted chain, when restore is called, then clears deletedAt', async () => {
      // Given
      const deletedChain = { ...mockChain, deletedAt: new Date() };
      mockManager.findOne.mockResolvedValue(deletedChain);
      mockManager.restore.mockResolvedValue({ affected: 1 });

      // When
      const result = await service.restore(chainId, tenantId);

      // Then
      expect(result.id).toBe(chainId);
      expect(mockManager.findOne).toHaveBeenCalledWith(WorkflowChainEntity, {
        where: { id: chainId, tenantId },
        withDeleted: true,
      });
      expect(mockManager.restore).toHaveBeenCalledWith(WorkflowChainEntity, {
        id: chainId,
        tenantId,
      });
    });

    it('[3.6a-UNIT-011a] [P1] Given non-deleted chain, when restore is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({ ...mockChain, deletedAt: null });

      // When/Then
      await expect(service.restore(chainId, tenantId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('[3.6a-UNIT-011b] [P0] Given chain not found, when restore is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(service.restore(chainId, tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('publish', () => {
    it('[3.6a-UNIT-012] [P0] Given draft chain with valid definition, when publish is called, then status transitions to published', async () => {
      // Given
      const publishedChain = { ...mockChain, status: WorkflowChainStatus.PUBLISHED };
      mockManager.findOne
        .mockResolvedValueOnce({ ...mockChain }) // Chain lookup
        .mockResolvedValue(mockPublishedTemplate); // Workflow validation
      mockManager.save.mockResolvedValue(publishedChain);

      // When
      const result = await service.publish(chainId, tenantId);

      // Then
      expect(result.status).toBe(WorkflowChainStatus.PUBLISHED);
    });

    it('[3.6a-UNIT-013] [P0] Given chain with < 2 steps, when publish is called, then throws BadRequestException', async () => {
      // Given
      const chainWithOneStep = {
        ...mockChain,
        definition: {
          metadata: { name: 'Test', description: 'Test' },
          steps: [{ workflow_id: workflowId1, alias: 'step1' }],
        },
      };
      mockManager.findOne.mockResolvedValue(chainWithOneStep);

      // When/Then
      await expect(service.publish(chainId, tenantId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('[3.6a-UNIT-013a] [P0] Given published chain, when publish is called, then throws BadRequestException', async () => {
      // Given
      const publishedChain = { ...mockChain, status: WorkflowChainStatus.PUBLISHED };
      mockManager.findOne.mockResolvedValue(publishedChain);

      // When/Then
      await expect(service.publish(chainId, tenantId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('[3.6a-UNIT-013b] [P0] Given chain not found, when publish is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      // When/Then
      await expect(service.publish(chainId, tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
