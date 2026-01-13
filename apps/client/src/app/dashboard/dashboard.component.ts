import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
    recentActivity = [
        {
            id: 1,
            name: 'Sales Data Analysis',
            status: 'completed',
            timestamp: 'Today, 10:30 AM'
        },
        {
            id: 2,
            name: 'Customer Segmentation',
            status: 'processing',
            timestamp: 'Today, 11:15 AM'
        }
    ];

    stats = {
        activeWorkflows: 5,
        filesInVault: 42
    };
}
