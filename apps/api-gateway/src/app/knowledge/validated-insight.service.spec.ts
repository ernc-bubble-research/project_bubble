import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ValidatedInsightService } from './validated-insight.service';

describe('ValidatedInsightService [2.4-UNIT-001] [P1]', () => {
  let service: ValidatedInsightService;
  let mockTxManager: { run: jest.Mock };
  let mockEmbeddingProvider: { embed: jest.Mock };
  let mockManager: { query: jest.Mock };

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const mockEmbedding = [0.1, 0.2, 0.3];

  const mockInsertResult = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      assetId: null,
      content: 'Trust was confirmed as the dominant theme.',
      chunkIndex: 0,
      metadata: {
        sourceType: 'report_feedback',
        sourceRunId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        sourceReportId: null,
        verifiedBy: userId,
        verifiedAt: '2026-02-01T12:00:00.000Z',
        originalContent: null,
      },
      isVerified: true,
      verifiedBy: userId,
      createdAt: new Date('2026-02-01'),
    },
  ];

  const mockRetrievalResults = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      assetId: null,
      content: 'Trust was confirmed as the dominant theme.',
      chunkIndex: 0,
      metadata: {
        sourceType: 'report_feedback',
        sourceRunId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        sourceReportId: null,
        verifiedBy: userId,
        verifiedAt: '2026-02-01T12:00:00.000Z',
        originalContent: null,
      },
      isVerified: true,
      verifiedBy: userId,
      createdAt: new Date('2026-02-01'),
    },
  ];

  beforeEach(() => {
    mockManager = { query: jest.fn() };
    mockTxManager = {
      run: jest.fn().mockImplementation((_tenantId, cb) => cb(mockManager)),
    };
    mockEmbeddingProvider = {
      embed: jest.fn().mockResolvedValue([mockEmbedding]),
    };

    service = new ValidatedInsightService(
      mockTxManager as any,
      mockEmbeddingProvider as any,
    );
  });

  describe('store()', () => {
    beforeEach(() => {
      mockManager.query.mockResolvedValue(mockInsertResult);
    });

    it('[2.4-UNIT-001a] should embed content and store with isVerified=true', async () => {
      const result = await service.store(
        'Trust was confirmed as the dominant theme.',
        tenantId,
        userId,
        { sourceType: 'report_feedback', sourceRunId: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
      );

      expect(mockEmbeddingProvider.embed).toHaveBeenCalledWith([
        'Trust was confirmed as the dominant theme.',
      ]);
      expect(result.isVerified).toBe(true);
      expect(result.id).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('[2.4-UNIT-001b] should populate metadata with source linkage', async () => {
      const result = await service.store(
        'Trust was confirmed.',
        tenantId,
        userId,
        {
          sourceType: 'assumption_correction',
          sourceRunId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          sourceReportId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          originalContent: 'Trust was NOT confirmed.',
        },
      );

      expect(result.sourceType).toBe('assumption_correction');
      expect(result.verifiedBy).toBe(userId);
      expect(result.verifiedAt).toBeTruthy();
    });

    it('[2.4-UNIT-001c] should use TransactionManager with correct tenantId', async () => {
      await service.store('test', tenantId, userId, { sourceType: 'manual_entry' });

      expect(mockTxManager.run).toHaveBeenCalledWith(
        tenantId,
        expect.any(Function),
      );
    });

    it('[2.4-UNIT-001d] should insert with asset_id=NULL for standalone insights', async () => {
      await service.store('test', tenantId, userId, { sourceType: 'manual_entry' });

      const [sql] = mockManager.query.mock.calls[0];
      expect(sql).toContain('asset_id, content');
      expect(sql).toContain('NULL');
    });

    it('[2.4-UNIT-001e] should pass embedding as ::vector cast', async () => {
      await service.store('test', tenantId, userId, { sourceType: 'manual_entry' });

      const [sql] = mockManager.query.mock.calls[0];
      expect(sql).toContain('$4::vector');
    });

    it('[2.4-UNIT-001f] should throw InternalServerErrorException when embedding fails', async () => {
      mockEmbeddingProvider.embed.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      await expect(
        service.store('test', tenantId, userId, { sourceType: 'manual_entry' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('[2.4-UNIT-001g] should not call database when embedding fails', async () => {
      mockEmbeddingProvider.embed.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      try {
        await service.store('test', tenantId, userId, { sourceType: 'manual_entry' });
      } catch {
        // expected
      }

      expect(mockTxManager.run).not.toHaveBeenCalled();
    });
  });

  describe('getByRun()', () => {
    it('[2.4-UNIT-001h] should query verified chunks by sourceRunId', async () => {
      mockManager.query.mockResolvedValue(mockRetrievalResults);
      const runId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

      const results = await service.getByRun(runId, tenantId);

      expect(results).toHaveLength(1);
      const [sql, params] = mockManager.query.mock.calls[0];
      expect(sql).toContain('is_verified = true');
      expect(sql).toContain('deleted_at IS NULL');
      expect(sql).toContain("metadata->>'sourceRunId'");
      expect(params[0]).toBe(runId);
    });

    it('[2.4-UNIT-001i] should return empty array when no insights for run', async () => {
      mockManager.query.mockResolvedValue([]);

      const results = await service.getByRun('no-such-run', tenantId);

      expect(results).toEqual([]);
    });
  });

  describe('getByTenant()', () => {
    it('[2.4-UNIT-001j] should query paginated verified chunks', async () => {
      mockManager.query.mockResolvedValue(mockRetrievalResults);

      const results = await service.getByTenant(tenantId, { limit: 5, offset: 10 });

      expect(results).toHaveLength(1);
      const [sql, params] = mockManager.query.mock.calls[0];
      expect(sql).toContain('LIMIT $1 OFFSET $2');
      expect(params[0]).toBe(5);
      expect(params[1]).toBe(10);
    });

    it('[2.4-UNIT-001k] should use default pagination values', async () => {
      mockManager.query.mockResolvedValue([]);

      await service.getByTenant(tenantId);

      const [, params] = mockManager.query.mock.calls[0];
      expect(params[0]).toBe(20);
      expect(params[1]).toBe(0);
    });

    it('[2.4-UNIT-001l] should exclude soft-deleted insights', async () => {
      mockManager.query.mockResolvedValue([]);

      await service.getByTenant(tenantId);

      const [sql] = mockManager.query.mock.calls[0];
      expect(sql).toContain('deleted_at IS NULL');
    });
  });

  describe('softDelete()', () => {
    it('[2.4-UNIT-001m] should set deleted_at on the insight', async () => {
      const insightId = '11111111-1111-1111-1111-111111111111';
      // UPDATE RETURNING via EntityManager returns [[rows], affectedCount]
      mockManager.query.mockResolvedValue([[{ id: insightId }], 1]);

      await service.softDelete(insightId, tenantId);

      const [sql, params] = mockManager.query.mock.calls[0];
      expect(sql).toContain('SET deleted_at = NOW()');
      expect(sql).toContain('is_verified = true');
      expect(sql).toContain('RETURNING id');
      expect(params[0]).toBe(insightId);
    });

    it('[2.4-UNIT-001n] should use TransactionManager with correct tenantId', async () => {
      // UPDATE RETURNING via EntityManager returns [[rows], affectedCount]
      mockManager.query.mockResolvedValue([[{ id: 'some-id' }], 1]);

      await service.softDelete('some-id', tenantId);

      expect(mockTxManager.run).toHaveBeenCalledWith(
        tenantId,
        expect.any(Function),
      );
    });

    it('[2.4-UNIT-001o] should throw NotFoundException when insight not found', async () => {
      // UPDATE RETURNING with no matches returns [[], 0]
      mockManager.query.mockResolvedValue([[], 0]);

      await expect(
        service.softDelete('nonexistent-id', tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[2.4-UNIT-001p] should throw NotFoundException when insight already deleted', async () => {
      // UPDATE RETURNING with no matches returns [[], 0]
      mockManager.query.mockResolvedValue([[], 0]);

      await expect(
        service.softDelete('already-deleted-id', tenantId),
      ).rejects.toThrow('not found or already deleted');
    });
  });
});
