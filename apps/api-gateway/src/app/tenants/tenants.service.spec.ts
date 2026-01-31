import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { TenantEntity, TenantStatus, PlanTier } from '@project-bubble/db-layer';
import { createMockTenant } from '@project-bubble/db-layer/testing';
import { TenantsService } from './tenants.service';

describe('TenantsService [P1]', () => {
  let service: TenantsService;
  let repo: jest.Mocked<Repository<TenantEntity>>;

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
    it('[1H.1-UNIT-008] should return a token for an active tenant', async () => {
      repo.findOne.mockResolvedValue(mockTenant);

      const result = await service.impersonate(mockTenant.id);

      expect(result.token).toBe('mock-jwt-token');
      expect(result.tenant).toEqual({ id: mockTenant.id, name: mockTenant.name });
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        {
          sub: 'admin',
          tenant_id: mockTenant.id,
          role: 'impersonator',
          impersonating: true,
        },
        { expiresIn: '60m' },
      );
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
});
