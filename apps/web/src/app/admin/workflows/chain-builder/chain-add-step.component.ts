import { Component, DestroyRef, input, output, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import type { ChainStep, WorkflowTemplateResponseDto } from '@project-bubble/shared';
import { WorkflowTemplateService } from '../../../core/services/workflow-template.service';
import { InfoTooltipComponent } from '../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, InfoTooltipComponent],
  selector: 'app-chain-add-step',
  template: `
    <div class="add-step-container">
      <div class="add-step-header">
        <label for="template-picker">
          Add Workflow Step
          <app-info-tooltip text="Select a published workflow to add as a step in your chain" />
        </label>
      </div>

      <div class="picker-row">
        <div class="template-picker" data-testid="chain-template-picker">
          <select
            id="template-picker"
            [(ngModel)]="selectedTemplateId"
            class="template-select"
            data-testid="chain-template-select"
          >
            <option value="">-- Select a workflow --</option>
            @for (template of publishedTemplates(); track template.id) {
              <option [value]="template.id">{{ template.name }}</option>
            }
          </select>

          @if (selectedTemplate()) {
            <div class="template-preview">
              <strong>{{ selectedTemplate()?.name }}</strong>
              <p>{{ selectedTemplate()?.description || 'No description' }}</p>
            </div>
          }
        </div>

        <button
          type="button"
          class="btn btn-outline"
          [disabled]="!selectedTemplateId"
          (click)="addStep()"
          data-testid="chain-add-step-button"
        >
          <lucide-icon name="plus" [size]="16"></lucide-icon>
          Add Step
        </button>
      </div>

      @if (isLoading()) {
        <div class="loading-state">
          <lucide-icon name="refresh-cw" [size]="16"></lucide-icon>
          Loading workflows...
        </div>
      }

      @if (!isLoading() && publishedTemplates().length === 0) {
        <div class="empty-state">
          <p>No published workflows available. Create and publish a workflow first.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .add-step-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .add-step-header {
      label {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-main);
        display: flex;
        align-items: center;
        gap: 6px;
      }
    }

    .picker-row {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .template-picker {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .template-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      font-size: 14px;
      font-family: inherit;
      color: var(--text-main);
      background: var(--bg-surface);
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: var(--primary-600);
        box-shadow: 0 0 0 3px var(--primary-100);
      }
    }

    .template-preview {
      padding: 12px;
      background: var(--slate-50);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      font-size: 13px;

      strong {
        color: var(--text-main);
        display: block;
        margin-bottom: 4px;
      }

      p {
        color: var(--text-secondary);
        margin: 0;
      }
    }

    .loading-state,
    .empty-state {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      font-size: 13px;
      color: var(--text-secondary);
    }

    .loading-state lucide-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `],
})
export class ChainAddStepComponent implements OnInit {
  private readonly templateService = inject(WorkflowTemplateService);
  private readonly destroyRef = inject(DestroyRef);

  existingStepCount = input<number>(0);
  stepAdded = output<ChainStep>();

  publishedTemplates = signal<WorkflowTemplateResponseDto[]>([]);
  isLoading = signal(true);
  selectedTemplateId = '';

  selectedTemplate = signal<WorkflowTemplateResponseDto | null>(null);

  ngOnInit(): void {
    this.loadPublishedTemplates();
  }

  private loadPublishedTemplates(): void {
    this.isLoading.set(true);
    this.templateService.getAll({ status: 'published' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (templates) => {
        this.publishedTemplates.set(templates);
        this.isLoading.set(false);
      },
      error: () => {
        this.publishedTemplates.set([]);
        this.isLoading.set(false);
      },
    });
  }

  addStep(): void {
    if (!this.selectedTemplateId) return;

    const template = this.publishedTemplates().find(t => t.id === this.selectedTemplateId);
    if (!template) return;

    const stepIndex = this.existingStepCount();
    const newStep: ChainStep = {
      workflow_id: template.id,
      alias: `step_${stepIndex}`,
    };

    this.stepAdded.emit(newStep);
    this.selectedTemplateId = '';
    this.selectedTemplate.set(null);
  }
}
