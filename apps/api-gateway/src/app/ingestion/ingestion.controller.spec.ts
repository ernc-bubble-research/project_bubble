import { IngestionController } from './ingestion.controller';

describe('IngestionController [2.2-UNIT-006] [P2]', () => {
  let controller: IngestionController;
  let mockIngestionService: {
    indexAsset: jest.Mock;
    deIndexAsset: jest.Mock;
  };

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const assetId = '11111111-1111-1111-1111-111111111111';
  const mockReq = { user: { tenantId: tenantId } };

  beforeEach(() => {
    mockIngestionService = {
      indexAsset: jest.fn().mockResolvedValue({ jobId: 'idx-mock-uuid' }),
      deIndexAsset: jest.fn().mockResolvedValue(undefined),
    };

    controller = new IngestionController(mockIngestionService as any);
  });

  describe('POST /app/assets/:id/index', () => {
    it('[2.2-UNIT-006a] should call indexAsset with correct params', async () => {
      const result = await controller.indexAsset(assetId, mockReq as any);

      expect(mockIngestionService.indexAsset).toHaveBeenCalledWith(
        assetId,
        tenantId,
      );
      expect(result.jobId).toBe('idx-mock-uuid');
      expect(result.assetId).toBe(assetId);
      expect(result.status).toBe('queued');
    });
  });

  describe('DELETE /app/assets/:id/index', () => {
    it('[2.2-UNIT-006b] should call deIndexAsset with correct params', async () => {
      await controller.deIndexAsset(assetId, mockReq as any);

      expect(mockIngestionService.deIndexAsset).toHaveBeenCalledWith(
        assetId,
        tenantId,
      );
    });
  });
});
