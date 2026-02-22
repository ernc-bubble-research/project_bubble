import { faker } from '@faker-js/faker';
import { FolderEntity } from '../entities/folder.entity';

export function buildFolder(overrides: Partial<FolderEntity> = {}): FolderEntity {
  return {
    id: faker.string.uuid(),
    tenantId: faker.string.uuid(),
    name: `${faker.word.adjective()} Folder`,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as FolderEntity;
}
