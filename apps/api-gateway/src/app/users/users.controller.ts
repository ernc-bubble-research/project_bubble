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

@Controller('app/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER_ADMIN, UserRole.BUBBLE_ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
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
  findAll(
    @Request() req: { user: { tenantId: string } },
  ): Promise<UserResponseDto[]> {
    return this.usersService.findAllByTenant(req.user.tenantId);
  }

  @Patch(':id')
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
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ): Promise<UserResponseDto> {
    return this.usersService.deactivate(id, req.user.tenantId);
  }

  @Post(':id/reset-password')
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
