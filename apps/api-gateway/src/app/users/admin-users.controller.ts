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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
  @ApiResponse({ status: 201, description: 'User created', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid user data or email already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  create(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.create(dto, tenantId, UserRole.BUBBLE_ADMIN);
  }

  @Get()
  @ApiOperation({ summary: 'List users in a specific tenant (admin)' })
  @ApiResponse({ status: 200, description: 'List of users', type: [UserResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ): Promise<UserResponseDto[]> {
    return this.usersService.findAllByTenant(tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user in a specific tenant (admin)' })
  @ApiResponse({ status: 200, description: 'User updated', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'User not found' })
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
  @ApiResponse({ status: 200, description: 'User deactivated', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  deactivate(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.deactivate(id, tenantId);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset user password (admin)' })
  @ApiResponse({ status: 201, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or weak password' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing credentials' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  resetPassword(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    return this.usersService.resetPassword(id, tenantId, dto.newPassword);
  }
}
