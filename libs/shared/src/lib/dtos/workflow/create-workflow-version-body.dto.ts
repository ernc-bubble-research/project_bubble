import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';

export class CreateWorkflowVersionBodyDto {
  @ApiProperty({ description: 'The full workflow definition (YAML schema stored as JSON)', type: Object })
  @IsObject()
  @IsNotEmpty()
  definition!: Record<string, unknown>;
}
