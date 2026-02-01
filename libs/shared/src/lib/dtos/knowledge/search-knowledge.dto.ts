import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchKnowledgeDto {
  @ApiProperty({
    example: 'What are the key themes around trust?',
    description: 'Natural language search query',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  query!: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Maximum number of results to return (1-50)',
    default: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    example: 0.3,
    description: 'Minimum similarity score threshold (0-1)',
    default: 0.3,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  similarityThreshold?: number;
}
