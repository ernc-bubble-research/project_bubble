import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  UserEntity,
  UserRole,
  UserStatus,
  TenantEntity,
  TransactionManager,
} from '@project-bubble/db-layer';
import { createMockUser } from '@project-bubble/db-layer/testing';
import { UsersService } from './users.service';

describe('UsersService [P1]', () => {
  let service: UsersService;
  let txManager: jest.Mocked<TransactionManager>;
  let mockManager: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const mockTenant = { id: tenantId, name: 'Acme Corp' } as TenantEntity;

  const mockUser = createMockUser({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'alice@acme.com',
    passwordHash: 'hashed_pw',
    role: UserRole.CREATOR,
    name: 'Alice',
    tenantId,
    status: UserStatus.ACTIVE,
    createdAt: new Date('2026-01-31'),
    updatedAt: new Date('2026-01-31'),
  });

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    txManager = {
      run: jest.fn().mockImplementation(
        (_tenantId: string, cb: (m: typeof mockManager) => Promise<unknown>) =>
          cb(mockManager),
      ),
    } as unknown as jest.Mocked<TransactionManager>;

    service = new UsersService(txManager);
  });

  describe('create', () => {
    it('[1H.1-UNIT-001] should create a user and return response without password', async () => {
      // First findOne: tenant check → found; Second findOne: email check → not found
      mockManager.findOne
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce(null);
      mockManager.create.mockReturnValue(mockUser);
      mockManager.save.mockResolvedValue(mockUser);

      const result = await service.create(
        { email: 'alice@acme.com', password: 'Password1!', role: 'creator', name: 'Alice' },
        tenantId,
        UserRole.CUSTOMER_ADMIN,
      );

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.role).toBe(mockUser.role);
      expect(result).not.toHaveProperty('passwordHash');
      expect(txManager.run).toHaveBeenCalledWith(tenantId, expect.any(Function));
    });

    it('[1H.1-UNIT-002] should throw ConflictException for duplicate email', async () => {
      // First findOne: tenant check → found; Second findOne: email check → found (duplicate)
      mockManager.findOne
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce(mockUser);

      await expect(
        service.create(
          { email: 'alice@acme.com', password: 'Password1!', role: 'creator' },
          tenantId,
          UserRole.CUSTOMER_ADMIN,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('[1H.1-UNIT-003] should throw NotFoundException when tenant does not exist', async () => {
      // First findOne: tenant check → not found
      mockManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create(
          { email: 'new@acme.com', password: 'Password1!', role: 'creator' },
          tenantId,
          UserRole.CUSTOMER_ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('[1H.1-UNIT-004] should throw ForbiddenException when non-admin tries to create bubble_admin', async () => {
      await expect(
        service.create(
          { email: 'new@acme.com', password: 'Password1!', role: 'bubble_admin' },
          tenantId,
          UserRole.CUSTOMER_ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('[1H.1-UNIT-005] should allow Bubble Admin to create bubble_admin users', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce(null);
      const adminUser = { ...mockUser, role: UserRole.BUBBLE_ADMIN };
      mockManager.create.mockReturnValue(adminUser);
      mockManager.save.mockResolvedValue(adminUser);

      const result = await service.create(
        { email: 'new@acme.com', password: 'Password1!', role: 'bubble_admin' },
        tenantId,
        UserRole.BUBBLE_ADMIN,
      );

      expect(result.role).toBe(UserRole.BUBBLE_ADMIN);
    });

    it('[1H.1-UNIT-006] should hash password with bcrypt', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(mockTenant)
        .mockResolvedValueOnce(null);
      mockManager.create.mockReturnValue(mockUser);
      mockManager.save.mockResolvedValue(mockUser);

      await service.create(
        { email: 'alice@acme.com', password: 'Password1!', role: 'creator' },
        tenantId,
        UserRole.CUSTOMER_ADMIN,
      );

      const createCall = mockManager.create.mock.calls[0];
      const passedData = createCall[1] as { passwordHash: string };
      expect(await bcrypt.compare('Password1!', passedData.passwordHash)).toBe(true);
    });
  });

  describe('findAllByTenant', () => {
    it('[1H.1-UNIT-007] should return all users for tenant without password hashes', async () => {
      mockManager.find.mockResolvedValue([mockUser]);

      const result = await service.findAllByTenant(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('alice@acme.com');
      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(mockManager.find).toHaveBeenCalledWith(UserEntity, {
        where: { tenantId },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('[1H.1-UNIT-008] should return a single user', async () => {
      mockManager.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id, tenantId);

      expect(result.id).toBe(mockUser.id);
    });

    it('[1H.1-UNIT-009] should throw NotFoundException if user not found', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent-id', tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('[1H.1-UNIT-010] should update user role and name', async () => {
      const updatedUser = { ...mockUser, role: UserRole.CUSTOMER_ADMIN, name: 'Alice Updated' };
      mockManager.findOne.mockResolvedValue({ ...mockUser });
      mockManager.save.mockResolvedValue(updatedUser);

      const result = await service.update(
        mockUser.id,
        tenantId,
        { role: 'customer_admin', name: 'Alice Updated' },
        UserRole.BUBBLE_ADMIN,
      );

      expect(result.role).toBe(UserRole.CUSTOMER_ADMIN);
      expect(result.name).toBe('Alice Updated');
    });

    it('[1H.1-UNIT-011] should throw ForbiddenException when Customer Admin promotes to bubble_admin', async () => {
      mockManager.findOne.mockResolvedValue({ ...mockUser });

      await expect(
        service.update(
          mockUser.id,
          tenantId,
          { role: 'bubble_admin' },
          UserRole.CUSTOMER_ADMIN,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deactivate', () => {
    it('[1H.1-UNIT-012] should set user status to inactive', async () => {
      const deactivatedUser = { ...mockUser, status: UserStatus.INACTIVE };
      mockManager.findOne.mockResolvedValue({ ...mockUser });
      mockManager.save.mockResolvedValue(deactivatedUser);

      const result = await service.deactivate(mockUser.id, tenantId);

      expect(result.status).toBe(UserStatus.INACTIVE);
    });

    it('[1H.1-UNIT-013] should throw NotFoundException for non-existent user', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.deactivate('nonexistent-id', tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    it('[1H.1-UNIT-014] should hash and update user password', async () => {
      mockManager.findOne.mockResolvedValue({ ...mockUser });
      mockManager.save.mockResolvedValue(mockUser);

      await service.resetPassword(mockUser.id, tenantId, 'NewPassword1!');

      const saveCall = mockManager.save.mock.calls[0];
      const savedUser = saveCall[1] as { passwordHash: string };
      expect(await bcrypt.compare('NewPassword1!', savedUser.passwordHash)).toBe(true);
    });

    it('[1H.1-UNIT-015] should throw NotFoundException for non-existent user', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('nonexistent-id', tenantId, 'NewPassword1!'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
