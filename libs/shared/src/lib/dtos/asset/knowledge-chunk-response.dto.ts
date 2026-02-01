import { ApiProperty } from '@nestjs/swagger';

export class KnowledgeChunkResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  assetId!: string;

  @ApiProperty({ example: 'This is the extracted text content of a chunk...' })
  content!: string;

  @ApiProperty({ example: 0, description: 'Zero-based index of this chunk within the asset' })
  chunkIndex!: number;

  @ApiProperty({
    example: { charStart: 0, charEnd: 2000 },
    description: 'Chunk metadata (character offsets, optional page number)',
  })
  metadata!: Record<string, unknown>;
}
