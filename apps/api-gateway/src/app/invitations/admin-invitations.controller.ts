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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InvitationsService } from './invitations.service';

@ApiTags('Admin - Invitations')
@ApiBearerAuth()
@Controller('admin/tenants/:tenantId/invitations')
@UseGuards(OptionalJwtAuthGuard, AdminApiKeyGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class AdminInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create and send an invitation (admin)' })
  @ApiResponse({ status: 201, description: 'Invitation created and email sent', type: InvitationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid invitation data or email already registered' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 500, description: 'Email delivery failure' })
  create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: InviteUserDto,
    @Request()
    req: { user: { userId: string } },
  ): Promise<InvitationResponseDto> {
    return this.invitationsService.create(
      dto,
      tenantId,
      req.user.userId,
      'Bubble Admin',
    );
  }

  @Get()
  @ApiOperation({ summary: 'List invitations for a tenant (admin)' })
  @ApiResponse({ status: 200, description: 'List of invitations', type: [InvitationResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<InvitationResponseDto[]> {
    return this.invitationsService.findAllByTenant(tenantId);
  }

  @Post(':id/resend')
  @ApiOperation({ summary: 'Resend an invitation email (admin)' })
  @ApiResponse({ status: 200, description: 'Invitation email resent' })
  @ApiResponse({ status: 400, description: 'Invitation already accepted or expired' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 500, description: 'Email delivery failure' })
  resend(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.invitationsService.resend(id, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an invitation (admin)' })
  @ApiResponse({ status: 200, description: 'Invitation revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  revoke(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.invitationsService.revoke(id, tenantId);
  }
}
