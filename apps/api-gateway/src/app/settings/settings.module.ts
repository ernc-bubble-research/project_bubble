import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LlmProviderConfigEntity } from '@project-bubble/db-layer';
import { LlmProviderConfigService } from './llm-provider-config.service';
import { LlmProviderConfigController } from './llm-provider-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LlmProviderConfigEntity])],
  controllers: [LlmProviderConfigController],
  providers: [LlmProviderConfigService],
  exports: [LlmProviderConfigService],
})
export class SettingsModule implements OnModuleInit {
  private readonly logger = new Logger(SettingsModule.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const encryptionKey = this.configService.get<string>(
      'SETTINGS_ENCRYPTION_KEY',
    );
    if (!encryptionKey) {
      this.logger.warn(
        '⚠️  SETTINGS_ENCRYPTION_KEY is not configured. ' +
          'Provider credential encryption is disabled. ' +
          'Set this environment variable to enable secure credential storage. ' +
          'Generate one with: openssl rand -base64 32',
      );
    }
  }
}
