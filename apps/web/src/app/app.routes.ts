import { Route } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';
import { noAuthGuard } from './core/guards/no-auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';

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
      {
        path: 'workflows',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./admin/workflows/workflow-studio.component').then(
                (m) => m.WorkflowStudioComponent
              ),
          },
          {
            path: 'create',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import(
                './admin/workflows/wizard/workflow-wizard.component'
              ).then((m) => m.WorkflowWizardComponent),
          },
          {
            path: 'edit/:id',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import(
                './admin/workflows/wizard/workflow-wizard.component'
              ).then((m) => m.WorkflowWizardComponent),
          },
          {
            path: 'chains/new',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import(
                './admin/workflows/chain-builder/chain-builder.component'
              ).then((m) => m.ChainBuilderComponent),
          },
          {
            path: 'chains/:id/edit',
            canDeactivate: [unsavedChangesGuard],
            loadComponent: () =>
              import(
                './admin/workflows/chain-builder/chain-builder.component'
              ).then((m) => m.ChainBuilderComponent),
          },
        ],
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./admin/settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  // Zone B: Tenant App
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./app-shell/app-layout.component').then(
        (m) => m.AppLayoutComponent
      ),
    children: [
      {
        path: 'data-vault',
        loadComponent: () =>
          import('./app/data-vault/data-vault.component').then(
            (m) => m.DataVaultComponent
          ),
      },
      {
        path: 'data-vault/:folderId',
        loadComponent: () =>
          import('./app/data-vault/data-vault.component').then(
            (m) => m.DataVaultComponent
          ),
      },
      {
        path: 'workflows',
        loadComponent: () =>
          import('./app/workflows/workflow-catalog.component').then(
            (m) => m.WorkflowCatalogComponent
          ),
      },
      {
        path: 'workflows/run/:templateId',
        loadComponent: () =>
          import('./app/workflows/workflow-run-form.component').then(
            (m) => m.WorkflowRunFormComponent
          ),
      },
      {
        path: 'access-log',
        loadComponent: () =>
          import('./tenant/access-log/access-log.component').then(
            (m) => m.AccessLogComponent
          ),
      },
      { path: '', redirectTo: 'data-vault', pathMatch: 'full' },
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
