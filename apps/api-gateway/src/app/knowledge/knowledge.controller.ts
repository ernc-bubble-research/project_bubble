import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import {
  CreateValidatedInsightDto,
  ListInsightsQueryDto,
  SearchKnowledgeDto,
  SearchResultDto,
  ValidatedInsightResponseDto,
} from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KnowledgeSearchService } from './knowledge-search.service';
import { ValidatedInsightService } from './validated-insight.service';

@ApiTags('Knowledge Base')
@ApiBearerAuth()
@Controller('app/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)
export class KnowledgeController {
  constructor(
    private readonly knowledgeSearchService: KnowledgeSearchService,
    private readonly validatedInsightService: ValidatedInsightService,
  ) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search Knowledge Base by semantic similarity' })
  @ApiResponse({
    status: 200,
    description: 'Search results ranked by similarity',
    type: [SearchResultDto],
  })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 500, description: 'Embedding service failure' })
  async search(
    @Body() dto: SearchKnowledgeDto,
    @Request() req: { user: { tenantId: string } },
  ): Promise<SearchResultDto[]> {
    return this.knowledgeSearchService.search(dto.query, req.user.tenantId, {
      limit: dto.limit,
      similarityThreshold: dto.similarityThreshold,
    });
  }

  @Post('insights')
  @ApiOperation({ summary: 'Store a validated insight in the Knowledge Base' })
  @ApiResponse({
    status: 201,
    description: 'Insight stored successfully',
    type: ValidatedInsightResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid insight data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 500, description: 'Embedding service failure' })
  async storeInsight(
    @Body() dto: CreateValidatedInsightDto,
    @Request() req: { user: { tenantId: string; sub: string } },
  ): Promise<ValidatedInsightResponseDto> {
    return this.validatedInsightService.store(
      dto.content,
      req.user.tenantId,
      req.user.sub,
      {
        sourceType: dto.sourceType,
        sourceRunId: dto.sourceRunId,
        sourceReportId: dto.sourceReportId,
        originalContent: dto.originalContent,
      },
    );
  }

  @Get('insights')
  @ApiOperation({ summary: 'List validated insights for the current tenant' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of validated insights',
    type: [ValidatedInsightResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Invalid pagination parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 500, description: 'Database query failure' })
  async listInsights(
    @Request() req: { user: { tenantId: string } },
    @Query() query: ListInsightsQueryDto,
  ): Promise<ValidatedInsightResponseDto[]> {
    return this.validatedInsightService.getByTenant(req.user.tenantId, {
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('insights/run/:runId')
  @ApiOperation({ summary: 'Get validated insights for a specific workflow run' })
  @ApiResponse({
    status: 200,
    description: 'Insights linked to the specified run',
    type: [ValidatedInsightResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 500, description: 'Database query failure' })
  async getInsightsByRun(
    @Param('runId', ParseUUIDPipe) runId: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<ValidatedInsightResponseDto[]> {
    return this.validatedInsightService.getByRun(runId, req.user.tenantId);
  }

  @Delete('insights/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a validated insight' })
  @ApiResponse({ status: 204, description: 'Insight soft-deleted' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Insight not found or already deleted' })
  async deleteInsight(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<void> {
    return this.validatedInsightService.softDelete(id, req.user.tenantId);
  }
}
