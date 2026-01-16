import { Route } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const appRoutes: Route[] = [
    {
        path: '',
        component: MainLayoutComponent,
        children: [
            {
                path: 'dashboard',
                loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
            },
            {
                path: 'workflows',
                loadComponent: () => import('./workflows/workflow-library.component').then(m => m.WorkflowLibraryComponent)
            },
            {
                path: 'data-vault',
                loadComponent: () => import('./data-vault/data-vault.component').then(m => m.DataVaultComponent)
            },
            {
                path: 'reports/:id',
                loadComponent: () => import('./reports/report-viewer.component').then(m => m.ReportViewerComponent)
            },
            {
                path: 'activity',
                loadComponent: () => import('./activity/activity.component').then(m => m.ActivityComponent)
            },
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
        ]

    }
];

