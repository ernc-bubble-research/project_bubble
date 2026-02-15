import { Injectable } from '@nestjs/common';
import { TransactionManager } from '@project-bubble/db-layer';
import { AccessLogEntryDto } from '@project-bubble/shared';

@Injectable()
export class SupportAccessReadService {
  constructor(
    private readonly txManager: TransactionManager,
  ) {}

  /**
   * Returns the most recent 50 support access sessions for a tenant.
   * Uses TransactionManager to SET LOCAL app.current_tenant within a transaction
   * for RLS enforcement. WHERE clause includes tenant_id for defense-in-depth (Rule 2c).
   */
  async getAccessLog(tenantId: string): Promise<AccessLogEntryDto[]> {
    return this.txManager.run(tenantId, async (manager) => {
      const rows: Array<{
        id: string;
        started_at: Date;
        ended_at: Date | null;
        action_count: string;
      }> = await manager.query(
        `SELECT
          sal.id,
          sal.started_at,
          sal.ended_at,
          (SELECT COUNT(*) FROM support_mutation_log WHERE session_id = sal.id) as action_count
        FROM support_access_log sal
        WHERE sal.tenant_id = $1
        ORDER BY sal.started_at DESC
        LIMIT 50`,
        [tenantId],
      );

      return rows.map((row) => ({
        id: row.id,
        startedAt: row.started_at.toISOString(),
        endedAt: row.ended_at ? row.ended_at.toISOString() : null,
        actionCount: parseInt(row.action_count, 10),
        status: row.ended_at ? ('completed' as const) : ('active' as const),
      }));
    });
  }
}
