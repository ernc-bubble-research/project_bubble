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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
  UserResponseDto,
} from '@project-bubble/shared';
import { UserRole } from '@project-bubble/db-layer';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminApiKeyGuard } from '../guards/admin-api-key.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('admin/tenants/:tenantId/users')
@UseGuards(OptionalJwtAuthGuard, AdminApiKeyGuard, RolesGuard)
@Roles(UserRole.BUBBLE_ADMIN)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user in a specific tenant (admin)' })
  create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.create(dto, tenantId, UserRole.BUBBLE_ADMIN);
  }

  @Get()
  @ApiOperation({ summary: 'List users in a specific tenant (admin)' })
  findAll(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<UserResponseDto[]> {
    return this.usersService.findAllByTenant(tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user in a specific tenant (admin)' })
  update(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(
      id,
      tenantId,
      dto,
      UserRole.BUBBLE_ADMIN,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a user (admin)' })
  deactivate(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.deactivate(id, tenantId);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset user password (admin)' })
  resetPassword(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    return this.usersService.resetPassword(id, tenantId, dto.newPassword);
  }
}
