import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@project-bubble/db-layer';
import { RolesGuard } from './roles.guard';

describe('RolesGuard [P0]', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const createMockContext = (
    user: { role: string } | null = null,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  it('[1H.1-UNIT-001] should allow access when user role matches required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.BUBBLE_ADMIN]);
    const context = createMockContext({ role: UserRole.BUBBLE_ADMIN });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('[1H.1-UNIT-002] should deny access when user role does not match', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.BUBBLE_ADMIN]);
    const context = createMockContext({ role: UserRole.CREATOR });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('[1H.1-UNIT-003] should allow access when no roles are specified (public)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ role: UserRole.CREATOR });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('[1H.1-UNIT-004] should allow access when roles array is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = createMockContext({ role: UserRole.CREATOR });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('[1H.1-UNIT-005] should deny access when no user is present', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.BUBBLE_ADMIN]);
    const context = createMockContext(null);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('[1H.1-UNIT-006] should allow when user matches one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.BUBBLE_ADMIN,
      UserRole.CUSTOMER_ADMIN,
    ]);
    const context = createMockContext({ role: UserRole.CUSTOMER_ADMIN });

    expect(guard.canActivate(context)).toBe(true);
  });
});
