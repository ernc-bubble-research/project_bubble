import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { LlmModelsService } from '../workflows/llm-models.service';
import { LlmProviderConfigService } from '../settings/llm-provider-config.service';

export interface CreditDeductionResult {
  creditsFromMonthly: number;
  creditsFromPurchased: number;
}

@Injectable()
export class PreFlightValidationService {
  private readonly logger = new Logger(PreFlightValidationService.name);

  constructor(
    private readonly llmModelsService: LlmModelsService,
    private readonly llmProviderConfigService: LlmProviderConfigService,
  ) {}

  /**
   * Validates that the model referenced by the workflow definition exists and is active,
   * and that its provider config exists and is active.
   */
  async validateModelAvailability(modelUuid: string): Promise<void> {
    const model = await this.llmModelsService.findOneById(modelUuid);
    if (!model) {
      throw new BadRequestException(
        `LLM model "${modelUuid}" not found. Please select a valid model in the workflow definition.`,
      );
    }
    if (!model.isActive) {
      throw new BadRequestException(
        `LLM model "${model.displayName}" (${model.modelId}) is currently inactive. Please activate it or select a different model.`,
      );
    }

    const providerConfig = await this.llmProviderConfigService.findByProviderKey(
      model.providerKey,
    );
    if (!providerConfig) {
      throw new BadRequestException(
        `No provider configuration found for "${model.providerKey}". Please configure the provider in Settings before running workflows.`,
      );
    }
    if (!providerConfig.isActive) {
      throw new BadRequestException(
        `Provider "${providerConfig.displayName}" (${model.providerKey}) is currently inactive. Please activate it in Settings.`,
      );
    }
  }

  /**
   * Checks credit availability and deducts credits within an existing transaction.
   * Uses SELECT FOR UPDATE on the tenant row to prevent concurrent double-spend.
   *
   * @param tenantId - The tenant ID
   * @param creditsPerRun - Cost of this workflow run
   * @param isTestRun - If true, skip all checks and return {0, 0}
   * @param manager - The EntityManager from the active transaction (must already have FOR UPDATE lock)
   */
  async checkAndDeductCredits(
    tenantId: string,
    creditsPerRun: number,
    isTestRun: boolean,
    manager: EntityManager,
  ): Promise<CreditDeductionResult> {
    // Test runs bypass all credit checks
    if (isTestRun) {
      return { creditsFromMonthly: 0, creditsFromPurchased: 0 };
    }

    // Tenant row must already be locked via SELECT FOR UPDATE by the caller.
    // Load tenant data from the locked row.
    const tenantRows = await manager.query(
      'SELECT max_monthly_runs, purchased_credits, max_credits_per_run FROM tenants WHERE id = $1',
      [tenantId],
    );
    if (!tenantRows.length) {
      throw new BadRequestException(`Tenant "${tenantId}" not found`);
    }
    const tenant = tenantRows[0];
    const maxMonthlyRuns = tenant.max_monthly_runs;
    const purchasedCredits = tenant.purchased_credits;
    const maxCreditsPerRun = tenant.max_credits_per_run;

    // Per-run cap check (AC1)
    if (creditsPerRun > maxCreditsPerRun) {
      throw new BadRequestException(
        `This workflow exceeds your organization's per-run credit limit of ${maxCreditsPerRun}. Please contact your administrator to adjust it.`,
      );
    }

    // Monthly usage query — derived from SUM, no stored balance (AC4)
    const monthlyResult = await manager.query(
      `SELECT COALESCE(SUM(credits_from_monthly), 0)::int as total
       FROM workflow_runs
       WHERE tenant_id = $1
         AND is_test_run = false
         AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')`,
      [tenantId],
    );
    const monthlyUsed = monthlyResult[0]?.total ?? 0;
    const monthlyRemaining = Math.max(0, maxMonthlyRuns - monthlyUsed);

    // Compute deduction split — monthly first (AC3)
    const fromMonthly = Math.min(creditsPerRun, monthlyRemaining);
    const fromPurchased = Math.max(0, creditsPerRun - fromMonthly);

    // Check purchased credit sufficiency (AC2)
    if (fromPurchased > purchasedCredits) {
      throw new BadRequestException(
        'Insufficient credits to run this workflow. Please contact your administrator.',
      );
    }

    // Deduct purchased credits if needed (AC5)
    if (fromPurchased > 0) {
      await manager.query(
        'UPDATE tenants SET purchased_credits = purchased_credits - $1 WHERE id = $2',
        [fromPurchased, tenantId],
      );
    }

    return { creditsFromMonthly: fromMonthly, creditsFromPurchased: fromPurchased };
  }

  /**
   * Refunds credits back to tenant when a run fails.
   * Must be called within a transaction that has a FOR UPDATE lock on the tenant row.
   */
  async refundCredits(
    tenantId: string,
    creditsFromPurchased: number,
    manager: EntityManager,
  ): Promise<void> {
    if (creditsFromPurchased <= 0) {
      return;
    }

    await manager.query(
      'UPDATE tenants SET purchased_credits = purchased_credits + $1 WHERE id = $2',
      [creditsFromPurchased, tenantId],
    );

    this.logger.log({
      message: 'Credits refunded to tenant',
      tenantId,
      creditsFromPurchased,
    });
  }
}
