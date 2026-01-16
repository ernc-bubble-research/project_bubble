import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BackendCoreModule } from '@bubble/backend/core';

@Module({
  imports: [BackendCoreModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

