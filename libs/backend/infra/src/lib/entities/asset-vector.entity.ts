import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Asset } from './asset.entity';

@Entity('asset_vectors')
export class AssetVector {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column('text')
    content!: string;

    // Note: 'vector' type is provided by pgvector extension. 
    // We specify dimensionality (e.g., 768 for Gemini, 1536 for OpenAI)
    // For prototype, we use 'vector', TypeORM handles it basically as string/array.
    @Column({ type: 'vector', nullable: true })
    embedding!: number[];

    @Column({ type: 'jsonb', default: {} })
    metadata!: Record<string, any>;

    @Column({ name: 'asset_id', type: 'uuid' })
    assetId!: string;

    @ManyToOne(() => Asset)
    @JoinColumn({ name: 'asset_id' })
    asset!: Asset;
}
