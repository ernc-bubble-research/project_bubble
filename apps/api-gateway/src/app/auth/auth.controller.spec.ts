import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { LoginResponseDto, UserResponseDto } from '@project-bubble/shared';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvitationsService } from '../invitations/invitations.service';

describe('AuthController [P2]', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            getProfile: jest.fn(),
          },
        },
        {
          provide: InvitationsService,
          useValue: {
            accept: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService);
  });

  describe('POST /auth/login', () => {
    it('[1H.1-UNIT-001] should call service and return response', async () => {
      const mockResponse: LoginResponseDto = {
        accessToken: 'mock-token',
        user: {
          id: '123',
          email: 'admin@bubble.io',
          role: 'bubble_admin',
          tenantId: '000',
        },
      };
      service.login.mockResolvedValue(mockResponse);

      const result = await controller.login({
        email: 'admin@bubble.io',
        password: 'Admin123!',
      });

      expect(result).toEqual(mockResponse);
      expect(service.login).toHaveBeenCalledWith({
        email: 'admin@bubble.io',
        password: 'Admin123!',
      });
    });

    it('[1H.1-UNIT-002] should propagate UnauthorizedException', async () => {
      service.login.mockRejectedValue(
        new UnauthorizedException('Invalid email or password'),
      );

      await expect(
        controller.login({ email: 'bad@email.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GET /auth/me', () => {
    it('[3.1-2-UNIT-003] should return user profile for authenticated request', async () => {
      // Given — a mock profile response
      const mockProfile: UserResponseDto = {
        id: '123',
        email: 'admin@bubble.io',
        role: 'bubble_admin',
        tenantId: '000',
        status: 'active',
        createdAt: new Date(),
      } as UserResponseDto;
      service.getProfile.mockResolvedValue(mockProfile);

      // When
      const result = await controller.getProfile({ user: { userId: '123' } });

      // Then
      expect(result).toEqual(mockProfile);
      expect(service.getProfile).toHaveBeenCalledWith('123');
    });

    it('[3.1-2-UNIT-004] should propagate NotFoundException', async () => {
      // Given — service throws NotFoundException
      service.getProfile.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      // When / Then
      await expect(
        controller.getProfile({ user: { userId: 'non-existent' } }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
