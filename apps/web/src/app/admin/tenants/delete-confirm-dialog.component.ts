import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  standalone: true,
  imports: [LucideAngularModule],
  selector: 'app-delete-confirm-dialog',
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
    <div class="dialog-overlay" (click)="cancelled.emit()" role="dialog" aria-modal="true" data-testid="delete-confirm-dialog">
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
      <div class="dialog-card" (click)="$event.stopPropagation()">
        <div class="dialog-icon">
          <lucide-icon name="alert-triangle" [size]="32"></lucide-icon>
        </div>
        <h2 class="dialog-title">Permanently Delete Tenant</h2>
        <p class="dialog-text">
          This will permanently delete <strong>{{ tenantName }}</strong> and all associated data
          including users, files, workflows, and knowledge chunks. This action cannot be undone.
        </p>
        <div class="confirm-input-group">
          <label class="confirm-label" for="confirm-name">
            Type <strong>{{ tenantName }}</strong> to confirm:
          </label>
          <input
            id="confirm-name"
            class="confirm-input"
            type="text"
            [value]="typedName()"
            (input)="typedName.set($any($event.target).value)"
            data-testid="delete-confirm-input"
            autocomplete="off"
          />
        </div>
        <div class="dialog-actions">
          <button class="btn btn-outline" (click)="cancelled.emit()" data-testid="delete-cancel-btn">Cancel</button>
          <button
            class="btn btn-danger"
            [disabled]="!nameMatches()"
            (click)="confirmed.emit()"
            data-testid="delete-confirm-btn"
          >
            Delete Forever
          </button>
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

    .dialog-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-xl);
      padding: 24px;
      max-width: 480px;
      width: 100%;
    }

    .dialog-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--danger-bg, #fef2f2);
      color: var(--danger, #dc2626);
      margin-bottom: 16px;
    }

    .dialog-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
      margin: 0 0 8px;
    }

    .dialog-text {
      font-size: 14px;
      color: var(--text-secondary);
      margin: 0 0 20px;
      line-height: 1.5;
    }

    .confirm-input-group {
      margin-bottom: 20px;
    }

    .confirm-label {
      display: block;
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .confirm-input {
      width: 100%;
      padding: 10px 12px;
      font-size: 14px;
      color: var(--text-main);
      background: var(--bg-app);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      outline: none;
      box-sizing: border-box;

      &:focus {
        border-color: var(--danger, #dc2626);
        box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-outline {
      color: var(--text-main);
      background: transparent;
      border: 1px solid var(--border-color);

      &:hover {
        background: var(--slate-50, #f8fafc);
      }
    }

    .btn-danger {
      color: #fff;
      background: var(--danger, #dc2626);
      border: 1px solid var(--danger, #dc2626);

      &:hover:not(:disabled) {
        opacity: 0.9;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  `],
})
export class DeleteConfirmDialogComponent {
  @Input({ required: true }) tenantName = '';
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  typedName = signal('');
  nameMatches = computed(() => this.typedName() === this.tenantName);
}
