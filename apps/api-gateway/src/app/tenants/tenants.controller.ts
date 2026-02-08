import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  CreateTenantDto,
  ImpersonateResponseDto,
  UpdateTenantDto,
  WorkflowTemplateResponseDto,
} from '@project-bubble/shared';
import { UserRole } from '@project-bubble/db-layer';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { TenantsService } from './tenants.service';
import { WorkflowTemplatesService } from '../workflows/workflow-templates.service';

@ApiTags('Admin - Tenants')
@ApiBearerAuth()
@Controller('admin/tenants')
@UseGuards(OptionalJwtAuthGuard, AdminApiKeyGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly workflowTemplatesService: WorkflowTemplatesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid tenant data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  @ApiResponse({ status: 200, description: 'List of all tenants' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id/accessible-workflows')
  @ApiOperation({ summary: 'List workflow templates accessible to a specific tenant' })
  @ApiResponse({ status: 200, description: 'List of accessible workflow templates', type: [WorkflowTemplateResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getAccessibleWorkflows(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WorkflowTemplateResponseDto[]> {
    // Verify tenant exists first
    await this.tenantsService.findOne(id);
    return this.workflowTemplatesService.findAccessibleByTenant(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  @ApiResponse({ status: 400, description: 'Invalid tenant data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, dto);
  }

  @Post(':id/impersonate')
  @ApiOperation({ summary: 'Impersonate a tenant (admin only)' })
  @ApiResponse({ status: 201, description: 'Impersonation token generated', type: ImpersonateResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  impersonate(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { userId: string } },
  ): Promise<ImpersonateResponseDto> {
    return this.tenantsService.impersonate(id, req.user.userId);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant archived successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition or UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.archive(id);
  }

  @Patch(':id/unarchive')
  @ApiOperation({ summary: 'Unarchive a tenant (restore to active)' })
  @ApiResponse({ status: 200, description: 'Tenant unarchived successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition or UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  unarchive(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.unarchive(id);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Permanently delete a tenant and all associated data' })
  @ApiResponse({ status: 200, description: 'Tenant permanently deleted' })
  @ApiResponse({ status: 400, description: 'Tenant must be archived before deletion' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.hardDelete(id);
  }
}
