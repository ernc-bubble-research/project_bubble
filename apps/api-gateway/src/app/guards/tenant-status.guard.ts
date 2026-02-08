import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantEntity, TenantStatus, UserRole } from '@project-bubble/db-layer';

@Injectable()
export class TenantStatusGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // No-op for unauthenticated routes (login, health check, public endpoints)
    if (!request.user) {
      return true;
    }

    // Bubble Admin users bypass tenant status checks entirely
    if (request.user.role === UserRole.BUBBLE_ADMIN) {
      return true;
    }

    const tenantId = request.user.tenantId;
    if (!tenantId) {
      return true;
    }

    const tenant = await this.dataSource.getRepository(TenantEntity).findOne({
      where: { id: tenantId },
      select: ['id', 'status'],
    });

    if (!tenant) {
      return true;
    }

    if (tenant.status === TenantStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Account suspended. Contact your administrator.',
      );
    }

    if (tenant.status === TenantStatus.ARCHIVED) {
      throw new ForbiddenException(
        'Account archived. Contact your administrator.',
      );
    }

    return true;
  }
}
