import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TenantService, Tenant } from '../../core/services/tenant.service';
import { ImpersonationService } from '../../core/services/impersonation.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ImpersonateConfirmDialogComponent } from './impersonate-confirm-dialog.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LucideAngularModule,
    StatusBadgeComponent,
    ImpersonateConfirmDialogComponent,
  ],
  selector: 'app-tenant-detail',
  templateUrl: './tenant-detail.component.html',
  styleUrl: './tenant-detail.component.scss',
})
export class TenantDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);
  private readonly impersonationService = inject(ImpersonationService);

  tenant = signal<Tenant | null>(null);
  loading = signal(false);
  activeTab = signal<'general' | 'entitlements' | 'users' | 'usage' | 'audit'>('general');
  showImpersonateDialog = signal(false);
  impersonating = signal(false);
  copiedId = signal(false);

  readonly tabs = [
    { key: 'general' as const, label: 'General' },
    { key: 'entitlements' as const, label: 'Entitlements' },
    { key: 'users' as const, label: 'Users' },
    { key: 'usage' as const, label: 'Usage' },
    { key: 'audit' as const, label: 'Audit' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTenant(id);
    }
  }

  private loadTenant(id: string): void {
    this.loading.set(true);
    this.tenantService.getOne(id).subscribe({
      next: (tenant) => {
        this.tenant.set(tenant);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/admin/tenants']);
      },
    });
  }

  setTab(tab: 'general' | 'entitlements' | 'users' | 'usage' | 'audit'): void {
    this.activeTab.set(tab);
  }

  openImpersonateDialog(): void {
    this.showImpersonateDialog.set(true);
  }

  closeImpersonateDialog(): void {
    this.showImpersonateDialog.set(false);
  }

  onConfirmImpersonate(): void {
    const t = this.tenant();
    if (!t) return;

    this.impersonating.set(true);
    this.showImpersonateDialog.set(false);

    this.impersonationService.impersonate(t.id).subscribe({
      next: (response) => {
        this.impersonationService.storeImpersonation(response.token, response.tenant);
        this.impersonationService.startInactivityTimer();
        this.router.navigate(['/app/workflows']);
      },
      error: () => {
        this.impersonating.set(false);
        this.impersonationService.showToast('Failed to start impersonation. The tenant may be suspended or not found.');
      },
    });
  }

  copyTenantId(): void {
    const t = this.tenant();
    if (!t) return;
    navigator.clipboard.writeText(t.id).then(() => {
      this.copiedId.set(true);
      setTimeout(() => this.copiedId.set(false), 2000);
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/tenants']);
  }
}
