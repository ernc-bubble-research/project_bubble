import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  ARCHIVED = 'archived',
}

export enum PlanTier {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

@Entity('tenants')
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, nullable: false })
  name!: string;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.ACTIVE })
  status!: TenantStatus;

  @Column({ name: 'primary_contact', nullable: true, default: null })
  primaryContact!: string | null;

  @Column({ name: 'plan_tier', type: 'enum', enum: PlanTier, default: PlanTier.FREE })
  planTier!: PlanTier;

  @Column({ name: 'data_residency', default: 'eu-west' })
  dataResidency!: string;

  @Column({ name: 'max_monthly_runs', type: 'int', default: 50 })
  maxMonthlyRuns!: number;

  @Column({ name: 'asset_retention_days', type: 'int', default: 30 })
  assetRetentionDays!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
