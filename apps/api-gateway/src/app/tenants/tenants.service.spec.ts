import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { TenantEntity, TenantStatus, PlanTier, IMPERSONATOR_ROLE } from '@project-bubble/db-layer';
import { createMockTenant } from '@project-bubble/db-layer/testing';
import { TenantsService } from './tenants.service';
import { SupportAccessService } from '../support-access/support-access.service';

// Mock fs/promises at module level
jest.mock('fs/promises', () => ({
  rm: jest.fn().mockResolvedValue(undefined),
}));

describe('TenantsService [P1]', () => {
  let service: TenantsService;
  let repo: jest.Mocked<Repository<TenantEntity>>;
  let mockManager: Record<string, jest.Mock>;
  let mockDataSource: { transaction: jest.Mock };

  const mockTenant = createMockTenant({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Acme Corp',
    status: TenantStatus.ACTIVE,
    primaryContact: null,
    planTier: PlanTier.FREE,
    dataResidency: 'eu-west',
    maxMonthlyRuns: 50,
    assetRetentionDays: 30,
    createdAt: new Date('2026-01-30'),
    updatedAt: new Date('2026-01-30'),
  });

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  beforeEach(async () => {
    mockManager = {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }),
    };

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: getRepositoryToken(TenantEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: SupportAccessService,
          useValue: {
            logSessionStart: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    repo = module.get(getRepositoryToken(TenantEntity));
  });

  describe('create', () => {
    it('[1H.1-UNIT-001] should create a tenant successfully', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockTenant);
      repo.save.mockResolvedValue(mockTenant);

      const result = await service.create({ name: 'Acme Corp' });

      expect(result).toEqual(mockTenant);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { name: 'Acme Corp' },
      });
      expect(repo.create).toHaveBeenCalledWith({ name: 'Acme Corp' });
      expect(repo.save).toHaveBeenCalledWith(mockTenant);
    });

    it('[1H.1-UNIT-002] should throw ConflictException for duplicate name', async () => {
      repo.findOne.mockResolvedValue(mockTenant);

      await expect(service.create({ name: 'Acme Corp' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('[1H.1-UNIT-003] should throw ConflictException on unique constraint race condition', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockTenant);

      const dbError = new QueryFailedError('INSERT', [], new Error('unique'));
      Object.assign(dbError, { code: '23505' });
      repo.save.mockRejectedValue(dbError);

      await expect(service.create({ name: 'Acme Corp' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('[1H.1-UNIT-004] should rethrow non-unique-constraint errors', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockTenant);

      const dbError = new QueryFailedError('INSERT', [], new Error('other'));
      Object.assign(dbError, { code: '42P01' });
      repo.save.mockRejectedValue(dbError);

      await expect(service.create({ name: 'Acme Corp' })).rejects.toThrow(
        QueryFailedError,
      );
    });
  });

  describe('findAll', () => {
    it('[1H.1-UNIT-005] should return all tenants', async () => {
      repo.find.mockResolvedValue([mockTenant]);

      const result = await service.findAll();

      expect(result).toEqual([mockTenant]);
      expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    });
  });

  describe('findOne', () => {
    it('[1H.1-UNIT-006] should return a tenant by id', async () => {
      repo.findOne.mockResolvedValue(mockTenant);

      const result = await service.findOne(mockTenant.id);

      expect(result).toEqual(mockTenant);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: mockTenant.id },
      });
    });

    it('[1H.1-UNIT-007] should throw NotFoundException for missing tenant', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('impersonate', () => {
    it('[1H.1-UNIT-008] should return a token for an active tenant with real admin UUID', async () => {
      const adminUserId = 'aaa11111-bbbb-cccc-dddd-eeeeeeee0001';
      repo.findOne.mockResolvedValue(mockTenant);

      const result = await service.impersonate(mockTenant.id, adminUserId);

      expect(result.token).toBe('mock-jwt-token');
      expect(result.tenant).toEqual({ id: mockTenant.id, name: mockTenant.name });
      expect(result.sessionId).toBeDefined();
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          sub: adminUserId,
          tenant_id: mockTenant.id,
          role: IMPERSONATOR_ROLE,
          impersonating: true,
          impersonated_by: adminUserId,
          sessionId: expect.any(String),
        },
        { expiresIn: '30m' },
      );
    });

    it('[4-SA-UNIT-001] should set sub to real admin UUID, not literal "admin"', async () => {
      const adminUserId = 'aaa11111-bbbb-cccc-dddd-eeeeeeee0001';
      repo.findOne.mockResolvedValue(mockTenant);

      await service.impersonate(mockTenant.id, adminUserId);

      const signCall = mockJwtService.sign.mock.calls[0];
      expect(signCall[0].sub).toBe(adminUserId);
      expect(signCall[0].sub).not.toBe('admin');
      expect(signCall[0].impersonated_by).toBe(adminUserId);
      expect(signCall[0].sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
    });

    it('[1H.1-UNIT-009] should log a warning with admin ID when impersonating', async () => {
      repo.findOne.mockResolvedValue(mockTenant);
      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      await service.impersonate(mockTenant.id, 'admin-user-123');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('IMPERSONATION: Admin admin-user-123 impersonated tenant'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(mockTenant.id),
      );
    });

    it('[1H.1-UNIT-010] should throw NotFoundException for non-existent tenant', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.impersonate('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('[1H.1-UNIT-011] should throw BadRequestException for suspended tenant', async () => {
      const suspendedTenant = {
        ...mockTenant,
        status: TenantStatus.SUSPENDED,
      };
      repo.findOne.mockResolvedValue(suspendedTenant);

      await expect(service.impersonate(mockTenant.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('[4-SA-UNIT-017] should return sessionId that matches the sessionId in JWT payload', async () => {
      const adminUserId = 'aaa11111-bbbb-cccc-dddd-eeeeeeee0001';
      repo.findOne.mockResolvedValue(mockTenant);
      mockJwtService.sign.mockClear().mockReturnValue('mock-jwt-token');

      const result = await service.impersonate(mockTenant.id, adminUserId);

      const signCall = mockJwtService.sign.mock.calls[0];
      expect(result.sessionId).toBe(signCall[0].sessionId);
    });

    it('[4-SA-UNIT-018] should pass a 64-char hex SHA-256 hash to logSessionStart', async () => {
      const adminUserId = 'aaa11111-bbbb-cccc-dddd-eeeeeeee0001';
      repo.findOne.mockResolvedValue(mockTenant);
      const mockSupportService = service['supportAccessService'] as unknown as { logSessionStart: jest.Mock };

      await service.impersonate(mockTenant.id, adminUserId);

      const hashArg = mockSupportService.logSessionStart.mock.calls[0][3];
      expect(hashArg).toMatch(/^[0-9a-f]{64}$/);
      // Deterministic: same mock token always produces same hash
      expect(hashArg).toBe('6e21b2d686605222c514d90f82d9d27e633025ddbdd0b061686e8c70c92c2721');
    });

    it('[1-13-UNIT-001a] should throw BadRequestException for archived tenant', async () => {
      const archivedTenant = {
        ...mockTenant,
        status: TenantStatus.ARCHIVED,
      };
      repo.findOne.mockResolvedValue(archivedTenant);

      await expect(service.impersonate(mockTenant.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('[1H.1-UNIT-012] should update a tenant with partial data (name only)', async () => {
      const updated = { ...mockTenant, name: 'New Name' };
      repo.findOne.mockResolvedValue({ ...mockTenant });
      repo.save.mockResolvedValue(updated);

      const result = await service.update(mockTenant.id, { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: mockTenant.id } });
      expect(repo.save).toHaveBeenCalled();
    });

    it('[1H.1-UNIT-013] should update entitlements fields only', async () => {
      const updated = { ...mockTenant, maxMonthlyRuns: 200, assetRetentionDays: 90 };
      repo.findOne.mockResolvedValue({ ...mockTenant });
      repo.save.mockResolvedValue(updated);

      const result = await service.update(mockTenant.id, {
        maxMonthlyRuns: 200,
        assetRetentionDays: 90,
      });

      expect(result.maxMonthlyRuns).toBe(200);
      expect(result.assetRetentionDays).toBe(90);
    });

    it('[1H.1-UNIT-014] should throw NotFoundException for non-existent tenant', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-id', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('[1H.1-UNIT-015] should update status from active to suspended', async () => {
      const updated = { ...mockTenant, status: TenantStatus.SUSPENDED };
      repo.findOne.mockResolvedValue({ ...mockTenant });
      repo.save.mockResolvedValue(updated);

      const result = await service.update(mockTenant.id, { status: 'suspended' });

      expect(result.status).toBe(TenantStatus.SUSPENDED);
    });

    it('[1H.1-UNIT-016] should update status from suspended to active', async () => {
      const suspendedTenant = { ...mockTenant, status: TenantStatus.SUSPENDED };
      const activated = { ...mockTenant, status: TenantStatus.ACTIVE };
      repo.findOne.mockResolvedValue({ ...suspendedTenant });
      repo.save.mockResolvedValue(activated);

      const result = await service.update(mockTenant.id, { status: 'active' });

      expect(result.status).toBe(TenantStatus.ACTIVE);
    });
  });

  describe('archive', () => {
    it('[1-13-UNIT-002] should set status to archived from active', async () => {
      const activeTenant = { ...mockTenant, status: TenantStatus.ACTIVE };
      const archivedTenant = { ...mockTenant, status: TenantStatus.ARCHIVED };
      repo.findOne.mockResolvedValue(activeTenant);
      repo.save.mockResolvedValue(archivedTenant);

      const result = await service.archive(mockTenant.id);

      expect(result.status).toBe(TenantStatus.ARCHIVED);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TenantStatus.ARCHIVED }),
      );
    });

    it('[1-13-UNIT-002a] should set status to archived from suspended', async () => {
      const suspendedTenant = { ...mockTenant, status: TenantStatus.SUSPENDED };
      const archivedTenant = { ...mockTenant, status: TenantStatus.ARCHIVED };
      repo.findOne.mockResolvedValue(suspendedTenant);
      repo.save.mockResolvedValue(archivedTenant);

      const result = await service.archive(mockTenant.id);

      expect(result.status).toBe(TenantStatus.ARCHIVED);
    });

    it('[1-13-UNIT-002b] should reject already-archived tenant', async () => {
      const archivedTenant = { ...mockTenant, status: TenantStatus.ARCHIVED };
      repo.findOne.mockResolvedValue(archivedTenant);

      await expect(service.archive(mockTenant.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('[1-13-UNIT-002c] should throw NotFoundException for missing tenant', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.archive('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unarchive', () => {
    it('[1-13-UNIT-003] should set status to active from archived', async () => {
      const archivedTenant = { ...mockTenant, status: TenantStatus.ARCHIVED };
      const activeTenant = { ...mockTenant, status: TenantStatus.ACTIVE };
      repo.findOne.mockResolvedValue(archivedTenant);
      repo.save.mockResolvedValue(activeTenant);

      const result = await service.unarchive(mockTenant.id);

      expect(result.status).toBe(TenantStatus.ACTIVE);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TenantStatus.ACTIVE }),
      );
    });

    it('[1-13-UNIT-003a] should reject non-archived tenant', async () => {
      const activeTenant = { ...mockTenant, status: TenantStatus.ACTIVE };
      repo.findOne.mockResolvedValue(activeTenant);

      await expect(service.unarchive(mockTenant.id)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('hardDelete', () => {
    it('[1-13-UNIT-004] should delete archived tenant', async () => {
      const archivedTenant = { ...mockTenant, status: TenantStatus.ARCHIVED };
      repo.findOne.mockResolvedValue(archivedTenant);

      await service.hardDelete(mockTenant.id);

      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('[1-13-UNIT-004a] should reject non-archived tenant', async () => {
      const activeTenant = { ...mockTenant, status: TenantStatus.ACTIVE };
      repo.findOne.mockResolvedValue(activeTenant);

      await expect(service.hardDelete(mockTenant.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('[1-13-UNIT-005] should cascade delete all 9 entity types in transaction', async () => {
      const archivedTenant = { ...mockTenant, status: TenantStatus.ARCHIVED };
      repo.findOne.mockResolvedValue(archivedTenant);

      await service.hardDelete(mockTenant.id);

      // manager.delete called for: Invitation, WorkflowRun, WorkflowVersion, Asset, Folder, User, Tenant
      expect(mockManager.delete).toHaveBeenCalledTimes(7);
      // createQueryBuilder called for: WorkflowChain, WorkflowTemplate, KnowledgeChunk (soft-delete entities)
      expect(mockManager.createQueryBuilder).toHaveBeenCalledTimes(3);
    });

    it('[1-13-UNIT-005a] should delete physical files after DB transaction', async () => {
      const archivedTenant = { ...mockTenant, status: TenantStatus.ARCHIVED };
      repo.findOne.mockResolvedValue(archivedTenant);

      const fsRm = jest.requireMock('fs/promises').rm;

      await service.hardDelete(mockTenant.id);

      expect(fsRm).toHaveBeenCalledWith(
        expect.stringContaining(mockTenant.id),
        { recursive: true, force: true },
      );
    });

    it('[1-13-UNIT-005b] should not throw if physical file deletion fails', async () => {
      const archivedTenant = { ...mockTenant, status: TenantStatus.ARCHIVED };
      repo.findOne.mockResolvedValue(archivedTenant);

      const fsRm = jest.requireMock('fs/promises').rm;
      fsRm.mockRejectedValueOnce(new Error('ENOENT'));

      await expect(service.hardDelete(mockTenant.id)).resolves.not.toThrow();
    });

    it('[1-13-UNIT-004b] should throw NotFoundException for missing tenant', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.hardDelete('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
