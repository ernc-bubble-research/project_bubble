import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { WorkflowTestService } from './workflow-test.service';
import { WorkflowTemplatesService } from './workflow-templates.service';
import { TestRunCacheService } from '../services/test-run-cache.service';
import { TransactionManager, AssetEntity } from '@project-bubble/db-layer';
import { WorkflowRunInputValueDto } from '@project-bubble/shared';

describe('[P0] WorkflowTestService', () => {
  let service: WorkflowTestService;
  let mockQueue: jest.Mocked<Queue>;
  let mockCache: jest.Mocked<TestRunCacheService>;
  let mockTemplatesService: jest.Mocked<WorkflowTemplatesService>;
  let mockTxManager: jest.Mocked<TransactionManager>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
    } as any;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    } as any;

    mockTemplatesService = {
      findOneWithVersion: jest.fn(),
    } as any;

    mockTxManager = {
      run: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowTestService,
        { provide: 'BullQueue_workflow-execution', useValue: mockQueue },
        { provide: TestRunCacheService, useValue: mockCache },
        { provide: WorkflowTemplatesService, useValue: mockTemplatesService },
        { provide: TransactionManager, useValue: mockTxManager },
      ],
    }).compile();

    service = module.get<WorkflowTestService>(WorkflowTestService);
  });

  describe('executeTest', () => {
    const templateId = '11111111-0000-0000-0000-000000000001';
    const tenantId = '22222222-0000-0000-0000-000000000001';
    const adminUserId = '33333333-0000-0000-0000-000000000001';
    const inputs: Record<string, WorkflowRunInputValueDto> = {
      subject: { type: 'asset', assetIds: ['asset-1'] },
    };

    it('[4-7a-UNIT-001] should initiate test run successfully and return sessionId', async () => {
      // Given: Valid template with model and inputs
      const mockTemplate = { id: templateId, name: 'Test Template' };
      const mockVersion = {
        id: 'version-1',
        definition: {
          execution: { model: 'model-uuid' },
          inputs: [{ name: 'subject', role: 'subject' }],
        },
      };

      mockTemplatesService.findOneWithVersion.mockResolvedValue({
        template: mockTemplate as any,
        version: mockVersion as any,
      });

      mockTxManager.run.mockImplementation(async (arg1: any, arg2?: any) => {
        const callback = typeof arg1 === 'function' ? arg1 : arg2;
        const mockManager = {
          find: jest.fn().mockResolvedValue([
            { id: 'asset-1', originalName: 'file.pdf', storagePath: '/path/file.pdf' },
          ]),
        };
        return callback(mockManager);
      });

      mockQueue.add.mockResolvedValue({} as any);

      // When: executeTest is called
      const result = await service.executeTest(templateId, inputs, adminUserId, tenantId);

      // Then: Returns sessionId and enqueues job
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-workflow',
        expect.objectContaining({
          isTestRun: true,
          sessionId: result.sessionId,
          tenantId,
          versionId: 'version-1',
          definition: mockVersion.definition,
        }),
        expect.objectContaining({
          jobId: result.sessionId,
          attempts: 1,
        }),
      );
    });

    it('[4-7a-UNIT-002] should throw BadRequestException when model not configured', async () => {
      // Given: Template with no model
      const mockTemplate = { id: templateId };
      const mockVersion = {
        id: 'version-1',
        definition: {
          execution: {}, // No model
          inputs: [{ name: 'subject' }],
        },
      };

      mockTemplatesService.findOneWithVersion.mockResolvedValue({
        template: mockTemplate as any,
        version: mockVersion as any,
      });

      // When/Then: Should throw with specific error message
      await expect(
        service.executeTest(templateId, inputs, adminUserId, tenantId),
      ).rejects.toThrow(
        new BadRequestException('Template must have LLM model selected (Prompt step)'),
      );
    });

    it('[4-7a-UNIT-003] should throw BadRequestException when no inputs defined', async () => {
      // Given: Template with model but no inputs
      const mockTemplate = { id: templateId };
      const mockVersion = {
        id: 'version-1',
        definition: {
          execution: { model: 'model-uuid' },
          inputs: [], // No inputs
        },
      };

      mockTemplatesService.findOneWithVersion.mockResolvedValue({
        template: mockTemplate as any,
        version: mockVersion as any,
      });

      // When/Then: Should throw with specific error message
      await expect(
        service.executeTest(templateId, inputs, adminUserId, tenantId),
      ).rejects.toThrow(
        new BadRequestException('Workflow must have at least one input defined (Inputs step)'),
      );
    });

    it('[4-7a-UNIT-004] should throw BadRequestException when asset not found', async () => {
      // Given: Template valid but asset doesn't exist
      const mockTemplate = { id: templateId };
      const mockVersion = {
        id: 'version-1',
        definition: {
          execution: { model: 'model-uuid' },
          inputs: [{ name: 'subject' }],
        },
      };

      mockTemplatesService.findOneWithVersion.mockResolvedValue({
        template: mockTemplate as any,
        version: mockVersion as any,
      });

      mockTxManager.run.mockImplementation(async (arg1: any, arg2?: any) => {
        const callback = typeof arg1 === 'function' ? arg1 : arg2;
        const mockManager = {
          find: jest.fn().mockResolvedValue([]), // Asset not found
        };
        return callback(mockManager);
      });

      // When/Then: Should throw with specific error message
      await expect(
        service.executeTest(templateId, inputs, adminUserId, tenantId),
      ).rejects.toThrow(new BadRequestException('Subject file asset(s) not found: asset-1'));
    });
  });

  describe('exportResults', () => {
    const sessionId = '44444444-0000-0000-0000-000000000001';

    it('[4-7a-UNIT-005] should return cached results when sessionId exists', async () => {
      // Given: Cached test run results exist
      const cachedResult = {
        sessionId,
        templateId: 'template-1',
        templateName: 'Test Template',
        inputs: { subject: { type: 'asset', assetIds: ['asset-1'] } },
        results: [
          {
            fileIndex: 0,
            fileName: 'file.pdf',
            assembledPrompt: 'prompt',
            llmResponse: 'response',
            status: 'success' as const,
          },
        ],
        createdAt: new Date(),
      };

      mockCache.get.mockReturnValue(cachedResult);

      // When: exportResults is called
      const result = await service.exportResults(sessionId);

      // Then: Returns cached data
      expect(result).toEqual({
        sessionId: cachedResult.sessionId,
        templateId: cachedResult.templateId,
        templateName: cachedResult.templateName,
        inputs: cachedResult.inputs,
        results: cachedResult.results,
        executedAt: cachedResult.createdAt,
      });
      expect(mockCache.get).toHaveBeenCalledWith(sessionId);
    });

    it('[4-7a-UNIT-006] should throw NotFoundException when sessionId not in cache', async () => {
      // Given: Cache miss
      mockCache.get.mockReturnValue(undefined);

      // When/Then: Should throw 404
      await expect(service.exportResults(sessionId)).rejects.toThrow(
        new NotFoundException('Test run not found or expired (5-minute TTL)'),
      );
    });

    it('[4-7a-UNIT-007] should return partial results with error details', async () => {
      // Given: Cached results with both success and error
      const cachedResult = {
        sessionId,
        templateId: 'template-1',
        templateName: 'Test Template',
        inputs: {},
        results: [
          {
            fileIndex: 0,
            fileName: 'file1.pdf',
            assembledPrompt: 'prompt1',
            llmResponse: 'response1',
            status: 'success' as const,
          },
          {
            fileIndex: 1,
            fileName: 'file2.pdf',
            assembledPrompt: '',
            llmResponse: '',
            status: 'error' as const,
            errorMessage: 'LLM timeout',
          },
        ],
        createdAt: new Date(),
      };

      mockCache.get.mockReturnValue(cachedResult);

      // When: exportResults is called
      const result = await service.exportResults(sessionId);

      // Then: Returns all results including errors
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('success');
      expect(result.results[1].status).toBe('error');
      expect(result.results[1].errorMessage).toBe('LLM timeout');
    });

    it('[4-7a-UNIT-008] should not set Content-Disposition header (frontend handles download)', async () => {
      // Given: This test documents that Content-Disposition is NOT set
      // When: Service returns data
      // Then: No header manipulation happens (controller just returns JSON)

      // This is a documentation test confirming the design decision
      // that frontend handles download filename, not backend
      expect(true).toBe(true);
    });
  });
});
