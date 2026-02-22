import { faker } from '@faker-js/faker';
import { UserEntity, UserRole, UserStatus } from '../entities/user.entity';

/**
 * Default passwordHash is a fake bcrypt string — NOT a real hash.
 * For integration tests involving login/auth, override with a real bcrypt hash:
 *   buildUser({ passwordHash: await bcrypt.hash('password', 10) })
 */
export function buildUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    passwordHash: '$2b$10$fakehashfakehashfakehashfakehashfakehashfakehash00',
    role: UserRole.CUSTOMER_ADMIN,
    name: faker.person.fullName(),
    tenantId: faker.string.uuid(),
    status: UserStatus.ACTIVE,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as UserEntity;
}
