import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoginResponseDto } from '@project-bubble/shared';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InvitationsService } from '../invitations/invitations.service';

describe('AuthController', () => {
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
    it('should call service and return response', async () => {
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

    it('should propagate UnauthorizedException', async () => {
      service.login.mockRejectedValue(
        new UnauthorizedException('Invalid email or password'),
      );

      await expect(
        controller.login({ email: 'bad@email.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
