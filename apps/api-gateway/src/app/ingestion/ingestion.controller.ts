import {
  Controller,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import { IndexAssetResponseDto } from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { IngestionService } from './ingestion.service';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('app/assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post(':id/index')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue file for Knowledge Base indexing' })
  @ApiResponse({
    status: 202,
    description: 'Indexing job queued successfully',
    type: IndexAssetResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Asset already indexed' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  @ApiResponse({ status: 500, description: 'Queue or embedding service failure' })
  async indexAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<IndexAssetResponseDto> {
    const result = await this.ingestionService.indexAsset(
      id,
      req.user.tenantId,
    );
    return {
      jobId: result.jobId,
      assetId: id,
      status: 'queued',
    };
  }

  @Delete(':id/index')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove file from Knowledge Base (de-index)' })
  @ApiResponse({ status: 200, description: 'Asset de-indexed successfully' })
  @ApiResponse({ status: 400, description: 'Asset is not indexed' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  @ApiResponse({ status: 500, description: 'De-indexing service failure' })
  async deIndexAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<void> {
    await this.ingestionService.deIndexAsset(id, req.user.tenantId);
  }
}
