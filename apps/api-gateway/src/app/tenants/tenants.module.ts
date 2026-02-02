import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from '@project-bubble/db-layer';
import { AuthModule } from '../auth/auth.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity]), AuthModule, WorkflowsModule],
  controllers: [TenantsController],
  providers: [TenantsService, AdminApiKeyGuard, RolesGuard],
  exports: [TenantsService],
})
export class TenantsModule {}
