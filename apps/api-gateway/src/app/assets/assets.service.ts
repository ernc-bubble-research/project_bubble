import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TransactionManager, AssetEntity, AssetStatus } from '@project-bubble/db-layer';
import { UploadAssetDto, UpdateAssetDto, AssetResponseDto } from '@project-bubble/shared';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_OUTPUT_MIME_TYPES = [
  'text/markdown',
  'application/json',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOADS_ROOT = 'uploads';

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(private readonly txManager: TransactionManager) {}

  async upload(
    file: Express.Multer.File,
    dto: UploadAssetDto,
    tenantId: string,
    userId: string,
  ): Promise<AssetResponseDto> {
    this.validateFile(file);

    const sha256Hash = createHash('sha256').update(file.buffer).digest('hex');

    // Check for duplicates within tenant — return existing asset (idempotent upload)
    const existing = await this.txManager.run(tenantId, async (manager) => {
      return manager.findOne(AssetEntity, {
        where: { sha256Hash, tenantId, status: AssetStatus.ACTIVE },
      });
    });

    if (existing) {
      this.logger.log({
        message: 'Duplicate file detected — returning existing asset',
        id: existing.id,
        hash: sha256Hash,
        tenantId,
      });
      return this.toResponse(existing);
    }

    // Write file to disk
    const fileUuid = uuidv4();
    const tenantDir = join(UPLOADS_ROOT, tenantId);
    await mkdir(tenantDir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageName = `${fileUuid}-${safeName}`;
    const storagePath = join(tenantDir, storageName);
    await writeFile(storagePath, file.buffer);

    let asset: AssetEntity;
    try {
      asset = await this.txManager.run(tenantId, async (manager) => {
        const entity = manager.create(AssetEntity, {
          tenantId,
          folderId: dto.folderId || null,
          originalName: file.originalname,
          storagePath,
          mimeType: file.mimetype,
          fileSize: file.size,
          sha256Hash,
          isIndexed: false,
          status: AssetStatus.ACTIVE,
          uploadedBy: userId,
        });
        return manager.save(AssetEntity, entity);
      });
    } catch (error) {
      // Clean up orphan file if DB save fails
      try {
        await unlink(storagePath);
      } catch {
        this.logger.warn({
          message: 'Failed to clean up orphan file after DB save failure',
          storagePath,
          tenantId,
        });
      }
      throw error;
    }

    this.logger.log({
      message: 'Asset uploaded',
      id: asset.id,
      filename: asset.originalName,
      size: asset.fileSize,
      hash: asset.sha256Hash,
      tenantId,
    });

    return this.toResponse(asset);
  }

  /**
   * Create an asset from a raw buffer (no Multer dependency).
   * Used by the workflow processor to persist LLM output as downloadable files.
   */
  async createFromBuffer(
    buffer: Buffer,
    metadata: {
      tenantId: string;
      filename: string;
      mimeType: string;
      sourceType: string;
      workflowRunId: string;
      uploadedBy: string;
    },
  ): Promise<AssetEntity> {
    if (!ALLOWED_OUTPUT_MIME_TYPES.includes(metadata.mimeType)) {
      throw new BadRequestException(
        `MIME type "${metadata.mimeType}" is not allowed for workflow output. Allowed: ${ALLOWED_OUTPUT_MIME_TYPES.join(', ')}`,
      );
    }

    const sha256Hash = createHash('sha256').update(buffer).digest('hex');

    // Write file to disk
    const fileUuid = uuidv4();
    const tenantDir = join(UPLOADS_ROOT, metadata.tenantId);
    await mkdir(tenantDir, { recursive: true });
    const safeName = metadata.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageName = `${fileUuid}-${safeName}`;
    const storagePath = join(tenantDir, storageName);
    await writeFile(storagePath, buffer);

    let asset: AssetEntity;
    try {
      asset = await this.txManager.run(metadata.tenantId, async (manager) => {
        const entity = manager.create(AssetEntity, {
          tenantId: metadata.tenantId,
          folderId: null,
          originalName: metadata.filename,
          storagePath,
          mimeType: metadata.mimeType,
          fileSize: buffer.length,
          sha256Hash,
          isIndexed: false,
          status: AssetStatus.ACTIVE,
          sourceType: metadata.sourceType,
          workflowRunId: metadata.workflowRunId,
          uploadedBy: metadata.uploadedBy,
        });
        return manager.save(AssetEntity, entity);
      });
    } catch (error) {
      // Clean up orphan file if DB save fails
      try {
        await unlink(storagePath);
      } catch {
        this.logger.warn({
          message: 'Failed to clean up orphan file after DB save failure',
          storagePath,
          tenantId: metadata.tenantId,
        });
      }
      throw error;
    }

    this.logger.log({
      message: 'Asset created from buffer',
      id: asset.id,
      filename: asset.originalName,
      size: asset.fileSize,
      sourceType: metadata.sourceType,
      workflowRunId: metadata.workflowRunId,
      tenantId: metadata.tenantId,
    });

    return asset;
  }

  async findAll(
    tenantId: string,
    options?: {
      folderId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<AssetResponseDto[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    return this.txManager.run(tenantId, async (manager) => {
      const qb = manager
        .createQueryBuilder(AssetEntity, 'asset')
        .orderBy('asset.createdAt', 'DESC')
        .take(limit)
        .skip(offset);

      if (options?.folderId) {
        qb.andWhere('asset.folderId = :folderId', { folderId: options.folderId });
      }
      if (options?.status) {
        qb.andWhere('asset.status = :status', { status: options.status });
      } else {
        qb.andWhere('asset.status = :status', { status: AssetStatus.ACTIVE });
      }

      const entities = await qb.getMany();
      return entities.map((e) => this.toResponse(e));
    });
  }

  async findOne(id: string, tenantId: string): Promise<AssetResponseDto> {
    const asset = await this.findEntity(id, tenantId);
    return this.toResponse(asset);
  }

  async findEntityById(id: string, tenantId: string): Promise<AssetEntity> {
    return this.findEntity(id, tenantId);
  }

  private async findEntity(id: string, tenantId: string): Promise<AssetEntity> {
    const asset = await this.txManager.run(tenantId, async (manager) => {
      return manager.findOne(AssetEntity, { where: { id, tenantId } });
    });

    if (!asset) {
      throw new NotFoundException(`Asset with id "${id}" not found`);
    }

    return asset;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateAssetDto,
  ): Promise<AssetResponseDto> {
    const asset = await this.findEntity(id, tenantId);

    const saved = await this.txManager.run(tenantId, async (manager) => {
      if (dto.name !== undefined) asset.originalName = dto.name;
      if (dto.folderId !== undefined) asset.folderId = dto.folderId || null;
      return manager.save(AssetEntity, asset);
    });
    return this.toResponse(saved);
  }

  async archive(id: string, tenantId: string): Promise<AssetResponseDto> {
    const asset = await this.findEntity(id, tenantId);

    if (asset.status === AssetStatus.ARCHIVED) {
      throw new BadRequestException('Asset is already archived');
    }

    const saved = await this.txManager.run(tenantId, async (manager) => {
      asset.status = AssetStatus.ARCHIVED;
      asset.archivedAt = new Date();
      return manager.save(AssetEntity, asset);
    });
    return this.toResponse(saved);
  }

  async restore(id: string, tenantId: string): Promise<AssetResponseDto> {
    const asset = await this.findEntity(id, tenantId);

    if (asset.status !== AssetStatus.ARCHIVED) {
      throw new BadRequestException('Asset is not archived');
    }

    const saved = await this.txManager.run(tenantId, async (manager) => {
      asset.status = AssetStatus.ACTIVE;
      asset.archivedAt = null;
      return manager.save(AssetEntity, asset);
    });
    return this.toResponse(saved);
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size ${file.size} exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes (10MB)`,
      );
    }

    const ext = this.getExtension(file.originalname);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `File extension "${ext}" is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `MIME type "${file.mimetype}" is not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }
  }

  private getExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return '';
    return filename.slice(lastDot).toLowerCase();
  }

  private toResponse(entity: AssetEntity): AssetResponseDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      folderId: entity.folderId,
      originalName: entity.originalName,
      mimeType: entity.mimeType,
      fileSize: entity.fileSize,
      sha256Hash: entity.sha256Hash,
      isIndexed: entity.isIndexed,
      status: entity.status,
      archivedAt: entity.archivedAt,
      uploadedBy: entity.uploadedBy,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    } as AssetResponseDto;
  }
}
