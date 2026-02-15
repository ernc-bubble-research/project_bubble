import {
  Controller,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import { AccessLogEntryDto } from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantStatusGuard } from '../guards/tenant-status.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SupportAccessReadService } from './support-access-read.service';

/**
 * Customer-facing access log endpoint.
 * Guards: JwtAuthGuard → TenantStatusGuard → RolesGuard (Rule 25: documented order)
 */
@ApiTags('App - Access Log')
@ApiBearerAuth()
@Controller('app/access-log')
@UseGuards(JwtAuthGuard, TenantStatusGuard, RolesGuard)
@Roles(UserRole.CUSTOMER_ADMIN)
export class AccessLogController {
  constructor(
    private readonly supportAccessReadService: SupportAccessReadService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List support access sessions for the requesting tenant' })
  @ApiResponse({ status: 200, description: 'Access log entries', type: [AccessLogEntryDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires CUSTOMER_ADMIN role' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async getAccessLog(
    @Request() req: { user: { tenantId: string } },
  ): Promise<AccessLogEntryDto[]> {
    return this.supportAccessReadService.getAccessLog(req.user.tenantId);
  }
}
