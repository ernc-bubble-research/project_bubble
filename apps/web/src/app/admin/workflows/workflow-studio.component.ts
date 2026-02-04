import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  standalone: true,
  imports: [LucideAngularModule],
  selector: 'app-workflow-studio',
  template: `
    <div class="studio-page">
      <div class="studio-header">
        <h1>Workflow Studio</h1>
        <p class="studio-subtitle">Create and manage LLM-powered workflow templates</p>
      </div>
      <div class="studio-content">
        <div class="empty-state">
          <lucide-icon name="git-branch" [size]="48"></lucide-icon>
          <h2>No workflows yet</h2>
          <p>Create your first workflow template or chain to get started.</p>
          <div class="action-buttons">
            <button
              class="btn btn-primary"
              data-testid="create-workflow-btn"
              (click)="navigateToCreate()"
            >
              <lucide-icon name="circle-check" [size]="16"></lucide-icon>
              Create Workflow
            </button>
            <button
              class="btn btn-outline"
              data-testid="create-chain-btn"
              (click)="navigateToCreateChain()"
            >
              <lucide-icon name="link" [size]="16"></lucide-icon>
              Create Chain
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .studio-page {
      padding: 32px;
    }
    .studio-header {
      margin-bottom: 32px;
    }
    .studio-header h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-main);
    }
    .studio-subtitle {
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .studio-content {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
      color: var(--text-secondary);
    }
    .empty-state h2 {
      font-size: 18px;
      color: var(--text-main);
    }
    .empty-state p {
      font-size: 14px;
      margin-bottom: 8px;
    }
    .action-buttons {
      display: flex;
      gap: 12px;
    }
  `],
})
export class WorkflowStudioComponent {
  private readonly router = inject(Router);

  navigateToCreate(): void {
    this.router.navigate(['/admin/workflows/create']);
  }

  navigateToCreateChain(): void {
    this.router.navigate(['/admin/workflows/chains/new']);
  }
}
