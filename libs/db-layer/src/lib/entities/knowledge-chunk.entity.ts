import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AssetEntity } from './asset.entity';

@Entity('knowledge_chunks')
export class KnowledgeChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AssetEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'asset_id' })
  asset?: AssetEntity;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId!: string | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex!: number;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  // pgvector column — stored as float8[] by TypeORM, then ALTER'd to vector(768)
  // by RlsSetupService on startup for HNSW index support.
  // Query with pgvector operators (e.g., <=> for cosine distance) via raw SQL.
  @Column({ type: 'float8', array: true, nullable: true })
  embedding!: number[] | null;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified!: boolean;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
