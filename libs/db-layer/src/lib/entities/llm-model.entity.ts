import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('llm_models')
@Unique(['providerKey', 'modelId'])
export class LlmModelEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'provider_key', length: 50 })
  providerKey!: string;

  @Column({ name: 'model_id', length: 100 })
  modelId!: string;

  @Column({ name: 'display_name', length: 100 })
  displayName!: string;

  @Column({ name: 'context_window', type: 'int' })
  contextWindow!: number;

  @Column({ name: 'max_output_tokens', type: 'int' })
  maxOutputTokens!: number;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ name: 'cost_per_1k_input', type: 'decimal', precision: 10, scale: 6, nullable: true })
  costPer1kInput!: string | null;

  @Column({ name: 'cost_per_1k_output', type: 'decimal', precision: 10, scale: 6, nullable: true })
  costPer1kOutput!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
