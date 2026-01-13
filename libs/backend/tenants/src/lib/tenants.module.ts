import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsService } from './tenants.service';
import { UsersService } from './users.service';
import { TenantsController } from './tenants.controller';
import { DatabaseModule, Tenant, User } from '@project_bubble/backend/infra';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([Tenant, User]),
  ],
  controllers: [TenantsController],
  providers: [TenantsService, UsersService],
  exports: [TenantsService, UsersService],
})
export class TenantsModule { }
