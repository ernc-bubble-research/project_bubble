import { WorkflowRunStatus } from '@project-bubble/db-layer';
import { WorkflowRunResponseDto } from '@project-bubble/shared';
import { WorkflowRunsController } from './workflow-runs.controller';
import { WorkflowRunsService } from './workflow-runs.service';

describe('WorkflowRunsController [P0]', () => {
  let controller: WorkflowRunsController;
  let service: jest.Mocked<Pick<WorkflowRunsService, 'initiateRun'>>;

  const tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const runId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const versionId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const templateId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const mockRunResponse: WorkflowRunResponseDto = {
    id: runId,
    tenantId,
    versionId,
    status: WorkflowRunStatus.QUEUED,
    startedBy: userId,
    creditsConsumed: 0,
    createdAt: new Date('2026-02-09'),
  };

  beforeEach(() => {
    service = {
      initiateRun: jest.fn(),
    };

    controller = new WorkflowRunsController(
      service as unknown as WorkflowRunsService,
    );
  });

  describe('initiateRun', () => {
    it('[4.1-UNIT-016] [P0] Given valid body and JWT user, when POST / is called, then delegates to service.initiateRun with tenantId and userId from JWT', async () => {
      // Given
      service.initiateRun.mockResolvedValue(mockRunResponse);
      const req = { user: { tenantId, userId } };
      const dto = {
        templateId,
        inputs: {
          context_doc: { type: 'text' as const, text: 'Analyze this' },
        },
      };

      // When
      const result = await controller.initiateRun(dto, req);

      // Then
      expect(result).toEqual(mockRunResponse);
      expect(service.initiateRun).toHaveBeenCalledWith(dto, tenantId, userId);
    });

    it('[4.1-UNIT-017] [P0] Given service throws, when POST / is called, then exception propagates', async () => {
      // Given
      service.initiateRun.mockRejectedValue(
        new Error('Template not found'),
      );
      const req = { user: { tenantId, userId } };
      const dto = { templateId, inputs: {} };

      // When/Then
      await expect(controller.initiateRun(dto, req)).rejects.toThrow(
        'Template not found',
      );
    });
  });
});
