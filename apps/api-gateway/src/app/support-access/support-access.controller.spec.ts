import { SupportAccessController } from './support-access.controller';
import { SupportAccessService } from './support-access.service';

describe('SupportAccessController [P1]', () => {
  let controller: SupportAccessController;
  let mockService: { logSessionEnd: jest.Mock };

  beforeEach(() => {
    mockService = {
      logSessionEnd: jest.fn().mockResolvedValue(undefined),
    };
    controller = new SupportAccessController(
      mockService as unknown as SupportAccessService,
    );
  });

  it('[4-SA-UNIT-013] should call logSessionEnd with sessionId and userId, return ok', async () => {
    const req = { user: { userId: 'admin-123' } };
    const result = await controller.endSession({ sessionId: 'session-1' }, req);

    expect(mockService.logSessionEnd).toHaveBeenCalledWith('session-1', 'admin-123');
    expect(result).toEqual({ ok: true });
  });
});
