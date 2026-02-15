import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PreFlightValidationService } from './pre-flight-validation.service';
import { LlmModelsService } from '../workflows/llm-models.service';
import { LlmProviderConfigService } from '../settings/llm-provider-config.service';

describe('PreFlightValidationService', () => {
  let service: PreFlightValidationService;
  let llmModelsService: { findOneById: jest.Mock };
  let llmProviderConfigService: { findByProviderKey: jest.Mock };
  let mockManager: { query: jest.Mock };

  const modelUuid = 'dddddddd-0000-0000-0000-000000000001';
  const tenantId = 'aaaaaaaa-0000-0000-0000-000000000001';

  const mockModel = {
    id: modelUuid,
    providerKey: 'mock',
    modelId: 'mock-model-v1',
    displayName: 'Mock Model v1',
    isActive: true,
    contextWindow: 100000,
    maxOutputTokens: 4096,
  };

  const mockProviderConfig = {
    id: 'eeeeeeee-0000-0000-0000-000000000001',
    providerKey: 'mock',
    displayName: 'Mock Provider',
    isActive: true,
    credentials: {},
  };

  beforeEach(() => {
    llmModelsService = { findOneById: jest.fn() };
    llmProviderConfigService = { findByProviderKey: jest.fn() };
    mockManager = { query: jest.fn() };

    service = new PreFlightValidationService(
      llmModelsService as unknown as LlmModelsService,
      llmProviderConfigService as unknown as LlmProviderConfigService,
    );
  });

  // ── validateModelAvailability ────────────────────────────────────

  describe('validateModelAvailability', () => {
    it('[4.4-UNIT-001] [AC8] should pass when model is active and provider config is active', async () => {
      llmModelsService.findOneById.mockResolvedValue(mockModel);
      llmProviderConfigService.findByProviderKey.mockResolvedValue(mockProviderConfig);

      await expect(service.validateModelAvailability(modelUuid)).resolves.toBeUndefined();
    });

    it('[4.4-UNIT-002] [AC8] should throw BadRequestException when model not found', async () => {
      llmModelsService.findOneById.mockResolvedValue(null);

      await expect(service.validateModelAvailability(modelUuid)).rejects.toThrow(/not found/);
    });

    it('[4.4-UNIT-003] [AC8] should throw BadRequestException when model is inactive', async () => {
      llmModelsService.findOneById.mockResolvedValue({ ...mockModel, isActive: false });

      await expect(service.validateModelAvailability(modelUuid)).rejects.toThrow(/inactive/);
    });

    it('[4.4-UNIT-004] [AC8] should throw BadRequestException when provider config not found', async () => {
      llmModelsService.findOneById.mockResolvedValue(mockModel);
      llmProviderConfigService.findByProviderKey.mockResolvedValue(null);

      await expect(service.validateModelAvailability(modelUuid)).rejects.toThrow(/No provider configuration/);
    });

    it('[4.4-UNIT-005] [AC8] should throw BadRequestException when provider config is inactive', async () => {
      llmModelsService.findOneById.mockResolvedValue(mockModel);
      llmProviderConfigService.findByProviderKey.mockResolvedValue({ ...mockProviderConfig, isActive: false });

      await expect(service.validateModelAvailability(modelUuid)).rejects.toThrow(/inactive/);
    });
  });

  // ── checkAndDeductCredits ────────────────────────────────────────

  describe('checkAndDeductCredits', () => {
    it('[4.4-UNIT-006] [AC7] should return {0, 0} for test runs and skip all queries', async () => {
      const result = await service.checkAndDeductCredits(
        tenantId, 5, true, mockManager as unknown as EntityManager,
      );

      expect(result).toEqual({ creditsFromMonthly: 0, creditsFromPurchased: 0 });
      expect(mockManager.query).not.toHaveBeenCalled();
    });

    it('[4.4-UNIT-007] [AC1] should throw when creditsPerRun exceeds max_credits_per_run', async () => {
      // Tenant has max_credits_per_run = 5, but run costs 10
      mockManager.query.mockResolvedValueOnce([
        { max_monthly_runs: 100, purchased_credits: 50, max_credits_per_run: 5 },
      ]);

      await expect(
        service.checkAndDeductCredits(tenantId, 10, false, mockManager as unknown as EntityManager),
      ).rejects.toThrow(/per-run credit limit/);
    });

    it('[4.4-UNIT-008] [AC3] should deduct monthly-first: 3 from monthly, 2 from purchased when cost=5 and monthlyRemaining=3', async () => {
      // max_monthly_runs = 10, monthly used so far = 7, so remaining = 3
      mockManager.query
        .mockResolvedValueOnce([{ max_monthly_runs: 10, purchased_credits: 20, max_credits_per_run: 10 }])
        .mockResolvedValueOnce([{ total: 7 }]); // monthly SUM

      const result = await service.checkAndDeductCredits(
        tenantId, 5, false, mockManager as unknown as EntityManager,
      );

      expect(result).toEqual({ creditsFromMonthly: 3, creditsFromPurchased: 2 });
      // Should have deducted 2 from purchased_credits
      expect(mockManager.query).toHaveBeenCalledWith(
        'UPDATE tenants SET purchased_credits = purchased_credits - $1 WHERE id = $2',
        [2, tenantId],
      );
    });

    it('[4.4-UNIT-009] [AC3] should deduct entirely from monthly when sufficient', async () => {
      // max_monthly_runs = 100, monthly used = 0, so remaining = 100
      mockManager.query
        .mockResolvedValueOnce([{ max_monthly_runs: 100, purchased_credits: 0, max_credits_per_run: 10 }])
        .mockResolvedValueOnce([{ total: 0 }]); // no monthly usage

      const result = await service.checkAndDeductCredits(
        tenantId, 5, false, mockManager as unknown as EntityManager,
      );

      expect(result).toEqual({ creditsFromMonthly: 5, creditsFromPurchased: 0 });
      // Should NOT have updated purchased_credits (no purchased deduction needed)
      const purchasedUpdateCalls = mockManager.query.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('purchased_credits = purchased_credits -'),
      );
      expect(purchasedUpdateCalls).toHaveLength(0);
    });

    it('[4.4-UNIT-010] [AC3] should deduct entirely from purchased when monthly exhausted', async () => {
      // max_monthly_runs = 10, monthly used = 10 (exhausted)
      mockManager.query
        .mockResolvedValueOnce([{ max_monthly_runs: 10, purchased_credits: 20, max_credits_per_run: 10 }])
        .mockResolvedValueOnce([{ total: 10 }]); // monthly exhausted

      const result = await service.checkAndDeductCredits(
        tenantId, 5, false, mockManager as unknown as EntityManager,
      );

      expect(result).toEqual({ creditsFromMonthly: 0, creditsFromPurchased: 5 });
      expect(mockManager.query).toHaveBeenCalledWith(
        'UPDATE tenants SET purchased_credits = purchased_credits - $1 WHERE id = $2',
        [5, tenantId],
      );
    });

    it('[4.4-UNIT-011] [AC2] should throw when insufficient credits (monthly + purchased)', async () => {
      // max_monthly_runs = 2, monthly used = 2, purchased = 1, cost = 3
      mockManager.query
        .mockResolvedValueOnce([{ max_monthly_runs: 2, purchased_credits: 1, max_credits_per_run: 10 }])
        .mockResolvedValueOnce([{ total: 2 }]); // monthly exhausted

      await expect(
        service.checkAndDeductCredits(tenantId, 3, false, mockManager as unknown as EntityManager),
      ).rejects.toThrow(/Insufficient credits/);
    });

    it('[4.4-UNIT-012] [AC4] should derive monthly remaining from SUM of credits_from_monthly', async () => {
      mockManager.query
        .mockResolvedValueOnce([{ max_monthly_runs: 50, purchased_credits: 0, max_credits_per_run: 10 }])
        .mockResolvedValueOnce([{ total: 45 }]); // monthly used = 45, remaining = 5

      const result = await service.checkAndDeductCredits(
        tenantId, 3, false, mockManager as unknown as EntityManager,
      );

      expect(result.creditsFromMonthly).toBe(3);
      expect(result.creditsFromPurchased).toBe(0);

      // Verify the monthly SUM query was called with correct params
      const monthlyQuery = mockManager.query.mock.calls[1];
      expect(monthlyQuery[0]).toContain('SUM(credits_from_monthly)');
      expect(monthlyQuery[0]).toContain('is_test_run = false');
      expect(monthlyQuery[0]).toContain("date_trunc('month', NOW() AT TIME ZONE 'UTC')");
      expect(monthlyQuery[1]).toEqual([tenantId]);
    });

    it('[4.4-UNIT-013] should throw when tenant not found', async () => {
      mockManager.query.mockResolvedValueOnce([]); // no tenant rows

      await expect(
        service.checkAndDeductCredits(tenantId, 1, false, mockManager as unknown as EntityManager),
      ).rejects.toThrow(/not found/);
    });

    it('[4.4-UNIT-014] [AC5] should pass when cost exactly equals available (monthly + purchased)', async () => {
      // monthly remaining = 2, purchased = 3, cost = 5 (exact match)
      mockManager.query
        .mockResolvedValueOnce([{ max_monthly_runs: 10, purchased_credits: 3, max_credits_per_run: 10 }])
        .mockResolvedValueOnce([{ total: 8 }]); // monthly remaining = 2

      const result = await service.checkAndDeductCredits(
        tenantId, 5, false, mockManager as unknown as EntityManager,
      );

      expect(result).toEqual({ creditsFromMonthly: 2, creditsFromPurchased: 3 });
    });
  });

  // ── refundCredits ────────────────────────────────────────────────

  describe('refundCredits', () => {
    it('[4.4-UNIT-015] [AC6] should refund purchased credits back to tenant', async () => {
      await service.refundCredits(tenantId, 5, mockManager as unknown as EntityManager);

      expect(mockManager.query).toHaveBeenCalledWith(
        'UPDATE tenants SET purchased_credits = purchased_credits + $1 WHERE id = $2',
        [5, tenantId],
      );
    });

    it('[4.4-UNIT-016] should skip refund when creditsFromPurchased is 0', async () => {
      await service.refundCredits(tenantId, 0, mockManager as unknown as EntityManager);

      expect(mockManager.query).not.toHaveBeenCalled();
    });

    it('[4.4-UNIT-017] should skip refund when creditsFromPurchased is negative', async () => {
      await service.refundCredits(tenantId, -1, mockManager as unknown as EntityManager);

      expect(mockManager.query).not.toHaveBeenCalled();
    });
  });

  // ── Negative credit guard (Finding 13) ──────────────────────────

  describe('checkAndDeductCredits — negative credit guard', () => {
    it('[4.4-UNIT-038] should never return negative creditsFromPurchased even if monthlyRemaining exceeds creditsPerRun', async () => {
      // Edge case: monthlyRemaining (100) > creditsPerRun (5)
      // fromMonthly = min(5, 100) = 5, fromPurchased = max(0, 5 - 5) = 0
      mockManager.query
        .mockResolvedValueOnce([{ max_monthly_runs: 100, purchased_credits: 0, max_credits_per_run: 10 }])
        .mockResolvedValueOnce([{ total: 0 }]); // no monthly usage

      const result = await service.checkAndDeductCredits(
        tenantId, 5, false, mockManager as unknown as EntityManager,
      );

      expect(result.creditsFromMonthly).toBe(5);
      expect(result.creditsFromPurchased).toBe(0);
      expect(result.creditsFromPurchased).toBeGreaterThanOrEqual(0);
    });
  });
});
