import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, Subscription } from 'rxjs';
import {
  tenantContextStorage,
  TenantContext,
  UserRole,
} from '@project-bubble/db-layer';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    const tenantContext: TenantContext = {
      tenantId: user.tenantId,
      bypassRls: user.role === UserRole.BUBBLE_ADMIN,
    };

    return new Observable((subscriber) => {
      let innerSub: Subscription;
      tenantContextStorage.run(tenantContext, () => {
        innerSub = next.handle().subscribe(subscriber);
      });
      return () => innerSub?.unsubscribe();
    });
  }
}
