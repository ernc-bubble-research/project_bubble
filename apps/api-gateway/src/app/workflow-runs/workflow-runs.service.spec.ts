import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  WorkflowVisibility,
  WorkflowVersionEntity,
  WorkflowRunEntity,
  WorkflowRunStatus,
  TransactionManager,
} from '@project-bubble/db-layer';
import { WorkflowRunsService } from './workflow-runs.service';
import { AssetsService } from '../assets/assets.service';
import { WorkflowExecutionService } from '../workflow-execution/workflow-execution.service';

describe('WorkflowRunsService [P0]', () => {
  let service: WorkflowRunsService;
  let txManager: jest.Mocked<TransactionManager>;
  let assetsService: jest.Mocked<Pick<AssetsService, 'findOne'>>;
  let executionService: jest.Mocked<Pick<WorkflowExecutionService, 'enqueueRun'>>;
  let mockManager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const templateId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const versionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const runId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const assetId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  const mockDefinition = {
    metadata: { name: 'Test Workflow', description: 'Test', version: 1 },
    inputs: [
      {
        name: 'context_doc',
        label: 'Context Document',
        role: 'context' as const,
        source: ['asset' as const, 'text' as const],
        required: true,
      },
      {
        name: 'subject_files',
        label: 'Subject Files',
        role: 'subject' as const,
        source: ['upload' as const],
        required: false,
      },
    ],
    execution: { processing: 'parallel' as const, model: 'mock-model' },
    knowledge: { enabled: false },
    prompt: 'Analyze the following: {{context_doc}}',
    output: { format: 'markdown' as const, filename_template: 'output-{{date}}' },
  };

  const mockTemplate: WorkflowTemplateEntity = {
    id: templateId,
    tenantId,
    name: 'Test Workflow',
    description: 'A test workflow',
    visibility: WorkflowVisibility.PUBLIC,
    allowedTenants: null,
    status: WorkflowTemplateStatus.PUBLISHED,
    currentVersionId: versionId,
    creditsPerRun: 1,
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
    definition: mockDefinition as unknown as Record<string, unknown>,
    createdBy: userId,
    createdAt: new Date('2026-02-02'),
  } as WorkflowVersionEntity;

  const mockRunEntity: WorkflowRunEntity = {
    id: runId,
    tenantId,
    versionId,
    chainId: null,
    chainStepIndex: null,
    status: WorkflowRunStatus.QUEUED,
    startedBy: userId,
    inputSnapshot: {},
    outputAssetIds: null,
    assembledPrompt: null,
    rawLlmResponse: null,
    retryHistory: null,
    errorMessage: null,
    validationWarnings: null,
    tokenUsage: null,
    modelId: null,
    creditsConsumed: 0,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    createdAt: new Date('2026-02-09'),
  } as WorkflowRunEntity;

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    txManager = {
      run: jest.fn().mockImplementation(
        (_tenantId: string, cb: (m: typeof mockManager) => Promise<unknown>) =>
          cb(mockManager),
      ),
    } as unknown as jest.Mocked<TransactionManager>;

    assetsService = {
      findOne: jest.fn().mockResolvedValue({ id: assetId }),
    };

    executionService = {
      enqueueRun: jest.fn().mockResolvedValue({ jobId: runId }),
    };

    service = new WorkflowRunsService(
      txManager,
      assetsService as unknown as AssetsService,
      executionService as unknown as WorkflowExecutionService,
    );
  });

  describe('initiateRun — happy path', () => {
    it('[4.1-UNIT-001] [P0] Given valid published template and valid inputs, when initiateRun is called, then creates run entity with QUEUED status and enqueues job', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)   // template lookup
        .mockResolvedValueOnce(mockVersion);    // version lookup
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'asset' as const, assetIds: [assetId] },
        },
      };

      // When
      const result = await service.initiateRun(dto, tenantId, userId);

      // Then
      expect(result.id).toBe(runId);
      expect(result.status).toBe(WorkflowRunStatus.QUEUED);
      expect(result.tenantId).toBe(tenantId);
      expect(result.versionId).toBe(versionId);
      expect(result.startedBy).toBe(userId);
      expect(result.creditsConsumed).toBe(0);
      expect(executionService.enqueueRun).toHaveBeenCalledWith(
        runId,
        expect.objectContaining({
          runId,
          tenantId,
          versionId,
          definition: expect.any(Object),
          contextInputs: expect.any(Object),
        }),
      );
    });

    it('[4.1-UNIT-002] [P0] Given text input for context role, when initiateRun is called, then builds payload with text contextInput', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Some analysis text' },
        },
      };

      // When
      await service.initiateRun(dto, tenantId, userId);

      // Then
      expect(executionService.enqueueRun).toHaveBeenCalledWith(
        runId,
        expect.objectContaining({
          contextInputs: {
            context_doc: { type: 'text', content: 'Some analysis text' },
          },
        }),
      );
    });

    it('[4.1-UNIT-003] [P0] Given asset input for context role, when initiateRun is called, then translates asset type to file type in payload', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'asset' as const, assetIds: [assetId] },
        },
      };

      // When
      await service.initiateRun(dto, tenantId, userId);

      // Then
      expect(executionService.enqueueRun).toHaveBeenCalledWith(
        runId,
        expect.objectContaining({
          contextInputs: {
            context_doc: { type: 'file', assetId },
          },
        }),
      );
    });

    it('[4.1-UNIT-004] [P1] Given subject role input, when initiateRun is called, then does not include it in contextInputs (subject handled in Story 4-3)', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Context text' },
          subject_files: { type: 'asset' as const, assetIds: [assetId] },
        },
      };

      // When
      await service.initiateRun(dto, tenantId, userId);

      // Then
      expect(executionService.enqueueRun).toHaveBeenCalledWith(
        runId,
        expect.objectContaining({
          contextInputs: {
            context_doc: { type: 'text', content: 'Context text' },
          },
        }),
      );
    });
  });

  describe('initiateRun — template validation', () => {
    it('[4.1-UNIT-005] [P0] Given template not found, when initiateRun is called, then throws NotFoundException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue(null);

      const dto = {
        templateId: '00000000-0000-0000-0000-000000000000',
        inputs: {},
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[4.1-UNIT-006] [P0] Given template is not published (draft), when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({
        ...mockTemplate,
        status: WorkflowTemplateStatus.DRAFT,
      });

      const dto = { templateId, inputs: {} };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-007] [P0] Given template has no currentVersionId, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne.mockResolvedValue({
        ...mockTemplate,
        currentVersionId: null,
      });

      const dto = { templateId, inputs: {} };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-008] [P0] Given version not found or has no definition, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(null); // version not found

      const dto = { templateId, inputs: {} };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('initiateRun — input validation', () => {
    it('[4.1-UNIT-009] [P0] Given required input is missing, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);

      // context_doc is required but not provided
      const dto = { templateId, inputs: {} };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-010] [P0] Given required asset input has empty assetIds, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'asset' as const, assetIds: [] },
        },
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-011] [P0] Given required text input has empty text, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: '   ' },
        },
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-012] [P0] Given unknown input name not in definition, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Valid input' },
          nonexistent_field: { type: 'text' as const, text: 'Unknown' },
        },
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-013] [P0] Given input type does not match allowed sources, when initiateRun is called, then throws BadRequestException', async () => {
      // Given — subject_files only allows 'upload', not 'text'
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Valid' },
          subject_files: { type: 'text' as const, text: 'Not allowed — upload only' },
        },
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('initiateRun — asset validation', () => {
    it('[4.1-UNIT-014] [P0] Given asset ID not found in tenant vault, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
      assetsService.findOne.mockRejectedValue(
        new NotFoundException('Asset not found'),
      );

      const dto = {
        templateId,
        inputs: {
          context_doc: {
            type: 'asset' as const,
            assetIds: ['00000000-0000-0000-0000-000000000000'],
          },
        },
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('initiateRun — inputSnapshot', () => {
    it('[4.1-UNIT-015] [P0] Given valid run, when entity is created, then inputSnapshot contains templateId, templateName, versionId, versionNumber, definition, userInputs', async () => {
      // Given
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Test' },
        },
      };

      // When
      await service.initiateRun(dto, tenantId, userId);

      // Then
      expect(mockManager.create).toHaveBeenCalledWith(
        WorkflowRunEntity,
        expect.objectContaining({
          tenantId,
          versionId,
          status: WorkflowRunStatus.QUEUED,
          startedBy: userId,
          creditsConsumed: 0,
          inputSnapshot: {
            templateId,
            templateName: 'Test Workflow',
            versionId,
            versionNumber: 1,
            definition: mockVersion.definition,
            userInputs: dto.inputs,
          },
        }),
      );
    });
  });
});
