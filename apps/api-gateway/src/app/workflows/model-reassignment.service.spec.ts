import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ModelReassignmentService } from './model-reassignment.service';
import { AffectedWorkflowDto, DeactivateModelResponseDto } from '@project-bubble/shared';

describe('ModelReassignmentService [P0]', () => {
  let service: ModelReassignmentService;
  let mockModelRepo: {
    findOne: jest.Mock;
    count: jest.Mock;
  };
  let mockDataSource: {
    query: jest.Mock;
    transaction: jest.Mock;
  };

  const modelId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const replacementId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const modelId2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  /** Helper: build a mockManager.query that responds in order */
  function buildMockManager(responses: unknown[]) {
    const query = jest.fn();
    for (const r of responses) {
      if (r instanceof Error) {
        query.mockRejectedValueOnce(r);
      } else {
        query.mockResolvedValueOnce(r);
      }
    }
    return { query };
  }

  beforeEach(() => {
    mockModelRepo = {
      findOne: jest.fn(),
      count: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn(),
      transaction: jest.fn(),
    };

    service = new ModelReassignmentService(
      mockModelRepo as any,
      mockDataSource as any,
    );
  });

  describe('findAffectedVersions', () => {
    it('[4-H1-UNIT-001] should return empty array when no model IDs provided', async () => {
      const result = await service.findAffectedVersions([]);
      expect(result).toEqual([]);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('[4-H1-UNIT-002] should query affected versions by JSONB path and return DTOs', async () => {
      const mockRows = [
        {
          version_id: 'v1',
          template_id: 't1',
          template_name: 'Template A',
          version_number: 1,
          template_status: 'published',
        },
        {
          version_id: 'v2',
          template_id: 't2',
          template_name: 'Template B',
          version_number: 2,
          template_status: 'draft',
        },
      ];
      mockDataSource.query.mockResolvedValue(mockRows);

      const result = await service.findAffectedVersions([modelId]);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("definition->'execution'->>'model' = ANY($1)"),
        [[modelId]],
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(AffectedWorkflowDto);
      expect(result[0].versionId).toBe('v1');
      expect(result[0].templateName).toBe('Template A');
      expect(result[0].templateStatus).toBe('published');
      expect(result[1].versionId).toBe('v2');
    });

    it('[4-H1-UNIT-003] should accept multiple model IDs', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.findAffectedVersions([modelId, replacementId]);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        [[modelId, replacementId]],
      );
    });
  });

  describe('reassignAndDeactivate', () => {
    it('[4-H1-UNIT-004] should throw NotFoundException if model not found', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [],         // SELECT model FOR UPDATE → not found
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(
        service.reassignAndDeactivate(modelId, replacementId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[4-H1-UNIT-005] should throw BadRequestException if model already inactive', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [{ id: modelId, is_active: false }], // SELECT model → inactive
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(
        service.reassignAndDeactivate(modelId, replacementId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4-H1-UNIT-006] should throw NotFoundException if replacement not found', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [{ id: modelId, is_active: true }],  // SELECT model → found
        [],                                    // SELECT replacement → not found
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(
        service.reassignAndDeactivate(modelId, replacementId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[4-H1-UNIT-007] should throw BadRequestException if replacement is inactive', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [{ id: modelId, is_active: true }],       // SELECT model → active
        [{ id: replacementId, is_active: false }], // SELECT replacement → inactive
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(
        service.reassignAndDeactivate(modelId, replacementId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4-H1-UNIT-008] should throw BadRequestException if replacement equals model', async () => {
      await expect(
        service.reassignAndDeactivate(modelId, modelId),
      ).rejects.toThrow(BadRequestException);

      // Pre-check catches this before transaction
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('[4-H1-UNIT-009] should throw BadRequestException if last active model', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [{ id: modelId, is_active: true }],       // SELECT model
        [{ id: replacementId, is_active: true }],  // SELECT replacement
        [{ count: '1' }],                          // SELECT COUNT → only 1 active
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(
        service.reassignAndDeactivate(modelId, replacementId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4-H1-UNIT-010] should execute atomic transaction with admin bypass + snapshot + reset + deactivate', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [{ id: modelId, is_active: true }],       // SELECT model
        [{ id: replacementId, is_active: true }],  // SELECT replacement
        [{ count: '3' }],                          // SELECT COUNT → 3 active
        undefined,                                  // UPDATE snapshot
        [[], 5],                                    // UPDATE reassign → 5 affected
        undefined,                                  // UPDATE deactivate
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.reassignAndDeactivate(modelId, replacementId);

      // Verify admin RLS bypass
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining("SET LOCAL app.is_admin = 'true'"),
      );

      // Verify FOR UPDATE locks
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        [modelId],
      );
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        [replacementId],
      );

      // Verify snapshot (N-1)
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('previous_generation_config'),
        [modelId],
      );

      // Verify model reassignment + nuclear reset
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('jsonb_set'),
        [modelId, replacementId],
      );

      // Verify deactivation
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = false'),
        [modelId],
      );

      expect(result).toBeInstanceOf(DeactivateModelResponseDto);
      expect(result.versionsReassigned).toBe(5);
      expect(result.deactivatedModelId).toBe(modelId);
      expect(result.replacementModelId).toBe(replacementId);
    });
  });

  describe('reassignMultipleAndDeactivate', () => {
    it('[4-H1-UNIT-042] should return empty array when no model IDs provided', async () => {
      const result = await service.reassignMultipleAndDeactivate([], replacementId);
      expect(result).toEqual([]);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('[4-H1-UNIT-043] should throw BadRequestException if any modelId equals replacement', async () => {
      await expect(
        service.reassignMultipleAndDeactivate([modelId, replacementId], replacementId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4-H1-UNIT-044] should throw NotFoundException if replacement model not found', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [],         // SELECT replacement FOR UPDATE → not found
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(
        service.reassignMultipleAndDeactivate([modelId], replacementId),
      ).rejects.toThrow(NotFoundException);
    });

    it('[4-H1-UNIT-045] should throw BadRequestException if replacement model inactive', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [{ id: replacementId, is_active: false }], // SELECT replacement → inactive
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(
        service.reassignMultipleAndDeactivate([modelId], replacementId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4-H1-UNIT-046] should atomically reassign multiple models in single transaction', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [{ id: replacementId, is_active: true }],  // SELECT replacement → valid
        [{ count: '5' }],                           // SELECT COUNT → 5 active (safe)
        // Model 1
        [{ id: modelId, is_active: true }],        // SELECT model1 FOR UPDATE
        undefined,                                   // UPDATE snapshot
        [[], 3],                                     // UPDATE reassign → 3 affected
        undefined,                                   // UPDATE deactivate
        // Model 2
        [{ id: modelId2, is_active: true }],        // SELECT model2 FOR UPDATE
        undefined,                                   // UPDATE snapshot
        [[], 1],                                     // UPDATE reassign → 1 affected
        undefined,                                   // UPDATE deactivate
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.reassignMultipleAndDeactivate(
        [modelId, modelId2],
        replacementId,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(DeactivateModelResponseDto);
      expect(result[0].versionsReassigned).toBe(3);
      expect(result[0].deactivatedModelId).toBe(modelId);
      expect(result[1].versionsReassigned).toBe(1);
      expect(result[1].deactivatedModelId).toBe(modelId2);
    });

    it('[4-H1-UNIT-052] should throw BadRequestException if deactivation would leave zero active models', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [{ id: replacementId, is_active: true }],  // SELECT replacement → valid
        [{ count: '2' }],                           // SELECT COUNT → only 2 active, deactivating 2 would leave 0
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      await expect(
        service.reassignMultipleAndDeactivate([modelId, modelId2], replacementId),
      ).rejects.toThrow(BadRequestException);
    });

    it('[4-H1-UNIT-053] should atomically deactivate provider config within same transaction', async () => {
      const providerConfigId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [{ id: replacementId, is_active: true }],  // SELECT replacement → valid
        [{ count: '5' }],                           // SELECT COUNT → 5 active (safe)
        // Model 1
        [{ id: modelId, is_active: true }],        // SELECT model FOR UPDATE
        undefined,                                   // UPDATE snapshot
        [[], 2],                                     // UPDATE reassign → 2 affected
        undefined,                                   // UPDATE deactivate model
        undefined,                                   // UPDATE provider config deactivate
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.reassignMultipleAndDeactivate(
        [modelId],
        replacementId,
        providerConfigId,
      );

      expect(result).toHaveLength(1);
      expect(result[0].versionsReassigned).toBe(2);
      // Verify provider config deactivation query was called
      expect(mockManager.query).toHaveBeenCalledWith(
        expect.stringContaining('llm_provider_configs'),
        [providerConfigId],
      );
    });

    it('[4-H1-UNIT-047] should skip already-inactive models', async () => {
      const mockManager = buildMockManager([
        undefined, // SET LOCAL
        [{ id: replacementId, is_active: true }],   // SELECT replacement → valid
        [{ count: '3' }],                            // SELECT COUNT → 3 active (safe)
        [{ id: modelId, is_active: false }],         // SELECT model1 → already inactive, skip
      ]);
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(mockManager));

      const result = await service.reassignMultipleAndDeactivate([modelId], replacementId);

      expect(result).toHaveLength(0);
    });
  });

  describe('getActiveModelCount', () => {
    it('[4-H1-UNIT-011] should return count from repo when no excludeIds', async () => {
      mockModelRepo.count.mockResolvedValue(5);

      const result = await service.getActiveModelCount();

      expect(mockModelRepo.count).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(result).toBe(5);
    });

    it('[4-H1-UNIT-012] should use raw query when excludeIds provided', async () => {
      mockDataSource.query.mockResolvedValue([{ count: '3' }]);

      const result = await service.getActiveModelCount([modelId]);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('id != ALL($1)'),
        [[modelId]],
      );
      expect(result).toBe(3);
    });

    it('[4-H1-UNIT-048] should handle null count gracefully', async () => {
      mockDataSource.query.mockResolvedValue([{}]);

      const result = await service.getActiveModelCount([modelId]);

      expect(result).toBe(0);
    });
  });
});
