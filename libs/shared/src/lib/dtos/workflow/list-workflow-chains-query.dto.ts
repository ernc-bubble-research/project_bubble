import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class ListWorkflowChainsQueryDto {
  @ApiPropertyOptional({
    example: 50,
    description: 'Maximum number of chains to return (1-200)',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Number of chains to skip for pagination',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    enum: ['draft', 'published', 'archived'],
    description: 'Filter by chain status',
  })
  @IsOptional()
  @IsEnum(['draft', 'published', 'archived'] as const)
  status?: 'draft' | 'published' | 'archived';

  @ApiPropertyOptional({
    enum: ['public', 'private'],
    description: 'Filter by visibility',
  })
  @IsOptional()
  @IsEnum(['public', 'private'] as const)
  visibility?: 'public' | 'private';
}
