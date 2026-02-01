import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KnowledgeChunkResponseDto } from '../asset/knowledge-chunk-response.dto';

export class ValidatedInsightResponseDto extends KnowledgeChunkResponseDto {
  @ApiProperty({ example: true, description: 'Whether this chunk is a verified insight' })
  isVerified!: boolean;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID of the user who verified/created the insight',
  })
  verifiedBy!: string;

  @ApiProperty({
    example: '2026-02-01T12:00:00.000Z',
    description: 'ISO timestamp when the insight was verified',
  })
  verifiedAt!: string;

  @ApiProperty({
    example: 'report_feedback',
    description: 'Source type of the insight',
  })
  sourceType!: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'UUID of the originating workflow run',
    nullable: true,
  })
  sourceRunId!: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'UUID of the originating report',
    nullable: true,
  })
  sourceReportId!: string | null;
}
