import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantService } from '../../core/services/tenant.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  selector: 'app-create-tenant-modal',
  template: `
    <div class="modal-overlay" role="button" tabindex="0" aria-label="Close modal" (click)="onOverlayClick($event)" (keydown.enter)="close()" (keydown.escape)="close()">
      <div class="modal-container">
        <div class="modal-header">
          <h2>Create Tenant</h2>
          <button class="close-btn" aria-label="Close modal" (click)="close()">✕</button>
        </div>
        <div class="modal-body">
          <label class="form-label" for="tenantName">Tenant Name</label>
          <input
            id="tenantName"
            type="text"
            class="form-input"
            placeholder="e.g. Acme Corp"
            [(ngModel)]="tenantName"
            [class.error]="errorMessage()"
            maxlength="255"
            (keydown.enter)="submit()"
          />
          @if (errorMessage()) {
            <p class="error-text">{{ errorMessage() }}</p>
          }
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" (click)="close()">Cancel</button>
          <button
            class="btn btn-primary"
            (click)="submit()"
            [disabled]="submitting()"
          >
            {{ submitting() ? 'Creating...' : 'Create Tenant' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.2s ease;
      }
      .modal-container {
        background: var(--bg-surface);
        border-radius: var(--radius-2xl);
        box-shadow: var(--shadow-xl);
        width: 100%;
        max-width: 480px;
        animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px 24px 16px;
        border-bottom: 1px solid var(--border-color);
        h2 {
          font-size: 18px;
        }
      }
      .close-btn {
        background: none;
        border: none;
        font-size: 18px;
        color: var(--text-tertiary);
        padding: 4px;
        &:hover {
          color: var(--text-main);
        }
      }
      .modal-body {
        padding: 24px;
      }
      .form-label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-main);
        margin-bottom: 8px;
      }
      .form-input {
        width: 100%;
        padding: 10px 14px;
        font-size: 14px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        background: var(--slate-50);
        color: var(--text-main);
        outline: none;
        transition: border-color 0.15s ease;
        &:focus {
          border-color: var(--primary-500);
          box-shadow: 0 0 0 2px var(--primary-100);
        }
        &.error {
          border-color: var(--danger);
        }
      }
      .error-text {
        margin-top: 8px;
        font-size: 13px;
        color: var(--danger-text);
      }
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px 24px;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes scaleIn {
        from {
          transform: scale(0.95);
          opacity: 0;
        }
        to {
          transform: scale(1);
          opacity: 1;
        }
      }
    `,
  ],
})
export class CreateTenantModalComponent {
  @Output() created = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private readonly tenantService = inject(TenantService);

  tenantName = '';
  errorMessage = signal('');
  submitting = signal(false);

  submit(): void {
    const name = this.tenantName.trim();
    if (!name) {
      this.errorMessage.set('Tenant name is required.');
      return;
    }

    this.errorMessage.set('');
    this.submitting.set(true);

    this.tenantService.create({ name }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.created.emit();
      },
      error: (err) => {
        this.submitting.set(false);
        if (err.status === 409) {
          this.errorMessage.set(
            `Tenant "${name}" already exists.`
          );
        } else {
          this.errorMessage.set('Failed to create tenant. Please try again.');
        }
      },
    });
  }

  close(): void {
    this.closed.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close();
    }
  }
}
