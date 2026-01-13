import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@project_bubble/backend/tenants';
import { EntityManager } from 'typeorm';
import { User } from '@project_bubble/backend/infra';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService
    ) { }

    // For Prototype: Simple Login by Email (Password check skipped or dummy)
    // In real implementation, we verify passwordHash.
    async login(email: string, manager: EntityManager) {
        const user = await this.usersService.findByEmail(email, manager);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Prototype Logic: Accept any password for now or assumed valid
        const payload = {
            sub: user.id,
            email: user.email,
            tenantId: user.tenantId,
            role: user.role
        };

        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async validateUser(email: string, manager: EntityManager): Promise<User | null> {
        return this.usersService.findByEmail(email, manager);
    }
}
