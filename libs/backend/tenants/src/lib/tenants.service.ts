import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Tenant } from '@project_bubble/backend/infra';

@Injectable()
export class TenantsService {
    async createTenant(name: string, manager: EntityManager): Promise<Tenant> {
        const tenant = new Tenant();
        tenant.name = name;
        // Default region is handles by DB or Entity default

        // Use the manager (Transaction) to save
        return await manager.save(Tenant, tenant);
    }

    async getAll(manager: EntityManager): Promise<Tenant[]> {
        return await manager.find(Tenant);
    }
}
