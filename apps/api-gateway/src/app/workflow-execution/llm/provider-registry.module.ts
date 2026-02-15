import { Module } from '@nestjs/common';
import { ProviderRegistry } from './provider-registry.service';

@Module({
  providers: [ProviderRegistry],
  exports: [ProviderRegistry],
})
export class ProviderRegistryModule {}
