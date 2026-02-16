import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { UserRole } from '@project-bubble/db-layer';
import {
  InitiateWorkflowRunDto,
  WorkflowRunResponseDto,
  ListWorkflowRunsQueryDto,
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

  @Get()
  @ApiOperation({ summary: 'List workflow runs for the tenant' })
  @ApiResponse({ status: 200, description: 'Paginated list of workflow runs' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role or tenant suspended' })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query() query: ListWorkflowRunsQueryDto,
  ) {
    return this.workflowRunsService.findAllByTenant(req.user.tenantId, {
      page: query.page,
      limit: query.limit,
      status: query.status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow run details by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Run details including perFileResults and outputAssetIds', type: WorkflowRunResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role or tenant suspended' })
  @ApiResponse({ status: 404, description: 'Run not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<WorkflowRunResponseDto> {
    return this.workflowRunsService.findOneByTenant(id, req.user.tenantId);
  }

  @Get(':id/outputs/:fileIndex')
  @ApiOperation({ summary: 'Download output file by index' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'fileIndex', type: 'number', description: 'Zero-based file index' })
  @ApiResponse({ status: 200, description: 'Raw file stream with Content-Type and Content-Disposition headers' })
  @ApiResponse({ status: 400, description: 'Output not available (status not completed)' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role or tenant suspended' })
  @ApiResponse({ status: 404, description: 'Run or output file not found' })
  async downloadOutput(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileIndex', ParseIntPipe) fileIndex: number,
    @Request() req: { user: { tenantId: string } },
    @Res() res: Response,
  ): Promise<void> {
    const { asset } = await this.workflowRunsService.getOutputFile(
      id,
      fileIndex,
      req.user.tenantId,
    );

    res.set({
      'Content-Type': asset.mimeType,
      'Content-Disposition': `attachment; filename="${asset.originalName.replace(/["\\\/\n\r]/g, '_')}"`,
      'Content-Length': asset.fileSize.toString(),
    });

    const fileStream = createReadStream(asset.storagePath);
    fileStream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to read output file' });
      }
    });
    fileStream.pipe(res);
  }
}
