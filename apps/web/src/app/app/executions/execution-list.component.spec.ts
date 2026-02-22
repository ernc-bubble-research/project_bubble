import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  ListChecks,
  Loader2,
  Eye,
} from 'lucide-angular';
import { ExecutionListComponent } from './execution-list.component';
import { WorkflowRunService } from '../../core/services/workflow-run.service';
import type { WorkflowRunResponseDto } from '@project-bubble/shared';

describe('ExecutionListComponent [P1]', () => {
  const mockRun: WorkflowRunResponseDto = {
    id: 'run-1',
    tenantId: 'tenant-1',
    versionId: 'version-1',
    status: 'completed',
    startedBy: 'user-1',
    creditsConsumed: 2,
    isTestRun: false,
    creditsFromMonthly: 2,
    creditsFromPurchased: 0,
    totalJobs: 3,
    completedJobs: 3,
    failedJobs: 0,
    createdAt: new Date(),
    templateName: 'Test Workflow',
    maxRetryCount: 3,
  };

  const mockRunService = {
    listRuns: jest.fn().mockReturnValue(of({ data: [mockRun], total: 1, page: 1, limit: 20 })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRunService.listRuns.mockReturnValue(
      of({ data: [mockRun], total: 1, page: 1, limit: 20 }),
    );

    await TestBed.configureTestingModule({
      imports: [ExecutionListComponent],
      providers: [
        provideRouter([]),
        { provide: WorkflowRunService, useValue: mockRunService },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ ListChecks, Loader2, Eye }),
        },
      ],
    }).compileComponents();
  });

  it('[4-RSUI-UNIT-020] should create', async () => {
    const fixture = TestBed.createComponent(ExecutionListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('[4-RSUI-UNIT-021] should show loading state initially', () => {
    mockRunService.listRuns.mockReturnValue(of({ data: [], total: 0, page: 1, limit: 20 }));
    const fixture = TestBed.createComponent(ExecutionListComponent);
    // Before ngOnInit — loading is true by default
    const component = fixture.componentInstance;
    expect(component.isLoading()).toBe(true);
  });

  it('[4-RSUI-UNIT-022] should render table with runs after loading', async () => {
    const fixture = TestBed.createComponent(ExecutionListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('[data-testid="execution-row"]');
    expect(rows.length).toBe(1);
  });

  it('[4-RSUI-UNIT-023] should show empty state when no runs', async () => {
    mockRunService.listRuns.mockReturnValue(
      of({ data: [], total: 0, page: 1, limit: 20 }),
    );
    const fixture = TestBed.createComponent(ExecutionListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="execution-list-empty"]')).toBeTruthy();
    expect(compiled.textContent).toContain('No executions yet');
  });

  it('[4-RSUI-UNIT-024] should pass excludeTestRuns=true on all API calls', async () => {
    const fixture = TestBed.createComponent(ExecutionListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockRunService.listRuns).toHaveBeenCalledWith(
      expect.objectContaining({ excludeTestRuns: true }),
    );
  });

  it('[4-RSUI-UNIT-025] should change page on pagination click', async () => {
    mockRunService.listRuns.mockReturnValue(
      of({ data: [mockRun], total: 50, page: 1, limit: 20 }),
    );
    const fixture = TestBed.createComponent(ExecutionListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.onPageChange(2);
    expect(component.page()).toBe(2);
    expect(mockRunService.listRuns).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it('[4-RSUI-UNIT-026] should reset to page 1 on filter change', async () => {
    const fixture = TestBed.createComponent(ExecutionListComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.onPageChange(3);
    component.onStatusFilterChange('failed');

    expect(component.page()).toBe(1);
    expect(component.statusFilter()).toBe('failed');
    expect(mockRunService.listRuns).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, status: 'failed' }),
    );
  });

  it('[4-RSUI-UNIT-027] should display status badge with correct class', async () => {
    const fixture = TestBed.createComponent(ExecutionListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const badge = compiled.querySelector('[data-testid="status-badge"]');
    expect(badge?.classList.contains('badge-completed')).toBe(true);
    expect(badge?.textContent?.trim()).toBe('Completed');
  });

  it('[4-RSUI-UNIT-028] should navigate to detail on view click', async () => {
    const fixture = TestBed.createComponent(ExecutionListComponent);
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.viewRun('run-1');
    expect(router.navigate).toHaveBeenCalledWith(['/app/executions', 'run-1']);
  });

  it('[4-RSUI-UNIT-029] should display workflow name from templateName', async () => {
    const fixture = TestBed.createComponent(ExecutionListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Workflow');
  });

  it('[4-RSUI-UNIT-030] should render all 7 filter options including Cancelled', async () => {
    const fixture = TestBed.createComponent(ExecutionListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const options = compiled.querySelectorAll('[data-testid="status-filter"] option');
    expect(options.length).toBe(7);
    const labels = Array.from(options).map((o) => o.textContent?.trim());
    expect(labels).toContain('All');
    expect(labels).toContain('Cancelled');
  });

  it('[4-RSUI-UNIT-031] should display files as completed/total', async () => {
    const fixture = TestBed.createComponent(ExecutionListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.getFilesDisplay(mockRun)).toBe('3/3');
  });

  describe('formatDate', () => {
    it('[4-RSUI-UNIT-032] should show relative time for < 24 hours', () => {
      const fixture = TestBed.createComponent(ExecutionListComponent);
      const component = fixture.componentInstance;
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(component.formatDate(twoHoursAgo)).toBe('2 hours ago');
    });

    it('[4-RSUI-UNIT-033] should show absolute date for >= 24 hours', () => {
      const fixture = TestBed.createComponent(ExecutionListComponent);
      const component = fixture.componentInstance;
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = component.formatDate(threeDaysAgo);
      // Should contain month abbreviation and year
      expect(result).toMatch(/\w+ \d+, \d{4}/);
    });
  });

  describe('getStatusClass', () => {
    it('[4-RSUI-UNIT-034] returns correct class for each status', () => {
      const fixture = TestBed.createComponent(ExecutionListComponent);
      const c = fixture.componentInstance;
      expect(c.getStatusClass('queued')).toBe('badge-queued');
      expect(c.getStatusClass('running')).toBe('badge-running');
      expect(c.getStatusClass('completed')).toBe('badge-completed');
      expect(c.getStatusClass('completed_with_errors')).toBe('badge-warning');
      expect(c.getStatusClass('failed')).toBe('badge-failed');
      expect(c.getStatusClass('cancelled')).toBe('badge-cancelled');
    });
  });

  describe('polling lifecycle', () => {
    it('[4-RSUI-UNIT-035] should detect active runs', async () => {
      const activeRun = { ...mockRun, status: 'running' };
      mockRunService.listRuns.mockReturnValue(
        of({ data: [activeRun], total: 1, page: 1, limit: 20 }),
      );
      const fixture = TestBed.createComponent(ExecutionListComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.hasActiveRuns()).toBe(true);
    });

    it('[4-RSUI-UNIT-036] should not detect active runs when all terminal', async () => {
      const fixture = TestBed.createComponent(ExecutionListComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      // mockRun status is 'completed' (terminal)
      expect(fixture.componentInstance.hasActiveRuns()).toBe(false);
    });
  });

  describe('polling timer behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('[4-RSUI-UNIT-067] should make polling API call when active runs exist', () => {
      const activeRun = { ...mockRun, status: 'running' };
      mockRunService.listRuns.mockReturnValue(
        of({ data: [activeRun], total: 1, page: 1, limit: 20 }),
      );
      const fixture = TestBed.createComponent(ExecutionListComponent);
      fixture.detectChanges();

      const callsBefore = mockRunService.listRuns.mock.calls.length;

      jest.advanceTimersByTime(10_000);

      expect(mockRunService.listRuns.mock.calls.length).toBeGreaterThan(callsBefore);
      fixture.destroy();
    });

    it('[4-RSUI-UNIT-068] should skip polling when all runs terminal (filter)', () => {
      // mockRun is 'completed' (terminal) — filter() skips the switchMap
      const fixture = TestBed.createComponent(ExecutionListComponent);
      fixture.detectChanges();

      const callsBefore = mockRunService.listRuns.mock.calls.length;

      jest.advanceTimersByTime(10_000);

      expect(mockRunService.listRuns.mock.calls.length).toBe(callsBefore);
      fixture.destroy();
    });

    it('[4-RSUI-UNIT-069] should resume polling after runs become active again', () => {
      // Start with terminal runs
      const fixture = TestBed.createComponent(ExecutionListComponent);
      fixture.detectChanges();

      const callsBefore = mockRunService.listRuns.mock.calls.length;

      // First tick — terminal, skipped by filter
      jest.advanceTimersByTime(10_000);
      expect(mockRunService.listRuns.mock.calls.length).toBe(callsBefore);

      // Simulate runs becoming active (e.g., after manual reload sets active run)
      const activeRun = { ...mockRun, status: 'running' } as WorkflowRunResponseDto;
      mockRunService.listRuns.mockReturnValue(
        of({ data: [activeRun], total: 1, page: 1, limit: 20 }),
      );
      fixture.componentInstance['runs'].set([activeRun]);

      // Second tick — active, should poll
      jest.advanceTimersByTime(10_000);
      expect(mockRunService.listRuns.mock.calls.length).toBeGreaterThan(callsBefore);
      fixture.destroy();
    });
  });

  describe('getFilesDisplay edge cases', () => {
    it('[4-RSUI-UNIT-070] should show N/A for context-only workflow with no perFileResults', () => {
      const fixture = TestBed.createComponent(ExecutionListComponent);
      const c = fixture.componentInstance;

      const contextOnlyRun = {
        ...mockRun,
        totalJobs: 1,
        completedJobs: 1,
        perFileResults: undefined,
      } as WorkflowRunResponseDto;
      expect(c.getFilesDisplay(contextOnlyRun)).toBe('N/A');
    });

    it('[4-RSUI-UNIT-071] should show completed/total when perFileResults exist', () => {
      const fixture = TestBed.createComponent(ExecutionListComponent);
      const c = fixture.componentInstance;

      const runWithFiles = {
        ...mockRun,
        totalJobs: 3,
        completedJobs: 2,
        perFileResults: [
          { index: 0, fileName: 'a.md', status: 'completed' },
          { index: 1, fileName: 'b.md', status: 'completed' },
          { index: 2, fileName: 'c.md', status: 'failed' },
        ],
      } as WorkflowRunResponseDto;
      expect(c.getFilesDisplay(runWithFiles)).toBe('2/3');
    });
  });
});
