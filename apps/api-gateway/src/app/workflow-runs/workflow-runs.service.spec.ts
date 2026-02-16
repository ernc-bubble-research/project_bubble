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
import { PreFlightValidationService } from './pre-flight-validation.service';

describe('WorkflowRunsService [P0]', () => {
  let service: WorkflowRunsService;
  let txManager: jest.Mocked<TransactionManager>;
  let assetsService: jest.Mocked<Pick<AssetsService, 'findOne'>>;
  let executionService: jest.Mocked<Pick<WorkflowExecutionService, 'enqueueRun'>>;
  let preFlightService: {
    validateModelAvailability: jest.Mock;
    checkAndDeductCredits: jest.Mock;
    refundCredits: jest.Mock;
  };
  let mockManager: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    query: jest.Mock;
    update: jest.Mock;
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
    isTestRun: false,
    creditsFromMonthly: 0,
    creditsFromPurchased: 0,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    createdAt: new Date('2026-02-09'),
  } as WorkflowRunEntity;

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      query: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
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

    preFlightService = {
      validateModelAvailability: jest.fn().mockResolvedValue(undefined),
      checkAndDeductCredits: jest.fn().mockResolvedValue({ creditsFromMonthly: 0, creditsFromPurchased: 0 }),
      refundCredits: jest.fn().mockResolvedValue(undefined),
    };

    service = new WorkflowRunsService(
      txManager,
      assetsService as unknown as AssetsService,
      executionService as unknown as WorkflowExecutionService,
      preFlightService as unknown as PreFlightValidationService,
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

      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
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
        service.initiateRun(dto, tenantId, userId, UserRole.CUSTOMER_ADMIN),
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(noModelVersion);
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
      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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

      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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

      mockManager.findOne
        .mockResolvedValueOnce(mockTemplate)
        .mockResolvedValueOnce(mockVersion);
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
    it('[4-FIX-404-UNIT-013] [P0] initiateRun passes withDeleted:false for template lookup', async () => {
      mockManager.findOne.mockResolvedValueOnce(null); // simulate soft-deleted template

      const dto = {
        templateId,
        inputs: {},
      };

      await expect(
        service.initiateRun(dto, tenantId, userId, 'customer_admin'),
      ).rejects.toThrow(NotFoundException);

      expect(mockManager.findOne).toHaveBeenCalledWith(
        expect.anything(), // WorkflowTemplateEntity
        expect.objectContaining({ withDeleted: false }),
      );
    });
  });
});
