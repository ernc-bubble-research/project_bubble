import { Component, input, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import type { ChainStep, WorkflowTemplateResponseDto } from '@project-bubble/shared';
import { WorkflowTemplateService } from '../../../core/services/workflow-template.service';

@Component({
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  selector: 'app-chain-data-flow',
  template: `
    <div class="data-flow-container" data-testid="chain-data-flow-diagram">
      <div class="flow-diagram">
        @for (step of steps(); track step.alias; let i = $index) {
          <div class="flow-step">
            <div class="step-node" [class.first-step]="i === 0">
              <div class="node-header">
                <span class="node-number">{{ i + 1 }}</span>
                <span class="node-alias">{{ step.alias }}</span>
              </div>
              <div class="node-name">{{ getTemplateName(step.workflow_id) }}</div>

              @if (i === 0) {
                <div class="node-badge input-badge">
                  <lucide-icon name="log-in" [size]="10"></lucide-icon>
                  User Input
                </div>
              }
            </div>

            @if (i < steps().length - 1) {
              <div class="flow-connector">
                <div class="connector-line"></div>
                <div class="connector-arrow">
                  <lucide-icon name="arrow-down" [size]="16"></lucide-icon>
                </div>
                @if (getMappingLabel(i + 1)) {
                  <div class="connector-label">{{ getMappingLabel(i + 1) }}</div>
                }
              </div>
            } @else {
              <div class="output-indicator">
                <lucide-icon name="log-out" [size]="12"></lucide-icon>
                Chain Output
              </div>
            }
          </div>
        }
      </div>

      @if (steps().length >= 2) {
        <div class="flow-summary">
          <div class="summary-item">
            <lucide-icon name="layers" [size]="14"></lucide-icon>
            <span>{{ steps().length }} workflow steps</span>
          </div>
          <div class="summary-item">
            <lucide-icon name="arrow-right-left" [size]="14"></lucide-icon>
            <span>{{ connectionCount() }} data connections</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .data-flow-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .flow-diagram {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      padding: 20px;
      background: var(--slate-25);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
    }

    .flow-step {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .step-node {
      min-width: 220px;
      padding: 16px;
      background: var(--bg-surface);
      border: 2px solid var(--border-color);
      border-radius: var(--radius-lg);
      text-align: center;
      position: relative;

      &.first-step {
        border-color: var(--primary-400);
        background: var(--primary-50);
      }
    }

    .node-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .node-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      background: var(--primary-600);
      color: white;
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 600;
    }

    .node-alias {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
      font-family: 'JetBrains Mono', monospace;
    }

    .node-name {
      font-size: 14px;
      color: var(--text-secondary);
    }

    .node-badge {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      border-radius: var(--radius-full);
    }

    .input-badge {
      background: var(--success-bg);
      color: var(--success-text);
      border: 1px solid var(--success);
    }

    .flow-connector {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 0;
      position: relative;
    }

    .connector-line {
      width: 2px;
      height: 24px;
      background: var(--slate-300);
    }

    .connector-arrow {
      color: var(--primary-600);
    }

    .connector-label {
      position: absolute;
      left: calc(50% + 16px);
      top: 50%;
      transform: translateY(-50%);
      padding: 2px 8px;
      background: var(--slate-100);
      border-radius: var(--radius-sm);
      font-size: 10px;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .output-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 12px;
      padding: 4px 12px;
      background: var(--info-bg, #dbeafe);
      color: var(--info-text, #1e40af);
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 500;
    }

    .flow-summary {
      display: flex;
      justify-content: center;
      gap: 24px;
      padding: 12px;
      background: var(--slate-50);
      border-radius: var(--radius-md);
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--text-secondary);
    }
  `],
})
export class ChainDataFlowComponent implements OnInit {
  private readonly templateService = inject(WorkflowTemplateService);

  steps = input.required<ChainStep[]>();

  templateCache = signal<Map<string, WorkflowTemplateResponseDto>>(new Map());

  connectionCount = computed(() => {
    let count = 0;
    for (const step of this.steps()) {
      const mapping = step.input_mapping;
      if (mapping) {
        count += Object.keys(mapping).filter(
          k => mapping[k].from_step
        ).length;
      }
    }
    return count;
  });

  ngOnInit(): void {
    this.loadTemplates();
  }

  private loadTemplates(): void {
    this.templateService.getAll({ status: 'published' }).subscribe({
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

  getMappingLabel(stepIndex: number): string {
    const step = this.steps()[stepIndex];
    if (!step?.input_mapping) return '';

    const fromStepMappings = Object.entries(step.input_mapping)
      .filter(([, source]) => source.from_step)
      .map(([inputName, source]) => `${source.from_step} → ${inputName}`);

    if (fromStepMappings.length === 0) return '';
    if (fromStepMappings.length === 1) return fromStepMappings[0];
    return `${fromStepMappings.length} mappings`;
  }
}
