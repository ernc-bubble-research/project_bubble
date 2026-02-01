import { InternalServerErrorException } from '@nestjs/common';
import { KnowledgeSearchService } from './knowledge-search.service';

describe('KnowledgeSearchService [2.3-UNIT-001] [P1]', () => {
  let service: KnowledgeSearchService;
  let mockTxManager: { run: jest.Mock };
  let mockEmbeddingProvider: { embed: jest.Mock };
  let mockManager: { query: jest.Mock };

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const mockEmbedding = [0.1, 0.2, 0.3];

  const mockDbResults = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      assetId: '22222222-2222-2222-2222-222222222222',
      content: 'Trust was identified as a recurring theme...',
      chunkIndex: 3,
      metadata: { charStart: 6000, charEnd: 8000 },
      assetName: 'quarterly-report.pdf',
      similarity: 0.87,
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      assetId: '22222222-2222-2222-2222-222222222222',
      content: 'Building trust requires consistent effort...',
      chunkIndex: 7,
      metadata: { charStart: 14000, charEnd: 16000 },
      assetName: 'quarterly-report.pdf',
      similarity: 0.72,
    },
  ];

  beforeEach(() => {
    mockManager = { query: jest.fn().mockResolvedValue(mockDbResults) };
    mockTxManager = {
      run: jest.fn().mockImplementation((_tenantId, cb) => cb(mockManager)),
    };
    mockEmbeddingProvider = {
      embed: jest.fn().mockResolvedValue([mockEmbedding]),
    };

    service = new KnowledgeSearchService(
      mockTxManager as any,
      mockEmbeddingProvider as any,
    );
  });

  describe('search()', () => {
    it('[2.3-UNIT-001a] should return results ranked by similarity', async () => {
      const results = await service.search('trust themes', tenantId);

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBe(0.87);
      expect(results[1].similarity).toBe(0.72);
    });

    it('[2.3-UNIT-001b] should call embeddingProvider.embed with the query', async () => {
      await service.search('trust themes', tenantId);

      expect(mockEmbeddingProvider.embed).toHaveBeenCalledWith([
        'trust themes',
      ]);
    });

    it('[2.3-UNIT-001c] should use TransactionManager with correct tenantId', async () => {
      await service.search('trust themes', tenantId);

      expect(mockTxManager.run).toHaveBeenCalledWith(
        tenantId,
        expect.any(Function),
      );
    });

    it('[2.3-UNIT-001d] should pass default limit, threshold, and verifiedBoost to SQL query', async () => {
      await service.search('trust themes', tenantId);

      const [sql, params] = mockManager.query.mock.calls[0];
      expect(sql).toContain('<=>');
      expect(sql).toContain('::vector');
      expect(params[0]).toBe(JSON.stringify(mockEmbedding));
      expect(params[1]).toBe(0.3); // default threshold
      expect(params[2]).toBe(10); // default limit
      expect(params[3]).toBe(0.1); // default verifiedBoost
    });

    it('[2.3-UNIT-001e] should respect custom limit and threshold', async () => {
      await service.search('trust themes', tenantId, {
        limit: 5,
        similarityThreshold: 0.7,
      });

      const [, params] = mockManager.query.mock.calls[0];
      expect(params[1]).toBe(0.7);
      expect(params[2]).toBe(5);
    });

    it('[2.3-UNIT-001f] should return empty array when no chunks match', async () => {
      mockManager.query.mockResolvedValue([]);

      const results = await service.search('nonexistent topic', tenantId);

      expect(results).toEqual([]);
    });

    it('[2.3-UNIT-001g] should include assetName in results', async () => {
      const results = await service.search('trust themes', tenantId);

      expect(results[0].assetName).toBe('quarterly-report.pdf');
    });

    it('[2.3-UNIT-001h] should include all required fields in results', async () => {
      const results = await service.search('trust themes', tenantId);
      const result = results[0];

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('assetId');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('chunkIndex');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('similarity');
      expect(result).toHaveProperty('assetName');
    });

    it('[2.3-UNIT-001i] should execute raw SQL with LEFT JOIN for standalone insights', async () => {
      await service.search('trust themes', tenantId);

      const [sql] = mockManager.query.mock.calls[0];
      expect(sql).toContain('(kc.embedding <=> $1::vector)');
      expect(sql).toContain('LEFT JOIN assets a ON a.id = kc.asset_id');
      expect(sql).toContain('ORDER BY similarity DESC');
      expect(sql).toContain('LIMIT $3');
    });

    it('[2.3-UNIT-001j] should throw InternalServerErrorException when embedding provider fails', async () => {
      mockEmbeddingProvider.embed.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      await expect(
        service.search('trust themes', tenantId),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('[2.3-UNIT-001k] should not call database when embedding fails', async () => {
      mockEmbeddingProvider.embed.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      try {
        await service.search('trust themes', tenantId);
      } catch {
        // expected
      }

      expect(mockTxManager.run).not.toHaveBeenCalled();
    });

    it('[2.3-UNIT-001l] should cast similarity to float8 in SQL', async () => {
      await service.search('trust themes', tenantId);

      const [sql] = mockManager.query.mock.calls[0];
      expect(sql).toContain('::float8 AS similarity');
    });

    // Story 2.4: Verified boost + soft-delete tests
    it('[2.4-UNIT-002a] should exclude soft-deleted chunks via deleted_at IS NULL', async () => {
      await service.search('trust themes', tenantId);

      const [sql] = mockManager.query.mock.calls[0];
      expect(sql).toContain('kc.deleted_at IS NULL');
    });

    it('[2.4-UNIT-002b] should boost verified chunks with CASE WHEN is_verified', async () => {
      await service.search('trust themes', tenantId);

      const [sql] = mockManager.query.mock.calls[0];
      expect(sql).toContain('CASE WHEN kc.is_verified THEN $4 ELSE 0 END');
    });

    it('[2.4-UNIT-002c] should cap boosted similarity at 1.0 via LEAST()', async () => {
      await service.search('trust themes', tenantId);

      const [sql] = mockManager.query.mock.calls[0];
      expect(sql).toContain('LEAST(');
      expect(sql).toContain('1.0');
    });

    it('[2.4-UNIT-002d] should pass default verifiedBoost of 0.1 as $4', async () => {
      await service.search('trust themes', tenantId);

      const [, params] = mockManager.query.mock.calls[0];
      expect(params[3]).toBe(0.1);
    });

    it('[2.4-UNIT-002e] should respect custom verifiedBoost value', async () => {
      await service.search('trust themes', tenantId, { verifiedBoost: 0.25 });

      const [, params] = mockManager.query.mock.calls[0];
      expect(params[3]).toBe(0.25);
    });
  });
});
