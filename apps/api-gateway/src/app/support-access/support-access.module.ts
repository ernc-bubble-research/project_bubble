import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SupportAccessLogEntity,
  SupportMutationLogEntity,
} from '@project-bubble/db-layer';
import { SupportAccessService } from './support-access.service';
import { SupportAccessReadService } from './support-access-read.service';
import { SupportAccessController } from './support-access.controller';
import { AccessLogController } from './access-log.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantStatusGuard } from '../guards/tenant-status.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [SupportAccessLogEntity, SupportMutationLogEntity],
      'migration',
    ),
    AuthModule,
  ],
  controllers: [SupportAccessController, AccessLogController],
  providers: [
    SupportAccessService,
    SupportAccessReadService,
    AdminApiKeyGuard,
    RolesGuard,
    TenantStatusGuard,
  ],
  exports: [SupportAccessService],
})
export class SupportAccessModule {}
