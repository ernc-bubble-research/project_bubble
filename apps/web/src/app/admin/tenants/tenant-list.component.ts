import { Component, DestroyRef, signal, computed, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { TenantService, Tenant } from '../../core/services/tenant.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, StatusBadgeComponent],
  selector: 'app-tenant-list',
  templateUrl: './tenant-list.component.html',
  styleUrl: './tenant-list.component.scss',
})
export class TenantListComponent implements OnInit {
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  tenants = signal<Tenant[]>([]);
  loading = signal(false);
  filter = signal<'all' | 'active' | 'suspended' | 'archived'>('all');

  allCount = computed(() => this.tenants().length);
  activeCount = computed(() => this.tenants().filter((t) => t.status === 'active').length);
  suspendedCount = computed(() => this.tenants().filter((t) => t.status === 'suspended').length);
  archivedCount = computed(() => this.tenants().filter((t) => t.status === 'archived').length);

  filteredTenants = computed(() => {
    const f = this.filter();
    const all = this.tenants();
    if (f === 'all') return all;
    return all.filter((t) => t.status === f);
  });

  ngOnInit(): void {
    this.loadTenants();
  }

  private loadTenants(): void {
    this.loading.set(true);
    this.tenantService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  setFilter(f: 'all' | 'active' | 'suspended' | 'archived'): void {
    this.filter.set(f);
  }

  navigateToTenant(tenant: Tenant): void {
    this.router.navigate(['/admin/tenants', tenant.id]);
  }

  navigateToDashboard(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}
