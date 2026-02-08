import { Test, TestingModule } from '@nestjs/testing';
import { createMockFolder } from '@project-bubble/db-layer/testing';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { TenantStatusGuard } from '../guards/tenant-status.guard';

describe('FoldersController [P2]', () => {
  let controller: FoldersController;
  let service: jest.Mocked<FoldersService>;

  const mockReq = { user: { tenantId: 'tenant-1' } };
  const mockFolder = createMockFolder({ tenantId: 'tenant-1' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FoldersController],
      providers: [
        {
          provide: FoldersService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockFolder),
            findAll: jest.fn().mockResolvedValue([mockFolder]),
            findOne: jest.fn().mockResolvedValue(mockFolder),
            update: jest.fn().mockResolvedValue(mockFolder),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(TenantStatusGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FoldersController);
    service = module.get(FoldersService);
  });

  it('[2.1-UNIT-034] should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('[2.1-UNIT-035] should call service.create with dto and tenant_id', async () => {
      const dto = { name: 'New Folder', parentId: null } as any;

      const result = await controller.create(dto, mockReq as any);

      expect(result).toEqual(mockFolder);
      expect(service.create).toHaveBeenCalledWith(dto, 'tenant-1');
    });
  });

  describe('findAll', () => {
    it('[2.1-UNIT-036] should call service.findAll with tenant_id', async () => {
      const result = await controller.findAll(mockReq as any);

      expect(result).toEqual([mockFolder]);
      expect(service.findAll).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('update', () => {
    it('[2.1-UNIT-037] should call service.update with id, tenant_id and dto', async () => {
      const dto = { name: 'Renamed Folder' } as any;

      const result = await controller.update('folder-1', dto, mockReq as any);

      expect(result).toEqual(mockFolder);
      expect(service.update).toHaveBeenCalledWith('folder-1', 'tenant-1', dto);
    });
  });

  describe('delete', () => {
    it('[2.1-UNIT-038] should call service.delete with id and tenant_id', async () => {
      await controller.delete('folder-1', mockReq as any);

      expect(service.delete).toHaveBeenCalledWith('folder-1', 'tenant-1');
    });
  });
});
