import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  bypassRls: boolean;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getCurrentTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}
