import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SupportAccessLogEntity,
  SupportMutationLogEntity,
} from '@project-bubble/db-layer';
import { SupportAccessService } from './support-access.service';
import { SupportAccessController } from './support-access.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [SupportAccessLogEntity, SupportMutationLogEntity],
      'migration',
    ),
    AuthModule,
  ],
  controllers: [SupportAccessController],
  providers: [SupportAccessService, AdminApiKeyGuard, RolesGuard],
  exports: [SupportAccessService],
})
export class SupportAccessModule {}
