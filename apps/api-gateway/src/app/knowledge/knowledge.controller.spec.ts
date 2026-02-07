import { KnowledgeController } from './knowledge.controller';
import { NotFoundException } from '@nestjs/common';
import {
  SearchKnowledgeDto,
  CreateValidatedInsightDto,
  ListInsightsQueryDto,
  InsightSourceType,
} from '@project-bubble/shared';

describe('KnowledgeController [2.3-UNIT-002] [P2]', () => {
  let controller: KnowledgeController;
  let mockSearchService: { search: jest.Mock };
  let mockInsightService: {
    store: jest.Mock;
    getByTenant: jest.Mock;
    getByRun: jest.Mock;
    softDelete: jest.Mock;
  };

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const mockReq = { user: { tenantId: tenantId, sub: userId } };
  const mockResults = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      assetId: '22222222-2222-2222-2222-222222222222',
      content: 'Trust was identified...',
      chunkIndex: 3,
      metadata: { charStart: 6000, charEnd: 8000 },
      similarity: 0.87,
      assetName: 'quarterly-report.pdf',
    },
  ];

  const mockInsightResponse = {
    id: '11111111-1111-1111-1111-111111111111',
    assetId: null,
    content: 'Trust was confirmed as the dominant theme.',
    chunkIndex: 0,
    metadata: { sourceType: 'report_feedback' },
    isVerified: true,
    verifiedBy: userId,
    verifiedAt: '2026-02-01T12:00:00.000Z',
    sourceType: 'report_feedback',
    sourceRunId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    sourceReportId: null,
  };

  beforeEach(() => {
    mockSearchService = {
      search: jest.fn().mockResolvedValue(mockResults),
    };
    mockInsightService = {
      store: jest.fn().mockResolvedValue(mockInsightResponse),
      getByTenant: jest.fn().mockResolvedValue([mockInsightResponse]),
      getByRun: jest.fn().mockResolvedValue([mockInsightResponse]),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };

    controller = new KnowledgeController(
      mockSearchService as any,
      mockInsightService as any,
    );
  });

  describe('POST /app/knowledge/search', () => {
    it('[2.3-UNIT-002a] should call search service with correct params', async () => {
      const dto: SearchKnowledgeDto = {
        query: 'trust themes',
        limit: 5,
        similarityThreshold: 0.5,
      };

      const result = await controller.search(dto, mockReq as any);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'trust themes',
        tenantId,
        { limit: 5, similarityThreshold: 0.5 },
      );
      expect(result).toEqual(mockResults);
    });

    it('[2.3-UNIT-002b] should pass undefined for optional params when not provided', async () => {
      const dto: SearchKnowledgeDto = {
        query: 'trust themes',
      } as SearchKnowledgeDto;

      await controller.search(dto, mockReq as any);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'trust themes',
        tenantId,
        { limit: undefined, similarityThreshold: undefined },
      );
    });

    it('[2.3-UNIT-002c] should return search results from service', async () => {
      const dto: SearchKnowledgeDto = { query: 'test query' } as SearchKnowledgeDto;

      const result = await controller.search(dto, mockReq as any);

      expect(result).toEqual(mockResults);
      expect(result).toHaveLength(1);
    });

    it('[2.3-UNIT-002d] should return empty array when no results', async () => {
      mockSearchService.search.mockResolvedValue([]);
      const dto: SearchKnowledgeDto = { query: 'nonexistent' } as SearchKnowledgeDto;

      const result = await controller.search(dto, mockReq as any);

      expect(result).toEqual([]);
    });

    it('[2.3-UNIT-002e] should extract tenant_id from request user', async () => {
      const customTenantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const customReq = { user: { tenantId: customTenantId, sub: userId } };
      const dto: SearchKnowledgeDto = { query: 'test' } as SearchKnowledgeDto;

      await controller.search(dto, customReq as any);

      expect(mockSearchService.search).toHaveBeenCalledWith(
        'test',
        customTenantId,
        expect.any(Object),
      );
    });
  });

  // Story 2.4: Validated insight controller tests
  describe('POST /app/knowledge/insights [2.4-UNIT-003]', () => {
    it('[2.4-UNIT-003a] should call insightService.store with correct params', async () => {
      const dto = {
        content: 'Trust was confirmed.',
        sourceType: InsightSourceType.REPORT_FEEDBACK,
        sourceRunId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      } as CreateValidatedInsightDto;

      const result = await controller.storeInsight(dto, mockReq as any);

      expect(mockInsightService.store).toHaveBeenCalledWith(
        'Trust was confirmed.',
        tenantId,
        userId,
        {
          sourceType: InsightSourceType.REPORT_FEEDBACK,
          sourceRunId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          sourceReportId: undefined,
          originalContent: undefined,
        },
      );
      expect(result).toEqual(mockInsightResponse);
    });

    it('[2.4-UNIT-003b] should extract sub (userId) from JWT for verifiedBy', async () => {
      const customUserId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      const customReq = { user: { tenantId: tenantId, sub: customUserId } };
      const dto = {
        content: 'Test insight.',
        sourceType: InsightSourceType.MANUAL_ENTRY,
      } as CreateValidatedInsightDto;

      await controller.storeInsight(dto, customReq as any);

      expect(mockInsightService.store).toHaveBeenCalledWith(
        'Test insight.',
        tenantId,
        customUserId,
        expect.any(Object),
      );
    });
  });

  describe('GET /app/knowledge/insights [2.4-UNIT-004]', () => {
    it('[2.4-UNIT-004a] should call getByTenant with DTO pagination', async () => {
      const query = { limit: 10, offset: 5 } as ListInsightsQueryDto;

      await controller.listInsights(mockReq as any, query);

      expect(mockInsightService.getByTenant).toHaveBeenCalledWith(
        tenantId,
        { limit: 10, offset: 5 },
      );
    });

    it('[2.4-UNIT-004b] should pass undefined for omitted pagination params', async () => {
      const query = {} as ListInsightsQueryDto;

      await controller.listInsights(mockReq as any, query);

      expect(mockInsightService.getByTenant).toHaveBeenCalledWith(
        tenantId,
        { limit: undefined, offset: undefined },
      );
    });

    it('[2.4-UNIT-004c] should return insight list from service', async () => {
      const query = {} as ListInsightsQueryDto;

      const result = await controller.listInsights(mockReq as any, query);

      expect(result).toEqual([mockInsightResponse]);
    });
  });

  describe('GET /app/knowledge/insights/run/:runId [2.4-UNIT-005]', () => {
    it('[2.4-UNIT-005a] should call getByRun with runId and tenantId', async () => {
      const runId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

      const result = await controller.getInsightsByRun(runId, mockReq as any);

      expect(mockInsightService.getByRun).toHaveBeenCalledWith(runId, tenantId);
      expect(result).toEqual([mockInsightResponse]);
    });
  });

  describe('DELETE /app/knowledge/insights/:id [2.4-UNIT-006]', () => {
    it('[2.4-UNIT-006a] should call softDelete with id and tenantId', async () => {
      const insightId = '11111111-1111-1111-1111-111111111111';

      await controller.deleteInsight(insightId, mockReq as any);

      expect(mockInsightService.softDelete).toHaveBeenCalledWith(
        insightId,
        tenantId,
      );
    });

    it('[2.4-UNIT-006b] should return void (204 No Content)', async () => {
      const result = await controller.deleteInsight('some-id', mockReq as any);

      expect(result).toBeUndefined();
    });

    it('[2.4-UNIT-006c] should propagate NotFoundException from service', async () => {
      mockInsightService.softDelete.mockRejectedValue(
        new NotFoundException('Validated insight nonexistent not found or already deleted'),
      );

      await expect(
        controller.deleteInsight('nonexistent', mockReq as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
