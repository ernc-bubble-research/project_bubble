import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserRole } from '@project-bubble/db-layer';
import { LoginDto, LoginResponseDto } from '@project-bubble/shared';

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

    const adminExists = await this.userRepo.findOne({
      where: { role: UserRole.BUBBLE_ADMIN },
    });

    if (!adminExists) {
      const passwordHash = await this.hashPassword('Admin123!');
      const admin = this.userRepo.create({
        email: 'admin@bubble.io',
        passwordHash,
        role: UserRole.BUBBLE_ADMIN,
        tenantId: '00000000-0000-0000-0000-000000000000',
      });
      await this.userRepo.save(admin);
      this.logger.log(
        'Dev seed: Created bubble_admin user — admin@bubble.io / Admin123!',
      );
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
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    return isMatch ? user : null;
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

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
