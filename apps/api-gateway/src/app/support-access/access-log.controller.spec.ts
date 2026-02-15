import { Test, TestingModule } from '@nestjs/testing';
import { AccessLogController } from './access-log.controller';
import { SupportAccessReadService } from './support-access-read.service';
import { TenantStatusGuard } from '../guards/tenant-status.guard';
import type { AccessLogEntryDto } from '@project-bubble/shared';

describe('AccessLogController [P1]', () => {
  let controller: AccessLogController;
  let mockReadService: { getAccessLog: jest.Mock };

  beforeEach(async () => {
    mockReadService = {
      getAccessLog: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccessLogController],
      providers: [
        { provide: SupportAccessReadService, useValue: mockReadService },
      ],
    })
      .overrideGuard(TenantStatusGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AccessLogController>(AccessLogController);
  });

  it('[4-SAB-UNIT-007] should return access log entries for the requesting tenant', async () => {
    const tenantId = 'tenant-abc';
    const mockEntries: AccessLogEntryDto[] = [
      {
        id: 'session-1',
        startedAt: '2026-02-14T10:00:00.000Z',
        endedAt: '2026-02-14T10:15:00.000Z',
        actionCount: 3,
        status: 'completed',
      },
    ];
    mockReadService.getAccessLog.mockResolvedValue(mockEntries);

    const result = await controller.getAccessLog({
      user: { tenantId },
    });

    expect(mockReadService.getAccessLog).toHaveBeenCalledWith(tenantId);
    expect(result).toEqual(mockEntries);
  });

  it('[4-SAB-UNIT-008] should pass tenantId from JWT, not from query params', async () => {
    mockReadService.getAccessLog.mockResolvedValue([]);

    await controller.getAccessLog({
      user: { tenantId: 'from-jwt-only' },
    });

    expect(mockReadService.getAccessLog).toHaveBeenCalledWith('from-jwt-only');
  });
});
