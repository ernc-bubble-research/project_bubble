import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Audit log for support/impersonation sessions.
 *
 * RETENTION: Permanent — no TTL, no cleanup jobs. Audit data for compliance.
 * Do not add purge/cleanup/expiry logic without compliance review.
 *
 * NOTE: No @ManyToOne relations to UserEntity or TenantEntity because this entity
 * lives on the 'migration' DataSource while User/Tenant are on the default DataSource.
 * Cross-DataSource ORM relations are not supported by TypeORM.
 * admin_user_id and tenant_id are stored as plain UUID columns for audit trail purposes.
 * This is intentional: audit logs should survive user/tenant deletion.
 */
@Entity('support_access_log')
export class SupportAccessLogEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'admin_user_id', type: 'uuid' })
  adminUserId!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @CreateDateColumn({ name: 'started_at' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'jwt_token_hash', type: 'varchar', length: 64 })
  jwtTokenHash!: string;
}
