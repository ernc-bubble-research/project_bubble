import { SupportAccessService } from './support-access.service';
import {
  SupportAccessLogEntity,
  SupportMutationLogEntity,
} from '@project-bubble/db-layer';

describe('SupportAccessService [P1]', () => {
  let service: SupportAccessService;
  let mockAccessLogRepo: Record<string, jest.Mock>;
  let mockMutationLogRepo: Record<string, jest.Mock>;

  beforeEach(() => {
    mockAccessLogRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ ...entity, startedAt: new Date() })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockMutationLogRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ ...entity, createdAt: new Date() })),
    };

    const mockMigrationDs = {
      getRepository: jest.fn((entity) => {
        if (entity === SupportAccessLogEntity) return mockAccessLogRepo;
        if (entity === SupportMutationLogEntity) return mockMutationLogRepo;
        throw new Error(`Unknown entity: ${entity}`);
      }),
    };

    service = new SupportAccessService(mockMigrationDs as any);
  });

  describe('logSessionStart', () => {
    it('[4-SA-UNIT-004] should create a session log entry with pre-set ID', async () => {
      const sessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee0001';
      await service.logSessionStart(sessionId, 'admin-123', 'tenant-456', 'hash-abc');

      expect(mockAccessLogRepo.create).toHaveBeenCalledWith({
        id: sessionId,
        adminUserId: 'admin-123',
        tenantId: 'tenant-456',
        jwtTokenHash: 'hash-abc',
      });
      expect(mockAccessLogRepo.save).toHaveBeenCalled();
    });
  });

  describe('logMutation', () => {
    it('[4-SA-UNIT-005] should create a mutation log entry', async () => {
      await service.logMutation('session-1', 'POST', '/api/app/folders', 201);

      expect(mockMutationLogRepo.create).toHaveBeenCalledWith({
        sessionId: 'session-1',
        httpMethod: 'POST',
        urlPath: '/api/app/folders',
        statusCode: 201,
      });
      expect(mockMutationLogRepo.save).toHaveBeenCalled();
    });
  });

  describe('logSessionEnd', () => {
    it('[4-SA-UNIT-006] should update endedAt for the session when admin owns it', async () => {
      mockAccessLogRepo.findOne = jest.fn().mockResolvedValue({
        id: 'session-1',
        adminUserId: 'admin-123',
      });

      await service.logSessionEnd('session-1', 'admin-123');

      expect(mockAccessLogRepo.findOne).toHaveBeenCalledWith({ where: { id: 'session-1' } });
      expect(mockAccessLogRepo.update).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ endedAt: expect.any(Date) }),
      );
    });

    it('[4-SA-UNIT-014] should throw NotFoundException when session does not exist', async () => {
      mockAccessLogRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(service.logSessionEnd('nonexistent', 'admin-123')).rejects.toThrow(
        'Session nonexistent not found',
      );
    });

    it('[4-SA-UNIT-015] should throw ForbiddenException when admin does not own session', async () => {
      mockAccessLogRepo.findOne = jest.fn().mockResolvedValue({
        id: 'session-1',
        adminUserId: 'other-admin-456',
      });

      await expect(service.logSessionEnd('session-1', 'admin-123')).rejects.toThrow(
        "Cannot close another admin's session",
      );
    });
  });
});
