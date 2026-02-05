import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserRole, UserStatus } from '@project-bubble/db-layer';
import { createMockUser, MOCK_PASSWORD_HASH } from '@project-bubble/db-layer/testing';
import { AuthService } from './auth.service';

describe('AuthService [P0]', () => {
  let service: AuthService;
  let repo: jest.Mocked<Repository<UserEntity>>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = createMockUser({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@bubble.io',
    passwordHash: MOCK_PASSWORD_HASH,
    role: UserRole.BUBBLE_ADMIN,
    tenantId: '00000000-0000-0000-0000-000000000000',
  });

  const createModule = async (configOverrides: Record<string, string | undefined> = {}) => {
    const defaultConfig: Record<string, string | undefined> = {
      NODE_ENV: 'development',
      SEED_ADMIN_EMAIL: 'admin@bubble.io',
      SEED_ADMIN_PASSWORD: 'Admin123!',
      ...configOverrides,
    };

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
            get: jest.fn().mockImplementation((key: string) => defaultConfig[key]),
          },
        },
      ],
    }).compile();

    return module;
  };

  beforeEach(async () => {
    const module = await createModule();

    service = module.get<AuthService>(AuthService);
    repo = module.get(getRepositoryToken(UserEntity));
    jwtService = module.get(JwtService);
  });

  describe('onModuleInit', () => {
    it('[1H.1-UNIT-001] should seed admin user when NODE_ENV=development and seed env vars are set', async () => {
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

    it('[1H.1-UNIT-002] should skip seed when admin user already exists', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      await service.onModuleInit();

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('[1H.1-UNIT-003] should skip seed when NODE_ENV is not development', async () => {
      const module = await createModule({ NODE_ENV: 'production' });
      const prodService = module.get<AuthService>(AuthService);
      const prodRepo: jest.Mocked<Repository<UserEntity>> = module.get(
        getRepositoryToken(UserEntity),
      );

      await prodService.onModuleInit();

      expect(prodRepo.findOne).not.toHaveBeenCalled();
      expect(prodRepo.create).not.toHaveBeenCalled();
    });

    it('[1H.1-UNIT-004] should skip seed when SEED_ADMIN_EMAIL is not set', async () => {
      const module = await createModule({ SEED_ADMIN_EMAIL: undefined });
      const svc = module.get<AuthService>(AuthService);
      const r: jest.Mocked<Repository<UserEntity>> = module.get(
        getRepositoryToken(UserEntity),
      );

      await svc.onModuleInit();

      expect(r.findOne).not.toHaveBeenCalled();
      expect(r.create).not.toHaveBeenCalled();
    });

    it('[1H.1-UNIT-005] should skip seed when SEED_ADMIN_PASSWORD is not set', async () => {
      const module = await createModule({ SEED_ADMIN_PASSWORD: undefined });
      const svc = module.get<AuthService>(AuthService);
      const r: jest.Mocked<Repository<UserEntity>> = module.get(
        getRepositoryToken(UserEntity),
      );

      await svc.onModuleInit();

      expect(r.findOne).not.toHaveBeenCalled();
      expect(r.create).not.toHaveBeenCalled();
    });

    it('[1H.1-UNIT-006] should handle seed error gracefully without crashing', async () => {
      repo.findOne.mockRejectedValue(new Error('DB connection failed'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('login', () => {
    it('[1H.1-UNIT-007] should return JWT and user info for valid credentials', async () => {
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

    it('[1H.1-UNIT-008] should throw UnauthorizedException for wrong password', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'admin@bubble.io', password: 'WrongPass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('[1H.1-UNIT-009] should throw UnauthorizedException for non-existent email (same error message)', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@bubble.io', password: 'Admin123!' }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
  });

  describe('validateUser', () => {
    it('[1H.1-UNIT-010] should return user when credentials match', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser(
        'admin@bubble.io',
        'Admin123!',
      );

      expect(result).toEqual(mockUser);
    });

    it('[1H.1-UNIT-011] should return null when password does not match', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser(
        'admin@bubble.io',
        'WrongPass',
      );

      expect(result).toBeNull();
    });

    it('[1H.1-UNIT-012] should return null when email does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.validateUser(
        'nobody@bubble.io',
        'Admin123!',
      );

      expect(result).toBeNull();
    });

    it('[1H.1-UNIT-013] should return null when user is inactive', async () => {
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

    it('[1H.1-UNIT-014] should increment failedLoginAttempts on wrong password', async () => {
      const user = { ...mockUser, failedLoginAttempts: 0, lockedUntil: null } as UserEntity;
      repo.findOne.mockResolvedValue(user);

      await service.validateUser('admin@bubble.io', 'WrongPass');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginAttempts: 1 }),
      );
    });

    it('[1H.1-UNIT-015] should lock account after 5 failed attempts', async () => {
      const user = { ...mockUser, failedLoginAttempts: 4, lockedUntil: null } as UserEntity;
      repo.findOne.mockResolvedValue(user);

      await service.validateUser('admin@bubble.io', 'WrongPass');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      );
    });

    it('[1H.1-UNIT-016] should return null when account is locked', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      const lockedUser = {
        ...mockUser,
        failedLoginAttempts: 5,
        lockedUntil: futureDate,
      } as UserEntity;
      repo.findOne.mockResolvedValue(lockedUser);

      const result = await service.validateUser(
        'admin@bubble.io',
        'Admin123!',
      );

      expect(result).toBeNull();
    });

    it('[1H.1-UNIT-017] should allow login after lock expires', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const expiredLockUser = {
        ...mockUser,
        failedLoginAttempts: 5,
        lockedUntil: pastDate,
      } as UserEntity;
      repo.findOne.mockResolvedValue(expiredLockUser);

      const result = await service.validateUser(
        'admin@bubble.io',
        'Admin123!',
      );

      expect(result).toEqual(expiredLockUser);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      );
    });

    it('[1H.1-UNIT-018] should reset failedLoginAttempts on successful login', async () => {
      const user = { ...mockUser, failedLoginAttempts: 3, lockedUntil: null } as UserEntity;
      repo.findOne.mockResolvedValue(user);

      const result = await service.validateUser(
        'admin@bubble.io',
        'Admin123!',
      );

      expect(result).toBeTruthy();
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      );
    });
  });

  describe('getProfile', () => {
    it('[3.1-2-UNIT-001] should return UserResponseDto for valid userId', async () => {
      // Given — a user exists in the database
      repo.findOne.mockResolvedValue(mockUser);

      // When
      const result = await service.getProfile(mockUser.id);

      // Then
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: mockUser.id } });
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.role).toBe(mockUser.role);
      expect(result.tenantId).toBe(mockUser.tenantId);
    });

    it('[3.1-2-UNIT-002] should throw NotFoundException for non-existent userId', async () => {
      // Given — no user found
      repo.findOne.mockResolvedValue(null);

      // When / Then
      await expect(
        service.getProfile('non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('hashPassword', () => {
    it('[1H.1-UNIT-019] should produce a valid bcrypt hash', async () => {
      const hash = await service.hashPassword('TestPassword1!');

      expect(hash).toBeDefined();
      expect(hash).not.toBe('TestPassword1!');
      expect(await bcrypt.compare('TestPassword1!', hash)).toBe(true);
    });

    it('[1H.1-UNIT-020] should produce different hashes for same input', async () => {
      const hash1 = await service.hashPassword('SamePassword1!');
      const hash2 = await service.hashPassword('SamePassword1!');

      expect(hash1).not.toBe(hash2);
    });
  });
});
