import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from './tenant.entity';

export enum AssetStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
}

@Entity('assets')
export class Asset {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'original_name' })
    originalName!: string;

    @Column({ name: 'storage_path' })
    storagePath!: string;

    @Column({ name: 'mime_type' })
    mimeType!: string;

    @Column({
        type: 'enum',
        enum: AssetStatus,
        default: AssetStatus.PENDING,
    })
    status!: AssetStatus;

    @Column({ name: 'tenant_id', type: 'uuid' })
    tenantId!: string;

    @ManyToOne(() => Tenant)
    @JoinColumn({ name: 'tenant_id' })
    tenant!: Tenant;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
