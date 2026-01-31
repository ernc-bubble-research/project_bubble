import { Route } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';
import { noAuthGuard } from './core/guards/no-auth.guard';

export const appRoutes: Route[] = [
  // Zone A: Auth pages
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        canActivate: [noAuthGuard],
        loadComponent: () =>
          import('./auth/login/login.component').then(
            (m) => m.LoginComponent
          ),
      },
      {
        path: 'set-password',
        loadComponent: () =>
          import('./auth/set-password/set-password.component').then(
            (m) => m.SetPasswordComponent
          ),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  // Zone C: Admin Portal (bubble_admin only)
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
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
  // Zone B: Tenant App (placeholder — Epic 2+)
  {
    path: 'app',
    canActivate: [authGuard],
    children: [
      {
        path: 'workflows',
        loadComponent: () =>
          import('./app-shell/coming-soon.component').then(
            (m) => m.ComingSoonComponent
          ),
      },
      { path: '', redirectTo: 'workflows', pathMatch: 'full' },
    ],
  },
  // Default: redirect to login (guards handle authenticated redirect)
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  {
    path: '**',
    loadComponent: () =>
      import('./not-found.component').then((m) => m.NotFoundComponent),
  },
];
