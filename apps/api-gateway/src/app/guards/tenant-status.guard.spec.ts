import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantStatus, UserRole } from '@project-bubble/db-layer';
import { TenantStatusGuard } from './tenant-status.guard';

describe('TenantStatusGuard [P1]', () => {
  let guard: TenantStatusGuard;
  let mockFindOne: jest.Mock;

  const createMockContext = (
    user: { tenantId?: string; role?: string } | null = null,
  ) => {
    const request: Record<string, unknown> = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockFindOne = jest.fn();
    const mockDataSource = {
      getRepository: jest.fn().mockReturnValue({
        findOne: mockFindOne,
      }),
    } as unknown as DataSource;

    guard = new TenantStatusGuard(mockDataSource);
  });

  it('[1-13-GUARD-001] should pass through when no user (unauthenticated route)', async () => {
    const context = createMockContext(null);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('[1-13-GUARD-002] should bypass for BUBBLE_ADMIN role', async () => {
    const context = createMockContext({
      tenantId: 'some-id',
      role: UserRole.BUBBLE_ADMIN,
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('[1-13-GUARD-003] should pass through when user has no tenantId', async () => {
    const context = createMockContext({ role: 'creator' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('[1-13-GUARD-004] should pass through when tenant not found', async () => {
    mockFindOne.mockResolvedValue(null);
    const context = createMockContext({ tenantId: 'unknown-id', role: 'creator' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('[1-13-GUARD-005] should allow active tenant', async () => {
    mockFindOne.mockResolvedValue({ id: 'tenant-1', status: TenantStatus.ACTIVE });
    const context = createMockContext({ tenantId: 'tenant-1', role: 'creator' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('[1-13-GUARD-006] should throw ForbiddenException for suspended tenant', async () => {
    mockFindOne.mockResolvedValue({ id: 'tenant-1', status: TenantStatus.SUSPENDED });
    const context = createMockContext({ tenantId: 'tenant-1', role: 'creator' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Account suspended. Contact your administrator.',
    );
  });

  it('[1-13-GUARD-007] should throw ForbiddenException for archived tenant', async () => {
    mockFindOne.mockResolvedValue({ id: 'tenant-1', status: TenantStatus.ARCHIVED });
    const context = createMockContext({ tenantId: 'tenant-1', role: 'creator' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Account archived. Contact your administrator.',
    );
  });

  it('[1-13-GUARD-008] should query tenant with correct id and select fields', async () => {
    mockFindOne.mockResolvedValue({ id: 'tenant-1', status: TenantStatus.ACTIVE });
    const context = createMockContext({ tenantId: 'tenant-1', role: 'creator' });

    await guard.canActivate(context);

    expect(mockFindOne).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      select: ['id', 'status'],
    });
  });
});
