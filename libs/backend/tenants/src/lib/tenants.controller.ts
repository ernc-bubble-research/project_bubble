import { Controller, Post, Body, Get, UseInterceptors, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { UsersService } from './users.service';
import { EntityManager } from 'typeorm';
import { TenancyInterceptor, TransactionManager, UserRole } from '@project_bubble/backend/infra';

@Controller('tenants')
export class TenantsController {
    constructor(
        private tenantsService: TenantsService,
        private usersService: UsersService
    ) { }

    @Post()
    @UseInterceptors(TenancyInterceptor)
    async create(
        @Body('name') name: string,
        @TransactionManager() manager: EntityManager
    ) {
        return this.tenantsService.createTenant(name, manager);
    }

    @Post(':id/users')
    @UseInterceptors(TenancyInterceptor)
    async createUser(
        @Param('id') tenantId: string,
        @Body('email') email: string,
        @TransactionManager() manager: EntityManager
    ) {
        // Prototype: Role hardcoded to ADMIN for first user
        return this.usersService.createUser(email, tenantId, UserRole.BUBBLE_ADMIN, manager);
    }

    @Get()
    @UseInterceptors(TenancyInterceptor)
    async findAll(@TransactionManager() manager: EntityManager) {
        return this.tenantsService.getAll(manager);
    }
}
