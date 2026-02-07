import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { getCurrentTenantContext } from './tenant-context';

@Injectable()
export class TransactionManager {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T>;
  async run<T>(
    tenantId: string,
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T>;
  async run<T>(
    tenantIdOrCallback:
      | string
      | ((manager: EntityManager) => Promise<T>),
    maybeCallback?: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    let tenantId: string | undefined;
    let callback: (manager: EntityManager) => Promise<T>;

    if (typeof tenantIdOrCallback === 'string') {
      tenantId = tenantIdOrCallback;
      callback =
        maybeCallback as (manager: EntityManager) => Promise<T>;
    } else {
      callback = tenantIdOrCallback;
      const ctx = getCurrentTenantContext();
      if (ctx && !ctx.bypassRls) {
        tenantId = ctx.tenantId;
      }
    }

    return this.dataSource.transaction(async (manager) => {
      if (tenantId) {
        // SET LOCAL does not support parameterized queries in PostgreSQL.
        // Validate UUID format to prevent SQL injection.
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
          throw new Error(`Invalid tenant ID format: ${tenantId}`);
        }
        await manager.query(`SET LOCAL app.current_tenant = '${tenantId}'`);
      }
      return callback(manager);
    });
  }
}
