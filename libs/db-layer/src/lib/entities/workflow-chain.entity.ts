import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { WorkflowVisibility } from './workflow-template.entity';

export enum WorkflowChainStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('workflow_chains')
@Index(['status', 'visibility'])
export class WorkflowChainEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: WorkflowVisibility,
    default: WorkflowVisibility.PUBLIC,
  })
  visibility!: WorkflowVisibility;

  @Column({ name: 'allowed_tenants', type: 'uuid', array: true, nullable: true })
  allowedTenants!: string[] | null;

  @Column({ type: 'jsonb' })
  definition!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: WorkflowChainStatus,
    default: WorkflowChainStatus.DRAFT,
  })
  status!: WorkflowChainStatus;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
