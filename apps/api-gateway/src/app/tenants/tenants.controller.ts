import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  CreateTenantDto,
  ImpersonateResponseDto,
  UpdateTenantDto,
} from '@project-bubble/shared';
import { UserRole } from '@project-bubble/db-layer';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { TenantsService } from './tenants.service';

@Controller('admin/tenants')
@UseGuards(OptionalJwtAuthGuard, AdminApiKeyGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, dto);
  }

  @Post(':id/impersonate')
  impersonate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImpersonateResponseDto> {
    return this.tenantsService.impersonate(id);
  }
}
