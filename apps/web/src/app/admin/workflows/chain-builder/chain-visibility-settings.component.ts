import { Component, input, output, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import type { Tenant } from '@project-bubble/shared';
import { TenantService } from '../../../core/services/tenant.service';
import { InfoTooltipComponent } from '../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, InfoTooltipComponent],
  selector: 'app-chain-visibility-settings',
  template: `
    <div class="visibility-section">
      <h2 class="section-title">Visibility Settings</h2>
      <p class="section-description">Control who can access and use this workflow chain.</p>

      <div class="form-fields">
        <div class="form-group">
          <span class="field-label">
            Visibility
            <app-info-tooltip text="Public chains are available to all tenants. Private chains are only visible to selected tenants." />
          </span>

          <div class="radio-group" data-testid="chain-visibility-toggle">
            <label class="radio-item">
              <input
                type="radio"
                name="visibility"
                value="public"
                [checked]="visibility() === 'public'"
                (change)="onVisibilityChange('public')"
                data-testid="chain-visibility-public"
              />
              <span>Public</span>
            </label>
            <label class="radio-item">
              <input
                type="radio"
                name="visibility"
                value="private"
                [checked]="visibility() === 'private'"
                (change)="onVisibilityChange('private')"
                data-testid="chain-visibility-private"
              />
              <span>Private</span>
            </label>
          </div>
        </div>

        @if (visibility() === 'private') {
          <div class="form-group tenant-picker-group">
            <span class="field-label">
              Allowed Tenants
              <span class="required">*</span>
              <app-info-tooltip text="Select which tenants can access this chain when visibility is private" />
            </span>

            @if (isLoadingTenants()) {
              <div class="loading-state">
                <lucide-icon name="refresh-cw" [size]="14"></lucide-icon>
                Loading tenants...
              </div>
            } @else {
              <div class="tenant-picker" data-testid="chain-allowed-tenants-picker">
                <div class="selected-tenants">
                  @if (allowedTenants().length === 0) {
                    <span class="no-selection">No tenants selected</span>
                  } @else {
                    @for (tenantId of allowedTenants(); track tenantId) {
                      <span class="tenant-chip">
                        {{ getTenantName(tenantId) }}
                        <button
                          type="button"
                          class="chip-remove"
                          (click)="removeTenant(tenantId)"
                        >
                          <lucide-icon name="x" [size]="12"></lucide-icon>
                        </button>
                      </span>
                    }
                  }
                </div>

                <select
                  class="tenant-select"
                  (change)="addTenant($event)"
                  data-testid="chain-tenant-select"
                >
                  <option value="">-- Add tenant --</option>
                  @for (tenant of availableTenants(); track tenant.id) {
                    <option [value]="tenant.id">{{ tenant.name }}</option>
                  }
                </select>
              </div>
            }

            @if (visibility() === 'private' && allowedTenants().length === 0) {
              <span class="field-error">At least one tenant must be selected for private visibility</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .visibility-section {
      min-height: 200px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 4px;
    }

    .section-description {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 24px;
    }

    .form-fields {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .field-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .required {
      color: var(--danger);
    }

    .radio-group {
      display: flex;
      gap: 24px;
    }

    .radio-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: var(--text-main);
      cursor: pointer;

      input[type='radio'] {
        width: 16px;
        height: 16px;
        accent-color: var(--primary-600);
      }
    }

    .loading-state {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      font-size: 13px;
      color: var(--text-secondary);

      lucide-icon {
        animation: spin 1s linear infinite;
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .tenant-picker {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .selected-tenants {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-height: 32px;
      padding: 8px;
      background: var(--slate-25);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
    }

    .no-selection {
      font-size: 13px;
      color: var(--text-tertiary);
    }

    .tenant-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--primary-100);
      color: var(--primary-700);
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 500;
    }

    .chip-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border: none;
      background: transparent;
      color: var(--primary-600);
      cursor: pointer;
      border-radius: var(--radius-full);

      &:hover {
        background: var(--primary-200);
      }
    }

    .tenant-select {
      width: 100%;
      max-width: 300px;
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

    .field-error {
      font-size: 12px;
      color: var(--danger-text);
    }
  `],
})
export class ChainVisibilitySettingsComponent implements OnInit {
  private readonly tenantService = inject(TenantService);

  visibility = input<'public' | 'private'>('public');
  allowedTenants = input<string[]>([]);
  visibilityChange = output<'public' | 'private'>();
  allowedTenantsChange = output<string[]>();

  tenants = signal<Tenant[]>([]);
  isLoadingTenants = signal(true);

  availableTenants = signal<Tenant[]>([]);

  ngOnInit(): void {
    this.loadTenants();
  }

  private loadTenants(): void {
    this.isLoadingTenants.set(true);
    this.tenantService.getAll().subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        this.updateAvailableTenants();
        this.isLoadingTenants.set(false);
      },
      error: () => {
        this.tenants.set([]);
        this.isLoadingTenants.set(false);
      },
    });
  }

  private updateAvailableTenants(selectedTenantIds?: string[]): void {
    // Use provided array or fall back to input signal (for initial load)
    const selectedIds = new Set(selectedTenantIds ?? this.allowedTenants());
    this.availableTenants.set(
      this.tenants().filter(t => !selectedIds.has(t.id))
    );
  }

  getTenantName(tenantId: string): string {
    const tenant = this.tenants().find(t => t.id === tenantId);
    return tenant?.name || tenantId;
  }

  onVisibilityChange(value: 'public' | 'private'): void {
    this.visibilityChange.emit(value);
    if (value === 'public') {
      this.allowedTenantsChange.emit([]);
    }
  }

  addTenant(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const tenantId = select.value;
    if (!tenantId) return;

    const newTenants = [...this.allowedTenants(), tenantId];
    this.allowedTenantsChange.emit(newTenants);
    this.updateAvailableTenants(newTenants);
    select.value = '';
  }

  removeTenant(tenantId: string): void {
    const newTenants = this.allowedTenants().filter(id => id !== tenantId);
    this.allowedTenantsChange.emit(newTenants);
    this.updateAvailableTenants(newTenants);
  }
}
