import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, Validate } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowRunInputValueDto, ValidateInputRecordConstraint } from './initiate-workflow-run.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ExecuteTestRunDto {
  @ApiProperty({ description: 'ID of the workflow template to test' })
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
}
