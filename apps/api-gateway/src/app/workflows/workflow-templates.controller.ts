import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import {
  CreateWorkflowTemplateDto,
  UpdateWorkflowTemplateDto,
  WorkflowTemplateResponseDto,
  ListWorkflowTemplatesQueryDto,
  PublishWorkflowTemplateDto,
} from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkflowTemplatesService } from './workflow-templates.service';

@ApiTags('Admin - Workflow Templates')
@ApiBearerAuth()
@Controller('admin/workflow-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class WorkflowTemplatesController {
  constructor(
    private readonly workflowTemplatesService: WorkflowTemplatesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow template' })
  @ApiResponse({ status: 201, description: 'Template created', type: WorkflowTemplateResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  create(
    @Body() dto: CreateWorkflowTemplateDto,
    @Request() req: { user: { userId: string; tenant_id: string } },
  ) {
    return this.workflowTemplatesService.create(
      dto,
      req.user.tenant_id,
      req.user.userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List workflow templates with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of templates', type: [WorkflowTemplateResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll(
    @Request() req: { user: { tenant_id: string } },
    @Query() query: ListWorkflowTemplatesQueryDto,
  ) {
    return this.workflowTemplatesService.findAll(req.user.tenant_id, {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      visibility: query.visibility,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow template by ID with current version' })
  @ApiResponse({ status: 200, description: 'Template details with current version', type: WorkflowTemplateResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.workflowTemplatesService.findOne(id, req.user.tenant_id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update workflow template metadata' })
  @ApiResponse({ status: 200, description: 'Template updated', type: WorkflowTemplateResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowTemplateDto,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.workflowTemplatesService.update(
      id,
      req.user.tenant_id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete workflow template' })
  @ApiResponse({ status: 204, description: 'Template soft-deleted' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.workflowTemplatesService.softDelete(id, req.user.tenant_id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted workflow template' })
  @ApiResponse({ status: 200, description: 'Template restored', type: WorkflowTemplateResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.workflowTemplatesService.restore(id, req.user.tenant_id);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish a workflow template or promote a specific version' })
  @ApiResponse({ status: 200, description: 'Template published', type: WorkflowTemplateResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid publish request (no version, wrong status)' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Template or version not found' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishWorkflowTemplateDto,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.workflowTemplatesService.publish(
      id,
      req.user.tenant_id,
      dto.versionId,
    );
  }

  @Post(':id/rollback/:versionId')
  @ApiOperation({ summary: 'Roll back a published template to a specific version' })
  @ApiResponse({ status: 200, description: 'Template rolled back to specified version', type: WorkflowTemplateResponseDto })
  @ApiResponse({ status: 400, description: 'Template is not published' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Template or version not found' })
  rollback(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.workflowTemplatesService.rollback(
      id,
      req.user.tenant_id,
      versionId,
    );
  }
}
