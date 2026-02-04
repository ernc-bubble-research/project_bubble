import { Component, DestroyRef, input, output, inject, OnInit, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import type { ChainStep, ChainInputSource, WorkflowTemplateResponseDto, WorkflowDefinition } from '@project-bubble/shared';
import { WorkflowTemplateService } from '../../../core/services/workflow-template.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  selector: 'app-chain-input-mapping',
  template: `
    <div class="input-mapping-container">
      @for (step of mappableSteps(); track step.alias; let i = $index) {
        <div class="step-mapping-card" [attr.data-testid]="'chain-step-' + (i + 1) + '-mapping'">
          <div class="step-mapping-header">
            <span class="step-badge">Step {{ i + 2 }}</span>
            <span class="step-alias">{{ step.alias }}</span>
          </div>

          <div class="inputs-list">
            @for (inputDef of getStepInputs(step.workflow_id); track inputDef.name) {
              <div class="input-row">
                <div class="input-label">
                  <span class="input-name">{{ inputDef.name }}</span>
                  @if (inputDef.required) {
                    <span class="required">*</span>
                  }
                </div>

                <div class="input-config">
                  <select
                    class="source-select"
                    [value]="getInputSource(step, inputDef.name)"
                    (change)="updateInputSource(step.alias, inputDef.name, $event)"
                    [attr.data-testid]="'chain-step-' + (i + 1) + '-input-' + inputDef.name + '-source'"
                  >
                    <option value="">-- Select source --</option>
                    <option value="from_step">From previous step output</option>
                    <option value="from_input">From chain input</option>
                    <option value="from_chain_config">Fixed value</option>
                  </select>

                  @switch (getInputSource(step, inputDef.name)) {
                    @case ('from_step') {
                      <select
                        class="value-select"
                        [value]="getFromStepValue(step, inputDef.name)"
                        (change)="updateFromStep(step.alias, inputDef.name, $event)"
                        [attr.data-testid]="'chain-step-' + (i + 1) + '-input-' + inputDef.name + '-step'"
                      >
                        <option value="">-- Select step --</option>
                        @for (prevStep of getPreviousSteps(i + 1); track prevStep.alias) {
                          <option [value]="prevStep.alias">{{ prevStep.alias }}</option>
                        }
                      </select>
                    }
                    @case ('from_input') {
                      <input
                        type="text"
                        class="value-input"
                        placeholder="Chain input name"
                        [value]="getFromInputValue(step, inputDef.name)"
                        (blur)="updateFromInput(step.alias, inputDef.name, $event)"
                        [attr.data-testid]="'chain-step-' + (i + 1) + '-input-' + inputDef.name + '-value'"
                      />
                    }
                    @case ('from_chain_config') {
                      <input
                        type="text"
                        class="value-input"
                        placeholder="Fixed value"
                        [value]="getFixedValue(step, inputDef.name)"
                        (blur)="updateFixedValue(step.alias, inputDef.name, $event)"
                        [attr.data-testid]="'chain-step-' + (i + 1) + '-input-' + inputDef.name + '-value'"
                      />
                    }
                  }
                </div>
              </div>
            }

            @if (getStepInputs(step.workflow_id).length === 0) {
              <div class="no-inputs-message">
                <lucide-icon name="info" [size]="14"></lucide-icon>
                <span>This workflow has no defined inputs.</span>
              </div>
            }
          </div>
        </div>
      }

      <div class="mapping-legend">
        <div class="legend-header">
          <lucide-icon name="help-circle" [size]="14"></lucide-icon>
          Input Source Types
        </div>
        <div class="legend-items">
          <div class="legend-item">
            <strong>From previous step:</strong>
            <span>Uses the output from a previous step in the chain</span>
          </div>
          <div class="legend-item">
            <strong>From chain input:</strong>
            <span>Passes through an input provided when the chain is executed</span>
          </div>
          <div class="legend-item">
            <strong>Fixed value:</strong>
            <span>Uses a constant value defined in the chain configuration</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .input-mapping-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .step-mapping-card {
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .step-mapping-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--slate-50);
      border-bottom: 1px solid var(--border-color);
    }

    .step-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 10px;
      background: var(--primary-100);
      color: var(--primary-700);
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 600;
    }

    .step-alias {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-main);
      font-family: 'JetBrains Mono', monospace;
    }

    .inputs-list {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .input-row {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .input-label {
      flex-shrink: 0;
      width: 120px;
      padding-top: 8px;
    }

    .input-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-main);
    }

    .required {
      color: var(--danger);
      margin-left: 2px;
    }

    .input-config {
      flex: 1;
      display: flex;
      gap: 8px;
    }

    .source-select,
    .value-select,
    .value-input {
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      font-size: 13px;
      font-family: inherit;
      color: var(--text-main);
      background: var(--bg-surface);

      &:focus {
        outline: none;
        border-color: var(--primary-600);
        box-shadow: 0 0 0 3px var(--primary-100);
      }
    }

    .source-select {
      flex: 1;
      max-width: 200px;
    }

    .value-select,
    .value-input {
      flex: 1;
    }

    .no-inputs-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--slate-50);
      border-radius: var(--radius-md);
      font-size: 13px;
      color: var(--text-secondary);
    }

    .mapping-legend {
      padding: 16px;
      background: var(--slate-25);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
    }

    .legend-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 12px;
    }

    .legend-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .legend-item {
      font-size: 12px;
      color: var(--text-secondary);

      strong {
        color: var(--text-main);
      }
    }
  `],
})
export class ChainInputMappingComponent implements OnInit {
  private readonly templateService = inject(WorkflowTemplateService);
  private readonly destroyRef = inject(DestroyRef);

