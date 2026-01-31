import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserRole, UserStatus } from '@project-bubble/db-layer';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let repo: jest.Mocked<Repository<UserEntity>>;
  let jwtService: jest.Mocked<JwtService>;

  const hashedPassword = bcrypt.hashSync('Admin123!', 10);

  const mockUser: UserEntity = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@bubble.io',
    passwordHash: hashedPassword,
    role: UserRole.BUBBLE_ADMIN,
    tenantId: '00000000-0000-0000-0000-000000000000',
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-01-31'),
    updatedAt: new Date('2026-01-31'),
  } as UserEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('development'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    repo = module.get(getRepositoryToken(UserEntity));
    jwtService = module.get(JwtService);
  });

  describe('onModuleInit', () => {
    it('should seed admin user when NODE_ENV=development and no admin exists', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockUser);
      repo.save.mockResolvedValue(mockUser);

      await service.onModuleInit();

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { role: UserRole.BUBBLE_ADMIN },
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'admin@bubble.io',
          role: UserRole.BUBBLE_ADMIN,
          tenantId: '00000000-0000-0000-0000-000000000000',
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });

    it('should skip seed when admin user already exists', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      await service.onModuleInit();

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('should skip seed when NODE_ENV is not development', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: getRepositoryToken(UserEntity),
            useValue: {
              findOne: jest.fn(),
              create: jest.fn(),
              save: jest.fn(),
            },
          },
          {
            provide: JwtService,
            useValue: { sign: jest.fn() },
          },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('production') },
          },
        ],
      }).compile();

      const prodService = module.get<AuthService>(AuthService);
      const prodRepo: jest.Mocked<Repository<UserEntity>> = module.get(
        getRepositoryToken(UserEntity),
      );

      await prodService.onModuleInit();

      expect(prodRepo.findOne).not.toHaveBeenCalled();
      expect(prodRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should return JWT and user info for valid credentials', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'admin@bubble.io',
        password: 'Admin123!',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        tenantId: mockUser.tenantId,
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        tenant_id: mockUser.tenantId,
        role: mockUser.role,
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'admin@bubble.io', password: 'WrongPass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent email (same error message)', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@bubble.io', password: 'Admin123!' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
  });

  describe('validateUser', () => {
    it('should return user when credentials match', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser(
        'admin@bubble.io',
        'Admin123!',
      );

      expect(result).toEqual(mockUser);
    });

    it('should return null when password does not match', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser(
        'admin@bubble.io',
        'WrongPass',
      );

      expect(result).toBeNull();
    });

    it('should return null when email does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.validateUser(
        'nobody@bubble.io',
        'Admin123!',
      );

      expect(result).toBeNull();
    });

    it('should return null when user is inactive', async () => {
      const inactiveUser = {
        ...mockUser,
        status: UserStatus.INACTIVE,
      } as UserEntity;
      repo.findOne.mockResolvedValue(inactiveUser);

      const result = await service.validateUser(
        'admin@bubble.io',
        'Admin123!',
      );

      expect(result).toBeNull();
    });
  });

  describe('hashPassword', () => {
    it('should produce a valid bcrypt hash', async () => {
      const hash = await service.hashPassword('TestPassword1!');

      expect(hash).toBeDefined();
      expect(hash).not.toBe('TestPassword1!');
      expect(await bcrypt.compare('TestPassword1!', hash)).toBe(true);
    });

    it('should produce different hashes for same input', async () => {
      const hash1 = await service.hashPassword('SamePassword1!');
      const hash2 = await service.hashPassword('SamePassword1!');

      expect(hash1).not.toBe(hash2);
    });
  });
});
