import {
  UserEntity,
  UserRole,
  UserStatus,
  TenantEntity,
  TenantStatus,
  PlanTier,
  InvitationEntity,
  InvitationStatus,
} from '../lib/entities';

let counter = 0;
function nextId(): string {
  counter++;
  const hex = counter.toString(16).padStart(12, '0');
  return `00000000-0000-0000-0000-${hex}`;
}

export function createMockUser(
  overrides: Partial<UserEntity> = {},
): UserEntity {
  return {
    id: nextId(),
    email: `user-${counter}@test.com`,
    passwordHash: '$2b$10$precomputedHashForTesting',
    role: UserRole.CREATOR,
    tenantId: '00000000-0000-0000-0000-000000000000',
    status: UserStatus.ACTIVE,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2026-01-31'),
    updatedAt: new Date('2026-01-31'),
    ...overrides,
  } as UserEntity;
}

export function createMockTenant(
  overrides: Partial<TenantEntity> = {},
): TenantEntity {
  return {
    id: nextId(),
    name: `Tenant ${counter}`,
    status: TenantStatus.ACTIVE,
    primaryContact: null,
    planTier: PlanTier.FREE,
    dataResidency: 'eu-west',
    maxMonthlyRuns: 50,
    assetRetentionDays: 30,
    createdAt: new Date('2026-01-31'),
    updatedAt: new Date('2026-01-31'),
    ...overrides,
  } as TenantEntity;
}

export function createMockInvitation(
  overrides: Partial<InvitationEntity> = {},
): InvitationEntity {
  return {
    id: nextId(),
    email: `invited-${counter}@test.com`,
    tokenHash: 'mock-token-hash',
    tokenPrefix: 'mock-tok',
    tenantId: '00000000-0000-0000-0000-000000000000',
    role: UserRole.CREATOR,
    invitedBy: '00000000-0000-0000-0000-000000000001',
    inviterName: 'Admin',
    name: undefined,
    status: InvitationStatus.PENDING,
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    createdAt: new Date('2026-01-31'),
    updatedAt: new Date('2026-01-31'),
    ...overrides,
  } as InvitationEntity;
}

/** Pre-computed bcrypt hash of 'Admin123!' with 10 rounds */
export const MOCK_PASSWORD_HASH =
  '$2b$10$LVJnhE2b9uXigikbTQuwPOIESyNbgyI0O48zVwsNYeHjqExlKLLlC';

/**
 * Reset the factory counter. Call in afterAll() if test ordering matters.
 */
export function resetFactoryCounter(): void {
  counter = 0;
}
