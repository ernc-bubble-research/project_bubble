import { Test, TestingModule } from '@nestjs/testing';
import { TransactionManager } from '@project-bubble/db-layer';
import { SupportAccessReadService } from './support-access-read.service';

describe('SupportAccessReadService [P1]', () => {
  let service: SupportAccessReadService;
  let mockQuery: jest.Mock;
  let mockTxManager: { run: jest.Mock };

  beforeEach(async () => {
    mockQuery = jest.fn();
    mockTxManager = {
      run: jest.fn().mockImplementation(
        (_tenantId: string, callback: (manager: { query: jest.Mock }) => Promise<unknown>) =>
          callback({ query: mockQuery }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportAccessReadService,
        { provide: TransactionManager, useValue: mockTxManager },
      ],
    }).compile();

    service = module.get<SupportAccessReadService>(SupportAccessReadService);
  });

  it('[4-SAB-UNIT-001] should return sessions for given tenantId', async () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    mockQuery.mockResolvedValue([
      {
        id: 'session-1',
        started_at: new Date('2026-02-14T10:00:00Z'),
        ended_at: new Date('2026-02-14T10:15:00Z'),
        action_count: '3',
      },
      {
        id: 'session-2',
        started_at: new Date('2026-02-13T09:00:00Z'),
        ended_at: null,
        action_count: '0',
      },
    ]);

    const result = await service.getAccessLog(tenantId);

    expect(mockTxManager.run).toHaveBeenCalledWith(tenantId, expect.any(Function));
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE sal.tenant_id = $1'),
      [tenantId],
    );
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('session-1');
    expect(result[0].actionCount).toBe(3);
    expect(result[0].status).toBe('completed');
    expect(result[1].id).toBe('session-2');
    expect(result[1].status).toBe('active');
  });

  it('[4-SAB-UNIT-002] should compute status correctly — active when endedAt is null', async () => {
    mockQuery.mockResolvedValue([
      {
        id: 'session-active',
        started_at: new Date('2026-02-14T10:00:00Z'),
        ended_at: null,
        action_count: '5',
      },
    ]);

    const result = await service.getAccessLog('tenant-1');

    expect(result[0].status).toBe('active');
    expect(result[0].endedAt).toBeNull();
  });

  it('[4-SAB-UNIT-003] should compute status correctly — completed when endedAt is set', async () => {
    mockQuery.mockResolvedValue([
      {
        id: 'session-done',
        started_at: new Date('2026-02-14T10:00:00Z'),
        ended_at: new Date('2026-02-14T10:20:00Z'),
        action_count: '2',
      },
    ]);

    const result = await service.getAccessLog('tenant-1');

    expect(result[0].status).toBe('completed');
    expect(result[0].endedAt).not.toBeNull();
  });

  it('[4-SAB-UNIT-004] should return empty array when no sessions exist', async () => {
    mockQuery.mockResolvedValue([]);

    const result = await service.getAccessLog('tenant-no-sessions');

    expect(result).toEqual([]);
  });

  it('[4-SAB-UNIT-005] should pass tenantId as parameterized SQL (no interpolation)', async () => {
    mockQuery.mockResolvedValue([]);

    await service.getAccessLog('inject-attempt');

    // Verify parameterized SQL is used, not string interpolation
    const sqlArg = mockQuery.mock.calls[0][0];
    expect(sqlArg).toContain('$1');
    expect(sqlArg).not.toContain('inject-attempt');
    expect(mockQuery.mock.calls[0][1]).toEqual(['inject-attempt']);
  });

  it('[4-SAB-UNIT-006] should convert action_count string to number', async () => {
    mockQuery.mockResolvedValue([
      {
        id: 'session-1',
        started_at: new Date('2026-02-14T10:00:00Z'),
        ended_at: new Date('2026-02-14T10:15:00Z'),
        action_count: '42',
      },
    ]);

    const result = await service.getAccessLog('tenant-1');

    expect(result[0].actionCount).toBe(42);
    expect(typeof result[0].actionCount).toBe('number');
  });

  it('[4-SAB-UNIT-026] should call TransactionManager.run with tenantId for RLS context', async () => {
    mockQuery.mockResolvedValue([]);
    const tenantId = 'abc-123';

    await service.getAccessLog(tenantId);

    expect(mockTxManager.run).toHaveBeenCalledWith(tenantId, expect.any(Function));
  });
});
