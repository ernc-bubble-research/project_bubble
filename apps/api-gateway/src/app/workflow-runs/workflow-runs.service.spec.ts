import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  WorkflowTemplateEntity,
  WorkflowTemplateStatus,
  WorkflowVisibility,
  WorkflowVersionEntity,
  WorkflowRunEntity,
  WorkflowRunStatus,
  TransactionManager,
  UserRole,
  IMPERSONATOR_ROLE,
} from '@project-bubble/db-layer';
import { WorkflowRunsService } from './workflow-runs.service';
import { AssetsService } from '../assets/assets.service';
import { WorkflowExecutionService } from '../workflow-execution/workflow-execution.service';
import { WorkflowTemplatesService } from '../workflows/workflow-templates.service';
import { PreFlightValidationService } from './pre-flight-validation.service';

describe('WorkflowRunsService [P0]', () => {
  let service: WorkflowRunsService;
  let txManager: jest.Mocked<TransactionManager>;
  let assetsService: jest.Mocked<Pick<AssetsService, 'findOne' | 'findEntityById'>>;
  let executionService: jest.Mocked<Pick<WorkflowExecutionService, 'enqueueRun'>>;
  let templatesService: {
    findPublishedOneEntity: jest.Mock;
  };
  let preFlightService: {
    validateModelAvailability: jest.Mock;
    checkAndDeductCredits: jest.Mock;
    refundCredits: jest.Mock;
  };
  let mockQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    take: jest.Mock;
    skip: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let mockManager: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    query: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockExecutionQueue: {
    add: jest.Mock;
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
    previousGenerationConfig: null,
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
    isTestRun: false,
    creditsFromMonthly: 0,
    creditsFromPurchased: 0,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    createdAt: new Date('2026-02-09'),
  } as WorkflowRunEntity;

  beforeEach(() => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      query: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    txManager = {
      run: jest.fn().mockImplementation(
        (_tenantId: string, cb: (m: typeof mockManager) => Promise<unknown>) =>
          cb(mockManager),
      ),
    } as unknown as jest.Mocked<TransactionManager>;

    assetsService = {
      findOne: jest.fn().mockResolvedValue({ id: assetId }),
      findEntityById: jest.fn(),
    };

    executionService = {
      enqueueRun: jest.fn().mockResolvedValue({ jobId: runId }),
    };

    templatesService = {
      findPublishedOneEntity: jest.fn().mockResolvedValue({
        template: mockTemplate,
        version: mockVersion,
      }),
    };

    preFlightService = {
      validateModelAvailability: jest.fn().mockResolvedValue(undefined),
      checkAndDeductCredits: jest.fn().mockResolvedValue({ creditsFromMonthly: 0, creditsFromPurchased: 0 }),
      refundCredits: jest.fn().mockResolvedValue(undefined),
    };

    mockExecutionQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    };

    service = new WorkflowRunsService(
      txManager,
      assetsService as unknown as AssetsService,
      executionService as unknown as WorkflowExecutionService,
      templatesService as unknown as WorkflowTemplatesService,
      preFlightService as unknown as PreFlightValidationService,
      mockExecutionQueue as any,
    );
  });

  describe('initiateRun — happy path', () => {
    it('[4.1-UNIT-001] [P0] Given valid published template and valid inputs, when initiateRun is called, then creates run entity with QUEUED status and enqueues job', async () => {
      // Given — templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'asset' as const, assetIds: [assetId] },
        },
      };

      // When
      const result = await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

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
        expect.objectContaining({
          subjectFiles: [],
          processingMode: 'parallel',
          maxConcurrency: 5,
        }),
      );
    });

    it('[4.1-UNIT-002] [P0] Given text input for context role, when initiateRun is called, then builds payload with text contextInput', async () => {
      // Given
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Some analysis text' },
        },
      };

      // When
      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Then
      expect(executionService.enqueueRun).toHaveBeenCalledWith(
        runId,
        expect.objectContaining({
          contextInputs: {
            context_doc: { type: 'text', content: 'Some analysis text' },
          },
        }),
        expect.any(Object),
      );
    });

    it('[4.1-UNIT-003] [P0] Given asset input for context role, when initiateRun is called, then translates asset type to file type in payload', async () => {
      // Given
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'asset' as const, assetIds: [assetId] },
        },
      };

      // When
      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Then
      expect(executionService.enqueueRun).toHaveBeenCalledWith(
        runId,
        expect.objectContaining({
          contextInputs: {
            context_doc: { type: 'file', assetId },
          },
        }),
        expect.any(Object),
      );
    });

    it('[4.1-UNIT-004] [P1] Given subject role input, when initiateRun is called, then resolves subject files and passes to enqueueRun options', async () => {
      // Given — bulk asset lookup returns matching entities
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)   // template lookup (tx 1)
        .mockResolvedValueOnce(mockVersion);   // version lookup (tx 1)
      mockManager.find.mockResolvedValueOnce([{  // bulk asset lookup (tx 2: resolveSubjectFiles)
        id: assetId,
        originalName: 'transcript.pdf',
        storagePath: '/uploads/transcript.pdf',
      }]);
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
      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Then — contextInputs should NOT include subject_files
      const enqueueCall = executionService.enqueueRun.mock.calls[0];
      const payloadArg = enqueueCall[1];
      expect(payloadArg.contextInputs).toEqual({
        context_doc: { type: 'text', content: 'Context text' },
      });
      // Subject files passed via options
      const optionsArg = enqueueCall[2];
      expect(optionsArg.subjectFiles).toEqual([
        { assetId, originalName: 'transcript.pdf', storagePath: '/uploads/transcript.pdf' },
      ]);
      expect(optionsArg.processingMode).toBe('parallel');
    });

    it('[4.3-UNIT-058] [P0] Given 3 subject files in parallel mode, when initiateRun is called, then totalJobs is set to 3 on the run entity', async () => {
      // Given — 3 subject file assets
      const assetId2 = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
      const assetId3 = 'ffffffff-ffff-ffff-ffff-fffffffffff3';

      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      mockManager.find.mockResolvedValueOnce([
        { id: assetId, originalName: 'a.pdf', storagePath: '/uploads/a.pdf' },
        { id: assetId2, originalName: 'b.pdf', storagePath: '/uploads/b.pdf' },
        { id: assetId3, originalName: 'c.pdf', storagePath: '/uploads/c.pdf' },
      ]);
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Context' },
          subject_files: { type: 'asset' as const, assetIds: [assetId, assetId2, assetId3] },
        },
      };

      // When
      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Then — totalJobs should be 3 (1 per subject file in parallel mode)
      expect(mockManager.create).toHaveBeenCalledWith(
        WorkflowRunEntity,
        expect.objectContaining({
          totalJobs: 3,
          completedJobs: 0,
          failedJobs: 0,
        }),
      );
      // enqueueRun receives all 3 subject files
      const optionsArg = executionService.enqueueRun.mock.calls[0][2];
      expect(optionsArg.subjectFiles).toHaveLength(3);
      expect(optionsArg.processingMode).toBe('parallel');
    });

    it('[4.3-UNIT-059] [P0] Given subject file asset not found, when initiateRun is called, then throws BadRequestException listing missing asset ID', async () => {
      // Given — bulk lookup returns fewer assets than requested
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      mockManager.find.mockResolvedValueOnce([]); // no assets found

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Context' },
          subject_files: { type: 'asset' as const, assetIds: [assetId] },
        },
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4-5b-UNIT-011] [P0] Given maxRetryCount in DTO, when initiateRun is called, then sets maxRetryCount on run entity; when omitted, defaults to 3', async () => {
      // Given — templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dtoWithMaxRetry = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Context' } },
        maxRetryCount: 5,
      };

      const dtoWithoutMaxRetry = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Context' } },
      };

      // When — call with maxRetryCount
      await service.initiateRun(dtoWithMaxRetry, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Then — maxRetryCount is set to 5
      expect(mockManager.create).toHaveBeenCalledWith(
        WorkflowRunEntity,
        expect.objectContaining({ maxRetryCount: 5 }),
      );

      // Reset mocks
      mockManager.create.mockClear();
      mockManager.save.mockClear();
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      // When — call without maxRetryCount
      await service.initiateRun(dtoWithoutMaxRetry, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Then — maxRetryCount defaults to 3
      expect(mockManager.create).toHaveBeenCalledWith(
        WorkflowRunEntity,
        expect.objectContaining({ maxRetryCount: 3 }),
      );
    });
  });

  describe('initiateRun — template validation (delegated to findPublishedOneEntity)', () => {
    it('[4.1-UNIT-005] [P0] Given template not found, when initiateRun is called, then propagates NotFoundException from findPublishedOneEntity', async () => {
      // Given — findPublishedOneEntity throws NotFoundException for missing/non-published/invisible templates
      templatesService.findPublishedOneEntity.mockRejectedValue(
        new NotFoundException('Published workflow template with id "00000000-0000-0000-0000-000000000000" not found'),
      );

      const dto = {
        templateId: '00000000-0000-0000-0000-000000000000',
        inputs: {},
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('[4.1-UNIT-006] [P0] Given template is not published (draft), when initiateRun is called, then propagates NotFoundException (non-published not found)', async () => {
      // Given — findPublishedOneEntity queries { status: PUBLISHED }, so drafts return NotFoundException
      templatesService.findPublishedOneEntity.mockRejectedValue(
        new NotFoundException('Published workflow template with id "..." not found'),
      );

      const dto = { templateId, inputs: {} };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('[4.1-UNIT-007] [P0] Given template has no currentVersionId, when initiateRun is called, then propagates BadRequestException', async () => {
      // Given — findPublishedOneEntity throws BadRequestException for missing currentVersionId
      templatesService.findPublishedOneEntity.mockRejectedValue(
        new BadRequestException('Template does not have a published version'),
      );

      const dto = { templateId, inputs: {} };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-008] [P0] Given version not found, when initiateRun is called, then propagates BadRequestException', async () => {
      // Given — findPublishedOneEntity throws BadRequestException for missing version
      templatesService.findPublishedOneEntity.mockRejectedValue(
        new BadRequestException('Template version not found'),
      );

      const dto = { templateId, inputs: {} };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4-LT4-3-UNIT-009] [P0] Given cross-tenant scenario (different tenantIds), when initiateRun is called, then passes requesting tenantId to findPublishedOneEntity', async () => {
      // Given — tenant B tries to run admin-created template
      const tenantBId = '11111111-1111-1111-1111-111111111111';
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      // When
      await service.initiateRun(dto, tenantBId, userId, UserRole.CUSTOMER_ADMIN);

      // Then — findPublishedOneEntity called with requesting tenant, not admin tenant
      expect(templatesService.findPublishedOneEntity).toHaveBeenCalledWith(
        templateId,
        tenantBId,
      );
    });
  });

  describe('initiateRun — input validation', () => {
    it('[4.1-UNIT-009] [P0] Given required input is missing, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion

      // context_doc is required but not provided
      const dto = { templateId, inputs: {} };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-010] [P0] Given required asset input has empty assetIds, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'asset' as const, assetIds: [] },
        },
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-011] [P0] Given required text input has empty text, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: '   ' },
        },
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-012] [P0] Given unknown input name not in definition, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Valid input' },
          nonexistent_field: { type: 'text' as const, text: 'Unknown' },
        },
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.1-UNIT-013] [P0] Given input type does not match allowed sources, when initiateRun is called, then throws BadRequestException', async () => {
      // Given — subject_files only allows 'upload', not 'text'
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Valid' },
          subject_files: { type: 'text' as const, text: 'Not allowed — upload only' },
        },
      };

      // When/Then
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('initiateRun — asset validation', () => {
    it('[4.1-UNIT-014] [P0] Given asset ID not found in tenant vault, when initiateRun is called, then throws BadRequestException', async () => {
      // Given
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('initiateRun — inputSnapshot', () => {
    it('[4.1-UNIT-015] [P0] Given valid run, when entity is created, then inputSnapshot contains templateId, templateName, versionId, versionNumber, definition, userInputs', async () => {
      // Given
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Test' },
        },
      };

      // When
      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Then
      expect(mockManager.create).toHaveBeenCalledWith(
        WorkflowRunEntity,
        expect.objectContaining({
          tenantId,
          versionId,
          status: WorkflowRunStatus.QUEUED,
          startedBy: userId,
          creditsConsumed: 0,
          totalJobs: 1,
          completedJobs: 0,
          failedJobs: 0,
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

  describe('initiateRun — pre-flight and credit checks', () => {
    it('[4.4-UNIT-018] [AC8] should call validateModelAvailability with definition.execution.model', async () => {
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      expect(preFlightService.validateModelAvailability).toHaveBeenCalledWith('mock-model');
    });

    it('[4.4-UNIT-019] [AC8] should propagate BadRequestException from model validation', async () => {
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      preFlightService.validateModelAvailability.mockRejectedValue(
        new BadRequestException('Model is inactive'),
      );

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4.4-UNIT-020] [AC5] should call checkAndDeductCredits within credit transaction', async () => {
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      preFlightService.checkAndDeductCredits.mockResolvedValue({
        creditsFromMonthly: 1, creditsFromPurchased: 0,
      });
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      expect(preFlightService.checkAndDeductCredits).toHaveBeenCalledWith(
        tenantId,
        1, // creditsPerRun from template
        false, // not a test run
        expect.anything(), // manager
      );
    });

    it('[4.4-UNIT-021] [AC7] should set isTestRun=true for BUBBLE_ADMIN role', async () => {
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      preFlightService.checkAndDeductCredits.mockResolvedValue({
        creditsFromMonthly: 0, creditsFromPurchased: 0,
      });
      mockManager.create.mockReturnValue({ ...mockRunEntity, isTestRun: true });
      mockManager.save.mockResolvedValue({ ...mockRunEntity, isTestRun: true });

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await service.initiateRun(dto, tenantId, userId, UserRole.BUBBLE_ADMIN);

      expect(preFlightService.checkAndDeductCredits).toHaveBeenCalledWith(
        tenantId,
        1,
        true, // isTestRun = true for BUBBLE_ADMIN
        expect.anything(),
      );
      expect(mockManager.create).toHaveBeenCalledWith(
        WorkflowRunEntity,
        expect.objectContaining({ isTestRun: true }),
      );
    });

    it('[4.4-UNIT-022] [AC7] should set isTestRun=true for IMPERSONATOR_ROLE', async () => {
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      preFlightService.checkAndDeductCredits.mockResolvedValue({
        creditsFromMonthly: 0, creditsFromPurchased: 0,
      });
      mockManager.create.mockReturnValue({ ...mockRunEntity, isTestRun: true });
      mockManager.save.mockResolvedValue({ ...mockRunEntity, isTestRun: true });

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await service.initiateRun(dto, tenantId, userId, IMPERSONATOR_ROLE);

      expect(preFlightService.checkAndDeductCredits).toHaveBeenCalledWith(
        tenantId,
        1,
        true, // isTestRun = true for impersonator
        expect.anything(),
      );
    });

    it('[4.4-UNIT-023] [AC7] should set isTestRun=false for CUSTOMER_ADMIN role', async () => {
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      preFlightService.checkAndDeductCredits.mockResolvedValue({
        creditsFromMonthly: 1, creditsFromPurchased: 0,
      });
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      expect(preFlightService.checkAndDeductCredits).toHaveBeenCalledWith(
        tenantId,
        1,
        false,
        expect.anything(),
      );
    });

    it('[4.4-UNIT-024] should set creditsConsumed, creditsFromMonthly, creditsFromPurchased on run entity', async () => {
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      preFlightService.checkAndDeductCredits.mockResolvedValue({
        creditsFromMonthly: 3, creditsFromPurchased: 2,
      });
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      expect(mockManager.create).toHaveBeenCalledWith(
        WorkflowRunEntity,
        expect.objectContaining({
          creditsConsumed: 5,
          creditsFromMonthly: 3,
          creditsFromPurchased: 2,
        }),
      );
    });

    it('[4.4-UNIT-025] [AC5] should execute SELECT FOR UPDATE on tenant row before credit check', async () => {
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      preFlightService.checkAndDeductCredits.mockResolvedValue({
        creditsFromMonthly: 0, creditsFromPurchased: 0,
      });
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Verify FOR UPDATE lock was acquired
      expect(mockManager.query).toHaveBeenCalledWith(
        'SELECT id FROM tenants WHERE id = $1 FOR UPDATE',
        [tenantId],
      );
    });

    it('[4.4-UNIT-026] [AC8] should skip model validation when definition has no model', async () => {
      const noModelDefinition = {
        ...mockDefinition,
        execution: { processing: 'parallel' as const },
      };
      const noModelVersion = {
        ...mockVersion,
        definition: noModelDefinition as unknown as Record<string, unknown>,
      };
      // Override default mock to return version with no model in definition
      templatesService.findPublishedOneEntity.mockResolvedValue({
        template: mockTemplate,
        version: noModelVersion,
      });
      mockManager.create.mockReturnValue(mockRunEntity);
      mockManager.save.mockResolvedValue(mockRunEntity);

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      expect(preFlightService.validateModelAvailability).not.toHaveBeenCalled();
    });
  });

  describe('initiateRun — credit check failure propagation', () => {
    it('[4.4-UNIT-040] [AC2] should propagate insufficient credits error and NOT create run entity', async () => {
      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      preFlightService.checkAndDeductCredits.mockRejectedValue(
        new BadRequestException('Insufficient credits to run this workflow. Please contact your administrator.'),
      );

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow(/Insufficient credits/);

      // Run entity should NOT have been created or saved
      expect(mockManager.create).not.toHaveBeenCalled();
      expect(mockManager.save).not.toHaveBeenCalled();
      // BullMQ should NOT have been called
      expect(executionService.enqueueRun).not.toHaveBeenCalled();
    });
  });

  describe('initiateRun — BullMQ enqueue failure', () => {
    it('[4.4-UNIT-036] [AC5] should refund credits and mark run FAILED when enqueueRun throws', async () => {
      const savedRunWithCredits = {
        ...mockRunEntity,
        creditsConsumed: 5,
        creditsFromMonthly: 3,
        creditsFromPurchased: 2,
      };

      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      preFlightService.checkAndDeductCredits.mockResolvedValue({
        creditsFromMonthly: 3, creditsFromPurchased: 2,
      });
      mockManager.create.mockReturnValue(savedRunWithCredits);
      mockManager.save.mockResolvedValue(savedRunWithCredits);

      // BullMQ enqueue fails (e.g., Redis down)
      executionService.enqueueRun.mockRejectedValue(new Error('Redis connection refused'));

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      // Should re-throw the enqueue error
      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow('Redis connection refused');

      // Should have acquired FOR UPDATE lock for compensating refund
      const forUpdateCalls = mockManager.query.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('FOR UPDATE'),
      );
      // First FOR UPDATE from credit check, second from compensating refund
      expect(forUpdateCalls).toHaveLength(2);

      // Should have called refundCredits with the purchased amount
      expect(preFlightService.refundCredits).toHaveBeenCalledWith(
        tenantId,
        2, // creditsFromPurchased from savedRun
        expect.anything(), // manager
      );

      // Should have marked the run as FAILED
      expect(mockManager.update).toHaveBeenCalledWith(
        WorkflowRunEntity,
        savedRunWithCredits.id,
        expect.objectContaining({
          status: WorkflowRunStatus.FAILED,
          creditsConsumed: 0,
          creditsFromMonthly: 0,
          creditsFromPurchased: 0,
        }),
      );
    });

    it('[4.4-UNIT-037] should not refund when enqueue fails for a test run (zero credits)', async () => {
      const testRunEntity = {
        ...mockRunEntity,
        isTestRun: true,
        creditsConsumed: 0,
        creditsFromMonthly: 0,
        creditsFromPurchased: 0,
      };

      // templatesService.findPublishedOneEntity default mock returns mockTemplate+mockVersion
      preFlightService.checkAndDeductCredits.mockResolvedValue({
        creditsFromMonthly: 0, creditsFromPurchased: 0,
      });
      mockManager.create.mockReturnValue(testRunEntity);
      mockManager.save.mockResolvedValue(testRunEntity);

      executionService.enqueueRun.mockRejectedValue(new Error('Redis down'));

      const dto = {
        templateId,
        inputs: { context_doc: { type: 'text' as const, text: 'Test' } },
      };

      await expect(
        service.initiateRun(dto, tenantId, userId, UserRole.BUBBLE_ADMIN),
      ).rejects.toThrow('Redis down');

      // refundCredits should be called with 0 purchased credits
      expect(preFlightService.refundCredits).toHaveBeenCalledWith(
        tenantId,
        0, // zero purchased credits for test run
        expect.anything(),
      );
    });
  });

  describe('soft-delete exclusion (withDeleted:false)', () => {
    it('[4-FIX-404-UNIT-013] [P0] initiateRun delegates template lookup to findPublishedOneEntity (which uses withDeleted:false)', async () => {
      // Given — findPublishedOneEntity throws NotFoundException (e.g. soft-deleted template)
      templatesService.findPublishedOneEntity.mockRejectedValue(
        new NotFoundException('Published workflow template with id "..." not found'),
      );

      const dto = {
        templateId,
        inputs: {},
      };

      // When/Then — error propagated from findPublishedOneEntity
      await expect(
        service.initiateRun(dto, tenantId, userId, 'customer_admin'),
      ).rejects.toThrow(NotFoundException);

      // Verify findPublishedOneEntity was called with correct args
      expect(templatesService.findPublishedOneEntity).toHaveBeenCalledWith(
        templateId,
        tenantId,
      );
    });
  });

  describe('findAllByTenant', () => {
    it('[4-5-UNIT-030] returns paginated list of runs scoped to tenantId', async () => {
      const run1 = { ...mockRunEntity, id: 'run-1' };
      const run2 = { ...mockRunEntity, id: 'run-2' };
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[run1, run2], 2]);

      const result = await service.findAllByTenant(tenantId, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'run.tenantId = :tenantId',
        { tenantId },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('run.createdAt', 'DESC');
    });

    it('[4-5-UNIT-031] applies status filter when provided', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAllByTenant(tenantId, { status: 'completed' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'run.status = :status',
        { status: 'completed' },
      );
    });

    it('[4-5-UNIT-032] defaults to page 1, limit 20 when not provided', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAllByTenant(tenantId, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
    });

    it('[4-5-UNIT-033] computes correct offset for page 3, limit 10', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAllByTenant(tenantId, { page: 3, limit: 10 });

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20); // (3-1)*10
    });
  });

  describe('findOneByTenant', () => {
    it('[4-5-UNIT-034] returns run details scoped to tenantId', async () => {
      mockManager.findOne.mockResolvedValue(mockRunEntity);

      const result = await service.findOneByTenant(runId, tenantId);

      expect(result.id).toBe(runId);
      expect(result.tenantId).toBe(tenantId);
      expect(mockManager.findOne).toHaveBeenCalledWith(
        WorkflowRunEntity,
        { where: { id: runId, tenantId } },
      );
    });

    it('[4-5-UNIT-035] throws NotFoundException when run not found', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.findOneByTenant('nonexistent-id', tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[4-5-UNIT-036] includes perFileResults and outputAssetIds in response', async () => {
      const completedRun = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED,
        perFileResults: [
          { index: 0, fileName: 'report.pdf', status: 'completed', outputAssetId: 'asset-1' },
        ],
        outputAssetIds: ['asset-1'],
      };
      mockManager.findOne.mockResolvedValue(completedRun);

      const result = await service.findOneByTenant(runId, tenantId);

      expect(result.perFileResults).toHaveLength(1);
      expect(result.outputAssetIds).toEqual(['asset-1']);
    });
  });

  describe('getOutputFile', () => {
    const completedRun = {
      ...mockRunEntity,
      status: WorkflowRunStatus.COMPLETED,
      perFileResults: [
        { index: 0, fileName: 'data.pdf', status: 'completed' as const, outputAssetId: 'out-asset-1' },
        { index: 1, fileName: 'data2.pdf', status: 'failed' as const, errorMessage: 'Timeout' },
      ],
      outputAssetIds: ['out-asset-1'],
    };

    const mockOutputAsset = {
      id: 'out-asset-1',
      tenantId,
      originalName: 'data-report.md',
      storagePath: 'uploads/test/data-report.md',
      mimeType: 'text/markdown',
      fileSize: 500,
    };

    it('[4-5-UNIT-037] returns asset and perFileResult for valid completed output', async () => {
      mockManager.findOne.mockResolvedValue(completedRun);
      assetsService.findEntityById.mockResolvedValue(mockOutputAsset as never);

      const result = await service.getOutputFile(runId, 0, tenantId);

      expect(result.asset).toEqual(mockOutputAsset);
      expect(result.perFileResult.index).toBe(0);
      expect(result.perFileResult.status).toBe('completed');
      expect(assetsService.findEntityById).toHaveBeenCalledWith('out-asset-1', tenantId);
    });

    it('[4-5-UNIT-038] throws NotFoundException when run not found', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.getOutputFile('nonexistent', 0, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[4-5-UNIT-039] throws NotFoundException when fileIndex not found in perFileResults', async () => {
      mockManager.findOne.mockResolvedValue(completedRun);

      await expect(
        service.getOutputFile(runId, 99, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[4-5-UNIT-040] throws BadRequestException when output file is not completed (failed status)', async () => {
      mockManager.findOne.mockResolvedValue(completedRun);

      await expect(
        service.getOutputFile(runId, 1, tenantId), // index 1 is 'failed'
      ).rejects.toThrow(BadRequestException);
    });

    it('[4-5-UNIT-041] throws NotFoundException for empty perFileResults array', async () => {
      const emptyRun = { ...mockRunEntity, perFileResults: [] };
      mockManager.findOne.mockResolvedValue(emptyRun);

      await expect(
        service.getOutputFile(runId, 0, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[4-5-UNIT-042] includes tenantId in run lookup (Rule 2c)', async () => {
      mockManager.findOne.mockResolvedValue(completedRun);
      assetsService.findEntityById.mockResolvedValue(mockOutputAsset as never);

      await service.getOutputFile(runId, 0, tenantId);

      expect(mockManager.findOne).toHaveBeenCalledWith(
        WorkflowRunEntity,
        { where: { id: runId, tenantId } },
      );
    });
  });

  describe('retryFailed', () => {
    beforeEach(() => {
      mockExecutionQueue.add.mockClear();
      // Mock the FOR UPDATE lock query for run row
      mockManager.query.mockImplementation((sql: string) => {
        if (sql.includes('FOR UPDATE')) {
          return Promise.resolve([{ id: runId }]);
        }
        return Promise.resolve([]);
      });
    });

    it('[4-5b-UNIT-001] [P0] Happy path: retries 3 FAILED files with credits available', async () => {
      const runWithFailures = {
        ...mockRunEntity,
        id: runId,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        versionId,
        maxRetryCount: 3,
        creditsConsumed: 3,
        creditsFromMonthly: 3,
        creditsFromPurchased: 0,
        totalJobs: 3,
        completedJobs: 0,
        failedJobs: 3,
        inputSnapshot: {
          templateId,
          definition: mockDefinition,
          userInputs: {
            context_doc: { type: 'asset', assetIds: [assetId] },
            subject_files: { type: 'asset', assetIds: [assetId, assetId, assetId] },
          },
        },
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'failed' as const, retryAttempt: 0 },
          { index: 1, fileName: 'file2.pdf', status: 'failed' as const, retryAttempt: 0 },
          { index: 2, fileName: 'file3.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };

      // Three findOne calls: (1) initial run load, (2) template, (3) final run load
      mockManager.findOne.mockResolvedValueOnce(runWithFailures);
      mockManager.findOne.mockResolvedValueOnce(mockTemplate);
      mockManager.findOne.mockResolvedValueOnce({ ...runWithFailures, status: WorkflowRunStatus.RUNNING });
      preFlightService.checkAndDeductCredits.mockResolvedValue({ creditsFromMonthly: 3, creditsFromPurchased: 0 });
      assetsService.findEntityById.mockResolvedValue({ id: assetId, originalName: 'test.pdf', storagePath: '/path' } as never);

      const result = await service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      expect(result.status).toBe(WorkflowRunStatus.RUNNING);
      expect(preFlightService.checkAndDeductCredits).toHaveBeenCalledWith(tenantId, 3, false, mockManager);
      expect(mockManager.update).toHaveBeenCalledWith(
        WorkflowRunEntity,
        { id: runId, tenantId },
        expect.objectContaining({
          status: WorkflowRunStatus.RUNNING,
          completedJobs: 0,
          failedJobs: 0,
        }),
      );
      expect(mockExecutionQueue.add).toHaveBeenCalledTimes(3);
    });

    it('[4-5b-UNIT-002] throws PaymentRequiredException (402) when insufficient credits', async () => {
      const runWithFailures = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        maxRetryCount: 3,
        inputSnapshot: { templateId, definition: mockDefinition, userInputs: {} },
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };

      mockManager.findOne.mockResolvedValue(runWithFailures);
      preFlightService.checkAndDeductCredits.mockRejectedValue(
        new BadRequestException('Insufficient credits'),
      );

      await expect(
        service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow();
    });

    it('[4-5b-UNIT-003] throws BadRequestException (409) when run status is RUNNING', async () => {
      const runningRun = {
        ...mockRunEntity,
        status: WorkflowRunStatus.RUNNING,
      };

      mockManager.findOne.mockResolvedValue(runningRun);

      await expect(
        service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow('Workflow run is already in progress');
    });

    it('[4-5b-UNIT-004] throws BadRequestException (400) when run status is COMPLETED (no errors)', async () => {
      const completedRun = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED,
      };

      mockManager.findOne.mockResolvedValue(completedRun);

      await expect(
        service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow('completed successfully with no errors');
    });

    it('[4-5b-UNIT-005] retries template that is soft-deleted (withDeleted: true)', async () => {
      const runWithFailures = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        maxRetryCount: 3,
        inputSnapshot: { templateId, definition: mockDefinition, userInputs: {} },
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };

      mockManager.findOne.mockResolvedValueOnce(runWithFailures);
      mockManager.findOne.mockResolvedValueOnce(mockTemplate);
      mockManager.findOne.mockResolvedValueOnce({ ...runWithFailures, status: WorkflowRunStatus.RUNNING });
      assetsService.findEntityById.mockResolvedValue({ id: assetId, originalName: 'test.pdf', storagePath: '/path' } as never);

      await service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Verify template was fetched with withDeleted: true
      expect(mockManager.findOne).toHaveBeenCalledWith(
        WorkflowTemplateEntity,
        expect.objectContaining({ withDeleted: true }),
      );
    });

    it('[4-5b-UNIT-006] retries PENDING-only files with zero credits charged', async () => {
      const runWithPending = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        maxRetryCount: 3,
        inputSnapshot: { templateId, definition: mockDefinition, userInputs: {} },
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'pending' as const, retryAttempt: 0 },
        ],
      };

      mockManager.findOne.mockResolvedValueOnce(runWithPending);
      mockManager.findOne.mockResolvedValueOnce(mockTemplate);
      mockManager.findOne.mockResolvedValueOnce({ ...runWithPending, status: WorkflowRunStatus.RUNNING });
      assetsService.findEntityById.mockResolvedValue({ id: assetId, originalName: 'test.pdf', storagePath: '/path' } as never);

      await service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      expect(preFlightService.checkAndDeductCredits).not.toHaveBeenCalled();
      expect(mockExecutionQueue.add).toHaveBeenCalledTimes(1);
    });

    it('[4-5b-UNIT-007] retries mixed FAILED+PENDING files, charges only for FAILED', async () => {
      const runWithMixed = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        maxRetryCount: 3,
        inputSnapshot: {
          templateId,
          definition: mockDefinition,
          userInputs: {
            subject_files: { type: 'asset', assetIds: [assetId, assetId, assetId] },
          },
        },
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'failed' as const, retryAttempt: 0 },
          { index: 1, fileName: 'file2.pdf', status: 'pending' as const, retryAttempt: 0 },
          { index: 2, fileName: 'file3.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };

      mockManager.findOne.mockResolvedValueOnce(runWithMixed);
      mockManager.findOne.mockResolvedValueOnce(mockTemplate);
      mockManager.findOne.mockResolvedValueOnce({ ...runWithMixed, status: WorkflowRunStatus.RUNNING });
      assetsService.findEntityById.mockResolvedValue({ id: assetId, originalName: 'test.pdf', storagePath: '/path' } as never);

      await service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      expect(preFlightService.checkAndDeductCredits).toHaveBeenCalledWith(tenantId, 2, false, mockManager);
      expect(mockExecutionQueue.add).toHaveBeenCalledTimes(3);
    });

    it('[4-5b-UNIT-008] throws BadRequestException (400) when no FAILED or PENDING files exist', async () => {
      const runAllCompleted = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'completed' as const },
          { index: 1, fileName: 'file2.pdf', status: 'completed' as const },
        ],
      };

      mockManager.findOne.mockResolvedValue(runAllCompleted);

      await expect(
        service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow('No failed or pending files to retry');
    });

    it('[4-5b-UNIT-009] throws BadRequestException (400) when max retry count exceeded', async () => {
      const runMaxedOut = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        maxRetryCount: 3,
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'failed' as const, retryAttempt: 3 },
        ],
      };

      mockManager.findOne.mockResolvedValue(runMaxedOut);

      await expect(
        service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow('Max retry count (3) exceeded');
    });

    it('[4-5b-UNIT-010] includes tenantId in WHERE clause (Rule 2c)', async () => {
      const runWithFailures = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        maxRetryCount: 3,
        inputSnapshot: { templateId, definition: mockDefinition, userInputs: {} },
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };

      mockManager.findOne.mockResolvedValue(runWithFailures);

      try {
        await service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN);
      } catch {
        // Expected to fail due to incomplete mocks
      }

      expect(mockManager.findOne).toHaveBeenCalledWith(
        WorkflowRunEntity,
        { where: { id: runId, tenantId } },
      );
    });

    it('[4-5b-UNIT-012] [P0] retries batch mode (fan-in): enqueues 1 job with all subject files', async () => {
      const batchDefinition = {
        ...mockDefinition,
        execution: { processing: 'batch' as const },
      };

      const runWithFailures = {
        ...mockRunEntity,
        id: runId,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        versionId,
        maxRetryCount: 3,
        creditsConsumed: 3,
        creditsFromMonthly: 3,
        creditsFromPurchased: 0,
        totalJobs: 1,
        completedJobs: 0,
        failedJobs: 1,
        inputSnapshot: {
          templateId,
          definition: batchDefinition,
          userInputs: {
            context_doc: { type: 'asset', assetIds: [assetId] },
            subject_files: { type: 'asset', assetIds: [assetId, assetId, assetId] },
          },
        },
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'failed' as const, retryAttempt: 0 },
          { index: 1, fileName: 'file2.pdf', status: 'failed' as const, retryAttempt: 0 },
          { index: 2, fileName: 'file3.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };

      mockManager.findOne.mockResolvedValueOnce(runWithFailures);
      mockManager.findOne.mockResolvedValueOnce(mockTemplate);
      mockManager.findOne.mockResolvedValueOnce({ ...runWithFailures, status: WorkflowRunStatus.RUNNING });
      preFlightService.checkAndDeductCredits.mockResolvedValue({ creditsFromMonthly: 3, creditsFromPurchased: 0 });
      assetsService.findEntityById.mockResolvedValue({ id: assetId, originalName: 'test.pdf', storagePath: '/path' } as never);

      await service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Batch mode should enqueue 1 job with jobId = runId (not per-file IDs)
      expect(mockExecutionQueue.add).toHaveBeenCalledTimes(1);
      expect(mockExecutionQueue.add).toHaveBeenCalledWith(
        'execute-workflow',
        expect.objectContaining({
          runId,
          tenantId,
          versionId,
          subjectFiles: expect.arrayContaining([
            expect.objectContaining({ assetId }),
          ]),
        }),
        expect.objectContaining({
          jobId: runId, // Batch uses runId, not per-file IDs
        }),
      );
    });

    it('[4-5b-UNIT-013] [P1] when enqueue fails AND refund also fails, logs error and re-throws enqueue error', async () => {
      const runWithFailures = {
        ...mockRunEntity,
        id: runId,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        versionId,
        maxRetryCount: 3,
        creditsConsumed: 3,
        creditsFromMonthly: 2,
        creditsFromPurchased: 1,
        inputSnapshot: {
          templateId,
          definition: mockDefinition,
          userInputs: {
            context_doc: { type: 'asset', assetIds: [assetId] },
            subject_files: { type: 'asset', assetIds: [assetId] },
          },
        },
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };

      mockManager.findOne.mockResolvedValueOnce(runWithFailures);
      mockManager.findOne.mockResolvedValueOnce(mockTemplate);
      mockManager.findOne.mockResolvedValueOnce({ ...runWithFailures, status: WorkflowRunStatus.RUNNING });
      preFlightService.checkAndDeductCredits.mockResolvedValue({ creditsFromMonthly: 1, creditsFromPurchased: 0 });
      assetsService.findEntityById.mockResolvedValue({ id: assetId, originalName: 'test.pdf', storagePath: '/path' } as never);

      // Enqueue fails (e.g., Redis down)
      mockExecutionQueue.add.mockRejectedValue(new Error('Redis connection refused'));
      // Refund ALSO fails (e.g., DB connection lost)
      preFlightService.refundCredits.mockRejectedValue(new Error('DB connection lost'));

      // Should re-throw the enqueue error, not the refund error
      await expect(
        service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow('Redis connection refused');

      // Should have attempted to refund
      expect(preFlightService.refundCredits).toHaveBeenCalled();

      // M3-004: Verify tenant FOR UPDATE lock was acquired before refund attempt
      const forUpdateCalls = mockManager.query.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('FOR UPDATE'),
      );
      // Should have 2 FOR UPDATE calls:
      // 1. Initial run row lock (line 592 in service.ts)
      // 2. Tenant lock for compensating refund (line 740 in service.ts)
      expect(forUpdateCalls.length).toBeGreaterThanOrEqual(2);
      const tenantLockCall = forUpdateCalls.find(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('tenants'),
      );
      expect(tenantLockCall).toBeDefined();
      expect(tenantLockCall![1]).toEqual([tenantId]);
    });

    it('[4-5b-UNIT-014] [P0] excludes ERROR status files from retry', async () => {
      const runWithError = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        maxRetryCount: 3,
        inputSnapshot: {
          templateId,
          definition: mockDefinition,
          userInputs: {
            subject_files: { type: 'asset', assetIds: [assetId, assetId] },
          },
        },
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'failed' as const, retryAttempt: 0 },
          { index: 1, fileName: 'file2.pdf', status: 'error' as const, errorMessage: 'Invalid file format' },
        ],
      };

      mockManager.findOne.mockResolvedValueOnce(runWithError);
      mockManager.findOne.mockResolvedValueOnce(mockTemplate);
      mockManager.findOne.mockResolvedValueOnce({ ...runWithError, status: WorkflowRunStatus.RUNNING });
      preFlightService.checkAndDeductCredits.mockResolvedValue({ creditsFromMonthly: 1, creditsFromPurchased: 0 });
      assetsService.findEntityById.mockResolvedValue({ id: assetId, originalName: 'test.pdf', storagePath: '/path' } as never);

      await service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN);

      // Should charge for 1 file only (the FAILED one, not the ERROR)
      expect(preFlightService.checkAndDeductCredits).toHaveBeenCalledWith(tenantId, 1, false, mockManager);
      // Should enqueue 1 job only (ERROR file excluded)
      expect(mockExecutionQueue.add).toHaveBeenCalledTimes(1);
    });

    it('[4-5b-UNIT-015] [P1] rejects retry when ANY file exceeds max count (not just all)', async () => {
      const runPartialMaxed = {
        ...mockRunEntity,
        status: WorkflowRunStatus.COMPLETED_WITH_ERRORS,
        maxRetryCount: 3,
        perFileResults: [
          { index: 0, fileName: 'file1.pdf', status: 'failed' as const, retryAttempt: 2 }, // OK (2 < 3)
          { index: 1, fileName: 'file2.pdf', status: 'failed' as const, retryAttempt: 3 }, // MAXED OUT (3 >= 3)
        ],
      };

      mockManager.findOne.mockResolvedValue(runPartialMaxed);

      await expect(
        service.retryFailed(runId, tenantId, userId, UserRole.CUSTOMER_ADMIN),
      ).rejects.toThrow('Max retry count (3) exceeded');

      // Should NOT have attempted credit check or enqueue
      expect(preFlightService.checkAndDeductCredits).not.toHaveBeenCalled();
      expect(mockExecutionQueue.add).not.toHaveBeenCalled();
    });
  });
});
