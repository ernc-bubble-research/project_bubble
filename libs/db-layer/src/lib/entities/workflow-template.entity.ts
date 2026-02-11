import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

export enum WorkflowTemplateStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum WorkflowVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

@Entity('workflow_templates')
@Index(['status', 'visibility'])
export class WorkflowTemplateEntity {
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

  @Column({
    type: 'enum',
    enum: WorkflowTemplateStatus,
    default: WorkflowTemplateStatus.DRAFT,
  })
  status!: WorkflowTemplateStatus;

  @Column({ name: 'current_version_id', type: 'uuid', nullable: true })
  currentVersionId!: string | null;

  @Column({ name: 'credits_per_run', type: 'int', default: 1 })
  creditsPerRun!: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
