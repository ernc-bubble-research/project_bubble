import { Component, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AssetService } from '../../core/services/asset.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  selector: 'app-create-folder-dialog',
  template: `
    <div class="dialog-overlay" (click)="onCancel()" (keydown.escape)="onCancel()" tabindex="0" role="dialog">
      <div class="dialog" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" tabindex="-1" role="document">
        <h3>Create Folder</h3>
        <input
          type="text"
          placeholder="Folder name"
          [(ngModel)]="folderName"
          (keydown.enter)="onSubmit()"
          cdkFocusInitial
        />
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <div class="dialog-actions">
          <button class="btn-secondary" (click)="onCancel()">Cancel</button>
          <button class="btn-primary" [disabled]="!folderName" (click)="onSubmit()">Create</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .dialog {
      background: var(--bg-surface, #fff);
      border-radius: var(--radius-lg);
      padding: 24px;
      width: 360px;
      max-width: 90vw;

      h3 {
        margin: 0 0 16px;
        font-size: 16px;
        font-weight: 600;
      }

      input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        font-size: 14px;
        outline: none;
        box-sizing: border-box;

        &:focus {
          border-color: var(--primary-500);
        }
      }
    }

    .error {
      color: var(--danger-600, #dc2626);
      font-size: 12px;
      margin-top: 8px;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }

    .btn-secondary {
      padding: 8px 16px;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      background: transparent;
      font-size: 13px;
      cursor: pointer;
    }

    .btn-primary {
      padding: 8px 16px;
      border: none;
      border-radius: var(--radius-md);
      background: var(--primary-600);
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `],
})
export class CreateFolderDialogComponent {
  parentId = input<string | null>(null);
  created = output<void>();
  cancelled = output<void>();

  private readonly assetService = inject(AssetService);

  folderName = '';
  error = signal('');

  onCancel(): void {
    this.cancelled.emit();
  }

  onSubmit(): void {
    if (!this.folderName.trim()) return;

    this.assetService
      .createFolder({
        name: this.folderName.trim(),
        parentId: this.parentId() || undefined,
      })
      .subscribe({
        next: () => this.created.emit(),
        error: (err) => this.error.set(err?.error?.message || 'Failed to create folder'),
      });
  }
}
