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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import {
  CreateLlmModelDto,
  UpdateLlmModelDto,
  LlmModelResponseDto,
  BulkUpdateModelStatusDto,
} from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantStatusGuard } from '../guards/tenant-status.guard';
import { LlmModelsService } from './llm-models.service';

@ApiTags('LLM Models')
@ApiBearerAuth()
@Controller('app/llm-models')
@UseGuards(JwtAuthGuard, TenantStatusGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)
export class AppLlmModelsController {
  constructor(private readonly llmModelsService: LlmModelsService) {}

  @Get()
  @ApiOperation({ summary: 'List active LLM models (all authenticated users)' })
  @ApiResponse({ status: 200, description: 'List of active LLM models', type: [LlmModelResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAllActive() {
    return this.llmModelsService.findAllActive();
  }
}

@ApiTags('Admin - LLM Models')
@ApiBearerAuth()
@Controller('admin/llm-models')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class AdminLlmModelsController {
  constructor(private readonly llmModelsService: LlmModelsService) {}

  @Get()
  @ApiOperation({ summary: 'List all LLM models (including inactive)' })
  @ApiResponse({ status: 200, description: 'List of all LLM models', type: [LlmModelResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll() {
    return this.llmModelsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new LLM model' })
  @ApiResponse({ status: 201, description: 'Model created', type: LlmModelResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 409, description: 'Duplicate provider_key + model_id' })
  create(@Body() dto: CreateLlmModelDto) {
    return this.llmModelsService.create(dto);
  }

  @Patch('bulk-status')
  @ApiOperation({ summary: 'Bulk update active status for all models of a provider' })
  @ApiResponse({ status: 200, description: 'Models updated' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  bulkUpdateStatus(@Body() dto: BulkUpdateModelStatusDto) {
    return this.llmModelsService.bulkUpdateStatus(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an LLM model' })
  @ApiResponse({ status: 200, description: 'Model updated', type: LlmModelResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLlmModelDto,
  ) {
    return this.llmModelsService.update(id, dto);
  }
}
