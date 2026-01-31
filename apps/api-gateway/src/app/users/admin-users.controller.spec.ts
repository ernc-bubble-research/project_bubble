import { UserRole, UserStatus } from '@project-bubble/db-layer';
import { UserResponseDto } from '@project-bubble/shared';
import { AdminUsersController } from './admin-users.controller';
import { UsersService } from './users.service';

describe('AdminUsersController [P2]', () => {
  let controller: AdminUsersController;
  let service: jest.Mocked<UsersService>;

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

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

    controller = new AdminUsersController(service);
  });

  it('[1H.1-UNIT-001] POST /admin/tenants/:tenantId/users — should call service with URL tenantId', async () => {
    const dto = { email: 'alice@acme.com', password: 'Password1!', role: 'creator' };

    await controller.create(tenantId, dto);

    expect(service.create).toHaveBeenCalledWith(
      dto,
      tenantId,
      UserRole.BUBBLE_ADMIN,
    );
  });

  it('[1H.1-UNIT-002] should allow Bubble Admin to create bubble_admin users', async () => {
    const dto = { email: 'admin@acme.com', password: 'Password1!', role: 'bubble_admin' };

    await controller.create(tenantId, dto);

    expect(service.create).toHaveBeenCalledWith(
      dto,
      tenantId,
      UserRole.BUBBLE_ADMIN,
    );
  });

  it('[1H.1-UNIT-003] GET /admin/tenants/:tenantId/users — should list users for specified tenant', async () => {
    const result = await controller.findAll(tenantId);

    expect(result).toEqual([mockResponse]);
    expect(service.findAllByTenant).toHaveBeenCalledWith(tenantId);
  });

  it('[1H.1-UNIT-004] PATCH /admin/tenants/:tenantId/users/:id — should update user', async () => {
    const dto = { name: 'Updated' };

    await controller.update(tenantId, 'user-id', dto);

    expect(service.update).toHaveBeenCalledWith(
      'user-id',
      tenantId,
      dto,
      UserRole.BUBBLE_ADMIN,
    );
  });

  it('[1H.1-UNIT-005] DELETE /admin/tenants/:tenantId/users/:id — should deactivate user', async () => {
    await controller.deactivate(tenantId, 'user-id');

    expect(service.deactivate).toHaveBeenCalledWith('user-id', tenantId);
  });

  it('[1H.1-UNIT-006] POST /admin/tenants/:tenantId/users/:id/reset-password — should reset password', async () => {
    await controller.resetPassword(tenantId, 'user-id', { newPassword: 'NewPass123!' });

    expect(service.resetPassword).toHaveBeenCalledWith(
      'user-id',
      tenantId,
      'NewPass123!',
    );
  });
});
