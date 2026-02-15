import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { IMPERSONATOR_ROLE } from '@project-bubble/db-layer';
import { SupportMutationInterceptor } from './support-mutation.interceptor';
import { SupportAccessService } from '../support-access/support-access.service';

describe('SupportMutationInterceptor [P1]', () => {
  let interceptor: SupportMutationInterceptor;
  let mockSupportAccessService: { logMutation: jest.Mock };

  beforeEach(() => {
    mockSupportAccessService = {
      logMutation: jest.fn().mockResolvedValue(undefined),
    };
    interceptor = new SupportMutationInterceptor(
      mockSupportAccessService as unknown as SupportAccessService,
    );
  });

  const createContext = (
    user: Record<string, unknown> | null,
    method: string,
    url: string,
    statusCode = 200,
  ): { context: ExecutionContext; handler: CallHandler } => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user, method, originalUrl: url }),
        getResponse: () => ({ statusCode }),
      }),
    } as unknown as ExecutionContext;
    const handler = {
      handle: () => of({ result: 'ok' }),
    } as CallHandler;
    return { context, handler };
  };

  it('[4-SA-UNIT-007] should log mutation for impersonation POST', (done) => {
    const { context, handler } = createContext(
      { role: IMPERSONATOR_ROLE, sessionId: 'session-1' },
      'POST',
      '/api/app/folders',
      201,
    );

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        // Fire-and-forget — give it a tick
        setTimeout(() => {
          expect(mockSupportAccessService.logMutation).toHaveBeenCalledWith(
            'session-1',
            'POST',
            '/api/app/folders',
            201,
          );
          done();
        }, 10);
      },
    });
  });

  it('[4-SA-UNIT-008] should skip GET requests during impersonation', (done) => {
    const { context, handler } = createContext(
      { role: IMPERSONATOR_ROLE, sessionId: 'session-1' },
      'GET',
      '/api/app/folders',
    );

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(mockSupportAccessService.logMutation).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('[4-SA-UNIT-009] should skip non-impersonation requests', (done) => {
    const { context, handler } = createContext(
      { role: 'bubble_admin' },
      'POST',
      '/api/admin/tenants',
    );

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(mockSupportAccessService.logMutation).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('[4-SA-UNIT-010] should skip requests without user', (done) => {
    const { context, handler } = createContext(null, 'POST', '/api/app/folders');

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(mockSupportAccessService.logMutation).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('[4-SA-UNIT-011] should not throw when logging fails', (done) => {
    mockSupportAccessService.logMutation.mockRejectedValue(new Error('DB connection lost'));

    const { context, handler } = createContext(
      { role: IMPERSONATOR_ROLE, sessionId: 'session-1' },
      'DELETE',
      '/api/app/folders/abc',
      200,
    );

    interceptor.intercept(context, handler).subscribe({
      next: (value) => {
        expect(value).toEqual({ result: 'ok' });
      },
      complete: () => {
        // Give the fire-and-forget promise time to resolve/reject
        setTimeout(() => {
          expect(mockSupportAccessService.logMutation).toHaveBeenCalled();
          done();
        }, 10);
      },
    });
  });

  it('[4-SA-UNIT-016] should log mutation even when request handler throws', (done) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: IMPERSONATOR_ROLE, sessionId: 'session-1' },
          method: 'POST',
          originalUrl: '/api/app/folders',
        }),
        getResponse: () => ({ statusCode: 500 }),
      }),
    } as unknown as ExecutionContext;
    const handler = {
      handle: () => throwError(() => new Error('Controller threw')),
    } as CallHandler;

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        setTimeout(() => {
          expect(mockSupportAccessService.logMutation).toHaveBeenCalledWith(
            'session-1',
            'POST',
            '/api/app/folders',
            500,
          );
          done();
        }, 10);
      },
    });
  });

  it('[4-SA-UNIT-012] should skip if no sessionId in user payload', (done) => {
    const { context, handler } = createContext(
      { role: IMPERSONATOR_ROLE },
      'POST',
      '/api/app/folders',
    );

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(mockSupportAccessService.logMutation).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
