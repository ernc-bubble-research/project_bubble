import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginDto, LoginResponseDto, AcceptInvitationDto } from '@project-bubble/shared';
import { AuthService } from './auth.service';
import { InvitationsService } from '../invitations/invitations.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 201, description: 'Login successful', type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('set-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Accept invitation and set password' })
  @ApiResponse({ status: 201, description: 'Password set successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request body or weak password' })
  @ApiResponse({ status: 401, description: 'Invalid or expired invitation token' })
  async setPassword(@Body() dto: AcceptInvitationDto): Promise<void> {
    return this.invitationsService.accept(dto);
  }
}
