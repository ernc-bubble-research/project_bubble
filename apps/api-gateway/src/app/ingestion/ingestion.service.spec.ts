import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  AssetEntity,
  AssetStatus,
  KnowledgeChunkEntity,
} from '@project-bubble/db-layer';
import { createMockAsset } from '@project-bubble/db-layer/testing';
import { IngestionService } from './ingestion.service';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

describe('IngestionService [2.2-UNIT-005] [P1]', () => {
  let service: IngestionService;
  let mockManager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let mockTxManager: { run: jest.Mock };
  let mockTextExtractor: { extract: jest.Mock };
  let mockChunker: { chunk: jest.Mock };
  let mockEmbeddingProvider: { embed: jest.Mock };
  let mockQueue: { add: jest.Mock };
  let mockConfig: { get: jest.Mock };

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const assetId = '11111111-1111-1111-1111-111111111111';

  const mockAsset = createMockAsset({
    id: assetId,
    tenantId,
    originalName: 'test.pdf',
    storagePath: `uploads/${tenantId}/test.pdf`,
    mimeType: 'application/pdf',
    isIndexed: false,
    status: AssetStatus.ACTIVE,
  });

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      create: jest.fn((entity, data) => data),
      save: jest.fn().mockImplementation((entity, data) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    mockTxManager = {
      run: jest.fn().mockImplementation(
        (_tenantId: string, cb: (manager: typeof mockManager) => Promise<unknown>) =>
          cb(mockManager),
      ),
    };

    mockTextExtractor = {
      extract: jest.fn().mockResolvedValue({
        text: 'Extracted text content for testing.',
        pages: 2,
      }),
    };

    mockChunker = {
      chunk: jest.fn().mockReturnValue([
        { content: 'Chunk 1', chunkIndex: 0, metadata: { charStart: 0, charEnd: 100 } },
        { content: 'Chunk 2', chunkIndex: 1, metadata: { charStart: 80, charEnd: 200 } },
      ]),
    };

    mockEmbeddingProvider = {
      embed: jest.fn().mockResolvedValue([
        new Array(768).fill(0.1),
        new Array(768).fill(0.2),
      ]),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    mockConfig = {
      get: jest.fn().mockReturnValue(undefined),
    };

    service = new IngestionService(
      mockTxManager as any,
      mockTextExtractor as any,
      mockChunker as any,
      mockEmbeddingProvider as any,
      mockQueue as any,
      mockConfig as any,
    );
  });

  describe('indexAsset()', () => {
    it('[2.2-UNIT-005a] should queue indexing job and return jobId', async () => {
      mockManager.findOne.mockResolvedValue(mockAsset);

      const result = await service.indexAsset(assetId, tenantId);

      expect(result.jobId).toContain('idx-');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'index-asset',
        { assetId, tenantId },
        expect.objectContaining({ jobId: expect.any(String) }),
      );
    });

    it('[2.2-UNIT-005b] should throw NotFoundException if asset does not exist', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(service.indexAsset(assetId, tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('[2.2-UNIT-005c] should throw BadRequestException if asset already indexed', async () => {
      mockManager.findOne.mockResolvedValue({ ...mockAsset, isIndexed: true });

      await expect(service.indexAsset(assetId, tenantId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('processIndexing()', () => {
    it('[2.2-UNIT-005d] should run full pipeline: extract -> chunk -> embed -> store', async () => {
      mockManager.findOne.mockResolvedValue(mockAsset);

      await service.processIndexing(assetId, tenantId);

      expect(mockTextExtractor.extract).toHaveBeenCalledWith(
        mockAsset.storagePath,
        mockAsset.mimeType,
      );
      expect(mockChunker.chunk).toHaveBeenCalled();
      expect(mockEmbeddingProvider.embed).toHaveBeenCalledWith([
        'Chunk 1',
        'Chunk 2',
      ]);
      expect(mockManager.save).toHaveBeenCalledWith(
        KnowledgeChunkEntity,
        expect.any(Array),
      );
      expect(mockManager.update).toHaveBeenCalledWith(
        AssetEntity,
        { id: assetId },
        { isIndexed: true },
      );
    });

    it('[2.2-UNIT-005e] should throw NotFoundException if asset not found during processing', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.processIndexing(assetId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[2.2-UNIT-005f] should skip indexing if no text extracted', async () => {
      mockManager.findOne.mockResolvedValue(mockAsset);
      mockTextExtractor.extract.mockResolvedValue({ text: '', pages: 0 });

      await service.processIndexing(assetId, tenantId);

      expect(mockChunker.chunk).not.toHaveBeenCalled();
      expect(mockEmbeddingProvider.embed).not.toHaveBeenCalled();
    });

    it('[2.2-UNIT-005g] should clean up partial chunks on failure', async () => {
      mockManager.findOne.mockResolvedValue(mockAsset);
      mockEmbeddingProvider.embed.mockRejectedValue(new Error('API error'));

      await expect(
        service.processIndexing(assetId, tenantId),
      ).rejects.toThrow('API error');

      // Verify cleanup was attempted
      expect(mockManager.delete).toHaveBeenCalledWith(
        KnowledgeChunkEntity,
        { assetId },
      );
    });
  });

  describe('deIndexAsset()', () => {
    it('[2.2-UNIT-005h] should delete chunks and reset isIndexed flag', async () => {
      mockManager.findOne.mockResolvedValue({ ...mockAsset, isIndexed: true });

      await service.deIndexAsset(assetId, tenantId);

      expect(mockManager.delete).toHaveBeenCalledWith(
        KnowledgeChunkEntity,
        { assetId },
      );
      expect(mockManager.update).toHaveBeenCalledWith(
        AssetEntity,
        { id: assetId },
        { isIndexed: false },
      );
    });

    it('[2.2-UNIT-005i] should throw NotFoundException if asset not found', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.deIndexAsset(assetId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[2.2-UNIT-005j] should throw BadRequestException if asset is not indexed', async () => {
      mockManager.findOne.mockResolvedValue({ ...mockAsset, isIndexed: false });

      await expect(
        service.deIndexAsset(assetId, tenantId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
