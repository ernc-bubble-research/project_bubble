import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantStatus, PlanTier } from '@project-bubble/db-layer';
import { createMockTenant } from '@project-bubble/db-layer/testing';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

describe('TenantsController [P2]', () => {
  let controller: TenantsController;
  let service: jest.Mocked<TenantsService>;

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
    it('[1H.1-UNIT-001] should create a tenant', async () => {
      service.create.mockResolvedValue(mockTenant);

      const result = await controller.create({ name: 'Acme Corp' });

      expect(result).toEqual(mockTenant);
      expect(service.create).toHaveBeenCalledWith({ name: 'Acme Corp' });
    });

    it('[1H.1-UNIT-002] should propagate ConflictException', async () => {
      service.create.mockRejectedValue(
        new ConflictException('Tenant with name "Acme Corp" already exists'),
      );

      await expect(controller.create({ name: 'Acme Corp' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('[1H.1-UNIT-003] should return all tenants', async () => {
      service.findAll.mockResolvedValue([mockTenant]);

      const result = await controller.findAll();

      expect(result).toEqual([mockTenant]);
    });
  });

  describe('findOne', () => {
    it('[1H.1-UNIT-004] should return a tenant by id', async () => {
      service.findOne.mockResolvedValue(mockTenant);

      const result = await controller.findOne(mockTenant.id);

      expect(result).toEqual(mockTenant);
    });

    it('[1H.1-UNIT-005] should propagate NotFoundException', async () => {
      service.findOne.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      await expect(controller.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('[1H.1-UNIT-006] should update a tenant with partial data', async () => {
      const updated = { ...mockTenant, name: 'Updated Corp' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(mockTenant.id, { name: 'Updated Corp' });

      expect(result).toEqual(updated);
      expect(service.update).toHaveBeenCalledWith(mockTenant.id, { name: 'Updated Corp' });
    });

    it('[1H.1-UNIT-007] should propagate NotFoundException for non-existent tenant', async () => {
      service.update.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      await expect(
        controller.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
