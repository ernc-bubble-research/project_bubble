import { WorkflowRunStatus, AssetEntity } from '@project-bubble/db-layer';
import { WorkflowRunResponseDto, PerFileResult } from '@project-bubble/shared';
import { Readable } from 'stream';
import { WorkflowRunsController } from './workflow-runs.controller';
import { WorkflowRunsService } from './workflow-runs.service';

// Mock only createReadStream — preserve the rest of fs (needed by TypeORM import chain)
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn(() => {
    const stream = new Readable({ read() { this.push(null); } });
    return stream;
  }),
}));

describe('WorkflowRunsController [P0]', () => {
  let controller: WorkflowRunsController;
  let service: jest.Mocked<Pick<WorkflowRunsService, 'initiateRun' | 'findAllByTenant' | 'findOneByTenant' | 'getOutputFile'>>;

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const runId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const versionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const templateId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const mockRunResponse: WorkflowRunResponseDto = {
    id: runId,
    tenantId,
    versionId,
    status: WorkflowRunStatus.QUEUED,
    startedBy: userId,
    creditsConsumed: 0,
    isTestRun: false,
    creditsFromMonthly: 0,
    creditsFromPurchased: 0,
    createdAt: new Date('2026-02-09'),
  };

  beforeEach(() => {
    service = {
      initiateRun: jest.fn(),
      findAllByTenant: jest.fn(),
      findOneByTenant: jest.fn(),
      getOutputFile: jest.fn(),
    };

    controller = new WorkflowRunsController(
      service as unknown as WorkflowRunsService,
    );
  });

  describe('initiateRun', () => {
    it('[4.1-UNIT-016] [P0] Given valid body and JWT user, when POST / is called, then delegates to service.initiateRun with tenantId, userId, and role from JWT', async () => {
      // Given
      service.initiateRun.mockResolvedValue(mockRunResponse);
      const req = { user: { tenantId, userId, role: 'customer_admin' } };
      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Analyze this' },
        },
      };

      // When
      const result = await controller.initiateRun(dto, req);

      // Then
      expect(result).toEqual(mockRunResponse);
      expect(service.initiateRun).toHaveBeenCalledWith(dto, tenantId, userId, 'customer_admin');
    });

    it('[4.1-UNIT-017] [P0] Given service throws, when POST / is called, then exception propagates', async () => {
      // Given
      service.initiateRun.mockRejectedValue(
        new Error('Template not found'),
      );
      const req = { user: { tenantId, userId, role: 'customer_admin' } };
      const dto = { templateId, inputs: {} };

      // When/Then
      await expect(controller.initiateRun(dto, req)).rejects.toThrow(
        'Template not found',
      );
    });
  });

  describe('findAll (GET /)', () => {
    it('[4-5-UNIT-024] delegates to service.findAllByTenant with pagination and status filter', async () => {
      const paginatedResult = {
        data: [mockRunResponse],
        total: 1,
        page: 1,
        limit: 20,
      };
      service.findAllByTenant.mockResolvedValue(paginatedResult);
      const req = { user: { tenantId } };

      const result = await controller.findAll(req, { page: 2, limit: 10, status: 'completed' as never });

      expect(result).toEqual(paginatedResult);
      expect(service.findAllByTenant).toHaveBeenCalledWith(tenantId, {
        page: 2,
        limit: 10,
        status: 'completed',
      });
    });

    it('[4-5-UNIT-025] passes undefined for optional query params when not provided', async () => {
      service.findAllByTenant.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
      const req = { user: { tenantId } };

      await controller.findAll(req, {});

      expect(service.findAllByTenant).toHaveBeenCalledWith(tenantId, {
        page: undefined,
        limit: undefined,
        status: undefined,
      });
    });
  });

  describe('findOne (GET /:id)', () => {
    it('[4-5-UNIT-026] delegates to service.findOneByTenant with id and tenantId', async () => {
      const completedRun = {
        ...mockRunResponse,
        status: WorkflowRunStatus.COMPLETED,
        perFileResults: [{ index: 0, fileName: 'file.pdf', status: 'completed' as const }],
        outputAssetIds: ['asset-1'],
      };
      service.findOneByTenant.mockResolvedValue(completedRun);
      const req = { user: { tenantId } };

      const result = await controller.findOne(runId, req);

      expect(result).toEqual(completedRun);
      expect(service.findOneByTenant).toHaveBeenCalledWith(runId, tenantId);
    });

    it('[4-5-UNIT-027] propagates NotFoundException when run not found', async () => {
      service.findOneByTenant.mockRejectedValue(new Error('not found'));
      const req = { user: { tenantId } };

      await expect(controller.findOne(runId, req)).rejects.toThrow('not found');
    });
  });

  describe('downloadOutput (GET /:id/outputs/:fileIndex)', () => {
    it('[4-5-UNIT-028] sets Content-Type, Content-Disposition, Content-Length and pipes file stream', async () => {
      const mockAsset = {
        id: 'asset-1',
        mimeType: 'text/markdown',
        originalName: 'output-00.md',
        fileSize: 1234,
        storagePath: '/tmp/test-file.md',
      } as AssetEntity;

      const mockPerFileResult: PerFileResult = {
        index: 0,
        fileName: 'report.pdf',
        status: 'completed',
        outputAssetId: 'asset-1',
      };

      service.getOutputFile.mockResolvedValue({
        asset: mockAsset,
        perFileResult: mockPerFileResult,
      });

      const req = { user: { tenantId } };
      const headersSet: Record<string, string> = {};
      const mockRes = {
        set: jest.fn((headers: Record<string, string>) => {
          Object.assign(headersSet, headers);
        }),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as import('express').Response;

      await controller.downloadOutput(runId, 0, req, mockRes);

      expect(service.getOutputFile).toHaveBeenCalledWith(runId, 0, tenantId);
      expect(mockRes.set).toHaveBeenCalledWith({
        'Content-Type': 'text/markdown',
        'Content-Disposition': 'attachment; filename="output-00.md"',
        'Content-Length': '1234',
      });

      // Verify createReadStream was called with the asset's storage path
      const { createReadStream } = require('fs');
      expect(createReadStream).toHaveBeenCalledWith('/tmp/test-file.md');
    });

    it('[4-5-UNIT-049] sanitizes unsafe characters in Content-Disposition filename', async () => {
      const mockAsset = {
        id: 'asset-1',
        mimeType: 'text/markdown',
        originalName: 'file"with\\slashes\nand\rnewlines.md',
        fileSize: 500,
        storagePath: '/tmp/test-file.md',
      } as AssetEntity;

      const mockPerFileResult: PerFileResult = {
        index: 0,
        fileName: 'report.pdf',
        status: 'completed' as const,
        outputAssetId: 'asset-1',
      };

      service.getOutputFile.mockResolvedValue({
        asset: mockAsset,
        perFileResult: mockPerFileResult,
      });

      const req = { user: { tenantId } };
      const headersSet: Record<string, string> = {};
      const mockRes = {
        set: jest.fn((headers: Record<string, string>) => {
          Object.assign(headersSet, headers);
        }),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as import('express').Response;

      await controller.downloadOutput(runId, 0, req, mockRes);

      // All dangerous characters replaced with underscores
      expect(headersSet['Content-Disposition']).toBe(
        'attachment; filename="file_with_slashes_and_newlines.md"',
      );
    });

    it('[4-5-UNIT-029] propagates NotFoundException for invalid fileIndex', async () => {
      service.getOutputFile.mockRejectedValue(new Error('Output at file index 99 not found'));
      const req = { user: { tenantId } };
      const mockRes = { set: jest.fn() } as unknown as import('express').Response;

      await expect(
        controller.downloadOutput(runId, 99, req, mockRes),
      ).rejects.toThrow('Output at file index 99 not found');
    });

    it('[4-5-UNIT-052] returns 500 when file stream emits error', async () => {
      const mockAsset = {
        id: 'asset-1',
        mimeType: 'text/markdown',
        originalName: 'output.md',
        fileSize: 100,
        storagePath: '/tmp/missing-file.md',
      } as AssetEntity;

      service.getOutputFile.mockResolvedValue({
        asset: mockAsset,
        perFileResult: { index: 0, fileName: 'file.pdf', status: 'completed' as const, outputAssetId: 'asset-1' },
      });

      // Mock createReadStream to return a stream that emits an error
      const { createReadStream } = require('fs');
      const errorStream = new Readable({
        read() {
          this.destroy(new Error('ENOENT: no such file'));
        },
      });
      (createReadStream as jest.Mock).mockReturnValueOnce(errorStream);

      const req = { user: { tenantId } };
      const mockRes = {
        set: jest.fn(),
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      } as unknown as import('express').Response;

      await controller.downloadOutput(runId, 0, req, mockRes);

      // Give the stream error event time to fire
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Failed to read output file' });
    });
  });
});
