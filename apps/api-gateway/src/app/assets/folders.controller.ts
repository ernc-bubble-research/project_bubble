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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@project-bubble/db-layer';
import { CreateFolderDto, UpdateFolderDto } from '@project-bubble/shared';
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
  create(
    @Body() dto: CreateFolderDto,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.foldersService.create(dto, req.user.tenant_id);
  }

  @Get()
  @ApiOperation({ summary: 'List all folders (tree structure)' })
  findAll(@Request() req: { user: { tenant_id: string } }) {
    return this.foldersService.findAll(req.user.tenant_id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename folder' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFolderDto,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.foldersService.update(id, req.user.tenant_id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete folder (must be empty)' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenant_id: string } },
  ) {
    return this.foldersService.delete(id, req.user.tenant_id);
  }
}
