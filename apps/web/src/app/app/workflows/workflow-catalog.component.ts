import { Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { WorkflowTemplateResponseDto } from '@project-bubble/shared';
import { WorkflowCatalogService } from '../../core/services/workflow-catalog.service';

@Component({
  selector: 'app-workflow-catalog',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="catalog-container">
      <div class="catalog-header">
        <h1>Workflows</h1>
        <p class="subtitle">Browse and run available workflows</p>
      </div>

      @if (loading()) {
        <div class="loading-state" data-testid="catalog-loading">
          <lucide-icon name="loader-2" [size]="24" class="spin"></lucide-icon>
          <span>Loading workflows...</span>
        </div>
      } @else if (error()) {
        <div class="error-state" data-testid="catalog-error">
          <lucide-icon name="alert-circle" [size]="24"></lucide-icon>
          <span>{{ error() }}</span>
        </div>
      } @else if (workflows().length === 0) {
        <div class="empty-state" data-testid="catalog-empty">
          <lucide-icon name="zap" [size]="48"></lucide-icon>
          <h2>No workflows available</h2>
          <p>There are no published workflows accessible to your organization.</p>
        </div>
      } @else {
        <div class="card-grid" data-testid="catalog-grid">
          @for (wf of workflows(); track wf.id) {
            <div class="workflow-card" [attr.data-testid]="'workflow-card-' + wf.id">
              <div class="card-body">
                <div class="card-header">
                  <h3 class="card-title">{{ wf.name }}</h3>
                  <span class="credits-badge" [attr.data-testid]="'credits-badge-' + wf.id">
                    <lucide-icon name="zap" [size]="14"></lucide-icon>
                    {{ wf.creditsPerRun }} {{ wf.creditsPerRun === 1 ? 'credit' : 'credits' }}
                  </span>
                </div>
                @if (wf.description) {
                  <p class="card-description">{{ wf.description }}</p>
                }
                @if (wf.currentVersion?.definition) {
                  <div class="card-tags">
                    @for (tag of getDefinitionTags(wf); track tag) {
                      <span class="tag-chip">{{ tag }}</span>
                    }
                  </div>
                }
              </div>
              <div class="card-footer">
                <button
                  class="run-button"
                  (click)="onRun(wf)"
                  [attr.data-testid]="'run-button-' + wf.id"
                >
                  <lucide-icon name="zap" [size]="16"></lucide-icon>
                  Run
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .catalog-container {
      padding: 32px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .catalog-header {
      margin-bottom: 32px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: var(--text-main);
        margin: 0 0 4px;
      }

      .subtitle {
        font-size: 14px;
        color: var(--text-secondary);
        margin: 0;
      }
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .workflow-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-xl);
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, box-shadow 0.2s;

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
    }

    .card-body {
      padding: 20px 20px 12px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-main);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .credits-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 600;
      color: var(--primary-700);
      background: var(--primary-50);
      border-radius: var(--radius-full);
      white-space: nowrap;
    }

    .card-description {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .tag-chip {
      display: inline-block;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-secondary);
      background: var(--slate-100);
      border-radius: var(--radius-full);
    }

    .card-footer {
      padding: 12px 20px 16px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
    }

    .run-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      color: white;
      background: var(--primary-600);
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: var(--primary-700);
      }
    }

    .empty-state,
    .loading-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 80px 20px;
      text-align: center;
      color: var(--text-secondary);

      h2 {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-main);
        margin: 0;
      }

      p {
        font-size: 14px;
        margin: 0;
      }
    }

    .loading-state {
      flex-direction: row;
    }

    .error-state {
      color: var(--danger-text);
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `],
})
export class WorkflowCatalogComponent {
  private readonly catalogService = inject(WorkflowCatalogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly workflows = signal<WorkflowTemplateResponseDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.loadWorkflows();
  }

  private loadWorkflows(): void {
    this.catalogService
      .listPublished()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.workflows.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load workflows');
          this.loading.set(false);
        },
      });
  }

  getDefinitionTags(wf: WorkflowTemplateResponseDto): string[] {
    const def = wf.currentVersion?.definition as Record<string, unknown> | undefined;
    const metadata = def?.['metadata'] as Record<string, unknown> | undefined;
    return (metadata?.['tags'] as string[]) ?? [];
  }

  onRun(wf: WorkflowTemplateResponseDto): void {
    this.router.navigate(['/app/workflows/run', wf.id]);
  }
}
