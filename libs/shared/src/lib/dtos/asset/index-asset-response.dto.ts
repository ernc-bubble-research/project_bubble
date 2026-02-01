import { ApiProperty } from '@nestjs/swagger';

export class IndexAssetResponseDto {
  @ApiProperty({ example: 'job-550e8400-e29b-41d4-a716-446655440000' })
  jobId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  assetId!: string;

  @ApiProperty({ example: 'queued', description: 'Indexing job status' })
  status!: string;
}