  steps = input.required<ChainStep[]>();
  stepsChange = output<ChainStep[]>();

  templateCache = signal<Map<string, WorkflowTemplateResponseDto>>(new Map());

  mappableSteps = computed(() => {
    // Skip the first step (index 0) - it gets inputs at runtime
    return this.steps().slice(1);
  });

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

  getStepInputs(workflowId: string): Array<{ name: string; required: boolean }> {
    const template = this.templateCache().get(workflowId);
    if (!template?.currentVersion?.definition) return [];

    const def = template.currentVersion.definition as unknown as WorkflowDefinition;
    return (def.inputs || []).map(inp => ({
      name: inp.name,
      required: inp.required ?? true,
    }));
  }

  getPreviousSteps(currentIndex: number): ChainStep[] {
    return this.steps().slice(0, currentIndex);
  }

  getInputSource(step: ChainStep, inputName: string): string {
    const mapping = step.input_mapping?.[inputName];
    if (!mapping) return '';
    if (mapping.from_step) return 'from_step';
    if (mapping.from_input) return 'from_input';
    if (mapping.from_chain_config) return 'from_chain_config';
    return '';
  }

  getFromStepValue(step: ChainStep, inputName: string): string {
    return step.input_mapping?.[inputName]?.from_step || '';
  }

  getFromInputValue(step: ChainStep, inputName: string): string {
    return step.input_mapping?.[inputName]?.from_input || '';
  }

  getFixedValue(step: ChainStep, inputName: string): string {
    return step.input_mapping?.[inputName]?.value || '';
  }

  updateInputSource(stepAlias: string, inputName: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const source = select.value as '' | 'from_step' | 'from_input' | 'from_chain_config';

    this.updateMapping(stepAlias, inputName, (mapping) => {
      // Clear previous source values
      delete mapping.from_step;
      delete mapping.from_output;
      delete mapping.from_input;
      delete mapping.from_chain_config;
      delete mapping.value;

      if (source === 'from_step') {
        mapping.from_step = '';
        mapping.from_output = 'outputs';
      } else if (source === 'from_input') {
        mapping.from_input = '';
      } else if (source === 'from_chain_config') {
        mapping.from_chain_config = true;
        mapping.value = '';
      }
    });
  }

  updateFromStep(stepAlias: string, inputName: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.updateMapping(stepAlias, inputName, (mapping) => {
      mapping.from_step = select.value;
      mapping.from_output = 'outputs';
    });
  }

  updateFromInput(stepAlias: string, inputName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.updateMapping(stepAlias, inputName, (mapping) => {
      mapping.from_input = input.value;
    });
  }

  updateFixedValue(stepAlias: string, inputName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.updateMapping(stepAlias, inputName, (mapping) => {
      mapping.from_chain_config = true;
      mapping.value = input.value;
    });
  }

  private updateMapping(
    stepAlias: string,
    inputName: string,
    updater: (mapping: ChainInputSource) => void,
  ): void {
    const newSteps = this.steps().map(step => {
      if (step.alias !== stepAlias) return step;

      const newMapping = { ...(step.input_mapping || {}) };
      if (!newMapping[inputName]) {
        newMapping[inputName] = {};
      }
      updater(newMapping[inputName]);

      return { ...step, input_mapping: newMapping };
    });

    this.stepsChange.emit(newSteps);
  }
}
