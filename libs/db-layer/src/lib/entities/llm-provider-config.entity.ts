import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('llm_provider_configs')
export class LlmProviderConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'provider_key', length: 50, unique: true })
  providerKey!: string;

  @Column({ name: 'display_name', length: 100 })
  displayName!: string;

  @Column({ name: 'encrypted_credentials', type: 'text', nullable: true })
  encryptedCredentials!: string | null;

  @Column({ name: 'rate_limit_rpm', type: 'int', nullable: true })
  rateLimitRpm!: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
