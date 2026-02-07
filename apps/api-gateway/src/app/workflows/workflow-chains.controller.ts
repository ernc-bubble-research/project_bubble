import {
  Controller,
  Get,
  Post,
  Put,
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
  CreateWorkflowChainDto,
  UpdateWorkflowChainDto,
  WorkflowChainResponseDto,
  ListWorkflowChainsQueryDto,
} from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkflowChainsService } from './workflow-chains.service';

@ApiTags('Admin - Workflow Chains')
@ApiBearerAuth()
@Controller('admin/workflow-chains')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class WorkflowChainsController {
  constructor(
    private readonly workflowChainsService: WorkflowChainsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow chain' })
  @ApiResponse({ status: 201, description: 'Chain created', type: WorkflowChainResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data or chain definition validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  create(
    @Body() dto: CreateWorkflowChainDto,
    @Request() req: { user: { userId: string; tenantId: string } },
  ) {
    return this.workflowChainsService.create(
      dto,
      req.user.tenantId,
      req.user.userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List workflow chains with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of chains', type: [WorkflowChainResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query() query: ListWorkflowChainsQueryDto,
  ) {
    return this.workflowChainsService.findAll(req.user.tenantId, {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
      visibility: query.visibility,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow chain by ID' })
  @ApiResponse({ status: 200, description: 'Chain details', type: WorkflowChainResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Chain not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.workflowChainsService.findOne(id, req.user.tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update workflow chain (draft status only)' })
  @ApiResponse({ status: 200, description: 'Chain updated', type: WorkflowChainResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid update data, validation failed, or chain is not draft' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Chain not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowChainDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.workflowChainsService.update(
      id,
      req.user.tenantId,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft-delete workflow chain' })
  @ApiResponse({ status: 204, description: 'Chain soft-deleted' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Chain not found' })
  softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.workflowChainsService.softDelete(id, req.user.tenantId);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted workflow chain' })
  @ApiResponse({ status: 200, description: 'Chain restored', type: WorkflowChainResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Chain not found' })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.workflowChainsService.restore(id, req.user.tenantId);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish a draft workflow chain' })
  @ApiResponse({ status: 200, description: 'Chain published', type: WorkflowChainResponseDto })
  @ApiResponse({ status: 400, description: 'Chain is not draft or has fewer than 2 steps' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Chain not found' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.workflowChainsService.publish(id, req.user.tenantId);
  }
}
