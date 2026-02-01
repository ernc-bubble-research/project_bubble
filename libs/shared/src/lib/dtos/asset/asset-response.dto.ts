import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssetResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  tenantId!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  folderId!: string | null;

  @ApiProperty({ example: 'quarterly-report.pdf' })
  originalName!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 102400 })
  fileSize!: number;

  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  sha256Hash!: string;

  @ApiProperty({ example: false, description: 'Whether this file has been indexed into the Knowledge Base' })
  isIndexed!: boolean;

  @ApiProperty({ example: 'active', enum: ['active', 'archived'] })
  status!: string;

  @ApiPropertyOptional()
  archivedAt!: Date | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  uploadedBy!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
