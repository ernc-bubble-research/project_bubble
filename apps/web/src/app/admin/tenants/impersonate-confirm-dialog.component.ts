import { Component, Input, Output, EventEmitter } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  standalone: true,
  imports: [LucideAngularModule],
  selector: 'app-impersonate-confirm-dialog',
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
    <div class="modal-overlay" (click)="cancelled.emit()" role="dialog" aria-modal="true" aria-label="Confirm impersonation dialog">
      <div class="modal-container" tabindex="-1" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-icon">
            <lucide-icon name="alert-triangle" [size]="24"></lucide-icon>
          </div>
          <h2 class="modal-title">Confirm Impersonation</h2>
          <button class="close-btn" aria-label="Close dialog" (click)="cancelled.emit()">
            <lucide-icon name="x" [size]="20"></lucide-icon>
          </button>
        </div>
        <div class="modal-body">
          <p class="warning-text">
            You are about to impersonate <strong>{{ tenantName }}</strong>.
            This action is audit-logged. You will see their workspace as if
            you were their admin. Session auto-reverts after 30 minutes of inactivity.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="cancelled.emit()">Cancel</button>
          <button class="btn btn-danger" (click)="confirmed.emit()">Impersonate</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease;
    }

    .modal-container {
      background: white;
      border-radius: var(--radius-xl, 16px);
      box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,.1));
      width: 100%;
      max-width: 480px;
      margin: 16px;
      animation: scaleIn 0.2s ease;
    }

    .modal-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-color, #e2e8f0);
    }

    .modal-icon {
      color: var(--danger, #dc2626);
    }

    .modal-title {
      flex: 1;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-main, #0f172a);
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--text-secondary, #64748b);
      cursor: pointer;
      padding: 4px;
      border-radius: var(--radius-md, 8px);
    }

    .close-btn:hover {
      background: var(--slate-100, #f1f5f9);
    }

    .modal-body {
      padding: 24px;
    }

    .warning-text {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-main, #0f172a);
      margin: 0;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 24px;
      border-top: 1px solid var(--border-color, #e2e8f0);
    }

    .btn {
      padding: 8px 20px;
      font-size: 14px;
      font-weight: 500;
      border-radius: var(--radius-md, 8px);
      cursor: pointer;
      border: none;
      transition: all 0.15s ease;
    }

    .btn-outline {
      background: transparent;
      border: 1px solid var(--border-color, #e2e8f0);
      color: var(--text-main, #0f172a);
    }

    .btn-outline:hover {
      background: var(--slate-50, #f8fafc);
    }

    .btn-danger {
      background: var(--danger, #dc2626);
      color: white;
    }

    .btn-danger:hover {
      background: #b91c1c;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `],
})
export class ImpersonateConfirmDialogComponent {
  @Input({ required: true }) tenantName!: string;
  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
}
