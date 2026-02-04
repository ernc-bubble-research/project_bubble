import { Component, input, output, computed, signal, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import type { WorkflowTemplateResponseDto } from '@project-bubble/shared';

@Component({
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  selector: 'app-template-card',
  template: `
    <div
      class="template-card"
      [attr.data-testid]="'template-card-' + template().id"
      (click)="onCardClick()"
      (keydown.enter)="cardClick.emit(template())"
      tabindex="0"
      role="button"
    >
      <div class="card-header">
        <h3 class="card-title">{{ template().name }}</h3>
        <div class="card-actions">
          <button
            class="more-actions-btn"
            (click)="toggleMenu($event)"
            [attr.data-testid]="'template-card-' + template().id + '-menu'"
            aria-label="More actions"
          >
            <lucide-icon name="more-vertical" [size]="16"></lucide-icon>
          </button>
          @if (showMenu()) {
            <div class="actions-dropdown">
              <button
                class="dropdown-item"
                (click)="onDuplicate($event)"
                [attr.data-testid]="'template-card-' + template().id + '-duplicate'"
              >
                <lucide-icon name="copy" [size]="14"></lucide-icon>
                Duplicate
              </button>
            </div>
          }
        </div>
      </div>
      <div class="card-badges">
        <span class="status-badge" [class]="template().status">
          {{ template().status | uppercase }}
        </span>
        <span class="visibility-badge" [class]="template().visibility">
          {{ template().visibility | uppercase }}
        </span>
      </div>

      <p class="card-description">
        {{ template().description || 'No description' }}
      </p>

      @if (displayTags().length > 0) {
        <div class="card-tags">
          @for (tag of displayTags(); track tag) {
            <span class="tag-pill">{{ tag }}</span>
          }
          @if (hiddenTagCount() > 0) {
            <span class="tag-pill tag-more">+{{ hiddenTagCount() }} more</span>
          }
        </div>
      }

      <div class="card-footer">
        <span class="version-info">
          <lucide-icon name="git-branch" [size]="12"></lucide-icon>
          {{ versionDisplay() }}
        </span>
        <span class="modified-date">
          {{ relativeDate() }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .template-card {
      background: var(--bg-surface);
      border-radius: var(--radius-xl);
      padding: 24px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      border: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 12px;

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }

      &:focus {
        outline: 2px solid var(--primary-600);
        outline-offset: 2px;
      }
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .card-actions {
      position: relative;
      flex-shrink: 0;
    }

    .more-actions-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: var(--text-tertiary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: background 0.2s, color 0.2s;

      &:hover {
        background: var(--slate-100);
        color: var(--text-main);
      }
    }

    .actions-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      min-width: 140px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      z-index: 10;
      padding: 4px 0;
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      font-size: 13px;
      font-family: inherit;
      color: var(--text-main);
      cursor: pointer;
      text-align: left;

      &:hover {
        background: var(--slate-50);
      }
    }

    .card-badges {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .status-badge,
    .visibility-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      text-transform: uppercase;
    }

    .status-badge {
      &.published {
        background: var(--success-bg);
        color: var(--success-text);
      }
      &.draft {
        background: var(--warning-bg);
        color: var(--warning-text);
      }
      &.archived {
        background: var(--slate-100);
        color: var(--slate-600);
      }
    }

    .visibility-badge {
      &.public {
        background: var(--primary-100);
        color: var(--primary-700);
      }
      &.private {
        background: var(--slate-100);
        color: var(--slate-600);
      }
    }

    .card-description {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.4;
    }

    .card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tag-pill {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      background: var(--slate-100);
      color: var(--slate-700);
      border-radius: var(--radius-full);
    }

    .tag-more {
      background: var(--slate-200);
      color: var(--slate-600);
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
      padding-top: 8px;
      border-top: 1px solid var(--border-color);
    }

    .version-info {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--text-tertiary);
    }

    .modified-date {
      font-size: 12px;
      color: var(--text-tertiary);
    }
  `],
})
export class TemplateCardComponent {
  private readonly elementRef = inject(ElementRef);

  template = input.required<WorkflowTemplateResponseDto>();
  cardClick = output<WorkflowTemplateResponseDto>();
  duplicateClick = output<WorkflowTemplateResponseDto>();

  showMenu = signal(false);
  private readonly maxVisibleTags = 3;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.showMenu() && !this.elementRef.nativeElement.contains(event.target)) {
      this.showMenu.set(false);
    }
  }

  tags = computed(() => {
    const definition = this.template().currentVersion?.definition as Record<string, unknown> | undefined;
    const metadata = definition?.['metadata'] as Record<string, unknown> | undefined;
    return (metadata?.['tags'] as string[]) || [];
  });

  displayTags = computed(() => this.tags().slice(0, this.maxVisibleTags));

  hiddenTagCount = computed(() => Math.max(0, this.tags().length - this.maxVisibleTags));

  versionDisplay = computed(() => {
    const version = this.template().currentVersion;
    return version ? `v${version.versionNumber}` : 'v0';
  });

  relativeDate = computed(() => {
    const date = new Date(this.template().updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString();
  });

  onCardClick(): void {
    // Don't emit card click if menu is open (clicking elsewhere should close it)
    if (!this.showMenu()) {
      this.cardClick.emit(this.template());
    } else {
      this.showMenu.set(false);
    }
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.showMenu.update(v => !v);
  }

  onDuplicate(event: Event): void {
    event.stopPropagation();
    this.showMenu.set(false);
    this.duplicateClick.emit(this.template());
  }
}
