import { Component, DestroyRef, input, output, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import type { ChainStep, WorkflowTemplateResponseDto } from '@project-bubble/shared';
import { WorkflowTemplateService } from '../../../core/services/workflow-template.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  selector: 'app-chain-steps-list',
  template: `
    <div class="steps-list" data-testid="chain-steps-list">
      @if (steps().length === 0) {
        <div class="empty-state">
          <lucide-icon name="layers" [size]="32"></lucide-icon>
          <p>No steps added yet. Add at least 2 workflow steps to build a chain.</p>
        </div>
      } @else {
        @for (step of steps(); track step.alias; let i = $index) {
          <div class="step-card" [attr.data-testid]="'chain-step-' + i">
            <div class="step-indicator">
              <span class="step-number">{{ i + 1 }}</span>
            </div>

            <div class="step-content">
              <div class="step-header">
                <span class="workflow-name">{{ getTemplateName(step.workflow_id) }}</span>
                <span class="step-alias">
                  Alias:
                  <input
                    type="text"
                    [value]="step.alias"
                    (blur)="updateAlias(i, $event)"
                    class="alias-input"
                    [attr.data-testid]="'chain-step-alias-' + i"
                  />
                </span>
              </div>
              <div class="step-id">{{ step.workflow_id }}</div>
            </div>

            <div class="step-actions">
              <button
                type="button"
                class="icon-btn"
                [disabled]="i === 0"
                (click)="moveUp(i)"
                [attr.data-testid]="'chain-step-up-' + i"
                title="Move up"
              >
                <lucide-icon name="chevron-up" [size]="16"></lucide-icon>
              </button>
              <button
                type="button"
                class="icon-btn"
                [disabled]="i === steps().length - 1"
                (click)="moveDown(i)"
                [attr.data-testid]="'chain-step-down-' + i"
                title="Move down"
              >
                <lucide-icon name="chevron-down" [size]="16"></lucide-icon>
              </button>
              <button
                type="button"
                class="icon-btn danger"
                [disabled]="steps().length <= 2"
                (click)="removeStep(i)"
                [attr.data-testid]="'chain-step-remove-' + i"
                title="Remove step"
              >
                <lucide-icon name="trash-2" [size]="16"></lucide-icon>
              </button>
            </div>
          </div>

          @if (i < steps().length - 1) {
            <div class="step-connector" aria-hidden="true">
              <lucide-icon name="arrow-down" [size]="20"></lucide-icon>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .steps-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px 20px;
      text-align: center;
      color: var(--text-secondary);

      p {
        font-size: 14px;
        max-width: 300px;
      }
    }

    .step-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: var(--slate-25);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
    }

    .step-indicator {
      flex-shrink: 0;
    }

    .step-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: var(--primary-600);
      color: white;
      border-radius: var(--radius-full);
      font-size: 14px;
      font-weight: 600;
    }

    .step-content {
      flex: 1;
      min-width: 0;
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 4px;
    }

    .workflow-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-main);
    }

    .step-alias {
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .alias-input {
      width: 100px;
      padding: 2px 6px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg-surface);

      &:focus {
        outline: none;
        border-color: var(--primary-600);
      }
    }

    .step-id {
      font-size: 11px;
      color: var(--text-tertiary);
      font-family: 'JetBrains Mono', monospace;
    }

    .step-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: var(--text-tertiary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not(:disabled) {
        background: var(--slate-100);
        color: var(--text-main);
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      &.danger:hover:not(:disabled) {
        background: var(--danger-bg);
        color: var(--danger-text);
      }
    }

    .step-connector {
      display: flex;
      justify-content: center;
      padding: 8px 0;
      color: var(--text-tertiary);
    }
  `],
})
export class ChainStepsListComponent implements OnInit {
  private readonly templateService = inject(WorkflowTemplateService);
  private readonly destroyRef = inject(DestroyRef);

  steps = input.required<ChainStep[]>();
  stepsChange = output<ChainStep[]>();

  templateCache = signal<Map<string, WorkflowTemplateResponseDto>>(new Map());

  ngOnInit(): void {
    this.loadTemplates();
  }

  private loadTemplates(): void {
    this.templateService.getAll({ status: 'published' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (templates) => {
        const cache = new Map<string, WorkflowTemplateResponseDto>();
        templates.forEach(t => cache.set(t.id, t));
        this.templateCache.set(cache);
      },
    });
  }

  getTemplateName(workflowId: string): string {
    const template = this.templateCache().get(workflowId);
    return template?.name || 'Unknown Workflow';
  }

  updateAlias(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newAlias = input.value.trim() || `step_${index}`;
    const newSteps = [...this.steps()];
    newSteps[index] = { ...newSteps[index], alias: newAlias };
    this.stepsChange.emit(newSteps);
  }

  moveUp(index: number): void {
    if (index === 0) return;
    const newSteps = [...this.steps()];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    this.stepsChange.emit(newSteps);
  }

  moveDown(index: number): void {
    if (index === this.steps().length - 1) return;
    const newSteps = [...this.steps()];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    this.stepsChange.emit(newSteps);
  }

  removeStep(index: number): void {
    if (this.steps().length <= 2) return;
    const newSteps = this.steps().filter((_, i) => i !== index);
    this.stepsChange.emit(newSteps);
  }
}
