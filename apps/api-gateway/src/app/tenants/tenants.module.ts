import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TenantEntity } from '@project-bubble/db-layer';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev_secret_key_change_in_prod'),
        signOptions: { expiresIn: '60m' },
      }),
    }),
  ],
  controllers: [TenantsController],
  providers: [TenantsService, AdminApiKeyGuard],
  exports: [TenantsService],
})
export class TenantsModule {}
