import { Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { interval, switchMap, filter } from 'rxjs';
import { WorkflowRunService } from '../../core/services/workflow-run.service';
import { ToastService } from '../../core/services/toast.service';
import { formatRelativeDate } from '../../core/utils/date-format.util';
import type { WorkflowRunResponseDto, PerFileResult } from '@project-bubble/shared';
import { downloadZip } from 'client-zip';

const POLL_INTERVAL_MS = 5_000;
const TERMINAL_STATUSES = new Set(['completed', 'completed_with_errors', 'failed', 'cancelled']);

@Component({
  standalone: true,
  imports: [LucideAngularModule, RouterModule],
  selector: 'app-execution-detail',
  templateUrl: './execution-detail.component.html',
  styleUrl: './execution-detail.component.scss',
})
export class ExecutionDetailComponent implements OnInit {
  private readonly runService = inject(WorkflowRunService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly run = signal<WorkflowRunResponseDto | null>(null);
  readonly isLoading = signal(true);
  readonly isRetrying = signal(false);
  readonly showRetryDialog = signal(false);
  readonly downloadProgress = signal('');
  readonly isDownloadingAll = signal(false);

  readonly isTerminal = computed(() => {
    const r = this.run();
    return r ? TERMINAL_STATUSES.has(r.status) : false;
  });

  readonly retryableFiles = computed(() => {
    const r = this.run();
    if (!r || r.status !== 'completed_with_errors') return [];
    const results = r.perFileResults ?? [];
    const maxRetries = r.maxRetryCount ?? 3;
    return results.filter(
      (f) => f.status === 'failed' && (f.retryAttempt ?? 0) < maxRetries,
    );
  });

  readonly allFailedAtMax = computed(() => {
    const r = this.run();
    if (!r || r.status !== 'completed_with_errors') return false;
    const failedFiles = (r.perFileResults ?? []).filter((f) => f.status === 'failed');
    if (failedFiles.length === 0) return false;
    const maxRetries = r.maxRetryCount ?? 3;
    return failedFiles.every((f) => (f.retryAttempt ?? 0) >= maxRetries);
  });

  readonly completedFiles = computed(() => {
    const r = this.run();
    return (r?.perFileResults ?? []).filter((f) => f.status === 'completed');
  });

  readonly retryCredits = computed(() => {
    const r = this.run();
    const retryable = this.retryableFiles();
    if (!r) return 0;
    return retryable.length * (r.creditsPerRun ?? 1);
  });

  private runId = '';
  private isDestroyed = false;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
    });
    this.runId = this.route.snapshot.params['id'];
    this.loadRun();
    this.startPolling();
  }

  goBack(): void {
    this.router.navigate(['/app/executions']);
  }

  formatDate(date: Date | string | null | undefined): string {
    return formatRelativeDate(date);
  }

  formatDuration(ms: number | null | undefined): string {
    if (ms == null) return '—';
    if (ms < 1000) return '< 1s';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'queued': return 'badge-queued';
      case 'running': case 'processing': case 'retrying': return 'badge-running';
      case 'completed': return 'badge-completed';
      case 'completed_with_errors': return 'badge-warning';
      case 'failed': return 'badge-failed';
      case 'cancelled': return 'badge-cancelled';
      case 'pending': return 'badge-pending';
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
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'retrying': return 'Retrying';
      default: return status;
    }
  }

  getTokenDisplay(result: PerFileResult): string {
    if (!result.tokenUsage) return '—';
    return `${result.tokenUsage.inputTokens} / ${result.tokenUsage.outputTokens}`;
  }

  getRetryDisplay(result: PerFileResult): string {
    const attempt = result.retryAttempt ?? 0;
    const max = result.maxRetries ?? this.run()?.maxRetryCount ?? 3;
    return `${attempt} of ${max}`;
  }

  openRetryDialog(): void {
    this.showRetryDialog.set(true);
  }

  closeRetryDialog(): void {
    this.showRetryDialog.set(false);
  }

  confirmRetry(): void {
    this.isRetrying.set(true);
    this.runService
      .retryFailed(this.runId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.run.set(updated);
          this.isRetrying.set(false);
          this.showRetryDialog.set(false);
          this.startPolling();
        },
        error: (err) => {
          this.isRetrying.set(false);
          const status = err.status;
          if (status === 402) {
            this.toast.show('Insufficient credits to retry failed files.');
          } else if (status === 409) {
            this.toast.show('Run is already in progress. Cannot retry while running.');
          } else {
            this.toast.show('Failed to retry. Please try again.');
          }
        },
      });
  }

  downloadFile(fileIndex: number, fileName: string): void {
    this.runService
      .downloadOutput(this.runId, fileIndex)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          this.triggerDownload(blob, fileName);
        },
        error: () => {
          this.toast.show('Failed to download file.');
        },
      });
  }

  async downloadAll(): Promise<void> {
    const run = this.run();
    if (!run) return;

    const completed = this.completedFiles();
    if (completed.length === 0) return;

    this.isDownloadingAll.set(true);
    this.downloadProgress.set(`Downloading 0 of ${completed.length} files...`);

    try {
      const files: { name: string; input: Blob }[] = [];
      let downloadedCount = 0;

      for (const file of completed) {
        if (this.isDestroyed) return;
        const blob = await new Promise<Blob>((resolve, reject) => {
          this.runService
            .downloadOutput(this.runId, file.index)
            .subscribe({ next: resolve, error: reject });
        });
        files.push({ name: file.fileName, input: blob });
        downloadedCount++;
        this.downloadProgress.set(
          `Downloading ${downloadedCount} of ${completed.length} files...`,
        );
      }

      const zipBlob = await new Response(downloadZip(files) as unknown as BodyInit).blob();
      const workflowName = run.templateName ?? 'workflow';
      const safeName = workflowName.replace(/[^a-zA-Z0-9-_ ]/g, '');
      this.triggerDownload(zipBlob, `${safeName}-outputs.zip`);
    } catch {
      this.toast.show('Failed to download files.');
    } finally {
      this.isDownloadingAll.set(false);
      this.downloadProgress.set('');
    }
  }

  private loadRun(): void {
    this.runService
      .getRun(this.runId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (run) => {
          this.run.set(run);
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
        filter(() => !this.isTerminal()),
        switchMap(() => this.runService.getRun(this.runId)),
      )
      .subscribe({
        next: (run) => {
          this.run.set(run);
        },
      });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

}
