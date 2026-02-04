import { Component, DestroyRef, OnInit, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { StatCardComponent } from '../../shared/components/stat-card/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { CreateTenantModalComponent } from './create-tenant-modal.component';
import {
  TenantService,
  Tenant,
} from '../../core/services/tenant.service';

@Component({
  standalone: true,
  imports: [StatCardComponent, StatusBadgeComponent, CreateTenantModalComponent],
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  tenants = signal<Tenant[]>([]);
  loading = signal(false);
  filter = signal<'all' | 'active' | 'suspended'>('all');
  sortBy = signal<'name' | 'createdAt'>('name');
  showCreateModal = signal(false);

  totalTenants = computed(() => this.tenants().length);
  activeTenants = computed(
    () => this.tenants().filter((t) => t.status === 'active').length
  );
  suspendedTenants = computed(
    () => this.tenants().filter((t) => t.status === 'suspended').length
  );

  filteredTenants = computed(() => {
    const f = this.filter();
    const result =
      f === 'all'
        ? this.tenants()
        : this.tenants().filter((t) => t.status === f);

    const sort = this.sortBy();
    return [...result].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  });

  ngOnInit(): void {
    this.loadTenants();
  }

  loadTenants(): void {
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

  setFilter(f: 'all' | 'active' | 'suspended'): void {
    this.filter.set(f);
  }

  setSortBy(s: 'name' | 'createdAt'): void {
    this.sortBy.set(s);
  }

  openCreateModal(): void {
    this.showCreateModal.set(true);
  }

  onTenantCreated(): void {
    this.showCreateModal.set(false);
    this.loadTenants();
  }

  onModalClosed(): void {
    this.showCreateModal.set(false);
  }

  manageTenant(tenant: Tenant): void {
    this.router.navigate(['/admin/tenants', tenant.id]);
  }
}
