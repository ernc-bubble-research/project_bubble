import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IngestionModule } from '@bubble/backend/ingestion';

@Module({
  imports: [IngestionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

