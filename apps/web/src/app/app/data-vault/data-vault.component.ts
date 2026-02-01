import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin } from 'rxjs';
import { AssetService } from '../../core/services/asset.service';
import { UploadZoneComponent } from './upload-zone.component';
import { FolderTreeComponent } from './folder-tree.component';
import { FileCardComponent } from './file-card.component';
import { CreateFolderDialogComponent } from './create-folder-dialog.component';
import { AssetResponseDto, FolderResponseDto } from '@project-bubble/shared';

type ViewMode = 'grid' | 'list';

const INDEXING_POLL_INTERVAL_MS = 3000;

@Component({
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    LucideAngularModule,
    UploadZoneComponent,
    FolderTreeComponent,
    FileCardComponent,
    CreateFolderDialogComponent,
  ],
  selector: 'app-data-vault',
  templateUrl: './data-vault.component.html',
  styleUrl: './data-vault.component.scss',
})
export class DataVaultComponent implements OnInit, OnDestroy {
  private readonly assetService = inject(AssetService);
  private readonly route = inject(ActivatedRoute);
  private indexingPollTimer: ReturnType<typeof setInterval> | null = null;

  assets = signal<AssetResponseDto[]>([]);
  folders = signal<FolderResponseDto[]>([]);
  activeFolderId = signal<string | null>(null);
  viewMode = signal<ViewMode>('grid');
  searchQuery = signal('');
  selectedIds = signal<Set<string>>(new Set());
  showCreateFolder = signal(false);
  loading = signal(false);
  indexingIds = signal<Set<string>>(new Set());

  filteredAssets = computed(() => {
    let result = this.assets();
    const query = this.searchQuery().toLowerCase();
    if (query) {
      result = result.filter((a) =>
        a.originalName.toLowerCase().includes(query),
      );
    }
    return result;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const folderId = params.get('folderId');
      this.activeFolderId.set(folderId);
      this.loadAssets();
    });
    this.loadFolders();
  }

  ngOnDestroy(): void {
    this.stopIndexingPoll();
  }

  loadAssets(): void {
    this.loading.set(true);
    const folderId = this.activeFolderId() || undefined;
    this.assetService.findAll(folderId).subscribe({
      next: (assets) => {
        this.assets.set(assets);
        this.loading.set(false);
        this.reconcileIndexingState(assets);
      },
      error: () => this.loading.set(false),
    });
  }

  loadFolders(): void {
    this.assetService.findAllFolders().subscribe({
      next: (folders) => this.folders.set(folders),
    });
  }

  onUploadComplete(): void {
    this.loadAssets();
  }

  onFolderSelect(folderId: string | null): void {
    this.activeFolderId.set(folderId);
    this.loadAssets();
  }

  onFolderCreated(): void {
    this.showCreateFolder.set(false);
    this.loadFolders();
  }

  onFolderRename(event: { id: string; name: string }): void {
    this.assetService.updateFolder(event.id, { name: event.name }).subscribe({
      next: () => this.loadFolders(),
    });
  }

  toggleView(): void {
    this.viewMode.update((m) => (m === 'grid' ? 'list' : 'grid'));
  }

  toggleSelect(id: string): void {
    this.selectedIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  deleteSelected(): void {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    if (!confirm(`Archive ${ids.length} file(s)? This affects all tenant users.`)) return;

    forkJoin(ids.map((id) => this.assetService.archive(id))).subscribe({
      next: () => {
        this.selectedIds.set(new Set());
        this.loadAssets();
      },
      error: () => {
        // Partial success possible — reload to show current state
        this.selectedIds.set(new Set());
        this.loadAssets();
      },
    });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  onIndexAsset(id: string): void {
    this.indexingIds.update((set) => {
      const next = new Set(set);
      next.add(id);
      return next;
    });
    this.assetService.indexAsset(id).subscribe({
      next: () => {
        // Job queued (202) — keep spinner, start polling for completion
        this.startIndexingPoll();
      },
      error: () => {
        this.indexingIds.update((set) => {
          const next = new Set(set);
          next.delete(id);
          return next;
        });
      },
    });
  }

  onDeIndexAsset(id: string): void {
    this.assetService.deIndexAsset(id).subscribe({
      next: () => this.loadAssets(),
    });
  }

  indexSelected(): void {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;

    // Add all to indexing state, then queue all
    this.indexingIds.update((set) => {
      const next = new Set(set);
      ids.forEach((id) => next.add(id));
      return next;
    });
    this.selectedIds.set(new Set());

    forkJoin(
      ids.map((id) => this.assetService.indexAsset(id)),
    ).subscribe({
      next: () => {
        // All jobs queued — poll for completion
        this.startIndexingPoll();
      },
      error: () => {
        // Partial success possible — poll to reconcile
        this.startIndexingPoll();
      },
    });
  }

  /**
   * Start polling for indexing completion. Polls loadAssets() at a fixed
   * interval until all indexingIds have resolved (isIndexed=true in the
   * response) or were removed from the current folder view.
   */
  private startIndexingPoll(): void {
    if (this.indexingPollTimer) return; // already polling

    this.indexingPollTimer = setInterval(() => {
      const folderId = this.activeFolderId() || undefined;
      this.assetService.findAll(folderId).subscribe({
        next: (assets) => {
          this.assets.set(assets);
          this.reconcileIndexingState(assets);
        },
      });
    }, INDEXING_POLL_INTERVAL_MS);
  }

  private stopIndexingPoll(): void {
    if (this.indexingPollTimer) {
      clearInterval(this.indexingPollTimer);
      this.indexingPollTimer = null;
    }
  }

  /**
   * Check loaded assets against indexingIds. If an asset that was being
   * indexed now shows isIndexed=true (or is no longer in the current view),
   * remove it from indexingIds. Stop polling when no more pending.
   */
  private reconcileIndexingState(assets: AssetResponseDto[]): void {
    const currentIndexing = this.indexingIds();
    if (currentIndexing.size === 0) {
      this.stopIndexingPoll();
      return;
    }

    const assetMap = new Map(assets.map((a) => [a.id, a]));
    const stillIndexing = new Set<string>();

    for (const id of currentIndexing) {
      const asset = assetMap.get(id);
      // Keep in indexingIds only if the asset exists and is NOT yet indexed
      if (asset && !asset.isIndexed) {
        stillIndexing.add(id);
      }
    }

    this.indexingIds.set(stillIndexing);

    if (stillIndexing.size === 0) {
      this.stopIndexingPoll();
    }
  }
}
