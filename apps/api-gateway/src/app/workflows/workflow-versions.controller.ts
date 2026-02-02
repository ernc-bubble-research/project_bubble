import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import {
  CreateWorkflowVersionBodyDto,
  WorkflowVersionResponseDto,
} from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkflowVersionsService } from './workflow-versions.service';

@ApiTags('Admin - Workflow Versions')
@ApiBearerAuth()
@Controller('admin/workflow-templates/:templateId/versions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class WorkflowVersionsController {
  constructor(
    private readonly workflowVersionsService: WorkflowVersionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new version for a workflow template' })
  @ApiResponse({ status: 201, description: 'Version created', type: WorkflowVersionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid definition (schema validation failed)' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  createVersion(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: CreateWorkflowVersionBodyDto,
    @Request() req: { user: { userId: string; tenant_id: string } },
  ) {
    return this.workflowVersionsService.createVersion(
      templateId,
      dto.definition,
      req.user.tenant_id,
      req.user.userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all versions for a workflow template' })
  @ApiResponse({ status: 200, description: 'List of versions ordered by version number DESC', type: [WorkflowVersionResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAllByTemplate(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.workflowVersionsService.findAllByTemplate(
      templateId,
      req.user.tenant_id,
    );
  }

  @Get(':versionId')
  @ApiOperation({ summary: 'Get a specific workflow version' })
  @ApiResponse({ status: 200, description: 'Version details', type: WorkflowVersionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  findOne(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.workflowVersionsService.findOne(
      versionId,
      req.user.tenant_id,
    );
  }
}
