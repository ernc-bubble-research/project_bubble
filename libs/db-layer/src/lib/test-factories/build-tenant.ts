import { faker } from '@faker-js/faker';
import { TenantEntity, TenantStatus, PlanTier } from '../entities/tenant.entity';

export function buildTenant(overrides: Partial<TenantEntity> = {}): TenantEntity {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    status: TenantStatus.ACTIVE,
    primaryContact: null,
    planTier: PlanTier.FREE,
    dataResidency: 'eu-west',
    maxMonthlyRuns: 50,
    assetRetentionDays: 30,
    purchasedCredits: 0,
    maxCreditsPerRunLimit: 1000,
    maxCreditsPerRun: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as TenantEntity;
}
