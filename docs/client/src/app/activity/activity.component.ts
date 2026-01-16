import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface ActivityItem {
  id: number;
  workflowName: string;
  status: 'completed' | 'processing' | 'failed';
  date: string;
  duration: string;
  user: string;
}

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './activity.component.html'
})
export class ActivityComponent {
  activities: ActivityItem[] = [
    {
      id: 1,
      workflowName: 'SPICED Discovery',
      status: 'completed',
      date: 'Today, 10:30 AM',
      duration: '4m 12s',
      user: 'jessi@bubble.com'
    },
    {
      id: 2,
      workflowName: 'Customer Segmentation',
      status: 'processing',
      date: 'Today, 11:15 AM',
      duration: 'In progress...',
      user: 'anne@bubble.com'
    },
    {
      id: 3,
      workflowName: 'Competitor Analysis',
      status: 'completed',
      date: 'Yesterday, 4:45 PM',
      duration: '12m 30s',
      user: 'anne@bubble.com'
    },
    {
      id: 4,
      workflowName: 'Feature Prioritization',
      status: 'failed',
      date: 'Yesterday, 2:15 PM',
      duration: '1m 05s',
      user: 'system'
    },
    {
      id: 5,
      workflowName: 'ICP Validation',
      status: 'completed',
      date: 'Oct 24, 2025',
      duration: '8m 45s',
      user: 'anne@bubble.com'
    }
  ];

  getStatusClass(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-orange-100 text-orange-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed': return '✓';
      case 'processing': return '●';
      case 'failed': return '!';
      default: return '?';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Success';
      case 'processing': return 'Processing';
      case 'failed': return 'Failed';
      default: return status;
    }
  }
}
