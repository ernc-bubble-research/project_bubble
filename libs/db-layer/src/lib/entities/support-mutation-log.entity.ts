import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SupportAccessLogEntity } from './support-access-log.entity';

@Entity('support_mutation_log')
export class SupportMutationLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @ManyToOne(() => SupportAccessLogEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session?: SupportAccessLogEntity;

  @Column({ name: 'http_method', type: 'varchar', length: 10 })
  httpMethod!: string;

  @Column({ name: 'url_path', type: 'varchar', length: 500 })
  urlPath!: string;

  @Column({ name: 'status_code', type: 'int' })
  statusCode!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
