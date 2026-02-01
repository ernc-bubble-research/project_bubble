import { Job } from 'bullmq';
import { IngestionProcessor } from './ingestion.processor';

describe('IngestionProcessor [2.2-UNIT-009] [P2]', () => {
  let processor: IngestionProcessor;
  let mockIngestionService: { processIndexing: jest.Mock };

  const assetId = '11111111-1111-1111-1111-111111111111';
  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => {
    mockIngestionService = {
      processIndexing: jest.fn().mockResolvedValue(undefined),
    };

    processor = new IngestionProcessor(mockIngestionService as any);
  });

  it('[2.2-UNIT-009a] should call processIndexing with job data', async () => {
    const mockJob = {
      id: 'job-1',
      data: { assetId, tenantId },
    } as Job<{ assetId: string; tenantId: string }>;

    await processor.process(mockJob);

    expect(mockIngestionService.processIndexing).toHaveBeenCalledWith(
      assetId,
      tenantId,
    );
  });

  it('[2.2-UNIT-009b] should re-throw errors from processIndexing', async () => {
    mockIngestionService.processIndexing.mockRejectedValue(
      new Error('Extraction failed'),
    );

    const mockJob = {
      id: 'job-2',
      data: { assetId, tenantId },
    } as Job<{ assetId: string; tenantId: string }>;

    await expect(processor.process(mockJob)).rejects.toThrow(
      'Extraction failed',
    );
  });
});
