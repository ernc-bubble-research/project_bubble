import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from '@project-bubble/db-layer';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity])],
  controllers: [TenantsController],
  providers: [TenantsService, AdminApiKeyGuard],
  exports: [TenantsService],
})
export class TenantsModule {}
