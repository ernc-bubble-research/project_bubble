import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  TransactionManager,
  AssetEntity,
  AssetStatus,
} from '@project-bubble/db-layer';
import { createMockAsset } from '@project-bubble/db-layer/testing';
import { AssetsService } from './assets.service';

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('a'.repeat(64)),
  }),
}));

describe('AssetsService [P1]', () => {
  let service: AssetsService;
  let mockManager: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockTxManager: { run: jest.Mock };

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const mockAsset = createMockAsset({
    id: '11111111-1111-1111-1111-111111111111',
    tenantId,
    originalName: 'test.pdf',
    storagePath: `uploads/${tenantId}/mock-uuid-test.pdf`,
    mimeType: 'application/pdf',
    fileSize: 1024,
    sha256Hash: 'a'.repeat(64),
    isIndexed: false,
    status: AssetStatus.ACTIVE,
    archivedAt: null,
    uploadedBy: userId,
    createdAt: new Date('2026-01-31'),
    updatedAt: new Date('2026-01-31'),
  });

  // Expected DTO shape (excludes storagePath, folderId)
  const expectedDto = {
    id: mockAsset.id,
    tenantId: mockAsset.tenantId,
    folderId: mockAsset.folderId,
    originalName: mockAsset.originalName,
    mimeType: mockAsset.mimeType,
    fileSize: mockAsset.fileSize,
    sha256Hash: mockAsset.sha256Hash,
    isIndexed: mockAsset.isIndexed,
    status: mockAsset.status,
    archivedAt: mockAsset.archivedAt,
    uploadedBy: mockAsset.uploadedBy,
    createdAt: mockAsset.createdAt,
    updatedAt: mockAsset.updatedAt,
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test content'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  const mockDto = { folderId: undefined };

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockTxManager = {
      run: jest.fn().mockImplementation(
        (tenantIdOrCb: string | ((m: unknown) => Promise<unknown>), maybeCb?: (m: unknown) => Promise<unknown>) => {
          const cb = typeof tenantIdOrCb === 'function' ? tenantIdOrCb : maybeCb!;
          return cb(mockManager);
        },
      ),
    };

    service = new AssetsService(
      mockTxManager as unknown as TransactionManager,
    );
  });

  describe('upload', () => {
    it('[2.1-UNIT-001] should upload a valid PDF file successfully', async () => {
      // First txManager.run: duplicate check -> no duplicate found
      // Second txManager.run: create + save
      mockManager.findOne.mockResolvedValue(null);
      mockManager.create.mockReturnValue(mockAsset);
      mockManager.save.mockResolvedValue(mockAsset);

      const result = await service.upload(mockFile, mockDto as any, tenantId, userId);

      expect(result).toEqual(expectedDto);
      expect(mockTxManager.run).toHaveBeenCalledTimes(2);
      expect(mockManager.findOne).toHaveBeenCalledWith(AssetEntity, {
        where: { sha256Hash: 'a'.repeat(64), status: AssetStatus.ACTIVE },
      });
      expect(mockManager.create).toHaveBeenCalledWith(AssetEntity, expect.objectContaining({
        tenantId,
        originalName: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        sha256Hash: 'a'.repeat(64),
        isIndexed: false,
        status: AssetStatus.ACTIVE,
        uploadedBy: userId,
      }));
      expect(mockManager.save).toHaveBeenCalledWith(AssetEntity, mockAsset);
    });

    it('[2.1-UNIT-002] should reject duplicate file with same SHA-256 hash', async () => {
      // Duplicate check returns existing asset
      mockManager.findOne.mockResolvedValue(mockAsset);

      await expect(
        service.upload(mockFile, mockDto as any, tenantId, userId),
      ).rejects.toThrow(ConflictException);

      expect(mockTxManager.run).toHaveBeenCalledTimes(1);
      expect(mockManager.create).not.toHaveBeenCalled();
    });

    it('[2.1-UNIT-003] should reject file exceeding 10MB size limit', async () => {
      const largeFile: Express.Multer.File = {
        ...mockFile,
        size: 11 * 1024 * 1024, // 11MB
      };

      await expect(
        service.upload(largeFile, mockDto as any, tenantId, userId),
      ).rejects.toThrow(BadRequestException);

      expect(mockTxManager.run).not.toHaveBeenCalled();
    });

    it('[2.1-UNIT-004] should reject file with invalid extension', async () => {
      const invalidExtFile: Express.Multer.File = {
        ...mockFile,
        originalname: 'test.exe',
        mimetype: 'application/pdf', // valid MIME but bad extension
      };

      await expect(
        service.upload(invalidExtFile, mockDto as any, tenantId, userId),
      ).rejects.toThrow(BadRequestException);

      expect(mockTxManager.run).not.toHaveBeenCalled();
    });

    it('[2.1-UNIT-005] should reject file with invalid MIME type', async () => {
      const invalidMimeFile: Express.Multer.File = {
        ...mockFile,
        originalname: 'test.pdf',
        mimetype: 'application/octet-stream',
      };

      await expect(
        service.upload(invalidMimeFile, mockDto as any, tenantId, userId),
      ).rejects.toThrow(BadRequestException);

      expect(mockTxManager.run).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('[2.1-UNIT-006] should return assets for a tenant', async () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAsset]),
      };
      mockManager.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAll(tenantId);

      expect(result).toEqual([expectedDto]);
      expect(mockManager.createQueryBuilder).toHaveBeenCalledWith(AssetEntity, 'asset');
      // Default status filter is applied when no status provided
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'asset.status = :status',
        { status: AssetStatus.ACTIVE },
      );
      expect(mockQb.orderBy).toHaveBeenCalledWith('asset.createdAt', 'DESC');
      expect(mockQb.take).toHaveBeenCalledWith(50);
      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.getMany).toHaveBeenCalled();
    });

    it('[2.1-UNIT-007] should filter by folderId when provided', async () => {
      const folderId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockAsset]),
      };
      mockManager.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAll(tenantId, { folderId });

      expect(result).toEqual([expectedDto]);
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'asset.folderId = :folderId',
        { folderId },
      );
    });

  });

  describe('findOne', () => {
    it('[2.1-UNIT-009] should return an asset by id', async () => {
      mockManager.findOne.mockResolvedValue(mockAsset);

      const result = await service.findOne(mockAsset.id, tenantId);

      expect(result).toEqual(expectedDto);
      expect(mockManager.findOne).toHaveBeenCalledWith(AssetEntity, {
        where: { id: mockAsset.id },
      });
    });

    it('[2.1-UNIT-010] should throw NotFoundException when asset does not exist', async () => {
      mockManager.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('nonexistent-id', tenantId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('[2.1-UNIT-011] should update asset metadata', async () => {
      const updateDto = { name: 'renamed.pdf' };
      const updatedAsset = {
        ...mockAsset,
        originalName: 'renamed.pdf',
      };

      // findOne call inside update -> returns existing asset
      mockManager.findOne.mockResolvedValue({ ...mockAsset });
      mockManager.save.mockResolvedValue(updatedAsset);

      const result = await service.update(mockAsset.id, tenantId, updateDto as any);

      expect(result).toEqual({
        ...expectedDto,
        originalName: 'renamed.pdf',
      });
      expect(mockManager.save).toHaveBeenCalledWith(
        AssetEntity,
        expect.objectContaining({
          originalName: 'renamed.pdf',
        }),
      );
    });
  });

  describe('archive', () => {
    it('[2.1-UNIT-012] should archive an active asset', async () => {
      const archivedAsset = {
        ...mockAsset,
        status: AssetStatus.ARCHIVED,
        archivedAt: expect.any(Date),
      };

      mockManager.findOne.mockResolvedValue({ ...mockAsset });
      mockManager.save.mockResolvedValue(archivedAsset);

      const result = await service.archive(mockAsset.id, tenantId);

      expect(result.status).toBe(AssetStatus.ARCHIVED);
      expect(mockManager.save).toHaveBeenCalledWith(
        AssetEntity,
        expect.objectContaining({
          status: AssetStatus.ARCHIVED,
        }),
      );
    });

    it('[2.1-UNIT-013] should reject archiving an already archived asset', async () => {
      const archivedAsset = {
        ...mockAsset,
        status: AssetStatus.ARCHIVED,
        archivedAt: new Date(),
      };
      mockManager.findOne.mockResolvedValue(archivedAsset);

      await expect(
        service.archive(mockAsset.id, tenantId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('restore', () => {
    it('[2.1-UNIT-014] should restore an archived asset', async () => {
      const archivedAsset = {
        ...mockAsset,
        status: AssetStatus.ARCHIVED,
        archivedAt: new Date(),
      };
      const restoredAsset = {
        ...mockAsset,
        status: AssetStatus.ACTIVE,
        archivedAt: null,
      };

      mockManager.findOne.mockResolvedValue({ ...archivedAsset });
      mockManager.save.mockResolvedValue(restoredAsset);

      const result = await service.restore(mockAsset.id, tenantId);

      expect(result.status).toBe(AssetStatus.ACTIVE);
      expect(result.archivedAt).toBeNull();
      expect(mockManager.save).toHaveBeenCalledWith(
        AssetEntity,
        expect.objectContaining({
          status: AssetStatus.ACTIVE,
          archivedAt: null,
        }),
      );
    });

    it('[2.1-UNIT-015] should reject restoring a non-archived asset', async () => {
      mockManager.findOne.mockResolvedValue({ ...mockAsset });

      await expect(
        service.restore(mockAsset.id, tenantId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('log sanitization [2.1-UNIT-055] [P2]', () => {
    it('[2.1-UNIT-055] should log only metadata, never file content', async () => {
      mockManager.findOne.mockResolvedValue(null);
      mockManager.create.mockReturnValue(mockAsset);
      mockManager.save.mockResolvedValue(mockAsset);

      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.upload(mockFile, mockDto as any, tenantId, userId);

      expect(logSpy).toHaveBeenCalledTimes(1);
      const logArg = logSpy.mock.calls[0][0];
      expect(logArg).toHaveProperty('id');
      expect(logArg).toHaveProperty('filename');
      expect(logArg).toHaveProperty('size');
      expect(logArg).toHaveProperty('hash');
      expect(logArg).toHaveProperty('tenantId');
      expect(logArg).not.toHaveProperty('content');
      expect(logArg).not.toHaveProperty('buffer');
      expect(JSON.stringify(logArg)).not.toContain('test content');
    });
  });
});
