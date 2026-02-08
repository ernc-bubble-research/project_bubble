import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InvitationStatus } from '@project-bubble/db-layer';
import { TenantStatusGuard } from '../guards/tenant-status.guard';

describe('InvitationsController [P2]', () => {
  let controller: InvitationsController;
  let service: Record<string, jest.Mock>;

  const mockReq = {
    user: { userId: 'user-1', tenantId: 'tenant-1', role: 'customer_admin' },
  };

  const mockInvitationResponse = {
    id: 'inv-1',
    email: 'bob@example.com',
    role: 'creator',
    status: InvitationStatus.PENDING,
    invitedBy: 'user-1',
    inviterName: 'Admin',
    expiresAt: '2026-02-03T00:00:00.000Z',
    createdAt: '2026-01-31T00:00:00.000Z',
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockInvitationResponse),
      findAllByTenant: jest.fn().mockResolvedValue([mockInvitationResponse]),
      resend: jest.fn().mockResolvedValue(undefined),
      revoke: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationsController],
      providers: [{ provide: InvitationsService, useValue: service }],
    })
      .overrideGuard(TenantStatusGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InvitationsController>(InvitationsController);
  });

  it('[1H.1-UNIT-001] should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('[1H.1-UNIT-002] should create an invitation', async () => {
      const dto = { email: 'bob@example.com', role: 'creator' };
      const result = await controller.create(dto, mockReq as any);

      expect(result).toEqual(mockInvitationResponse);
      expect(service.create).toHaveBeenCalledWith(
        dto,
        'tenant-1',
        'user-1',
        'Admin',
      );
    });
  });

  describe('findAll', () => {
    it('[1H.1-UNIT-003] should return all invitations for tenant', async () => {
      const result = await controller.findAll(mockReq as any);

      expect(result).toEqual([mockInvitationResponse]);
      expect(service.findAllByTenant).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('resend', () => {
    it('[1H.1-UNIT-004] should resend an invitation', async () => {
      await controller.resend('inv-1', mockReq as any);

      expect(service.resend).toHaveBeenCalledWith('inv-1', 'tenant-1');
    });
  });

  describe('revoke', () => {
    it('[1H.1-UNIT-005] should revoke an invitation', async () => {
      await controller.revoke('inv-1', mockReq as any);

      expect(service.revoke).toHaveBeenCalledWith('inv-1', 'tenant-1');
    });
  });
});
