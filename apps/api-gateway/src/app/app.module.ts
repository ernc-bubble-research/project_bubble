import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { DbLayerModule } from '@project-bubble/db-layer';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { InvitationsModule } from './invitations/invitations.module';
import { AssetsModule } from './assets/assets.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { SettingsModule } from './settings/settings.module';
import { WorkflowExecutionModule } from './workflow-execution/workflow-execution.module';
import { WorkflowRunsModule } from './workflow-runs/workflow-runs.module';
import { SupportAccessModule } from './support-access/support-access.module';
import { SupportMutationInterceptor } from './interceptors/support-mutation.interceptor';
import { MigrationDatabaseModule, MIGRATION_DB_READY } from './migration-database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Migration DataSource: bubble_user (superuser), synchronize: true, schema sync + RLS setup
    MigrationDatabaseModule,
    // Default (app) DataSource: bubble_app (non-superuser), synchronize: false
    // Factory injects MIGRATION_DB_READY to guarantee migration DS finishes first
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule, MigrationDatabaseModule],
      useFactory: (config: ConfigService, _migrationReady: boolean /* injection guarantees boot order */) => {
        const dbAppUser = config.get<string>('DB_APP_USER', 'bubble_app');
        const dbAppPassword = config.get<string>('DB_APP_PASSWORD', 'bubble_password');
        const host = config.get<string>('POSTGRES_HOST', 'localhost');
        const port = config.get<number>('POSTGRES_PORT', 5432);
        const db = config.get<string>('POSTGRES_DB', 'bubble_db');

        return {
          type: 'postgres',
          host,
          port,
          username: dbAppUser,
          password: dbAppPassword,
          database: db,
          autoLoadEntities: true,
          synchronize: false, // Schema synced by migration DS — no sync needed here
        };
      },
      inject: [ConfigService, MIGRATION_DB_READY],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    DbLayerModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    InvitationsModule,
    AssetsModule,
    IngestionModule,
    KnowledgeModule,
    WorkflowsModule,
    SettingsModule,
    WorkflowExecutionModule,
    WorkflowRunsModule,
    SupportAccessModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SupportMutationInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
