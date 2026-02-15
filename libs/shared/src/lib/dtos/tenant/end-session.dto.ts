import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class EndSessionDto {
  @ApiProperty({ description: 'Support access session ID to close' })
  @IsNotEmpty()
  @Matches(UUID_REGEX, { message: 'sessionId must be a valid UUID' })
  sessionId!: string;
}
