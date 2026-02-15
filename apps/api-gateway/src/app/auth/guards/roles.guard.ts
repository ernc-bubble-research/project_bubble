import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, IMPERSONATOR_ROLE } from '@project-bubble/db-layer';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false;
    }

    // Map impersonator sessions to CUSTOMER_ADMIN for role checks.
    // JWT payload is NOT modified — only the local authorization comparison.
    const effectiveRole =
      user.role === IMPERSONATOR_ROLE
        ? UserRole.CUSTOMER_ADMIN
        : (user.role as UserRole);
    return requiredRoles.includes(effectiveRole);
  }
}
