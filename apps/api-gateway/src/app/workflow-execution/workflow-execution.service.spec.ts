import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WorkflowExecutionService } from './workflow-execution.service';
import { WorkflowJobPayload } from '@project-bubble/shared';

describe('WorkflowExecutionService', () => {
  let service: WorkflowExecutionService;
  let queue: jest.Mocked<Queue>;

  const runId = 'bbbbbbbb-0000-0000-0000-000000000001';
  const tenantId = 'aaaaaaaa-0000-0000-0000-000000000001';

  const payload: WorkflowJobPayload = {
    runId,
    tenantId,
    versionId: 'cccccccc-0000-0000-0000-000000000001',
    definition: {} as WorkflowJobPayload['definition'],
    contextInputs: {},
  };

  beforeEach(async () => {
    queue = {
      add: jest.fn().mockResolvedValue({ id: runId }),
    } as unknown as jest.Mocked<Queue>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowExecutionService,
        { provide: getQueueToken('workflow-execution'), useValue: queue },
      ],
    }).compile();

    service = module.get(WorkflowExecutionService);
  });

  it('5.1 — enqueueRun() adds job with runId as jobId', async () => {
    await service.enqueueRun(runId, payload);

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [jobName, jobData, jobOpts] = queue.add.mock.calls[0];
    expect(jobName).toBe('execute-workflow');
    expect(jobOpts).toEqual({ jobId: runId });
    expect(jobData).toBe(payload);
  });

  it('5.2 — enqueueRun() returns correct jobId', async () => {
    const result = await service.enqueueRun(runId, payload);

    expect(result).toEqual({ jobId: runId });
  });

  it('5.3 — enqueueRun() passes WorkflowJobPayload as job data', async () => {
    await service.enqueueRun(runId, payload);

    const jobData = queue.add.mock.calls[0][1];
    expect(jobData).toMatchObject({
      runId,
      tenantId,
      versionId: 'cccccccc-0000-0000-0000-000000000001',
      contextInputs: {},
    });
  });
});
