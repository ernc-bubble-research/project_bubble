import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from './tenant.entity';

export enum UserRole {
    BUBBLE_ADMIN = 'BubbleAdmin',
    CUSTOMER_ADMIN = 'CustomerAdmin',
    CREATOR = 'Creator',
    GUEST = 'Guest',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ unique: true })
    email!: string;

    @Column({ name: 'password_hash', nullable: true })
    passwordHash!: string; // Nullable for SSO/Magic Link users

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.CREATOR,
    })
    role!: UserRole;

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
