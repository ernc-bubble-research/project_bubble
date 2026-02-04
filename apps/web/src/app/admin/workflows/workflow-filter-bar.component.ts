import { Component, input, output, signal, computed, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

export interface WorkflowFilters {
  status: 'all' | 'published' | 'draft' | 'archived';
  visibility: 'all' | 'public' | 'private';
  tags: string[];
  search: string;
}

export interface StatusCounts {
  all: number;
  published: number;
  draft: number;
  archived: number;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  selector: 'app-workflow-filter-bar',
  template: `
    <div class="filter-bar">
      <div class="status-tabs">
        <button
          class="status-tab"
          [class.active]="filters().status === 'all'"
          (click)="updateStatus('all')"
          data-testid="filter-status-all"
        >
          All
          <span class="count-badge">{{ statusCounts().all }}</span>
        </button>
        <button
          class="status-tab"
          [class.active]="filters().status === 'published'"
          (click)="updateStatus('published')"
          data-testid="filter-status-published"
        >
          Published
          <span class="count-badge">{{ statusCounts().published }}</span>
        </button>
        <button
          class="status-tab"
          [class.active]="filters().status === 'draft'"
          (click)="updateStatus('draft')"
          data-testid="filter-status-draft"
        >
          Draft
          <span class="count-badge">{{ statusCounts().draft }}</span>
        </button>
        <button
          class="status-tab"
          [class.active]="filters().status === 'archived'"
          (click)="updateStatus('archived')"
          data-testid="filter-status-archived"
        >
          Archived
          <span class="count-badge">{{ statusCounts().archived }}</span>
        </button>
      </div>

      <div class="filter-controls">
        <select
          class="visibility-select"
          [ngModel]="filters().visibility"
          (ngModelChange)="updateVisibility($event)"
          data-testid="filter-visibility"
        >
          <option value="all">All Visibility</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>

        @if (showTags() && availableTags().length > 0) {
          <div class="tags-filter" data-testid="filter-tags">
            <button
              class="tags-trigger"
              (click)="toggleTagsDropdown()"
            >
              <lucide-icon name="tag" [size]="14"></lucide-icon>
              Tags
              @if (filters().tags.length > 0) {
                <span class="selected-count">({{ filters().tags.length }})</span>
              }
              <lucide-icon name="chevron-down" [size]="14"></lucide-icon>
            </button>

            @if (showTagsDropdown()) {
              <div class="tags-dropdown">
                @for (tag of availableTags(); track tag) {
                  <label class="tag-option">
                    <input
                      type="checkbox"
                      [checked]="filters().tags.includes(tag)"
                      (change)="toggleTag(tag)"
                    />
                    {{ tag }}
                  </label>
                }
              </div>
            }
          </div>
        }

        @if (hasActiveFilters()) {
          <button
            class="clear-filters"
            (click)="clearFilters()"
            data-testid="filter-clear"
          >
            <lucide-icon name="x" [size]="14"></lucide-icon>
            Clear filters
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .filter-bar {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 24px;
    }

    .status-tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--border-color);
    }

    .status-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border: none;
      background: transparent;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.2s, border-color 0.2s;

      &:hover {
        color: var(--text-main);
      }

      &.active {
        color: var(--primary-600);
        border-bottom-color: var(--primary-600);
      }
    }

    .count-badge {
      font-size: 12px;
      font-weight: 500;
      padding: 2px 8px;
      background: var(--slate-100);
      color: var(--slate-600);
      border-radius: var(--radius-full);
    }

    .active .count-badge {
      background: var(--primary-100);
      color: var(--primary-700);
    }

    .filter-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .visibility-select {
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      font-size: 13px;
      font-family: inherit;
      color: var(--text-main);
      background: var(--bg-surface);
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: var(--primary-600);
        box-shadow: 0 0 0 3px var(--primary-100);
      }
    }

    .tags-filter {
      position: relative;
    }

    .tags-trigger {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      font-size: 13px;
      font-family: inherit;
      color: var(--text-main);
      background: var(--bg-surface);
      cursor: pointer;

      &:hover {
        border-color: var(--slate-300);
      }
    }

    .selected-count {
      color: var(--primary-600);
      font-weight: 500;
    }

    .tags-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      min-width: 180px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      z-index: 10;
      padding: 8px 0;
    }

    .tag-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      font-size: 13px;
      color: var(--text-main);
      cursor: pointer;

      &:hover {
        background: var(--slate-50);
      }

      input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: var(--primary-600);
      }
    }

    .clear-filters {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      border: none;
      background: transparent;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;

      &:hover {
        color: var(--danger-text);
      }
    }
  `],
})
export class WorkflowFilterBarComponent {
  private readonly elementRef = inject(ElementRef);

  filters = input.required<WorkflowFilters>();
  statusCounts = input.required<StatusCounts>();
  availableTags = input<string[]>([]);
  showTags = input<boolean>(true);
  filtersChange = output<WorkflowFilters>();

  showTagsDropdown = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const tagsFilter = this.elementRef.nativeElement.querySelector('.tags-filter');
    if (this.showTagsDropdown() && tagsFilter && !tagsFilter.contains(event.target)) {
      this.showTagsDropdown.set(false);
    }
  }

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return f.status !== 'all' || f.visibility !== 'all' || f.tags.length > 0 || f.search !== '';
  });

  updateStatus(status: WorkflowFilters['status']): void {
    this.filtersChange.emit({ ...this.filters(), status });
  }

  updateVisibility(visibility: WorkflowFilters['visibility']): void {
    this.filtersChange.emit({ ...this.filters(), visibility });
  }

  toggleTag(tag: string): void {
    const current = this.filters().tags;
    const newTags = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    this.filtersChange.emit({ ...this.filters(), tags: newTags });
  }

  toggleTagsDropdown(): void {
    this.showTagsDropdown.update(v => !v);
  }

  clearFilters(): void {
    this.filtersChange.emit({
      status: 'all',
      visibility: 'all',
      tags: [],
      search: '',
    });
  }
}
