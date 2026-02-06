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
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import {
  CreateLlmProviderConfigDto,
  UpdateLlmProviderConfigDto,
  LlmProviderConfigResponseDto,
} from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LlmProviderConfigService } from './llm-provider-config.service';

@ApiTags('Admin - LLM Provider Config')
@ApiBearerAuth()
@Controller('admin/settings/llm-providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class LlmProviderConfigController {
  constructor(
    private readonly providerConfigService: LlmProviderConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all LLM provider configurations (credentials masked)' })
  @ApiResponse({ status: 200, description: 'List of provider configs with masked credentials', type: [LlmProviderConfigResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll() {
    return this.providerConfigService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new LLM provider configuration' })
  @ApiResponse({ status: 201, description: 'Provider config created', type: LlmProviderConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data or encryption key not configured' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 409, description: 'Duplicate provider_key' })
  create(@Body() dto: CreateLlmProviderConfigDto) {
    return this.providerConfigService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an LLM provider configuration' })
  @ApiResponse({ status: 200, description: 'Provider config updated', type: LlmProviderConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid update data or encryption key not configured' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Provider config not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLlmProviderConfigDto,
  ) {
    return this.providerConfigService.update(id, dto);
  }
}
