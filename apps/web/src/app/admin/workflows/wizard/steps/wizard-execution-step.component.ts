import { Component, input, output, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import type { WorkflowDefinition } from '@project-bubble/shared';
import { LlmModelService, LlmModel } from '../../../../core/services/llm-model.service';
import { InfoTooltipComponent } from '../../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, InfoTooltipComponent],
  selector: 'app-wizard-execution-step',
  templateUrl: './wizard-execution-step.component.html',
  styleUrl: './wizard-step-shared.scss',
})
export class WizardExecutionStepComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly llmModelService = inject(LlmModelService);
  private readonly destroyRef = inject(DestroyRef);

  state = input.required<Partial<WorkflowDefinition>>();
  stateChange = output<Partial<WorkflowDefinition>>();

  form!: FormGroup;
  models = signal<LlmModel[]>([]);
  modelsLoading = signal(true);
  modelsLoadError = signal<string | null>(null);

  ngOnInit(): void {
    this.initForm();
    this.loadModels();
  }

  private initForm(): void {
    const exec = this.state()?.execution;
    this.form = this.fb.group({
      processing: [exec?.processing || 'parallel'],
      model: [exec?.model || '', [Validators.required]],
      // M7: min/max validators on numeric fields
      temperature: [exec?.temperature ?? 0.7, [Validators.min(0), Validators.max(2)]],
      max_output_tokens: [exec?.max_output_tokens ?? 4096, [Validators.min(1)]],
      // M2: Use ?? instead of || so that max_retries=0 is preserved
      max_retries: [exec?.max_retries ?? null, [Validators.min(0), Validators.max(10)]],
    });

    // H2: takeUntilDestroyed prevents memory leak
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncToParent());
  }

  private loadModels(): void {
    this.llmModelService.getActiveModels()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (models) => {
          this.models.set(models);
          this.modelsLoading.set(false);
          this.modelsLoadError.set(null);
          // Auto-select first model if none set
          if (!this.form.get('model')?.value && models.length > 0) {
            this.form.patchValue({ model: models[0].id });
          }
        },
        // M1: Surface model load error to user
        error: () => {
          this.modelsLoading.set(false);
          this.modelsLoadError.set('Failed to load LLM models. Please refresh the page.');
        },
      });
  }

  private syncToParent(): void {
    const val = this.form.value;
    const execution: WorkflowDefinition['execution'] = {
      processing: val.processing,
      model: val.model,
    };
    if (val.temperature != null) execution.temperature = Number(val.temperature);
    if (val.max_output_tokens != null) execution.max_output_tokens = Number(val.max_output_tokens);
    if (val.max_retries != null && val.max_retries !== '') execution.max_retries = Number(val.max_retries);

    this.stateChange.emit({ execution });
  }

  isValid(): boolean {
    this.form.markAllAsTouched();
    return this.form.valid;
  }
}
