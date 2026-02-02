import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import type { AssetResponseDto } from '@project-bubble/shared';

@Component({
  standalone: true,
  imports: [NgClass, LucideAngularModule],
  selector: 'app-file-card',
  template: `
    @if (viewMode() === 'grid') {
      <div class="file-card" [ngClass]="{ selected: selected() }" (click)="toggleSelect.emit()" (keydown.enter)="toggleSelect.emit()" tabindex="0" role="button">
        <div class="card-checkbox">
          <input type="checkbox" [checked]="selected()" (click)="$event.stopPropagation()" (change)="toggleSelect.emit()" aria-label="Select file" />
        </div>
        <div class="card-badges">
          @if (indexing()) {
            <lucide-icon name="loader" [size]="16" class="badge-indexing spin" title="Indexing in progress..."></lucide-icon>
          } @else if (asset().isIndexed) {
            <lucide-icon name="brain" [size]="16" class="badge-indexed" title="In Knowledge Base"></lucide-icon>
          }
        </div>
        <div class="card-icon">
          <lucide-icon [name]="getIcon()" [size]="32"></lucide-icon>
        </div>
        <div class="card-name" [title]="asset().originalName">{{ asset().originalName }}</div>
        <div class="card-meta">
          <span class="file-ext">{{ getExtension() }}</span>
          <span class="file-size">{{ formatSize(asset().fileSize) }}</span>
        </div>
        <div class="card-actions" role="presentation" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
          @if (asset().isIndexed) {
            <button class="btn-action" title="Remove from Knowledge Base" (click)="deIndex.emit()">
              <lucide-icon name="brain" [size]="14"></lucide-icon>
              <span>Remove</span>
            </button>
          } @else if (!indexing()) {
            <button class="btn-action btn-learn" title="Adding to Knowledge Base means Bubble's AI agents will permanently learn from this file across all workflows." (click)="index.emit()">
              <lucide-icon name="brain" [size]="14"></lucide-icon>
              <span>Learn This</span>
            </button>
            <span class="info-tooltip" title="Adding to Knowledge Base means Bubble's AI agents will permanently learn from this file across all workflows.">
              <lucide-icon name="info" [size]="12"></lucide-icon>
            </span>
          }
        </div>
      </div>
    } @else {
      <div class="file-row" [ngClass]="{ selected: selected() }" (click)="toggleSelect.emit()" (keydown.enter)="toggleSelect.emit()" tabindex="0" role="button">
        <input type="checkbox" [checked]="selected()" (click)="$event.stopPropagation()" (change)="toggleSelect.emit()" aria-label="Select file" />
        <lucide-icon [name]="getIcon()" [size]="18"></lucide-icon>
        <span class="row-name" [title]="asset().originalName">{{ asset().originalName }}</span>
        @if (indexing()) {
          <lucide-icon name="loader" [size]="14" class="badge-indexing spin" title="Indexing in progress..."></lucide-icon>
        } @else if (asset().isIndexed) {
          <lucide-icon name="brain" [size]="14" class="badge-indexed" title="In Knowledge Base"></lucide-icon>
        }
        <span class="file-ext">{{ getExtension() }}</span>
        <span class="file-size">{{ formatSize(asset().fileSize) }}</span>
        <div class="row-actions" role="presentation" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
          @if (asset().isIndexed) {
            <button class="btn-row-action" title="Remove from Knowledge Base" (click)="deIndex.emit()">Remove</button>
          } @else if (!indexing()) {
            <button class="btn-row-action btn-learn" title="Adding to Knowledge Base means Bubble's AI agents will permanently learn from this file across all workflows." (click)="index.emit()">Learn This</button>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .file-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;

      &:hover { border-color: var(--primary-400); }
      &:hover .card-actions { opacity: 1; }
      &.selected { border-color: var(--primary-600); background: var(--primary-50, rgba(59, 130, 246, 0.05)); }
    }

    .card-checkbox {
      position: absolute;
      top: 8px;
      left: 8px;
    }

    .card-badges {
      position: absolute;
      top: 8px;
      right: 8px;
    }

    .badge-indexed {
      color: var(--primary-500, #6366f1);
    }

    .badge-indexing {
      color: var(--text-muted);
    }

    .spin {
      animation: spin 1.5s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .card-icon {
      color: var(--text-muted);
      padding: 8px 0;
    }

    .card-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .btn-action {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      font-size: 11px;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      background: var(--bg-surface);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      &.btn-learn {
        color: var(--primary-500, #6366f1);
        border-color: var(--primary-300, #a5b4fc);
        &:hover { background: var(--primary-50, rgba(99, 102, 241, 0.05)); }
      }
    }

    .info-tooltip {
      color: var(--text-muted);
      cursor: help;
    }

    .file-ext {
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      background: var(--bg-hover);
      color: var(--text-muted);
    }

    .file-size {
      font-size: 11px;
      color: var(--text-muted);
    }

    /* List view */
    .file-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background 0.15s ease;

      &:hover { background: var(--bg-hover); }
      &:hover .row-actions { opacity: 1; }
      &.selected { background: var(--primary-50, rgba(59, 130, 246, 0.05)); }
    }

    .row-name {
      flex: 1;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .row-actions {
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .btn-row-action {
      padding: 2px 8px;
      font-size: 11px;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-sm);
      background: var(--bg-surface);
      color: var(--text-muted);
      cursor: pointer;

      &:hover { background: var(--bg-hover); color: var(--text-primary); }
      &.btn-learn { color: var(--primary-500, #6366f1); }
    }
  `],
})
export class FileCardComponent {
  asset = input.required<AssetResponseDto>();
  selected = input(false);
  viewMode = input<'grid' | 'list'>('grid');
  indexing = input(false);
  toggleSelect = output<void>();
  index = output<void>();
  deIndex = output<void>();

  getExtension(): string {
    const name = this.asset().originalName;
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? '' : name.slice(lastDot + 1).toUpperCase();
  }

  getIcon(): string {
    const mime = this.asset().mimeType;
    if (mime === 'application/pdf') return 'file-text';
    if (mime.startsWith('text/')) return 'file-type';
    return 'file';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
