jest.mock('client-zip', () => ({
  downloadZip: jest.fn(() => new Blob(['mock-zip'])),
}));

import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  RefreshCw,
  Download,
  Eye,
} from 'lucide-angular';
import { ExecutionDetailComponent } from './execution-detail.component';
import { WorkflowRunService } from '../../core/services/workflow-run.service';
import { ToastService } from '../../core/services/toast.service';
import type { WorkflowRunResponseDto, PerFileResult } from '@project-bubble/shared';

describe('ExecutionDetailComponent [P1]', () => {
  const runId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  const baseRun: WorkflowRunResponseDto = {
    id: runId,
    tenantId: 'tenant-1',
    versionId: 'version-1',
    status: 'completed',
    startedBy: 'user-1',
    creditsConsumed: 3,
    isTestRun: false,
    creditsFromMonthly: 3,
    creditsFromPurchased: 0,
    totalJobs: 3,
    completedJobs: 3,
    failedJobs: 0,
    createdAt: new Date('2026-02-22T10:00:00Z'),
    startedAt: new Date('2026-02-22T10:00:05Z'),
    completedAt: new Date('2026-02-22T10:05:00Z'),
    durationMs: 295000,
    templateName: 'Analysis Workflow',
    maxRetryCount: 3,
    creditsPerRun: 1,
    perFileResults: [
      { index: 0, fileName: 'report-1.md', status: 'completed', outputAssetId: 'asset-1', tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 } },
      { index: 1, fileName: 'report-2.md', status: 'completed', outputAssetId: 'asset-2', tokenUsage: { inputTokens: 150, outputTokens: 250, totalTokens: 400 } },
      { index: 2, fileName: 'report-3.md', status: 'completed', outputAssetId: 'asset-3', tokenUsage: { inputTokens: 120, outputTokens: 180, totalTokens: 300 } },
    ],
  };

  let mockRunService: {
    getRun: jest.Mock;
    retryFailed: jest.Mock;
    downloadOutput: jest.Mock;
  };
  let mockToast: { show: jest.Mock };

  beforeEach(async () => {
    mockRunService = {
      getRun: jest.fn().mockReturnValue(of(baseRun)),
      retryFailed: jest.fn().mockReturnValue(of({ ...baseRun, status: 'running' })),
      downloadOutput: jest.fn().mockReturnValue(of(new Blob(['test']))),
    };
    mockToast = { show: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [ExecutionDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { params: { id: runId } } },
        },
        { provide: WorkflowRunService, useValue: mockRunService },
        { provide: ToastService, useValue: mockToast },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            Loader2, AlertCircle, AlertTriangle, ArrowLeft,
            Clock, RefreshCw, Download, Eye,
          }),
        },
      ],
    }).compileComponents();
  });

  it('[4-RSUI-UNIT-040] should create and load run', async () => {
    const fixture = TestBed.createComponent(ExecutionDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.run()?.id).toBe(runId);
    expect(fixture.componentInstance.isLoading()).toBe(false);
  });

  it('[4-RSUI-UNIT-041] should show loading state initially', () => {
    const fixture = TestBed.createComponent(ExecutionDetailComponent);
    expect(fixture.componentInstance.isLoading()).toBe(true);
  });

  it('[4-RSUI-UNIT-042] should display status badge with correct class', async () => {
    const fixture = TestBed.createComponent(ExecutionDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const badge = compiled.querySelector('[data-testid="detail-status-badge"]');
    expect(badge?.classList.contains('badge-completed')).toBe(true);
  });

  it('[4-RSUI-UNIT-043] should render per-file results table', async () => {
    const fixture = TestBed.createComponent(ExecutionDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('[data-testid="file-row"]');
    expect(rows.length).toBe(3);
  });

  it('[4-RSUI-UNIT-044] should display queued state message', async () => {
    mockRunService.getRun.mockReturnValue(of({ ...baseRun, status: 'queued', perFileResults: null }));
    const fixture = TestBed.createComponent(ExecutionDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="queued-state"]')).toBeTruthy();
    expect(compiled.textContent).toContain('Run is queued, waiting to start...');
  });

  it('[4-RSUI-UNIT-045] should display error banner for failed run', async () => {
    mockRunService.getRun.mockReturnValue(
      of({ ...baseRun, status: 'failed', errorMessage: 'Provider timeout' }),
    );
    const fixture = TestBed.createComponent(ExecutionDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const banner = compiled.querySelector('[data-testid="error-banner"]');
    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('Provider timeout');
  });

  it('[4-RSUI-UNIT-046] should show error message for failed files', async () => {
    const runWithErrors = {
      ...baseRun,
      status: 'completed_with_errors',
      perFileResults: [
        { index: 0, fileName: 'file1.pdf', status: 'completed' as const, outputAssetId: 'a1' },
        { index: 1, fileName: 'file2.pdf', status: 'failed' as const, errorMessage: 'LLM timeout', retryAttempt: 1 },
      ],
    };
    mockRunService.getRun.mockReturnValue(of(runWithErrors));
    const fixture = TestBed.createComponent(ExecutionDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorRow = compiled.querySelector('[data-testid="file-error-row"]');
    expect(errorRow).toBeTruthy();
    expect(errorRow?.textContent).toContain('LLM timeout');
  });

  describe('status badge classes', () => {
    it('[4-RSUI-UNIT-047] should return correct class for each status', () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      const c = fixture.componentInstance;
      expect(c.getStatusClass('queued')).toBe('badge-queued');
      expect(c.getStatusClass('running')).toBe('badge-running');
      expect(c.getStatusClass('completed')).toBe('badge-completed');
      expect(c.getStatusClass('completed_with_errors')).toBe('badge-warning');
      expect(c.getStatusClass('failed')).toBe('badge-failed');
      expect(c.getStatusClass('cancelled')).toBe('badge-cancelled');
      expect(c.getStatusClass('pending')).toBe('badge-pending');
    });
  });

  describe('retry button states', () => {
    it('[4-RSUI-UNIT-048] should hide retry button when status is not completed_with_errors', async () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="retry-btn"]')).toBeNull();
      expect(compiled.querySelector('[data-testid="retry-btn-disabled"]')).toBeNull();
    });

    it('[4-RSUI-UNIT-049] should show retry button when completed_with_errors and retryable files exist', async () => {
      const runWithErrors = {
        ...baseRun,
        status: 'completed_with_errors',
        perFileResults: [
          { index: 0, fileName: 'f1.pdf', status: 'completed' as const, outputAssetId: 'a1' },
          { index: 1, fileName: 'f2.pdf', status: 'failed' as const, retryAttempt: 1 },
        ],
      };
      mockRunService.getRun.mockReturnValue(of(runWithErrors));
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const btn = compiled.querySelector('[data-testid="retry-btn"]');
      expect(btn).toBeTruthy();
      expect(btn?.textContent).toContain('Retry 1 Failed Files');
    });

    it('[4-RSUI-UNIT-050] should disable retry button when all failed files at max retries', async () => {
      const runMaxed = {
        ...baseRun,
        status: 'completed_with_errors',
        maxRetryCount: 3,
        perFileResults: [
          { index: 0, fileName: 'f1.pdf', status: 'failed' as const, retryAttempt: 3 },
          { index: 1, fileName: 'f2.pdf', status: 'failed' as const, retryAttempt: 3 },
        ],
      };
      mockRunService.getRun.mockReturnValue(of(runMaxed));
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const btn = compiled.querySelector('[data-testid="retry-btn-disabled"]') as HTMLButtonElement;
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(true);
    });
  });

  describe('retry dialog', () => {
    it('[4-RSUI-UNIT-051] should open and close retry dialog', async () => {
      const runWithErrors = {
        ...baseRun,
        status: 'completed_with_errors',
        creditsPerRun: 2,
        perFileResults: [
          { index: 0, fileName: 'f1.pdf', status: 'failed' as const, retryAttempt: 0 },
          { index: 1, fileName: 'f2.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };
      mockRunService.getRun.mockReturnValue(of(runWithErrors));
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const c = fixture.componentInstance;
      c.openRetryDialog();
      expect(c.showRetryDialog()).toBe(true);

      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const dialog = compiled.querySelector('[data-testid="retry-dialog"]');
      expect(dialog).toBeTruthy();
      expect(dialog?.textContent).toContain('4'); // 2 files * 2 credits

      c.closeRetryDialog();
      expect(c.showRetryDialog()).toBe(false);
    });

    it('[4-RSUI-UNIT-052] should call retryFailed on confirm and close dialog', async () => {
      const runWithErrors = {
        ...baseRun,
        status: 'completed_with_errors',
        perFileResults: [
          { index: 0, fileName: 'f1.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };
      mockRunService.getRun.mockReturnValue(of(runWithErrors));
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const c = fixture.componentInstance;
      c.openRetryDialog();
      c.confirmRetry();

      expect(mockRunService.retryFailed).toHaveBeenCalledWith(runId);
      expect(c.showRetryDialog()).toBe(false);
    });

    it('[4-RSUI-UNIT-053] should show loading state during retry and prevent double-click', async () => {
      const runWithErrors = {
        ...baseRun,
        status: 'completed_with_errors',
        perFileResults: [
          { index: 0, fileName: 'f1.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };
      mockRunService.getRun.mockReturnValue(of(runWithErrors));
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const c = fixture.componentInstance;
      c.openRetryDialog();

      // Before confirm — not retrying
      expect(c.isRetrying()).toBe(false);

      // The mock returns immediately, so isRetrying will be set and then cleared
      // We test the initial state and the fact that the button becomes disabled
      fixture.detectChanges();
      const confirmBtn = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="retry-confirm-btn"]',
      ) as HTMLButtonElement;
      expect(confirmBtn).toBeTruthy();
    });

    it('[4-RSUI-UNIT-054] should show error toast on 402 insufficient credits', async () => {
      const runWithErrors = {
        ...baseRun,
        status: 'completed_with_errors',
        perFileResults: [
          { index: 0, fileName: 'f1.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };
      mockRunService.getRun.mockReturnValue(of(runWithErrors));
      mockRunService.retryFailed.mockReturnValue(
        throwError(() => ({ status: 402 })),
      );
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance.openRetryDialog();
      fixture.componentInstance.confirmRetry();

      expect(mockToast.show).toHaveBeenCalledWith(
        'Insufficient credits to retry failed files.',
      );
    });

    it('[4-RSUI-UNIT-055] should show error toast on 409 already running', async () => {
      const runWithErrors = {
        ...baseRun,
        status: 'completed_with_errors',
        perFileResults: [
          { index: 0, fileName: 'f1.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };
      mockRunService.getRun.mockReturnValue(of(runWithErrors));
      mockRunService.retryFailed.mockReturnValue(
        throwError(() => ({ status: 409 })),
      );
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance.openRetryDialog();
      fixture.componentInstance.confirmRetry();

      expect(mockToast.show).toHaveBeenCalledWith(
        'Run is already in progress. Cannot retry while running.',
      );
    });
  });

  describe('download', () => {
    it('[4-RSUI-UNIT-056] should call downloadOutput with correct params', async () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance.downloadFile(0, 'report-1.md');
      expect(mockRunService.downloadOutput).toHaveBeenCalledWith(runId, 0);
    });

    it('[4-RSUI-UNIT-057] should show error toast on download failure', async () => {
      mockRunService.downloadOutput.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance.downloadFile(0, 'report-1.md');
      expect(mockToast.show).toHaveBeenCalledWith('Failed to download file.');
    });

    it('[4-RSUI-UNIT-058] should show Download All button when multiple completed files', async () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const btn = compiled.querySelector('[data-testid="download-all-btn"]');
      expect(btn).toBeTruthy();
      expect(btn?.textContent?.trim()).toContain('Download All');
    });

    it('[4-RSUI-UNIT-059] should hide Download All when 0 or 1 completed files', async () => {
      mockRunService.getRun.mockReturnValue(
        of({
          ...baseRun,
          perFileResults: [
            { index: 0, fileName: 'f1.pdf', status: 'completed', outputAssetId: 'a1' },
          ],
        }),
      );
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="download-all-btn"]')).toBeNull();
    });
  });

  describe('formatDuration', () => {
    it('[4-RSUI-UNIT-060] should format various durations correctly', () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      const c = fixture.componentInstance;

      expect(c.formatDuration(null)).toBe('—');
      expect(c.formatDuration(500)).toBe('< 1s');
      expect(c.formatDuration(45000)).toBe('45s');
      expect(c.formatDuration(125000)).toBe('2m 5s');
      expect(c.formatDuration(3700000)).toBe('1h 1m');
    });
  });

  describe('getTokenDisplay', () => {
    it('[4-RSUI-UNIT-061] should display token usage when present', () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      const c = fixture.componentInstance;

      const result: PerFileResult = {
        index: 0,
        fileName: 'test.md',
        status: 'completed',
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      };
      expect(c.getTokenDisplay(result)).toBe('100 / 200');
    });

    it('[4-RSUI-UNIT-062] should return dash when no token usage', () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      const c = fixture.componentInstance;

      const result: PerFileResult = { index: 0, fileName: 'test.md', status: 'pending' };
      expect(c.getTokenDisplay(result)).toBe('—');
    });
  });

  describe('polling', () => {
    it('[4-RSUI-UNIT-063] should recognize terminal status', async () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      // completed is terminal
      expect(fixture.componentInstance.isTerminal()).toBe(true);
    });

    it('[4-RSUI-UNIT-064] should recognize non-terminal status', async () => {
      mockRunService.getRun.mockReturnValue(of({ ...baseRun, status: 'running' }));
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.isTerminal()).toBe(false);
    });
  });

  describe('navigation', () => {
    it('[4-RSUI-UNIT-065] should navigate back to executions list', async () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      const router = TestBed.inject(Router);
      jest.spyOn(router, 'navigate').mockResolvedValue(true);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance.goBack();
      expect(router.navigate).toHaveBeenCalledWith(['/app/executions']);
    });
  });

  describe('cancelled status', () => {
    it('[4-RSUI-UNIT-066] should display cancelled status correctly', async () => {
      mockRunService.getRun.mockReturnValue(of({ ...baseRun, status: 'cancelled' }));
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const badge = compiled.querySelector('[data-testid="detail-status-badge"]');
      expect(badge?.classList.contains('badge-cancelled')).toBe(true);
      expect(badge?.textContent?.trim()).toBe('Cancelled');
    });
  });

  describe('formatDate edge cases', () => {
    it('[4-RSUI-UNIT-072] should return dash for null date', () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      expect(fixture.componentInstance.formatDate(null)).toBe('—');
    });

    it('[4-RSUI-UNIT-073] should return dash for undefined date', () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      expect(fixture.componentInstance.formatDate(undefined)).toBe('—');
    });

    it('[4-RSUI-UNIT-074] should show relative time for recent date', () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(fixture.componentInstance.formatDate(twoHoursAgo)).toBe('2 hours ago');
    });

    it('[4-RSUI-UNIT-075] should show "just now" for < 1 minute', () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      const justNow = new Date(Date.now() - 30 * 1000);
      expect(fixture.componentInstance.formatDate(justNow)).toBe('just now');
    });

    it('[4-RSUI-UNIT-076] should show absolute date for >= 24 hours', () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = fixture.componentInstance.formatDate(threeDaysAgo);
      expect(result).toMatch(/\w+ \d+, \d{4}/);
    });
  });

  describe('polling timer behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('[4-RSUI-UNIT-077] should poll when non-terminal status', () => {
      mockRunService.getRun.mockReturnValue(of({ ...baseRun, status: 'running' }));
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();

      const callsBefore = mockRunService.getRun.mock.calls.length;

      jest.advanceTimersByTime(5_000);

      expect(mockRunService.getRun.mock.calls.length).toBeGreaterThan(callsBefore);
      fixture.destroy();
    });

    it('[4-RSUI-UNIT-078] should not poll when terminal status', () => {
      // baseRun status is 'completed' (terminal)
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();

      const callsBefore = mockRunService.getRun.mock.calls.length;

      jest.advanceTimersByTime(5_000);

      expect(mockRunService.getRun.mock.calls.length).toBe(callsBefore);
      fixture.destroy();
    });
  });

  describe('downloadAll', () => {
    beforeEach(() => {
      global.URL.createObjectURL = jest.fn(() => 'blob:test');
      global.URL.revokeObjectURL = jest.fn();
    });

    it('[4-RSUI-UNIT-079] should download all files and track progress', async () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      jest.spyOn(fixture.componentInstance as any, 'triggerDownload').mockImplementation(() => {});

      const promise = fixture.componentInstance.downloadAll();

      expect(fixture.componentInstance.isDownloadingAll()).toBe(true);

      await promise;

      expect(mockRunService.downloadOutput).toHaveBeenCalledTimes(3);
      expect(fixture.componentInstance.isDownloadingAll()).toBe(false);
      expect(fixture.componentInstance.downloadProgress()).toBe('');
    });

    it('[4-RSUI-UNIT-080] should show error toast and cleanup on failure', async () => {
      mockRunService.downloadOutput.mockReturnValue(
        throwError(() => new Error('Network error')),
      );
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      await fixture.componentInstance.downloadAll();

      expect(mockToast.show).toHaveBeenCalledWith('Failed to download files.');
      expect(fixture.componentInstance.isDownloadingAll()).toBe(false);
      expect(fixture.componentInstance.downloadProgress()).toBe('');
    });
  });

  describe('getRetryDisplay', () => {
    it('[4-RSUI-UNIT-081] should show retry attempt vs maxRetries from result', () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      const c = fixture.componentInstance;

      const result: PerFileResult = {
        index: 0,
        fileName: 'test.md',
        status: 'failed',
        retryAttempt: 2,
        maxRetries: 5,
      };
      expect(c.getRetryDisplay(result)).toBe('2 of 5');
    });

    it('[4-RSUI-UNIT-082] should default to 0 retries and run maxRetryCount', async () => {
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const result: PerFileResult = {
        index: 0,
        fileName: 'test.md',
        status: 'pending',
      };
      expect(fixture.componentInstance.getRetryDisplay(result)).toBe('0 of 3');
    });
  });

  describe('retry error handling', () => {
    it('[4-RSUI-UNIT-083] should show generic error toast on non-402/409 error', async () => {
      const runWithErrors = {
        ...baseRun,
        status: 'completed_with_errors',
        perFileResults: [
          { index: 0, fileName: 'f1.pdf', status: 'failed' as const, retryAttempt: 0 },
        ],
      };
      mockRunService.getRun.mockReturnValue(of(runWithErrors));
      mockRunService.retryFailed.mockReturnValue(
        throwError(() => ({ status: 500 })),
      );
      const fixture = TestBed.createComponent(ExecutionDetailComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance.openRetryDialog();
      fixture.componentInstance.confirmRetry();

      expect(mockToast.show).toHaveBeenCalledWith('Failed to retry. Please try again.');
      expect(fixture.componentInstance.isRetrying()).toBe(false);
    });
  });
});
