import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionProcessor } from './ingestion.processor';
import { DatabaseModule, Asset, AssetVector } from '@project_bubble/backend/infra';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([Asset, AssetVector]),
    BullModule.registerQueue({
      name: 'ingestion',
    }),
  ],
  providers: [IngestionProcessor],
  exports: [],
})
export class IngestionModule { }
