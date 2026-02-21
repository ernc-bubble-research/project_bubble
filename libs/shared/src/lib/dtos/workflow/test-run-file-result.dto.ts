import { ApiProperty } from '@nestjs/swagger';

export class TestRunFileResultDto {
  @ApiProperty({ description: 'Index of the file in the execution order (0-based)' })
  fileIndex!: number;

  @ApiProperty({ description: 'Name of the subject file processed' })
  fileName!: string;

  @ApiProperty({ description: 'Fully assembled prompt sent to the LLM' })
  assembledPrompt!: string;

  @ApiProperty({ description: 'Raw response from the LLM' })
  llmResponse!: string;

  @ApiProperty({ enum: ['success', 'failed', 'error'], description: 'Execution status for this file' })
  status!: 'success' | 'failed' | 'error';

  @ApiProperty({ required: false, description: 'Error message if status is error or failed' })
  errorMessage?: string;
}
