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
import { InviteUserDto, InvitationResponseDto } from '@project-bubble/shared';
import { UserRole } from '@project-bubble/db-layer';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InvitationsService } from './invitations.service';

@Controller('admin/tenants/:tenantId/invitations')
@UseGuards(OptionalJwtAuthGuard, AdminApiKeyGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class AdminInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
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
  findAll(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<InvitationResponseDto[]> {
    return this.invitationsService.findAllByTenant(tenantId);
  }

  @Post(':id/resend')
  resend(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.invitationsService.resend(id, tenantId);
  }

  @Delete(':id')
  revoke(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.invitationsService.revoke(id, tenantId);
  }
}
