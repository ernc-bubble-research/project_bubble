import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FolderEntity } from './folder.entity';
import { WorkflowRunEntity } from './workflow-run.entity';

export enum AssetStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

@Entity('assets')
export class AssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => FolderEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'folder_id' })
  folder?: FolderEntity;

  @Column({ name: 'folder_id', type: 'uuid', nullable: true })
  folderId!: string | null;

  @Column({ name: 'original_name' })
  originalName!: string;

  @Column({ name: 'storage_path' })
  storagePath!: string;

  @Column({ name: 'mime_type' })
  mimeType!: string;

  @Column({ name: 'file_size', type: 'int' })
  fileSize!: number;

  @Column({ name: 'sha256_hash', length: 64 })
  sha256Hash!: string;

  @Column({ name: 'is_indexed', type: 'boolean', default: false })
  isIndexed!: boolean;

  @Column({
    type: 'enum',
    enum: AssetStatus,
    default: AssetStatus.ACTIVE,
  })
  status!: AssetStatus;

  @Column({ name: 'archived_at', type: 'timestamp', nullable: true })
  archivedAt!: Date | null;

  @Column({ name: 'source_type', type: 'varchar', length: 50, default: 'user_upload' })
  sourceType!: string;

  @ManyToOne(() => WorkflowRunEntity, { nullable: true })
  @JoinColumn({ name: 'workflow_run_id' })
  workflowRun?: WorkflowRunEntity;

  @Column({ name: 'workflow_run_id', type: 'uuid', nullable: true })
  workflowRunId!: string | null;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
