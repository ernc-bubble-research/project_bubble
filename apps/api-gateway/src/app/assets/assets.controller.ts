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
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import { UploadAssetDto, UpdateAssetDto, AssetResponseDto, ListAssetsQueryDto } from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssetsService } from './assets.service';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('app/assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully', type: AssetResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file (type, size, or missing)' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 409, description: 'Duplicate file (SHA-256 hash conflict)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAssetDto,
    @Request() req: { user: { userId: string; tenant_id: string } },
  ) {
    return this.assetsService.upload(
      file,
      dto,
      req.user.tenant_id,
      req.user.userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List assets' })
  @ApiResponse({ status: 200, description: 'Paginated list of assets', type: [AssetResponseDto] })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll(
    @Request() req: { user: { tenant_id: string } },
    @Query() query: ListAssetsQueryDto,
  ) {
    return this.assetsService.findAll(req.user.tenant_id, {
      folderId: query.folderId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset by ID' })
  @ApiResponse({ status: 200, description: 'Asset details', type: AssetResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.assetsService.findOne(id, req.user.tenant_id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update asset metadata' })
  @ApiResponse({ status: 200, description: 'Asset updated', type: AssetResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.assetsService.update(id, req.user.tenant_id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive asset (soft delete)' })
  @ApiResponse({ status: 200, description: 'Asset archived', type: AssetResponseDto })
  @ApiResponse({ status: 400, description: 'Asset already archived' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.assetsService.archive(id, req.user.tenant_id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore archived asset' })
  @ApiResponse({ status: 200, description: 'Asset restored', type: AssetResponseDto })
  @ApiResponse({ status: 400, description: 'Asset is not archived' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.assetsService.restore(id, req.user.tenant_id);
  }
}
