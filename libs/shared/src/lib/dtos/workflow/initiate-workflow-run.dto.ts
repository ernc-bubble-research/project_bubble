import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
  Matches,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
  validateSync,
} from 'class-validator';
import { plainToInstance, Type } from 'class-transformer';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class WorkflowRunInputValueDto {
  @ApiProperty({ enum: ['asset', 'text'], description: 'Type of input value' })
  @IsEnum(['asset', 'text'] as const)
  type!: 'asset' | 'text';

  @ApiProperty({ type: [String], required: false, description: 'Asset IDs from the data vault' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(UUID_REGEX, { each: true, message: 'each assetId must be a valid UUID' })
  assetIds?: string[];

  @ApiProperty({ required: false, description: 'Text content for text-type inputs' })
  @IsOptional()
  @IsString()
  text?: string;
}

// class-validator's @ValidateNested({ each: true }) only iterates Arrays/Sets/Maps,
// not plain-object Records. This custom constraint validates each value explicitly.
@ValidatorConstraint({ name: 'validateRecordValues', async: false })
export class ValidateInputRecordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    for (const val of Object.values(value)) {
      const instance = plainToInstance(WorkflowRunInputValueDto, val as Record<string, unknown>);
      const errors = validateSync(instance);
      if (errors.length > 0) return false;
    }
    return true;
  }

  defaultMessage(): string {
    return 'Each value in inputs must be a valid WorkflowRunInputValueDto (type: asset|text, with valid fields)';
  }
}

export class InitiateWorkflowRunDto {
  @ApiProperty({ description: 'ID of the workflow template to run' })
  @IsNotEmpty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'templateId must be a valid UUID' })
  templateId!: string;

  @ApiProperty({
    description: 'Input values keyed by input name from the workflow definition',
    type: 'object',
    additionalProperties: { type: 'object' },
  })
  @Validate(ValidateInputRecordConstraint)
  @Type(() => WorkflowRunInputValueDto)
  inputs!: Record<string, WorkflowRunInputValueDto>;

  @ApiProperty({
    description: 'Maximum number of retry attempts per file (default: 3, range: 1-10)',
    required: false,
    minimum: 1,
    maximum: 10,
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxRetryCount?: number;
}
