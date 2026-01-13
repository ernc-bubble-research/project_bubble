import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { DatabaseModule, Asset } from '@project_bubble/backend/infra';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([Asset]),
    BullModule.registerQueue({
      name: 'ingestion',
    }),
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule { }
