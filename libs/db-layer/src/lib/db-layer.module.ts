import { Global, Module } from '@nestjs/common';
import { RlsSetupService } from './rls-setup.service';
import { TransactionManager } from './transaction-manager';

/**
 * Global module providing TransactionManager and RLS setup.
 *
 * Prerequisites: The consuming application MUST register these globally BEFORE importing DbLayerModule:
 * - TypeOrmModule.forRoot() — provides DataSource (used by TransactionManager + RlsSetupService)
 * - ConfigModule.forRoot({ isGlobal: true }) — provides ConfigService (used by RlsSetupService)
 */
@Global()
@Module({
  providers: [TransactionManager, RlsSetupService],
  exports: [TransactionManager],
})
export class DbLayerModule {}
