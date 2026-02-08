import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { WorkflowChainService } from '../../core/services/workflow-chain.service';
import { ToastService } from '../../core/services/toast.service';
import { ChainCardComponent } from './chain-card.component';
import { WorkflowFilterBarComponent, WorkflowFilters, StatusCounts } from './workflow-filter-bar.component';
import { WorkflowSearchComponent } from './workflow-search.component';
import { WorkflowSettingsModalComponent, type WorkflowSettingsTarget } from './workflow-settings-modal.component';
import type { WorkflowChainResponseDto } from '@project-bubble/shared';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    ChainCardComponent,
    WorkflowFilterBarComponent,
    WorkflowSearchComponent,
    WorkflowSettingsModalComponent,
  ],
  selector: 'app-chain-list',
  template: `
    <div class="chain-list-container" data-testid="chain-list">
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
          data-testid="create-chain-button"
        >
          <lucide-icon name="plus" [size]="16"></lucide-icon>
          Create Chain
        </button>
      </div>

      <app-workflow-filter-bar
        [filters]="filters()"
        [statusCounts]="statusCounts()"
        [availableTags]="[]"
        [showTags]="false"
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
      } @else if (filteredChains().length === 0) {
        <div class="empty-state" data-testid="chain-list-empty">
          <lucide-icon name="link" [size]="48"></lucide-icon>
          @if (hasActiveFilters()) {
            <h2>No chains match your filters</h2>
            <p>Try adjusting your search or filter criteria.</p>
          } @else {
            <h2>No chains yet</h2>
            <p>Click "+ Create Chain" to build your first workflow chain.</p>
          }
        </div>
      } @else {
        <div class="chain-grid">
          @for (chain of filteredChains(); track chain.id) {
            <app-chain-card
              [chain]="chain"
              (cardClick)="onChainClick($event)"
              (settingsClick)="onSettingsClick($event)"
            />
          }
        </div>
      }

      @if (settingsTarget()) {
        <app-workflow-settings-modal
          [target]="settingsTarget()!"
          (saved)="onSettingsSaved()"
          (cancelled)="onSettingsCancelled()"
        />
      }
    </div>
  `,
  styles: [`
    .chain-list-container {
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

    .chain-grid {
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
export class ChainListComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly chainService = inject(WorkflowChainService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  chains = signal<WorkflowChainResponseDto[]>([]);
  isLoading = signal(true);
  settingsTarget = signal<WorkflowSettingsTarget | null>(null);

  filters = signal<WorkflowFilters>({
    status: 'all',
    visibility: 'all',
    tags: [],
    search: '',
  });

  statusCounts = computed<StatusCounts>(() => {
    const all = this.chains();
    return {
      all: all.length,
      published: all.filter(c => c.status === 'published').length,
      draft: all.filter(c => c.status === 'draft').length,
      archived: all.filter(c => c.status === 'archived').length,
    };
  });

  filteredChains = computed(() => {
    const f = this.filters();
    let result = this.chains();

    // Filter by status
    if (f.status !== 'all') {
      result = result.filter(c => c.status === f.status);
    }

    // Filter by visibility
    if (f.visibility !== 'all') {
      result = result.filter(c => c.visibility === f.visibility);
    }

    // Filter by search
    if (f.search) {
      const searchLower = f.search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(searchLower) ||
        (c.description?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    return result;
  });

  hasActiveFilters = computed(() => {
    const f = this.filters();
    return f.status !== 'all' || f.visibility !== 'all' || f.search !== '';
  });

  ngOnInit(): void {
    this.loadChains();
  }

  loadChains(): void {
    this.isLoading.set(true);
    this.chainService.getAll().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (chains) => {
        this.chains.set(chains);
        this.isLoading.set(false);
      },
      error: () => {
        this.chains.set([]);
        this.isLoading.set(false);
        this.toastService.show('Failed to load chains');
      },
    });
  }

  onFiltersChange(filters: WorkflowFilters): void {
    this.filters.set(filters);
  }

  updateSearch(search: string): void {
    this.filters.update(f => ({ ...f, search }));
  }

  onSettingsClick(chain: WorkflowChainResponseDto): void {
    this.settingsTarget.set({ type: 'chain', data: chain });
  }

  onSettingsSaved(): void {
    this.settingsTarget.set(null);
    this.loadChains();
  }

  onSettingsCancelled(): void {
    this.settingsTarget.set(null);
  }

  onChainClick(chain: WorkflowChainResponseDto): void {
    this.router.navigate(['/admin/workflows/chains', chain.id, 'edit']);
  }

  navigateToCreate(): void {
    this.router.navigate(['/admin/workflows/chains/new']);
  }
}
