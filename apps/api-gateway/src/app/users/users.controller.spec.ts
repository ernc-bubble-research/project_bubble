import { UserRole, UserStatus } from '@project-bubble/db-layer';
import { UserResponseDto } from '@project-bubble/shared';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const mockRequest = { user: { tenantId, role: 'customer_admin', userId: 'user-1' } };

  const mockResponse: UserResponseDto = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'alice@acme.com',
    role: 'creator',
    name: 'Alice',
    tenantId,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-01-31'),
  };

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(mockResponse),
      findAllByTenant: jest.fn().mockResolvedValue([mockResponse]),
      update: jest.fn().mockResolvedValue(mockResponse),
      deactivate: jest.fn().mockResolvedValue({ ...mockResponse, status: UserStatus.INACTIVE }),
      resetPassword: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<UsersService>;

    controller = new UsersController(service);
  });

  it('POST /app/users — should call service with JWT tenantId', async () => {
    const dto = { email: 'alice@acme.com', password: 'Password1!', role: 'creator' };

    await controller.create(dto, mockRequest);

    expect(service.create).toHaveBeenCalledWith(
      dto,
      tenantId,
      UserRole.CUSTOMER_ADMIN,
    );
  });

  it('GET /app/users — should return user list for tenant', async () => {
    const result = await controller.findAll(mockRequest);

    expect(result).toEqual([mockResponse]);
    expect(service.findAllByTenant).toHaveBeenCalledWith(tenantId);
  });

  it('PATCH /app/users/:id — should update user', async () => {
    const dto = { role: 'customer_admin', name: 'Alice Updated' };

    await controller.update('user-id', dto, mockRequest);

    expect(service.update).toHaveBeenCalledWith(
      'user-id',
      tenantId,
      dto,
      UserRole.CUSTOMER_ADMIN,
    );
  });

  it('DELETE /app/users/:id — should deactivate user', async () => {
    await controller.deactivate('user-id', mockRequest);

    expect(service.deactivate).toHaveBeenCalledWith('user-id', tenantId);
  });

  it('POST /app/users/:id/reset-password — should reset password', async () => {
    await controller.resetPassword('user-id', { newPassword: 'NewPass123!' }, mockRequest);

    expect(service.resetPassword).toHaveBeenCalledWith(
      'user-id',
      tenantId,
      'NewPass123!',
    );
  });
});
