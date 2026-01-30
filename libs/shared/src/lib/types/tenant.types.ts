export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantPayload {
  name: string;
}
