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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import { CreateFolderDto, UpdateFolderDto, FolderResponseDto } from '@project-bubble/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FoldersService } from './folders.service';

@ApiTags('Folders')
@ApiBearerAuth()
@Controller('app/folders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN, UserRole.CUSTOMER_ADMIN, UserRole.CREATOR)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a folder' })
  @ApiResponse({ status: 201, description: 'Folder created', type: FolderResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid folder data or max nesting depth exceeded' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  create(
    @Body() dto: CreateFolderDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.foldersService.create(dto, req.user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List all folders (tree structure)' })
  @ApiResponse({ status: 200, description: 'List of all folders', type: [FolderResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll(@Request() req: { user: { tenantId: string } }) {
    return this.foldersService.findAll(req.user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename folder' })
  @ApiResponse({ status: 200, description: 'Folder updated', type: FolderResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid folder name' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFolderDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.foldersService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete folder (must be empty)' })
  @ApiResponse({ status: 200, description: 'Folder deleted' })
  @ApiResponse({ status: 400, description: 'Folder not empty (has subfolders or assets)' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Folder not found' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.foldersService.delete(id, req.user.tenantId);
  }
}
