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
import {
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
  UserResponseDto,
} from '@project-bubble/shared';
import { UserRole } from '@project-bubble/db-layer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';

@ApiTags('App - Users')
@ApiBearerAuth()
@Controller('app/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER_ADMIN, UserRole.BUBBLE_ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user in current tenant' })
  @ApiResponse({ status: 201, description: 'User created', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid user data or email already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  create(
    @Body() dto: CreateUserDto,
    @Request() req: { user: { tenantId: string; role: string } },
  ): Promise<UserResponseDto> {
    return this.usersService.create(
      dto,
      req.user.tenantId,
      req.user.role as UserRole,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List users in current tenant' })
  @ApiResponse({ status: 200, description: 'List of users', type: [UserResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll(
    @Request() req: { user: { tenantId: string } },
  ): Promise<UserResponseDto[]> {
    return this.usersService.findAllByTenant(req.user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiResponse({ status: 200, description: 'User updated', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: { user: { tenantId: string; role: string } },
  ): Promise<UserResponseDto> {
    return this.usersService.update(
      id,
      req.user.tenantId,
      dto,
      req.user.role as UserRole,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a user' })
  @ApiResponse({ status: 200, description: 'User deactivated', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<UserResponseDto> {
    return this.usersService.deactivate(id, req.user.tenantId);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset user password' })
  @ApiResponse({ status: 201, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or weak password' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @Request() req: { user: { tenantId: string } },
  ): Promise<void> {
    return this.usersService.resetPassword(
      id,
      req.user.tenantId,
      dto.newPassword,
    );
  }
}
