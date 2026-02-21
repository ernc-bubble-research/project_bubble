import { ApiProperty } from '@nestjs/swagger';
import { TestRunFileResultDto } from './test-run-file-result.dto';

export class TestRunResultDto {
  @ApiProperty({ description: 'Unique session ID for this test run' })
  sessionId!: string;

  @ApiProperty({ description: 'ID of the workflow template that was tested' })
  templateId!: string;

  @ApiProperty({ description: 'Name of the workflow template' })
  templateName!: string;

  @ApiProperty({
    description: 'Input values provided for the test run',
    type: 'object',
    additionalProperties: { type: 'object' },
  })
  inputs!: Record<string, unknown>;

  @ApiProperty({ type: [TestRunFileResultDto], description: 'Per-file execution results' })
  results!: TestRunFileResultDto[];

  @ApiProperty({ description: 'Timestamp when the test run was executed' })
  executedAt!: Date;
}
