import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import { WorkflowTemplateResponseDto } from '@project-bubble/shared';
import { PickType } from '@nestjs/swagger';
import { ListWorkflowTemplatesQueryDto } from '@project-bubble/shared';

/** Expose only limit/offset in Swagger — status & visibility are irrelevant for the catalog. */
class CatalogQueryDto extends PickType(ListWorkflowTemplatesQueryDto, [
  'limit',
  'offset',
] as const) {}
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantStatusGuard } from '../guards/tenant-status.guard';
import { WorkflowTemplatesService } from './workflow-templates.service';

@ApiTags('Workflow Catalog')
@ApiBearerAuth()
@Controller('app/workflow-templates')
@UseGuards(JwtAuthGuard, TenantStatusGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)
export class WorkflowCatalogController {
  constructor(
    private readonly workflowTemplatesService: WorkflowTemplatesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List published workflow templates accessible to the calling tenant' })
  @ApiResponse({ status: 200, description: 'List of accessible published templates', type: [WorkflowTemplateResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findPublished(
    @Request() req: { user: { tenantId: string } },
    @Query() query: CatalogQueryDto,
  ): Promise<WorkflowTemplateResponseDto[]> {
    return this.workflowTemplatesService.findPublished(req.user.tenantId, {
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a published workflow template by ID (includes current version definition)' })
  @ApiResponse({ status: 200, description: 'Template with current version details', type: WorkflowTemplateResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<WorkflowTemplateResponseDto> {
    return this.workflowTemplatesService.findOne(id, req.user.tenantId);
  }
}
