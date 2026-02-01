import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { TransactionManager, FolderEntity, AssetEntity, AssetStatus } from '@project-bubble/db-layer';
import { CreateFolderDto, UpdateFolderDto } from '@project-bubble/shared';

@Injectable()
export class FoldersService {
  private readonly logger = new Logger(FoldersService.name);

  constructor(private readonly txManager: TransactionManager) {}

  private static readonly MAX_FOLDER_DEPTH = 3;

  async create(dto: CreateFolderDto, tenantId: string): Promise<FolderEntity> {
    if (dto.parentId) {
      const parent = await this.findOne(dto.parentId, tenantId);
      const depth = await this.getFolderDepth(parent, tenantId);
      if (depth + 1 >= FoldersService.MAX_FOLDER_DEPTH) {
        throw new BadRequestException(
          `Cannot create folder: maximum nesting depth of ${FoldersService.MAX_FOLDER_DEPTH} levels reached.`,
        );
      }
    }

    const folder = await this.txManager.run(tenantId, async (manager) => {
      const entity = manager.create(FolderEntity, {
        tenantId,
        name: dto.name,
        parentId: dto.parentId || null,
      });
      return manager.save(FolderEntity, entity);
    });

    this.logger.log({
      message: 'Folder created',
      id: folder.id,
      name: folder.name,
      tenantId,
    });

    return folder;
  }

  async findAll(tenantId: string): Promise<FolderEntity[]> {
    return this.txManager.run(tenantId, async (manager) => {
      return manager.find(FolderEntity, {
        order: { name: 'ASC' },
      });
    });
  }

  async findOne(id: string, tenantId: string): Promise<FolderEntity> {
    const folder = await this.txManager.run(tenantId, async (manager) => {
      return manager.findOne(FolderEntity, { where: { id } });
    });

    if (!folder) {
      throw new NotFoundException(`Folder with id "${id}" not found`);
    }

    return folder;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateFolderDto,
  ): Promise<FolderEntity> {
    const folder = await this.findOne(id, tenantId);

    return this.txManager.run(tenantId, async (manager) => {
      folder.name = dto.name;
      return manager.save(FolderEntity, folder);
    });
  }

  private async getFolderDepth(folder: FolderEntity, tenantId: string): Promise<number> {
    let depth = 1;
    let current = folder;
    while (current.parentId) {
      current = await this.findOne(current.parentId, tenantId);
      depth++;
    }
    return depth;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);

    await this.txManager.run(tenantId, async (manager) => {
      // Check if folder has any active assets
      const assetCount = await manager.count(AssetEntity, {
        where: { folderId: id, status: AssetStatus.ACTIVE },
      });

      if (assetCount > 0) {
        throw new BadRequestException(
          `Cannot delete folder: it contains ${assetCount} active file(s). Move or archive files first.`,
        );
      }

      // Check if folder has child folders
      const childCount = await manager.count(FolderEntity, {
        where: { parentId: id },
      });

      if (childCount > 0) {
        throw new BadRequestException(
          `Cannot delete folder: it contains ${childCount} sub-folder(s). Delete or move them first.`,
        );
      }

      await manager.delete(FolderEntity, { id });
    });

    this.logger.log({
      message: 'Folder deleted',
      id,
      tenantId,
    });
  }
}
