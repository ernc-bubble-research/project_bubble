import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module';
import { KnowledgeSearchService } from './knowledge-search.service';
import { ValidatedInsightService } from './validated-insight.service';
import { KnowledgeController } from './knowledge.controller';

@Module({
  imports: [IngestionModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeSearchService, ValidatedInsightService],
  exports: [KnowledgeSearchService, ValidatedInsightService],
})
export class KnowledgeModule {}
