export type UserRole = 'bubble_admin' | 'customer_admin' | 'creator';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
