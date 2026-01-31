import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  InvitationEntity,
  InvitationStatus,
  UserEntity,
  UserRole,
  UserStatus,
  TenantEntity,
} from '@project-bubble/db-layer';
import { createMockTenant } from '@project-bubble/db-layer/testing';
import { InvitationsService } from './invitations.service';
import { EmailService } from '../email/email.service';

describe('InvitationsService [P1]', () => {
  let service: InvitationsService;
  let invitationRepo: Record<string, jest.Mock>;
  let userRepo: Record<string, jest.Mock>;
  let tenantRepo: Record<string, jest.Mock>;
  let emailService: Record<string, jest.Mock>;
  let dataSource: Record<string, jest.Mock>;

  const mockTenant = createMockTenant({ id: 'tenant-1', name: 'Acme Corp' });

  beforeEach(async () => {
    invitationRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ ...data, id: 'inv-1' })),
      save: jest.fn((entity) => ({
        ...entity,
        id: entity.id || 'inv-1',
        createdAt: new Date('2026-01-31'),
        updatedAt: new Date('2026-01-31'),
      })),
      remove: jest.fn(),
    };

    userRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ ...data, id: 'user-1' })),
      save: jest.fn((entity) => entity),
    };

    tenantRepo = {
      findOne: jest.fn(),
    };

    emailService = {
      sendInvitationEmail: jest.fn().mockResolvedValue(undefined),
    };

    dataSource = {
      transaction: jest.fn(async (cb: (manager: unknown) => Promise<void>) => {
        // Create transactional repos that delegate to the same mocks
        const txManager = {
          getRepository: jest.fn((entity: unknown) => {
            if (entity === InvitationEntity) return invitationRepo;
            if (entity === UserEntity) return userRepo;
            return {};
          }),
        };
        return cb(txManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationsService,
        { provide: getRepositoryToken(InvitationEntity), useValue: invitationRepo },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        { provide: getRepositoryToken(TenantEntity), useValue: tenantRepo },
        { provide: EmailService, useValue: emailService },
        { provide: DataSource, useValue: dataSource },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              if (key === 'INVITATION_EXPIRY_HOURS') return 72;
              return defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<InvitationsService>(InvitationsService);
  });

  describe('create', () => {
    it('[1H.1-UNIT-001] should create an invitation and send email', async () => {
      userRepo.findOne.mockResolvedValue(null);
      invitationRepo.findOne.mockResolvedValue(null);
      tenantRepo.findOne.mockResolvedValue(mockTenant);

      const result = await service.create(
        { email: 'bob@example.com', role: 'creator', name: 'Bob' },
        'tenant-1',
        'inviter-1',
        'Alice',
      );

      expect(result.email).toBe('bob@example.com');
      expect(result.role).toBe('creator');
      expect(result.status).toBe(InvitationStatus.PENDING);
      expect(invitationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inviterName: 'Alice',
          name: 'Bob',
          tokenPrefix: expect.any(String),
        }),
      );
      expect(invitationRepo.save).toHaveBeenCalled();
      expect(emailService.sendInvitationEmail).toHaveBeenCalledWith(
        'bob@example.com',
        expect.any(String),
        'Alice',
        'Acme Corp',
      );
    });

    it('[1H.1-UNIT-002] should throw ConflictException if user email exists globally', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'existing-user', email: 'bob@example.com' });

      await expect(
        service.create(
          { email: 'bob@example.com', role: 'creator' },
          'tenant-1',
          'inviter-1',
          'Alice',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('[1H.1-UNIT-003] should throw ConflictException if pending invitation exists for same email+tenant', async () => {
      userRepo.findOne.mockResolvedValue(null);
      invitationRepo.findOne.mockResolvedValue({ id: 'existing-inv', status: InvitationStatus.PENDING });

      await expect(
        service.create(
          { email: 'bob@example.com', role: 'creator' },
          'tenant-1',
          'inviter-1',
          'Alice',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('[1H.1-UNIT-004] should rollback invitation if email sending fails', async () => {
      userRepo.findOne.mockResolvedValue(null);
      invitationRepo.findOne.mockResolvedValue(null);
      tenantRepo.findOne.mockResolvedValue(mockTenant);
      emailService.sendInvitationEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.create(
          { email: 'bob@example.com', role: 'creator' },
          'tenant-1',
          'inviter-1',
          'Alice',
        ),
      ).rejects.toThrow('SMTP error');

      expect(invitationRepo.remove).toHaveBeenCalled();
    });
  });

  describe('accept', () => {
    it('[1H.1-UNIT-005] should accept a valid invitation and create user within a transaction', async () => {
      const tokenHash = await bcrypt.hash('valid-token', 10);
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);

      const mockInvitation = {
        id: 'inv-1',
        email: 'bob@example.com',
        tokenHash,
        tokenPrefix: 'valid-to',
        tenantId: 'tenant-1',
        role: UserRole.CREATOR,
        inviterName: 'Alice',
        name: 'Bob Smith',
        status: InvitationStatus.PENDING,
        expiresAt: futureDate,
      };

      invitationRepo.find.mockResolvedValue([mockInvitation]);
      userRepo.findOne.mockResolvedValue(null);

      await service.accept({ token: 'valid-token', password: 'Password123!' });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'bob@example.com',
          tenantId: 'tenant-1',
          role: UserRole.CREATOR,
          name: 'Bob Smith',
          status: UserStatus.ACTIVE,
        }),
      );
      expect(userRepo.save).toHaveBeenCalled();
      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.ACCEPTED }),
      );
    });

    it('[1H.1-UNIT-006] should throw BadRequestException for invalid token', async () => {
      invitationRepo.find.mockResolvedValue([]);

      await expect(
        service.accept({ token: 'invalid-token', password: 'Password123!' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('[1H.1-UNIT-007] should throw BadRequestException for expired token', async () => {
      const tokenHash = await bcrypt.hash('expired-token', 10);
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const mockInvitation = {
        id: 'inv-1',
        email: 'bob@example.com',
        tokenHash,
        tokenPrefix: 'expired-',
        tenantId: 'tenant-1',
        role: UserRole.CREATOR,
        status: InvitationStatus.PENDING,
        expiresAt: pastDate,
      };

      invitationRepo.find.mockResolvedValue([mockInvitation]);

      await expect(
        service.accept({ token: 'expired-token', password: 'Password123!' }),
      ).rejects.toThrow(BadRequestException);

      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.EXPIRED }),
      );
    });

    it('[1H.1-UNIT-008] should throw ConflictException if email already exists during accept', async () => {
      const tokenHash = await bcrypt.hash('valid-token', 10);
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);

      invitationRepo.find.mockResolvedValue([{
        id: 'inv-1',
        email: 'bob@example.com',
        tokenHash,
        tokenPrefix: 'valid-to',
        tenantId: 'tenant-1',
        role: UserRole.CREATOR,
        status: InvitationStatus.PENDING,
        expiresAt: futureDate,
      }]);
      userRepo.findOne.mockResolvedValue({ id: 'existing', email: 'bob@example.com' });

      await expect(
        service.accept({ token: 'valid-token', password: 'Password123!' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('resend', () => {
    it('[1H.1-UNIT-009] should resend a pending invitation with tenant name', async () => {
      const mockInvitation = {
        id: 'inv-1',
        email: 'bob@example.com',
        status: InvitationStatus.PENDING,
        inviterName: 'Alice',
        tenantId: 'tenant-1',
        tokenHash: 'old-hash',
        tokenPrefix: 'old-pref',
        expiresAt: new Date(),
      };

      invitationRepo.findOne.mockResolvedValue(mockInvitation);
      tenantRepo.findOne.mockResolvedValue(mockTenant);

      await service.resend('inv-1', 'tenant-1');

      expect(invitationRepo.save).toHaveBeenCalled();
      expect(tenantRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
      });
      expect(emailService.sendInvitationEmail).toHaveBeenCalledWith(
        'bob@example.com',
        expect.any(String),
        'Alice',
        'Acme Corp',
      );
    });

    it('[1H.1-UNIT-010] should rollback token changes if email fails during resend', async () => {
      const oldExpiresAt = new Date('2026-01-30');
      const mockInvitation = {
        id: 'inv-1',
        email: 'bob@example.com',
        status: InvitationStatus.PENDING,
        inviterName: 'Alice',
        tenantId: 'tenant-1',
        tokenHash: 'old-hash',
        tokenPrefix: 'old-pref',
        expiresAt: oldExpiresAt,
      };

      invitationRepo.findOne.mockResolvedValue(mockInvitation);
      tenantRepo.findOne.mockResolvedValue(mockTenant);
      emailService.sendInvitationEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(service.resend('inv-1', 'tenant-1')).rejects.toThrow('SMTP error');

      // Verify rollback: save was called at least twice (once for new token, once for rollback)
      expect(invitationRepo.save).toHaveBeenCalledTimes(2);
      // The last save should have rolled back to old values
      const lastSaveCall = invitationRepo.save.mock.calls[1][0];
      expect(lastSaveCall.tokenHash).toBe('old-hash');
      expect(lastSaveCall.tokenPrefix).toBe('old-pref');
    });

    it('[1H.1-UNIT-011] should throw NotFoundException if invitation not found', async () => {
      invitationRepo.findOne.mockResolvedValue(null);

      await expect(service.resend('inv-1', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('[1H.1-UNIT-012] should throw BadRequestException if invitation is not pending', async () => {
      invitationRepo.findOne.mockResolvedValue({
        id: 'inv-1',
        status: InvitationStatus.ACCEPTED,
        tenantId: 'tenant-1',
      });

      await expect(service.resend('inv-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('revoke', () => {
    it('[1H.1-UNIT-013] should revoke a pending invitation', async () => {
      const mockInvitation = {
        id: 'inv-1',
        email: 'bob@example.com',
        status: InvitationStatus.PENDING,
        tenantId: 'tenant-1',
      };

      invitationRepo.findOne.mockResolvedValue(mockInvitation);

      await service.revoke('inv-1', 'tenant-1');

      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvitationStatus.REVOKED }),
      );
    });

    it('[1H.1-UNIT-014] should throw NotFoundException if invitation not found', async () => {
      invitationRepo.findOne.mockResolvedValue(null);

      await expect(service.revoke('inv-1', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllByTenant', () => {
    it('[1H.1-UNIT-015] should return all invitations for a tenant', async () => {
      const mockInvitations = [
        {
          id: 'inv-1',
          email: 'bob@example.com',
          role: UserRole.CREATOR,
          status: InvitationStatus.PENDING,
          invitedBy: 'inviter-1',
          inviterName: 'Alice',
          expiresAt: new Date('2026-02-03'),
          createdAt: new Date('2026-01-31'),
          tenantId: 'tenant-1',
        },
      ];

      invitationRepo.find.mockResolvedValue(mockInvitations);

      const result = await service.findAllByTenant('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('bob@example.com');
      expect(invitationRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
