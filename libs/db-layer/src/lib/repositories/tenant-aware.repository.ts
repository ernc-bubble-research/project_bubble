import {
  DeleteResult,
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  UpdateResult,
} from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TransactionManager } from '../transaction-manager';

/**
 * Base class for tenant-scoped TypeORM repositories.
 *
 * Pattern: wrapper/composition (NOT TypeORM Repository<T> extension).
 * TypeORM's Repository<T> is sealed by its factory system — subclassing causes
 * runtime failures when the entity manager cannot instantiate the subclass.
 *
 * API: tenantId is the FIRST parameter of every public method.
 * It is NOT stored on the instance — the class is a singleton-safe stateless
 * wrapper. Concurrent requests with different tenantIds use the same instance safely.
 *
 * Two execution paths per method:
 * (a) manager provided → delegate directly (caller is inside an existing txManager.run() transaction)
 * (b) manager omitted → wrap in txManager.run(tenantId, ...) which applies SET LOCAL app.current_tenant
 *
 * ⚠️ NESTED TRANSACTION NOTE: When inside an existing txManager.run() callback, always pass
 * the outer manager to repo method calls. Omitting it creates a nested PostgreSQL SAVEPOINT
 * transaction — functionally safe but wasteful.
 *
 * Do NOT add @Injectable() to this class. Only concrete subclasses (Story 4-5-3) are @Injectable().
 */
export class TenantAwareRepository<T extends ObjectLiteral> {
  constructor(
    protected readonly entityClass: EntityTarget<T>,
    protected readonly txManager: TransactionManager,
  ) {}

  /**
   * Merges tenantId into WHERE clause. Three cases:
   * - undefined → { tenantId }
   * - array → map each element (NOT spread — spread adds a tenantId-only element to the OR list)
   * - object → { ...where, tenantId }
   *
   * Also validates tenantId format — throws on empty string or non-UUID to prevent
   * silent empty-result bugs when a programming error produces a malformed tenantId.
   * Same UUID regex as TransactionManager to keep enforcement consistent.
   */
  private mergeWhere(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[] | undefined,
    tenantId: string,
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    if (
      !tenantId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)
    ) {
      throw new Error('Invalid tenant ID format');
    }
    if (!where) {
      return { tenantId } as unknown as FindOptionsWhere<T>;
    }
    if (Array.isArray(where)) {
      // Map — NOT spread. Spreading adds a tenantId-only element to the OR list.
      // Each OR branch must individually include tenantId.
      return where.map((w) => ({ ...w, tenantId }));
    }
    return { ...where, tenantId };
  }

  // ─── Find-like methods ───────────────────────────────────────────────────

  findOne(
    tenantId: string,
    options: FindOneOptions<T>,
    manager?: EntityManager,
  ): Promise<T | null> {
    const opts = { ...options, where: this.mergeWhere(options.where, tenantId) };
    if (manager) {
      return manager.findOne(this.entityClass, opts);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.findOne(this.entityClass, opts));
  }

  find(
    tenantId: string,
    options?: FindManyOptions<T>,
    manager?: EntityManager,
  ): Promise<T[]> {
    const opts = { ...options, where: this.mergeWhere(options?.where, tenantId) };
    if (manager) {
      return manager.find(this.entityClass, opts);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.find(this.entityClass, opts));
  }

  findAndCount(
    tenantId: string,
    options?: FindManyOptions<T>,
    manager?: EntityManager,
  ): Promise<[T[], number]> {
    const opts = { ...options, where: this.mergeWhere(options?.where, tenantId) };
    if (manager) {
      return manager.findAndCount(this.entityClass, opts);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.findAndCount(this.entityClass, opts));
  }

  count(
    tenantId: string,
    options?: FindManyOptions<T>,
    manager?: EntityManager,
  ): Promise<number> {
    const opts = { ...options, where: this.mergeWhere(options?.where, tenantId) };
    if (manager) {
      return manager.count(this.entityClass, opts);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.count(this.entityClass, opts));
  }

  // ─── Write-like methods ──────────────────────────────────────────────────

  /**
   * countBy is array-safe: TypeORM's countBy accepts FindOptionsWhere<T> | FindOptionsWhere<T>[].
   * Do NOT cast to single FindOptionsWhere<T> — pass mergeWhere result directly.
   */
  countBy(
    tenantId: string,
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
    manager?: EntityManager,
  ): Promise<number> {
    const mergedWhere = this.mergeWhere(where, tenantId);
    if (manager) {
      return manager.countBy(this.entityClass, mergedWhere);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.countBy(this.entityClass, mergedWhere));
  }

  update(
    tenantId: string,
    criteria: FindOptionsWhere<T>,
    partial: QueryDeepPartialEntity<T>,
    manager?: EntityManager,
  ): Promise<UpdateResult> {
    const where = this.mergeWhere(criteria, tenantId) as FindOptionsWhere<T>;
    if (manager) {
      return manager.update(this.entityClass, where, partial);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.update(this.entityClass, where, partial));
  }

  delete(
    tenantId: string,
    criteria: FindOptionsWhere<T>,
    manager?: EntityManager,
  ): Promise<DeleteResult> {
    const where = this.mergeWhere(criteria, tenantId) as FindOptionsWhere<T>;
    if (manager) {
      return manager.delete(this.entityClass, where);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.delete(this.entityClass, where));
  }

  softDelete(
    tenantId: string,
    criteria: FindOptionsWhere<T>,
    manager?: EntityManager,
  ): Promise<UpdateResult> {
    const where = this.mergeWhere(criteria, tenantId) as FindOptionsWhere<T>;
    if (manager) {
      return manager.softDelete(this.entityClass, where);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.softDelete(this.entityClass, where));
  }

  restore(
    tenantId: string,
    criteria: FindOptionsWhere<T>,
    manager?: EntityManager,
  ): Promise<UpdateResult> {
    const where = this.mergeWhere(criteria, tenantId) as FindOptionsWhere<T>;
    if (manager) {
      return manager.restore(this.entityClass, where);
    }
    return this.txManager.run(tenantId, (mgr) => mgr.restore(this.entityClass, where));
  }
}
