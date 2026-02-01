import { ApiProperty } from '@nestjs/swagger';
import { KnowledgeChunkResponseDto } from '../asset/knowledge-chunk-response.dto';

export class SearchResultDto extends KnowledgeChunkResponseDto {
  @ApiProperty({
    example: 0.87,
    description: 'Cosine similarity score (0-1, higher is more relevant)',
  })
  similarity!: number;

  @ApiProperty({
    example: 'quarterly-report.pdf',
    description: 'Original filename of the parent asset (null for standalone validated insights)',
    nullable: true,
  })
  assetName!: string | null;
}
