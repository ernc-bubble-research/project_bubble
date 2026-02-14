import { Global, Module } from '@nestjs/common';
import { TransactionManager } from './transaction-manager';

/**
 * Global module providing TransactionManager for tenant-scoped database operations.
 *
 * Prerequisites: The consuming application MUST register these globally BEFORE importing DbLayerModule:
 * - TypeOrmModule.forRoot() — provides DataSource (used by TransactionManager)
 * - ConfigModule.forRoot({ isGlobal: true }) — provides ConfigService
 *
 * Note: RlsSetupService is NOT in this module — it lives in MigrationDatabaseModule
 * where the named 'migration' DataSource is available for DDL operations.
 */
@Global()
@Module({
  providers: [TransactionManager],
  exports: [TransactionManager],
})
export class DbLayerModule {}
