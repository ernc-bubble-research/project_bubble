import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WorkflowExecutionService, EnqueueOptions } from './workflow-execution.service';
import { WorkflowJobPayload, WorkflowJobSubjectFile } from '@project-bubble/shared';

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

  const subjectFiles: WorkflowJobSubjectFile[] = [
    { originalName: 'file-a.pdf', storagePath: '/uploads/a.pdf', assetId: 'asset-a' },
    { originalName: 'file-b.pdf', storagePath: '/uploads/b.pdf', assetId: 'asset-b' },
    { originalName: 'file-c.pdf', storagePath: '/uploads/c.pdf', assetId: 'asset-c' },
  ];

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

  describe('context-only (no options)', () => {
    it('[4.3-UNIT-047] enqueueRun() adds job with runId as jobId', async () => {
      await service.enqueueRun(runId, payload);

      expect(queue.add).toHaveBeenCalledTimes(1);
      const [jobName, jobData, jobOpts] = queue.add.mock.calls[0];
      expect(jobName).toBe('execute-workflow');
      expect(jobOpts).toEqual({
        jobId: runId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      expect(jobData).toBe(payload);
    });

    it('[4.3-UNIT-048] enqueueRun() returns correct jobIds (context-only)', async () => {
      const result = await service.enqueueRun(runId, payload);

      expect(result).toEqual({ jobIds: [runId] });
    });

    it('[4.3-UNIT-049] enqueueRun() passes WorkflowJobPayload as job data', async () => {
      await service.enqueueRun(runId, payload);

      const jobData = queue.add.mock.calls[0][1];
      expect(jobData).toMatchObject({
        runId,
        tenantId,
        versionId: 'cccccccc-0000-0000-0000-000000000001',
        contextInputs: {},
      });
    });

    it('[4.3-UNIT-050] treats empty subjectFiles array as context-only', async () => {
      const options: EnqueueOptions = {
        subjectFiles: [],
        processingMode: 'parallel',
        maxConcurrency: 5,
      };

      const result = await service.enqueueRun(runId, payload, options);

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ jobIds: [runId] });
    });
  });

  describe('batch mode (fan-in)', () => {
    it('[4.3-UNIT-051] enqueues single job with all subjectFiles attached (batch)', async () => {
      const options: EnqueueOptions = {
        subjectFiles,
        processingMode: 'batch',
        maxConcurrency: 5,
      };

      const result = await service.enqueueRun(runId, payload, options);

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ jobIds: [runId] });

      const [jobName, jobData, jobOpts] = queue.add.mock.calls[0];
      expect(jobName).toBe('execute-workflow');
      expect(jobOpts).toEqual({
        jobId: runId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
      expect(jobData.subjectFiles).toEqual(subjectFiles);
    });

    it('[4.3-UNIT-052] batch job payload merges subjectFiles with base payload', async () => {
      const options: EnqueueOptions = {
        subjectFiles,
        processingMode: 'batch',
        maxConcurrency: 5,
      };

      await service.enqueueRun(runId, payload, options);

      const jobData = queue.add.mock.calls[0][1] as WorkflowJobPayload;
      expect(jobData.runId).toBe(runId);
      expect(jobData.tenantId).toBe(tenantId);
      expect(jobData.subjectFiles).toHaveLength(3);
    });
  });

  describe('parallel mode (fan-out)', () => {
    it('[4.3-UNIT-053] enqueues N jobs, one per subject file (parallel)', async () => {
      const options: EnqueueOptions = {
        subjectFiles,
        processingMode: 'parallel',
        maxConcurrency: 5,
      };

      const result = await service.enqueueRun(runId, payload, options);

      expect(queue.add).toHaveBeenCalledTimes(3);
      expect(result.jobIds).toHaveLength(3);
    });

    it('[4.3-UNIT-054] fan-out jobIds follow {runId}:file:{index} format', async () => {
      const options: EnqueueOptions = {
        subjectFiles,
        processingMode: 'parallel',
        maxConcurrency: 5,
      };

      const result = await service.enqueueRun(runId, payload, options);

      expect(result.jobIds).toEqual([
        `${runId}:file:0`,
        `${runId}:file:1`,
        `${runId}:file:2`,
      ]);

      // Verify each queue.add call used the correct jobId
      for (let i = 0; i < 3; i++) {
        const jobOpts = queue.add.mock.calls[i][2];
        expect(jobOpts).toEqual({
          jobId: `${runId}:file:${i}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });
      }
    });

    it('[4.3-UNIT-055] each fan-out job carries a single subjectFile (not subjectFiles)', async () => {
      const options: EnqueueOptions = {
        subjectFiles,
        processingMode: 'parallel',
        maxConcurrency: 5,
      };

      await service.enqueueRun(runId, payload, options);

      for (let i = 0; i < 3; i++) {
        const jobData = queue.add.mock.calls[i][1] as WorkflowJobPayload;
        expect(jobData.subjectFile).toEqual(subjectFiles[i]);
        expect(jobData.subjectFiles).toBeUndefined();
      }
    });

    it('[4.3-UNIT-056] fan-out jobs preserve base payload fields', async () => {
      const options: EnqueueOptions = {
        subjectFiles,
        processingMode: 'parallel',
        maxConcurrency: 5,
      };

      await service.enqueueRun(runId, payload, options);

      for (let i = 0; i < 3; i++) {
        const jobData = queue.add.mock.calls[i][1] as WorkflowJobPayload;
        expect(jobData.runId).toBe(runId);
        expect(jobData.tenantId).toBe(tenantId);
        expect(jobData.versionId).toBe(payload.versionId);
        expect(jobData.contextInputs).toBe(payload.contextInputs);
      }
    });

    it('[4.3-UNIT-057] single file with parallel mode creates 1 fan-out job', async () => {
      const options: EnqueueOptions = {
        subjectFiles: [subjectFiles[0]],
        processingMode: 'parallel',
        maxConcurrency: 5,
      };

      const result = await service.enqueueRun(runId, payload, options);

      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(result.jobIds).toEqual([`${runId}:file:0`]);
    });
  });
});
