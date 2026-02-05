import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginDto, LoginResponseDto, AcceptInvitationDto, UserResponseDto } from '@project-bubble/shared';
import { AuthService } from './auth.service';
import { InvitationsService } from '../invitations/invitations.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(
    @Request() req: { user: { userId: string } },
  ): Promise<UserResponseDto> {
    return this.authService.getProfile(req.user.userId);
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
