import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  // Zone C: Admin Portal
  {
    path: 'admin',
    loadComponent: () =>
      import('./admin/admin-layout.component').then(
        (m) => m.AdminLayoutComponent
      ),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./admin/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./admin/tenants/tenant-list.component').then(
            (m) => m.TenantListComponent
          ),
      },
      {
        path: 'tenants/:id',
        loadComponent: () =>
          import('./admin/tenants/tenant-detail.component').then(
            (m) => m.TenantDetailComponent
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  // Zone A: Public / Auth (placeholder — Story 1.10)
  { path: 'auth', redirectTo: '/admin/dashboard', pathMatch: 'prefix' },
  // Zone B: App / Tenant UI (placeholder — Epic 2)
  { path: 'app', redirectTo: '/admin/dashboard', pathMatch: 'prefix' },
  // Default redirect (temporary — will redirect to /auth/login after Story 1.10)
  { path: '', redirectTo: '/admin/dashboard', pathMatch: 'full' },
  {
    path: '**',
    loadComponent: () =>
      import('./not-found.component').then((m) => m.NotFoundComponent),
  },
];
