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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InviteUserDto, InvitationResponseDto } from '@project-bubble/shared';
import { UserRole } from '@project-bubble/db-layer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantStatusGuard } from '../guards/tenant-status.guard';
import { InvitationsService } from './invitations.service';

@ApiTags('App - Invitations')
@ApiBearerAuth()
@Controller('app/invitations')
@UseGuards(JwtAuthGuard, TenantStatusGuard, RolesGuard)
@Roles(UserRole.CUSTOMER_ADMIN, UserRole.BUBBLE_ADMIN)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create and send an invitation' })
  @ApiResponse({ status: 201, description: 'Invitation created and email sent', type: InvitationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid invitation data or email already registered' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 500, description: 'Email delivery failure' })
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
  @ApiResponse({ status: 200, description: 'List of invitations', type: [InvitationResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll(
    @Request() req: { user: { tenantId: string } },
  ): Promise<InvitationResponseDto[]> {
    return this.invitationsService.findAllByTenant(req.user.tenantId);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend an invitation email' })
  @ApiResponse({ status: 200, description: 'Invitation email resent' })
  @ApiResponse({ status: 400, description: 'Invitation already accepted or expired' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 500, description: 'Email delivery failure' })
  resend(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<void> {
    return this.invitationsService.resend(id, req.user.tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<void> {
    return this.invitationsService.revoke(id, req.user.tenantId);
  }
}
