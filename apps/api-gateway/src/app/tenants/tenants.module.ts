import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  TenantEntity,
  UserEntity,
  FolderEntity,
  AssetEntity,
  WorkflowTemplateEntity,
  WorkflowVersionEntity,
  WorkflowChainEntity,
  WorkflowRunEntity,
  KnowledgeChunkEntity,
  InvitationEntity,
} from '@project-bubble/db-layer';
import { AuthModule } from '../auth/auth.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { SupportAccessModule } from '../support-access/support-access.module';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      UserEntity,
      FolderEntity,
      AssetEntity,
      WorkflowTemplateEntity,
      WorkflowVersionEntity,
      WorkflowChainEntity,
      WorkflowRunEntity,
      KnowledgeChunkEntity,
      InvitationEntity,
    ]),
    AuthModule,
    WorkflowsModule,
    SupportAccessModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService, AdminApiKeyGuard, RolesGuard],
  exports: [TenantsService],
})
export class TenantsModule {}
