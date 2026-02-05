import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserRole, UserStatus } from '@project-bubble/db-layer';
import { LoginDto, LoginResponseDto, UserResponseDto } from '@project-bubble/shared';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>('NODE_ENV') !== 'development') {
      return;
    }

    const seedEmail = this.config.get<string>('SEED_ADMIN_EMAIL');
    const seedPassword = this.config.get<string>('SEED_ADMIN_PASSWORD');

    if (!seedEmail || !seedPassword) {
      this.logger.log(
        'Dev seed: Skipped — SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD not set',
      );
      return;
    }

    try {
      const adminExists = await this.userRepo.findOne({
        where: { role: UserRole.BUBBLE_ADMIN },
      });

      if (!adminExists) {
        const passwordHash = await this.hashPassword(seedPassword);
        const admin = this.userRepo.create({
          email: seedEmail,
          passwordHash,
          role: UserRole.BUBBLE_ADMIN,
          tenantId: '00000000-0000-0000-0000-000000000000',
        });
        await this.userRepo.save(admin);
        this.logger.log(`Dev seed: Created bubble_admin user — ${seedEmail}`);
      }
    } catch (error) {
      this.logger.error('Dev seed failed', error);
    }
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserEntity | null> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      return null;
    }
    if (user.status === UserStatus.INACTIVE) {
      return null;
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        this.logger.warn(
          `Account locked for ${email} after ${user.failedLoginAttempts} failed attempts`,
        );
      }
      await this.userRepo.save(user);
      return null;
    }

    // Reset on successful login
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await this.userRepo.save(user);
    }

    return user;
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
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

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
