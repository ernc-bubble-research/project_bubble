import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User, UserRole } from '@project_bubble/backend/infra';

@Injectable()
export class UsersService {
    async createUser(
        email: string,
        tenantId: string,
        role: UserRole,
        manager: EntityManager
    ): Promise<User> {
        const user = new User();
        user.email = email;
        user.tenantId = tenantId;
        user.role = role;
        // Password hash omitted for prototype (mock logic or hardcoded for now)
        user.passwordHash = 'hashed_password_123';

        return await manager.save(User, user);
    }

    async findByEmail(email: string, manager: EntityManager): Promise<User | null> {
        return await manager.findOne(User, { where: { email } });
    }
}
