import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { WorkflowRunService } from './workflow-run.service';
import type { WorkflowRunResponseDto } from '@project-bubble/shared';

describe('WorkflowRunService [P1]', () => {
  let service: WorkflowRunService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/app/workflow-runs';
  const runId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const mockRun: WorkflowRunResponseDto = {
    id: runId,
    tenantId: 'tenant-1',
    versionId: 'version-1',
    status: 'completed',
    startedBy: 'user-1',
    creditsConsumed: 1,
    isTestRun: false,
    creditsFromMonthly: 1,
    creditsFromPurchased: 0,
    createdAt: new Date('2026-02-22'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WorkflowRunService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('listRuns', () => {
    it('[4-RSUI-UNIT-010] should GET runs with no params', () => {
      service.listRuns().subscribe((res) => {
        expect(res.data).toHaveLength(1);
        expect(res.total).toBe(1);
      });

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('GET');
      req.flush({ data: [mockRun], total: 1, page: 1, limit: 20 });
    });

    it('[4-RSUI-UNIT-011] should pass page, limit, status, excludeTestRuns params', () => {
      service
        .listRuns({ page: 2, limit: 10, status: 'completed', excludeTestRuns: true })
        .subscribe();

      const req = httpMock.expectOne(
        `${baseUrl}?page=2&limit=10&status=completed&excludeTestRuns=true`,
      );
      expect(req.request.method).toBe('GET');
      req.flush({ data: [], total: 0, page: 2, limit: 10 });
    });

    it('[4-RSUI-UNIT-012] should not include excludeTestRuns when false', () => {
      service.listRuns({ excludeTestRuns: false }).subscribe();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.params.has('excludeTestRuns')).toBe(false);
      req.flush({ data: [], total: 0, page: 1, limit: 20 });
    });
  });

  describe('getRun', () => {
    it('[4-RSUI-UNIT-013] should GET single run by id', () => {
      service.getRun(runId).subscribe((res) => {
        expect(res.id).toBe(runId);
      });

      const req = httpMock.expectOne(`${baseUrl}/${runId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockRun);
    });
  });

  describe('retryFailed', () => {
    it('[4-RSUI-UNIT-014] should POST retry-failed with empty body', () => {
      service.retryFailed(runId).subscribe((res) => {
        expect(res.status).toBe('running');
      });

      const req = httpMock.expectOne(`${baseUrl}/${runId}/retry-failed`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush({ ...mockRun, status: 'running' });
    });
  });

  describe('downloadOutput', () => {
    it('[4-RSUI-UNIT-015] should GET output as blob', () => {
      service.downloadOutput(runId, 0).subscribe((blob) => {
        expect(blob).toBeInstanceOf(Blob);
      });

      const req = httpMock.expectOne(`${baseUrl}/${runId}/outputs/0`);
      expect(req.request.method).toBe('GET');
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['test content'], { type: 'text/plain' }));
    });
  });
});
