import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminApiKeyGuard } from './admin-api-key.guard';

describe('AdminApiKeyGuard', () => {
  let guard: AdminApiKeyGuard;
  let configService: jest.Mocked<ConfigService>;

  const createMockContext = (
    headers: Record<string, string> = {},
    user: { role: string } | null = null,
  ) => {
    const request: Record<string, unknown> = { headers, user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      _request: request,
    } as unknown as ExecutionContext & { _request: Record<string, unknown> };
  };

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('valid-api-key'),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new AdminApiKeyGuard(configService);
  });

  it('should allow request with valid API key and set synthetic admin user', () => {
    const context = createMockContext({ 'x-admin-api-key': 'valid-api-key' });

    expect(guard.canActivate(context)).toBe(true);
    // Verify synthetic user is set for downstream RolesGuard
    expect((context as unknown as { _request: Record<string, unknown> })._request.user).toEqual({
      userId: 'api-key',
      tenantId: null,
      role: 'bubble_admin',
    });
  });

  it('should allow request with valid JWT bubble_admin role', () => {
    const context = createMockContext({}, { role: 'bubble_admin' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject request with invalid API key and no JWT', () => {
    const context = createMockContext({ 'x-admin-api-key': 'wrong-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject request with missing API key and no JWT', () => {
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject request with non-admin JWT role and no API key', () => {
    const context = createMockContext({}, { role: 'creator' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should prefer JWT path over API key when both present', () => {
    const context = createMockContext(
      { 'x-admin-api-key': 'valid-api-key' },
      { role: 'bubble_admin' },
    );

    expect(guard.canActivate(context)).toBe(true);
  });
});
