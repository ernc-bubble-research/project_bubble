import { Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { interval, switchMap, filter } from 'rxjs';
import { formatRelativeDate } from '../../core/utils/date-format.util';
import {
  WorkflowRunService,
  type WorkflowRunListParams,
} from '../../core/services/workflow-run.service';
import type { WorkflowRunResponseDto } from '@project-bubble/shared';

const POLL_INTERVAL_MS = 10_000;
const NON_TERMINAL_STATUSES = new Set(['queued', 'running']);

@Component({
  standalone: true,
  imports: [LucideAngularModule, RouterModule],
  selector: 'app-execution-list',
  templateUrl: './execution-list.component.html',
  styleUrl: './execution-list.component.scss',
})
export class ExecutionListComponent implements OnInit {
  private readonly runService = inject(WorkflowRunService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly runs = signal<WorkflowRunResponseDto[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly statusFilter = signal<string>('');
  readonly isLoading = signal(true);

  readonly totalPages = computed(() => Math.ceil(this.total() / this.limit()) || 1);
  readonly hasActiveRuns = computed(() =>
    this.runs().some((r) => NON_TERMINAL_STATUSES.has(r.status)),
  );

  readonly statusOptions = [
    { label: 'All', value: '' },
    { label: 'Queued', value: 'queued' },
    { label: 'Running', value: 'running' },
    { label: 'Completed', value: 'completed' },
    { label: 'Completed with Errors', value: 'completed_with_errors' },
    { label: 'Failed', value: 'failed' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  ngOnInit(): void {
    this.loadRuns();
    this.startPolling();
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value);
    this.page.set(1);
    this.loadRuns();
  }

  onPageChange(newPage: number): void {
    if (newPage < 1 || newPage > this.totalPages()) return;
    this.page.set(newPage);
    this.loadRuns();
  }

  viewRun(id: string): void {
    this.router.navigate(['/app/executions', id]);
  }

  formatDate(date: Date | string): string {
    return formatRelativeDate(date);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'queued': return 'badge-queued';
      case 'running': return 'badge-running';
      case 'completed': return 'badge-completed';
      case 'completed_with_errors': return 'badge-warning';
      case 'failed': return 'badge-failed';
      case 'cancelled': return 'badge-cancelled';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'queued': return 'Queued';
      case 'running': return 'Running';
      case 'completed': return 'Completed';
      case 'completed_with_errors': return 'Completed with Errors';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }

  getFilesDisplay(run: WorkflowRunResponseDto): string {
    const total = run.totalJobs ?? 0;
    if (total <= 1 && (!run.perFileResults || run.perFileResults.length === 0)) {
      return 'N/A';
    }
    const completed = run.completedJobs ?? 0;
    return `${completed}/${total}`;
  }

  private loadRuns(): void {
    const params: WorkflowRunListParams = {
      page: this.page(),
      limit: this.limit(),
      excludeTestRuns: true,
    };
    const filter = this.statusFilter();
    if (filter) {
      params.status = filter;
    }

    this.runService
      .listRuns(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.runs.set(res.data);
          this.total.set(res.total);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  private startPolling(): void {
    interval(POLL_INTERVAL_MS)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(() => this.hasActiveRuns()),
        switchMap(() => {
          const params: WorkflowRunListParams = {
            page: this.page(),
            limit: this.limit(),
            excludeTestRuns: true,
          };
          const filter = this.statusFilter();
          if (filter) params.status = filter;
          return this.runService.listRuns(params);
        }),
      )
      .subscribe({
        next: (res) => {
          this.runs.set(res.data);
          this.total.set(res.total);
        },
      });
  }

}
