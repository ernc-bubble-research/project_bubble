import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  UserEntity,
  UserRole,
  UserStatus,
  TenantEntity,
  TransactionManager,
} from '@project-bubble/db-layer';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
} from '@project-bubble/shared';

@Injectable()
export class UsersService {
  constructor(private readonly txManager: TransactionManager) {}

  async create(
    dto: CreateUserDto,
    tenantId: string,
    callerRole: UserRole,
  ): Promise<UserResponseDto> {
    // Role restriction: @IsIn validator on the DTO guarantees dto.role is a
    // valid UserRole string value, so this string comparison is safe.
    if (
      callerRole !== UserRole.BUBBLE_ADMIN &&
      dto.role === UserRole.BUBBLE_ADMIN
    ) {
      throw new ForbiddenException(
        'Only Bubble Admins can create bubble_admin users',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.txManager.run(tenantId, async (manager) => {
      // Verify the target tenant exists (tenants table has no RLS).
      const tenant = await manager.findOne(TenantEntity, {
        where: { id: tenantId },
      });
      if (!tenant) {
        throw new NotFoundException(
          `Tenant with id "${tenantId}" not found`,
        );
      }

      // Scope duplicate check to this tenant only to avoid leaking
      // cross-tenant user existence via the error message.
      const existing = await manager.findOne(UserEntity, {
        where: { email: dto.email, tenantId },
      });
      if (existing) {
        throw new ConflictException(
          `User with email "${dto.email}" already exists`,
        );
      }

      const user = manager.create(UserEntity, {
        email: dto.email,
        passwordHash,
        role: dto.role as UserRole,
        name: dto.name,
        tenantId,
        status: UserStatus.ACTIVE,
      });

      const saved = await manager.save(UserEntity, user);
      return this.toResponse(saved);
    });
  }

  async findAllByTenant(tenantId: string): Promise<UserResponseDto[]> {
    return this.txManager.run(tenantId, async (manager) => {
      const users = await manager.find(UserEntity, {
        where: { tenantId },
        order: { createdAt: 'DESC' },
      });
      return users.map((u) => this.toResponse(u));
    });
  }

  async findOne(
    userId: string,
    tenantId: string,
  ): Promise<UserResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      const user = await manager.findOne(UserEntity, {
        where: { id: userId, tenantId },
      });
      if (!user) {
        throw new NotFoundException(`User with id "${userId}" not found`);
      }
      return this.toResponse(user);
    });
  }

  async update(
    userId: string,
    tenantId: string,
    dto: UpdateUserDto,
    callerRole: UserRole,
  ): Promise<UserResponseDto> {
    if (
      callerRole !== UserRole.BUBBLE_ADMIN &&
      dto.role === UserRole.BUBBLE_ADMIN
    ) {
      throw new ForbiddenException(
        'Only Bubble Admins can promote users to bubble_admin',
      );
    }

    return this.txManager.run(tenantId, async (manager) => {
      const user = await manager.findOne(UserEntity, {
        where: { id: userId, tenantId },
      });
      if (!user) {
        throw new NotFoundException(`User with id "${userId}" not found`);
      }

      if (dto.role !== undefined) {
        user.role = dto.role as UserRole;
      }
      if (dto.name !== undefined) {
        user.name = dto.name;
      }

      const updated = await manager.save(UserEntity, user);
      return this.toResponse(updated);
    });
  }

  async deactivate(
    userId: string,
    tenantId: string,
  ): Promise<UserResponseDto> {
    return this.txManager.run(tenantId, async (manager) => {
      const user = await manager.findOne(UserEntity, {
        where: { id: userId, tenantId },
      });
      if (!user) {
        throw new NotFoundException(`User with id "${userId}" not found`);
      }

      user.status = UserStatus.INACTIVE;
      const updated = await manager.save(UserEntity, user);
      return this.toResponse(updated);
    });
  }

  async resetPassword(
    userId: string,
    tenantId: string,
    newPassword: string,
  ): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    return this.txManager.run(tenantId, async (manager) => {
      const user = await manager.findOne(UserEntity, {
        where: { id: userId, tenantId },
      });
      if (!user) {
        throw new NotFoundException(`User with id "${userId}" not found`);
      }

      user.passwordHash = passwordHash;
      await manager.save(UserEntity, user);
    });
  }

  private toResponse(user: UserEntity): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.role = user.role;
    dto.name = user.name;
    dto.tenantId = user.tenantId;
    dto.status = user.status;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
