export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'archived';
  primaryContact: string | null;
  planTier: 'free' | 'starter' | 'professional' | 'enterprise';
  dataResidency: string;
  maxMonthlyRuns: number;
  assetRetentionDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantPayload {
  name: string;
}

export type UpdateTenantPayload = Partial<
  Pick<
    Tenant,
    | 'name'
    | 'primaryContact'
    | 'planTier'
    | 'dataResidency'
    | 'status'
    | 'maxMonthlyRuns'
    | 'assetRetentionDays'
  >
>;
