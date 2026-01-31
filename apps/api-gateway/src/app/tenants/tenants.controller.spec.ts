import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantEntity, TenantStatus, PlanTier } from '@project-bubble/db-layer';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

describe('TenantsController', () => {
  let controller: TenantsController;
  let service: jest.Mocked<TenantsService>;

  const mockTenant: TenantEntity = {
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-api-key'),
          },
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    service = module.get(TenantsService);
  });

  describe('create', () => {
    it('should create a tenant', async () => {
      service.create.mockResolvedValue(mockTenant);

      const result = await controller.create({ name: 'Acme Corp' });

      expect(result).toEqual(mockTenant);
      expect(service.create).toHaveBeenCalledWith({ name: 'Acme Corp' });
    });

    it('should propagate ConflictException', async () => {
      service.create.mockRejectedValue(
        new ConflictException('Tenant with name "Acme Corp" already exists'),
      );

      await expect(controller.create({ name: 'Acme Corp' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all tenants', async () => {
      service.findAll.mockResolvedValue([mockTenant]);

      const result = await controller.findAll();

      expect(result).toEqual([mockTenant]);
    });
  });

  describe('findOne', () => {
    it('should return a tenant by id', async () => {
      service.findOne.mockResolvedValue(mockTenant);

      const result = await controller.findOne(mockTenant.id);

      expect(result).toEqual(mockTenant);
    });

    it('should propagate NotFoundException', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a tenant with partial data', async () => {
      const updated = { ...mockTenant, name: 'Updated Corp' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(mockTenant.id, { name: 'Updated Corp' });

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(mockTenant.id, { name: 'Updated Corp' });
    });

    it('should propagate NotFoundException for non-existent tenant', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      await expect(
        controller.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
