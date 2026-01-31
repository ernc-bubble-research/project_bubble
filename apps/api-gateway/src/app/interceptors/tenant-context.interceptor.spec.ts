import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { getCurrentTenantContext } from '@project-bubble/db-layer';

describe('TenantContextInterceptor', () => {
  let interceptor: TenantContextInterceptor;

  const createMockContext = (
    user: Record<string, unknown> | null = null,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  const createMockCallHandler = (
    returnValue: unknown = 'response',
  ): CallHandler => ({
    handle: () => of(returnValue),
  });

  beforeEach(() => {
    interceptor = new TenantContextInterceptor();
  });

  it('should set tenant context from JWT user tenantId', async () => {
    const context = createMockContext({
      userId: 'user-1',
      tenantId: 'tenant-abc',
      role: 'creator',
    });

    let capturedContext: ReturnType<typeof getCurrentTenantContext>;

    const callHandler: CallHandler = {
      handle: () => {
        capturedContext = getCurrentTenantContext();
        return of('ok');
      },
    };

    const result$ = interceptor.intercept(context, callHandler);
    await lastValueFrom(result$);

    expect(capturedContext).toEqual({
      tenantId: 'tenant-abc',
      bypassRls: false,
    });
  });

  it('should set bypassRls=true for bubble_admin role', async () => {
    const context = createMockContext({
      userId: 'admin-1',
      tenantId: '00000000-0000-0000-0000-000000000000',
      role: 'bubble_admin',
    });

    let capturedContext: ReturnType<typeof getCurrentTenantContext>;

    const callHandler: CallHandler = {
      handle: () => {
        capturedContext = getCurrentTenantContext();
        return of('ok');
      },
    };

    const result$ = interceptor.intercept(context, callHandler);
    await lastValueFrom(result$);

    expect(capturedContext).toEqual({
      tenantId: '00000000-0000-0000-0000-000000000000',
      bypassRls: true,
    });
  });

  it('should pass through without context when no user (public route)', async () => {
    const context = createMockContext(null);
    const callHandler = createMockCallHandler('public-response');

    const result$ = interceptor.intercept(context, callHandler);
    const result = await lastValueFrom(result$);

    expect(result).toBe('public-response');
  });

  it('should propagate the response from the next handler', async () => {
    const context = createMockContext({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'creator',
    });
    const callHandler = createMockCallHandler({ data: 'test' });

    const result$ = interceptor.intercept(context, callHandler);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({ data: 'test' });
  });
});
