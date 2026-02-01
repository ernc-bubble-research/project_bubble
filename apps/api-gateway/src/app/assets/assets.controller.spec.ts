import { Test, TestingModule } from '@nestjs/testing';
import { createMockAsset } from '@project-bubble/db-layer/testing';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

describe('AssetsController [P2]', () => {
  let controller: AssetsController;
  let service: jest.Mocked<AssetsService>;

  const mockReq = { user: { userId: 'user-1', tenant_id: 'tenant-1' } };
  const mockAsset = createMockAsset({ tenantId: 'tenant-1' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetsController],
      providers: [
        {
          provide: AssetsService,
          useValue: {
            upload: jest.fn().mockResolvedValue(mockAsset),
            findAll: jest.fn().mockResolvedValue([mockAsset]),
            findOne: jest.fn().mockResolvedValue(mockAsset),
            update: jest.fn().mockResolvedValue(mockAsset),
            archive: jest.fn().mockResolvedValue(mockAsset),
            restore: jest.fn().mockResolvedValue(mockAsset),
          },
        },
      ],
    }).compile();

    controller = module.get(AssetsController);
    service = module.get(AssetsService);
  });

  it('[2.1-UNIT-026] should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    it('[2.1-UNIT-027] should call service.upload with correct params', async () => {
      const mockFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('test'),
        size: 4,
      } as Express.Multer.File;
      const dto = {} as any;

      const result = await controller.upload(mockFile, dto, mockReq as any);

      expect(result).toEqual(mockAsset);
      expect(service.upload).toHaveBeenCalledWith(
        mockFile,
        dto,
        'tenant-1',
        'user-1',
      );
    });
  });

  describe('findAll', () => {
    it('[2.1-UNIT-028] should call service.findAll with tenant_id and query params', async () => {
      const query = { folderId: 'folder-1', status: 'active' } as any;
      const result = await controller.findAll(mockReq as any, query);

      expect(result).toEqual([mockAsset]);
      expect(service.findAll).toHaveBeenCalledWith(
        'tenant-1',
        { folderId: 'folder-1', status: 'active', limit: undefined, offset: undefined },
      );
    });

    it('[2.1-UNIT-029] should call service.findAll without optional params', async () => {
      const query = {} as any;
      const result = await controller.findAll(mockReq as any, query);

      expect(result).toEqual([mockAsset]);
      expect(service.findAll).toHaveBeenCalledWith(
        'tenant-1',
        { folderId: undefined, status: undefined, limit: undefined, offset: undefined },
      );
    });
  });

  describe('findOne', () => {
    it('[2.1-UNIT-030] should call service.findOne with id and tenant_id', async () => {
      const result = await controller.findOne('asset-1', mockReq as any);

      expect(result).toEqual(mockAsset);
      expect(service.findOne).toHaveBeenCalledWith('asset-1', 'tenant-1');
    });
  });

  describe('update', () => {
    it('[2.1-UNIT-031] should call service.update with id, tenant_id and dto', async () => {
      const dto = { name: 'renamed.pdf' } as any;

      const result = await controller.update('asset-1', dto, mockReq as any);

      expect(result).toEqual(mockAsset);
      expect(service.update).toHaveBeenCalledWith('asset-1', 'tenant-1', dto);
    });
  });

  describe('archive', () => {
    it('[2.1-UNIT-032] should call service.archive with id and tenant_id', async () => {
      const result = await controller.archive('asset-1', mockReq as any);

      expect(result).toEqual(mockAsset);
      expect(service.archive).toHaveBeenCalledWith('asset-1', 'tenant-1');
    });
  });

  describe('restore', () => {
    it('[2.1-UNIT-033] should call service.restore with id and tenant_id', async () => {
      const result = await controller.restore('asset-1', mockReq as any);

      expect(result).toEqual(mockAsset);
      expect(service.restore).toHaveBeenCalledWith('asset-1', 'tenant-1');
    });
  });
});
