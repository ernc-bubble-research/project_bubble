import { Component, input, output, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { WorkflowDefinition } from '@project-bubble/shared';
import { InfoTooltipComponent } from '../../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InfoTooltipComponent],
  selector: 'app-wizard-knowledge-step',
  template: `
    <div class="step-section">
      <h2 class="step-title">Knowledge Config</h2>
      <p class="step-description">
        Optionally inject relevant context from the tenant's Knowledge Base into the prompt.
      </p>

      <form [formGroup]="form" class="form-fields">
        <div class="form-group">
          <span class="field-label">
            Enable Knowledge Base
            <app-info-tooltip text="When on, the system queries the tenant Knowledge Base for relevant context to inject into the prompt" />
          </span>
          <div class="toggle-group">
            <label class="toggle-switch">
              <input type="checkbox" formControlName="enabled" data-testid="knowledge-enabled-toggle" />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">{{ form.get('enabled')?.value ? 'Enabled' : 'Disabled' }}</span>
          </div>
        </div>

        @if (form.get('enabled')?.value) {
          <div class="form-group">
            <span class="field-label">
              Query Strategy
            </span>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" formControlName="query_strategy" value="auto" data-testid="knowledge-strategy-auto" />
                Auto
                <app-info-tooltip text="Platform automatically generates a search query from the subject content" />
              </label>
              <label class="radio-item">
                <input type="radio" formControlName="query_strategy" value="custom" data-testid="knowledge-strategy-custom" />
                Custom
                <app-info-tooltip text="You provide a specific search query template" />
              </label>
            </div>
          </div>

          @if (form.get('query_strategy')?.value === 'custom') {
            <div class="form-group">
              <span class="field-label">
                Query Template
                <app-info-tooltip text="Custom search query sent to the Knowledge Base. Use {input_name} variables to include input content in the search." />
              </span>
              <textarea
                formControlName="query_template"
                rows="3"
                placeholder="Enter your custom search query template..."
                data-testid="knowledge-query-template"
              ></textarea>
            </div>
          }

          <div class="form-row">
            <div class="form-group">
              <span class="field-label">
                Similarity Threshold
                <app-info-tooltip text="Minimum relevance score (0.0-1.0) for knowledge chunks to be included" />
              </span>
              <input
                type="number"
                formControlName="similarity_threshold"
                min="0"
                max="1"
                step="0.05"
                data-testid="knowledge-threshold-input"
              />
            </div>
            <div class="form-group">
              <span class="field-label">
                Max Chunks
                <app-info-tooltip text="Maximum number of knowledge chunks to inject into the prompt" />
              </span>
              <input
                type="number"
                formControlName="max_chunks"
                min="1"
                max="50"
                data-testid="knowledge-max-chunks-input"
              />
            </div>
          </div>
        }
      </form>
    </div>
  `,
  styleUrl: './wizard-step-shared.scss',
})
export class WizardKnowledgeStepComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  state = input.required<Partial<WorkflowDefinition>>();
  stateChange = output<Partial<WorkflowDefinition>>();

  form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    const knowledge = this.state()?.knowledge;
    this.form = this.fb.group({
      enabled: [knowledge?.enabled ?? false],
      query_strategy: [knowledge?.query_strategy || 'auto'],
      query_template: [knowledge?.query_template || ''],
      // M7: min/max validators on numeric fields
      similarity_threshold: [knowledge?.similarity_threshold ?? 0.7, [Validators.min(0), Validators.max(1)]],
      max_chunks: [knowledge?.max_chunks ?? 10, [Validators.min(1), Validators.max(50)]],
    });

    // H2: takeUntilDestroyed prevents memory leak
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncToParent());
  }

  private syncToParent(): void {
    const val = this.form.value;
    const knowledge: WorkflowDefinition['knowledge'] = {
      enabled: val.enabled,
    };

    if (val.enabled) {
      knowledge.query_strategy = val.query_strategy;
      if (val.query_strategy === 'custom' && val.query_template) {
        knowledge.query_template = val.query_template;
      }
      knowledge.similarity_threshold = Number(val.similarity_threshold);
      knowledge.max_chunks = Number(val.max_chunks);
    }

    this.stateChange.emit({ knowledge });
  }

  isValid(): boolean {
    return true; // Knowledge config has no required fields beyond enabled toggle
  }
}
