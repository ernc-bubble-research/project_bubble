/**
 * Worker Engine — Background Processor
 * This app processes async jobs via BullMQ (configured in later stories).
 * It runs on a separate port from api-gateway to avoid conflicts.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.WORKER_PORT || 3001;
  await app.listen(port);
  Logger.log(`Worker Engine is running on: http://localhost:${port}`);
}

bootstrap();
