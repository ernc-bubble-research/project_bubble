import { faker } from '@faker-js/faker';
import { AssetEntity, AssetStatus } from '../entities/asset.entity';

export function buildAsset(overrides: Partial<AssetEntity> = {}): AssetEntity {
  const fileName = faker.system.fileName({ extensionCount: 1 });
  return {
    id: faker.string.uuid(),
    tenantId: faker.string.uuid(),
    folderId: null,
    originalName: fileName,
    storagePath: `/uploads/${faker.string.uuid()}/${fileName}`,
    mimeType: 'application/pdf',
    fileSize: faker.number.int({ min: 1024, max: 10485760 }),
    sha256Hash: faker.string.hexadecimal({ length: 64, casing: 'lower', prefix: '' }),
    isIndexed: false,
    status: AssetStatus.ACTIVE,
    archivedAt: null,
    sourceType: 'user_upload',
    workflowRunId: null,
    uploadedBy: faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as AssetEntity;
}
