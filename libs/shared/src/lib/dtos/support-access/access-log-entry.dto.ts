import { IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class AccessLogEntryDto {
  @IsString()
  id!: string;

  @IsString()
  startedAt!: string;

  @ValidateIf((o) => o.endedAt !== null)
  @IsString()
  @IsOptional()
  endedAt!: string | null;

  @IsInt()
  @Min(0)
  actionCount!: number;

  @IsString()
  status!: 'active' | 'completed';
}
