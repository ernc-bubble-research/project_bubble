import { Controller, Post, Body } from '@nestjs/common';
import { LoginDto, LoginResponseDto, AcceptInvitationDto } from '@project-bubble/shared';
import { AuthService } from './auth.service';
import { InvitationsService } from '../invitations/invitations.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly invitationsService: InvitationsService,
  ) {}

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('set-password')
  async setPassword(@Body() dto: AcceptInvitationDto): Promise<void> {
    return this.invitationsService.accept(dto);
  }
}
