import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { AccessLogService } from './access-log.service';
import type { AccessLogEntryDto } from '@project-bubble/shared';

@Component({
  standalone: true,
  imports: [LucideAngularModule],
  selector: 'app-access-log',
  templateUrl: './access-log.component.html',
  styleUrl: './access-log.component.scss',
})
export class AccessLogComponent {
  private readonly accessLogService = inject(AccessLogService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly entries = signal<AccessLogEntryDto[]>([]);

  constructor() {
    this.accessLogService
      .getAccessLog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.entries.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDuration(startedAt: string, endedAt: string | null): string {
    if (!endedAt) return '—';
    const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const totalMinutes = Math.round(ms / 60_000);
    if (totalMinutes < 1) return '< 1 min';
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }
}
