import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminApiKeyGuard } from './admin-api-key.guard';

describe('AdminApiKeyGuard [P0]', () => {
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

  it('[1H.1-UNIT-001] should allow request with valid API key and set synthetic admin user', () => {
    const context = createMockContext({ 'x-admin-api-key': 'valid-api-key' });

    expect(guard.canActivate(context)).toBe(true);
    expect((context as unknown as { _request: Record<string, unknown> })._request.user).toEqual({
      userId: 'api-key',
      tenantId: null,
      role: 'bubble_admin',
    });
  });

  it('[1H.1-UNIT-002] should allow request with valid JWT bubble_admin role', () => {
    const context = createMockContext({}, { role: 'bubble_admin' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('[1H.1-UNIT-003] should reject request with invalid API key and no JWT', () => {
    const context = createMockContext({ 'x-admin-api-key': 'wrong-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('[1H.1-UNIT-004] should reject request with missing API key and no JWT', () => {
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('[1H.1-UNIT-005] should reject request with non-admin JWT role and no API key', () => {
    const context = createMockContext({}, { role: 'creator' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('[1H.1-UNIT-006] should prefer JWT path over API key when both present', () => {
    const context = createMockContext(
      { 'x-admin-api-key': 'valid-api-key' },
      { role: 'bubble_admin' },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('[1H.1-UNIT-007] should reject API key with different length (timing-safe)', () => {
    const context = createMockContext({ 'x-admin-api-key': 'short' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('[1H.1-UNIT-008] should reject when ADMIN_API_KEY is not configured', () => {
    configService.get.mockReturnValue(undefined);
    const context = createMockContext({ 'x-admin-api-key': 'any-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
