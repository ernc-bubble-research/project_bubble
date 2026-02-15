import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import {
  InitiateWorkflowRunDto,
  WorkflowRunResponseDto,
} from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantStatusGuard } from '../guards/tenant-status.guard';
import { WorkflowRunsService } from './workflow-runs.service';

@ApiTags('Workflow Runs')
@ApiBearerAuth()
@Controller('app/workflow-runs')
@UseGuards(JwtAuthGuard, TenantStatusGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)
export class WorkflowRunsController {
  constructor(private readonly workflowRunsService: WorkflowRunsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate a new workflow run' })
  @ApiResponse({ status: 201, description: 'Run created and enqueued', type: WorkflowRunResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error — missing inputs, invalid assets, template not published' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role or tenant suspended' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  initiateRun(
    @Body() dto: InitiateWorkflowRunDto,
    @Request() req: { user: { tenantId: string; userId: string; role: string } },
  ): Promise<WorkflowRunResponseDto> {
    return this.workflowRunsService.initiateRun(
      dto,
      req.user.tenantId,
      req.user.userId,
      req.user.role,
    );
  }
}
