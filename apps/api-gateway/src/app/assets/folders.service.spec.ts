import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TransactionManager, FolderEntity, AssetEntity, AssetStatus } from '@project-bubble/db-layer';
import { createMockFolder } from '@project-bubble/db-layer/testing';
import { FoldersService } from './folders.service';

describe('FoldersService [P1]', () => {
  let service: FoldersService;

  const mockManager = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };

  const mockTxManager = {
    run: jest.fn().mockImplementation(
      (tenantIdOrCb: string | ((m: unknown) => Promise<unknown>), maybeCb?: (m: unknown) => Promise<unknown>) => {
        const cb = typeof tenantIdOrCb === 'function' ? tenantIdOrCb : maybeCb!;
        return cb(mockManager);
      },
    ),
  };

  const tenantId = '00000000-0000-0000-0000-000000000099';

  const mockFolder = createMockFolder({
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01',
    tenantId,
    name: 'Research Documents',
    parentId: null,
  });

  const mockParentFolder = createMockFolder({
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02',
    tenantId,
    name: 'Parent Folder',
    parentId: null,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoldersService,
        { provide: TransactionManager, useValue: mockTxManager },
      ],
    }).compile();

    service = module.get<FoldersService>(FoldersService);
  });

  describe('create', () => {
    it('[2.1-UNIT-016] should create a folder successfully', async () => {
      mockManager.create.mockReturnValue(mockFolder);
      mockManager.save.mockResolvedValue(mockFolder);

      const result = await service.create({ name: 'Research Documents' }, tenantId);

      expect(result).toEqual(mockFolder);
      expect(mockManager.create).toHaveBeenCalledWith(FolderEntity, {
        tenantId,
        name: 'Research Documents',
        parentId: null,
      });
      expect(mockManager.save).toHaveBeenCalledWith(FolderEntity, mockFolder);
    });

    it('[2.1-UNIT-017] should validate parent exists when parentId is provided', async () => {
      // findOne for parent validation
      mockManager.findOne.mockResolvedValueOnce(mockParentFolder);
      // create + save for the new folder
      const childFolder = createMockFolder({
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee03',
        tenantId,
        name: 'Sub Folder',
        parentId: mockParentFolder.id,
      });
      mockManager.create.mockReturnValue(childFolder);
      mockManager.save.mockResolvedValue(childFolder);

      const result = await service.create(
        { name: 'Sub Folder', parentId: mockParentFolder.id },
        tenantId,
      );

      expect(result).toEqual(childFolder);
      expect(mockManager.findOne).toHaveBeenCalledWith(FolderEntity, {
        where: { id: mockParentFolder.id },
      });
      expect(mockManager.create).toHaveBeenCalledWith(FolderEntity, {
        tenantId,
        name: 'Sub Folder',
        parentId: mockParentFolder.id,
      });
    });

    it('[2.1-UNIT-018] should throw NotFoundException for invalid parentId', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          { name: 'Sub Folder', parentId: 'nonexistent-parent-id' },
          tenantId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('[2.1-UNIT-019] should return folders ordered by name ASC', async () => {
      const folders = [
        createMockFolder({ tenantId, name: 'Alpha' }),
        createMockFolder({ tenantId, name: 'Beta' }),
        createMockFolder({ tenantId, name: 'Gamma' }),
      ];
      mockManager.find.mockResolvedValue(folders);

      const result = await service.findAll(tenantId);

      expect(result).toEqual(folders);
      expect(result).toHaveLength(3);
      expect(mockManager.find).toHaveBeenCalledWith(FolderEntity, {
        order: { name: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('[2.1-UNIT-020] should return a folder by id', async () => {
      mockManager.findOne.mockResolvedValue(mockFolder);

      const result = await service.findOne(mockFolder.id, tenantId);

      expect(result).toEqual(mockFolder);
      expect(mockManager.findOne).toHaveBeenCalledWith(FolderEntity, {
        where: { id: mockFolder.id },
      });
    });

    it('[2.1-UNIT-021] should throw NotFoundException when folder does not exist', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent-id', tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('[2.1-UNIT-022] should rename a folder', async () => {
      const updatedFolder = { ...mockFolder, name: 'Renamed Folder' };
      mockManager.findOne.mockResolvedValue({ ...mockFolder });
      mockManager.save.mockResolvedValue(updatedFolder);

      const result = await service.update(mockFolder.id, tenantId, {
        name: 'Renamed Folder',
      });

      expect(result).toEqual(updatedFolder);
      expect(mockManager.findOne).toHaveBeenCalledWith(FolderEntity, {
        where: { id: mockFolder.id },
      });
      expect(mockManager.save).toHaveBeenCalledWith(FolderEntity, expect.objectContaining({
        name: 'Renamed Folder',
      }));
    });
  });

  describe('delete', () => {
    it('[2.1-UNIT-023] should delete a folder when it is empty', async () => {
      mockManager.findOne.mockResolvedValue(mockFolder);
      mockManager.count.mockResolvedValueOnce(0); // no active assets
      mockManager.count.mockResolvedValueOnce(0); // no child folders
      mockManager.delete.mockResolvedValue({ affected: 1 });

      await expect(
        service.delete(mockFolder.id, tenantId),
      ).resolves.toBeUndefined();

      expect(mockManager.findOne).toHaveBeenCalledWith(FolderEntity, {
        where: { id: mockFolder.id },
      });
      expect(mockManager.count).toHaveBeenCalledWith(AssetEntity, {
        where: { folderId: mockFolder.id, status: AssetStatus.ACTIVE },
      });
      expect(mockManager.count).toHaveBeenCalledWith(FolderEntity, {
        where: { parentId: mockFolder.id },
      });
      expect(mockManager.delete).toHaveBeenCalledWith(FolderEntity, {
        id: mockFolder.id,
      });
    });

    it('[2.1-UNIT-024] should reject deletion when folder has active assets', async () => {
      mockManager.findOne.mockResolvedValue(mockFolder);
      mockManager.count.mockResolvedValueOnce(3); // 3 active assets

      await expect(
        service.delete(mockFolder.id, tenantId),
      ).rejects.toThrow(/active file/);

      expect(mockManager.delete).not.toHaveBeenCalled();
    });

    it('[2.1-UNIT-025] should reject deletion when folder has child folders', async () => {
      mockManager.findOne.mockResolvedValue(mockFolder);
      mockManager.count.mockResolvedValueOnce(0); // no active assets
      mockManager.count.mockResolvedValueOnce(2); // 2 child folders

      await expect(
        service.delete(mockFolder.id, tenantId),
      ).rejects.toThrow(/sub-folder/);

      expect(mockManager.delete).not.toHaveBeenCalled();
    });
  });
});
