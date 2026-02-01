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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import { UploadAssetDto, UpdateAssetDto } from '@project-bubble/shared';
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
  @UseInterceptors(FileInterceptor('file'))
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
  findAll(
    @Request() req: { user: { tenant_id: string } },
    @Query('folderId') folderId?: string,
    @Query('status') status?: string,
  ) {
    return this.assetsService.findAll(
      req.user.tenant_id,
      folderId,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.assetsService.findOne(id, req.user.tenant_id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update asset metadata' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.assetsService.update(id, req.user.tenant_id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive asset (soft delete)' })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.assetsService.archive(id, req.user.tenant_id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore archived asset' })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.assetsService.restore(id, req.user.tenant_id);
  }
}
