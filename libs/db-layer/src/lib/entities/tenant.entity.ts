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

  @Column({ name: 'primary_contact', type: 'varchar', nullable: true, default: null })
  primaryContact!: string | null;

  @Column({ name: 'plan_tier', type: 'enum', enum: PlanTier, default: PlanTier.FREE })
  planTier!: PlanTier;

  @Column({ name: 'data_residency', default: 'eu-west' })
  dataResidency!: string;

  @Column({ name: 'max_monthly_runs', type: 'int', default: 50 })
  maxMonthlyRuns!: number;

  @Column({ name: 'asset_retention_days', type: 'int', default: 30 })
  assetRetentionDays!: number;

  @Column({ name: 'purchased_credits', type: 'int', default: 0 })
  purchasedCredits!: number;

  @Column({ name: 'max_credits_per_run_limit', type: 'int', default: 1000 })
  maxCreditsPerRunLimit!: number;

  @Column({ name: 'max_credits_per_run', type: 'int', default: 1000 })
  maxCreditsPerRun!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
