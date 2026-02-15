import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import { EndSessionDto } from '@project-bubble/shared';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { SupportAccessService } from './support-access.service';

@ApiTags('Admin - Support Access')
@ApiBearerAuth()
@Controller('admin/tenants/impersonation')
@UseGuards(OptionalJwtAuthGuard, AdminApiKeyGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class SupportAccessController {
  constructor(
    private readonly supportAccessService: SupportAccessService,
  ) {}

  @Post('end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End an impersonation session (close audit trail)' })
  @ApiResponse({ status: 200, description: 'Session ended successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires BUBBLE_ADMIN role or session ownership' })
  async endSession(
    @Body() dto: EndSessionDto,
    @Req() req: { user: { userId: string } },
  ): Promise<{ ok: true }> {
    await this.supportAccessService.logSessionEnd(dto.sessionId, req.user.userId);
    return { ok: true };
  }
}
