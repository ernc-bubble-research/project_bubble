import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { switchMap } from 'rxjs/operators';
import { WorkflowTemplateService } from '../../core/services/workflow-template.service';
import { ToastService } from '../../core/services/toast.service';
import { TemplateCardComponent } from './template-card.component';
import { WorkflowFilterBarComponent, WorkflowFilters, StatusCounts } from './workflow-filter-bar.component';
import { WorkflowSearchComponent } from './workflow-search.component';
import type { WorkflowTemplateResponseDto, CreateWorkflowTemplateDto } from '@project-bubble/shared';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    TemplateCardComponent,
    WorkflowFilterBarComponent,
    WorkflowSearchComponent,
  ],
  selector: 'app-template-list',
  template: `
    <div class="template-list-container" data-testid="template-list">
      <div class="list-header">
        <div class="search-section">
          <app-workflow-search
            [value]="filters().search"
            (searchChange)="updateSearch($event)"
          />
        </div>
        <button
          class="btn btn-primary"
          (click)="navigateToCreate()"
          data-testid="create-workflow-button"
        >
          <lucide-icon name="plus" [size]="16"></lucide-icon>
          Create Workflow
        </button>
      </div>

      <app-workflow-filter-bar
        [filters]="filters()"
        [statusCounts]="statusCounts()"
        [availableTags]="availableTags()"
        (filtersChange)="onFiltersChange($event)"
      />

      @if (isLoading()) {
        <div class="loading-state">
          <div class="skeleton-grid">
            @for (item of [1,2,3,4,5,6]; track item) {
              <div class="skeleton-card"></div>
            }
          </div>
        </div>
      } @else if (filteredTemplates().length === 0) {
        <div class="empty-state" data-testid="template-list-empty">
          <lucide-icon name="file-text" [size]="48"></lucide-icon>
          @if (hasActiveFilters()) {
            <h2>No workflows match your filters</h2>
            <p>Try adjusting your search or filter criteria.</p>
          } @else {
            <h2>No workflows yet</h2>
            <p>Click "+ Create Workflow" to build your first template.</p>
          }
        </div>
      } @else {
        <div class="workflow-grid">
          @for (template of filteredTemplates(); track template.id) {
            <app-template-card
              [template]="template"
              (cardClick)="onTemplateClick($event)"
              (duplicateClick)="onDuplicateTemplate($event)"
            />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .template-list-container {
      width: 100%;
    }

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .search-section {
      flex: 1;
      max-width: 320px;
    }

    .workflow-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }

    .loading-state {
      padding: 24px 0;
    }

    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }

    .skeleton-card {
      height: 180px;
      background: linear-gradient(90deg, var(--slate-100) 25%, var(--slate-50) 50%, var(--slate-100) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: var(--radius-xl);
    }

    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 24px;
      text-align: center;
      color: var(--text-secondary);

      h2 {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-main);
        margin: 16px 0 8px;
      }

      p {
        font-size: 14px;
        margin: 0;
      }
    }
  `],
})
export class TemplateListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly templateService = inject(WorkflowTemplateService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  templates = signal<WorkflowTemplateResponseDto[]>([]);
  isLoading = signal(true);

  filters = signal<WorkflowFilters>({
    status: 'all',
    visibility: 'all',
    tags: [],
    search: '',
  });

  statusCounts = computed<StatusCounts>(() => {
    const all = this.templates();
    return {
      all: all.length,
      published: all.filter(t => t.status === 'published').length,
      draft: all.filter(t => t.status === 'draft').length,
      archived: all.filter(t => t.status === 'archived').length,
    };
  });

  availableTags = computed(() => {
    const tagsSet = new Set<string>();
    for (const template of this.templates()) {
      const definition = template.currentVersion?.definition as Record<string, unknown> | undefined;
      const metadata = definition?.['metadata'] as Record<string, unknown> | undefined;
      const tags = metadata?.['tags'] as string[] | undefined;
      if (tags) {
        tags.forEach(tag => tagsSet.add(tag));
      }
    }
    return Array.from(tagsSet).sort();
  });

  filteredTemplates = computed(() => {
    const f = this.filters();
    let result = this.templates();

    // Filter by status
    if (f.status !== 'all') {
      result = result.filter(t => t.status === f.status);
    }

    // Filter by visibility
    if (f.visibility !== 'all') {
      result = result.filter(t => t.visibility === f.visibility);
    }

    // Filter by tags
    if (f.tags.length > 0) {
      result = result.filter(t => {
        const definition = t.currentVersion?.definition as Record<string, unknown> | undefined;
        const metadata = definition?.['metadata'] as Record<string, unknown> | undefined;
        const templateTags = metadata?.['tags'] as string[] | undefined;
        return f.tags.some(tag => templateTags?.includes(tag));
      });
    }

    // Filter by search
    if (f.search) {
      const searchLower = f.search.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        (t.description?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    return result;
  });

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return f.status !== 'all' || f.visibility !== 'all' || f.tags.length > 0 || f.search !== '';
  });

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.isLoading.set(true);
    this.templateService.getAll().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.isLoading.set(false);
      },
      error: () => {
        this.templates.set([]);
        this.isLoading.set(false);
        this.toastService.show('Failed to load templates');
      },
    });
  }

  onFiltersChange(filters: WorkflowFilters): void {
    this.filters.set(filters);
  }

  updateSearch(search: string): void {
    this.filters.update(f => ({ ...f, search }));
  }

  onTemplateClick(template: WorkflowTemplateResponseDto): void {
    this.router.navigate(['/admin/workflows/edit', template.id]);
  }

  navigateToCreate(): void {
    this.router.navigate(['/admin/workflows/create']);
  }

  onDuplicateTemplate(template: WorkflowTemplateResponseDto): void {
    // Create new template with "(Copy)" suffix
    const createDto: CreateWorkflowTemplateDto = {
      name: `${template.name} (Copy)`,
      description: template.description ?? '',
      visibility: template.visibility as 'public' | 'private',
    };

    this.templateService.create(createDto).pipe(
      switchMap((newTemplate) => {
        // If original has a version with definition, copy it to the new template
        if (template.currentVersion?.definition) {
          return this.templateService.createVersion(newTemplate.id, {
            definition: template.currentVersion.definition as Record<string, unknown>,
          }).pipe(
            switchMap(() => this.templateService.getById(newTemplate.id))
          );
        }
        // Otherwise just return the new template
        return this.templateService.getById(newTemplate.id);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (newTemplate) => {
        this.toastService.show(`Duplicated "${template.name}" successfully`);
        this.router.navigate(['/admin/workflows/edit', newTemplate.id]);
      },
      error: () => {
        this.toastService.show('Failed to duplicate template');
      },
    });
  }
}
