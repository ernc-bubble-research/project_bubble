import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RlsSetupService } from '@project-bubble/db-layer';

/**
 * Injection token that signals the migration DataSource has fully initialized
 * (schema synced + bubble_app role provisioned).
 * The default (app) DataSource factory injects this token to guarantee boot order.
 */
export const MIGRATION_DB_READY = Symbol('MIGRATION_DB_READY');

/**
 * MigrationDatabaseModule — hosts the superuser DataSource for schema sync + DDL.
 *
 * Boot sequence:
 * 1. TypeORM named DataSource ('migration') initializes → runs synchronize: true
 *    (TypeORM synchronize executes during DataSource.initialize(), before NestJS onModuleInit)
 * 2. RlsSetupService is instantiated (injects migration DataSource)
 * 3. MIGRATION_DB_READY async factory runs → creates bubble_app role + grants
 *    (MUST complete before default DS connects as bubble_app)
 * 4. Default DS factory (in AppModule) injects MIGRATION_DB_READY → waits for step 3
 * 5. Default DS connects as bubble_app to fully synced schema
 * 6. onModuleInit phase: RlsSetupService runs full setup (RLS policies, seeds, etc.)
 *    Role creation is idempotent — re-runs harmlessly.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'migration',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true, // DEV ONLY — superuser role syncs schema
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    RlsSetupService,
    {
      provide: MIGRATION_DB_READY,
      useFactory: async (rlsSetup: RlsSetupService, config: ConfigService) => {
        // In development, create bubble_app role + grants BEFORE default DS connects.
        // synchronize has already run (DataSource.initialize), so tables exist.
        // These methods are idempotent — safe to re-run in onModuleInit later.
        if (config.get<string>('NODE_ENV') === 'development') {
          await rlsSetup.createAppRole();
          await rlsSetup.grantAppPermissions();
          await rlsSetup.setDefaultPrivileges();
        }
        return true;
      },
      inject: [RlsSetupService, ConfigService],
    },
  ],
  exports: [MIGRATION_DB_READY],
})
export class MigrationDatabaseModule {}
