import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InviteUserDto, InvitationResponseDto } from '@project-bubble/shared';
import { UserRole } from '@project-bubble/db-layer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InvitationsService } from './invitations.service';

@ApiTags('App - Invitations')
@ApiBearerAuth()
@Controller('app/invitations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER_ADMIN, UserRole.BUBBLE_ADMIN)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create and send an invitation' })
  create(
    @Body() dto: InviteUserDto,
    @Request()
    req: {
      user: { userId: string; tenantId: string; role: string };
    },
  ): Promise<InvitationResponseDto> {
    return this.invitationsService.create(
      dto,
      req.user.tenantId,
      req.user.userId,
      'Admin',
    );
  }

  @Get()
  @ApiOperation({ summary: 'List invitations for current tenant' })
  findAll(
    @Request() req: { user: { tenantId: string } },
  ): Promise<InvitationResponseDto[]> {
    return this.invitationsService.findAllByTenant(req.user.tenantId);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend an invitation email' })
  resend(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<void> {
    return this.invitationsService.resend(id, req.user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an invitation' })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<void> {
    return this.invitationsService.revoke(id, req.user.tenantId);
  }
}
