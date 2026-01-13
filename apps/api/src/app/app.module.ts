import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DatabaseModule } from '@project_bubble/backend/infra';
import { TenantsModule } from '@project_bubble/backend/tenants';
import { AuthModule } from '@project_bubble/backend/auth';
import { AssetsModule } from '@project_bubble/backend/assets';
import { IngestionModule } from '@project_bubble/backend/ingestion';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    DatabaseModule,
    TenantsModule,
    AuthModule,
    AssetsModule,
    IngestionModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
