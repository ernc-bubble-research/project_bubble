import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminApiKeyGuard } from './admin-api-key.guard';

describe('AdminApiKeyGuard', () => {
  let guard: AdminApiKeyGuard;
  let configService: jest.Mocked<ConfigService>;

  const createMockContext = (headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue('valid-api-key'),
    } as unknown as jest.Mocked<ConfigService>;

    guard = new AdminApiKeyGuard(configService);
  });

  it('should allow request with valid API key', () => {
    const context = createMockContext({ 'x-admin-api-key': 'valid-api-key' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject request with invalid API key', () => {
    const context = createMockContext({ 'x-admin-api-key': 'wrong-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject request with missing API key', () => {
    const context = createMockContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
