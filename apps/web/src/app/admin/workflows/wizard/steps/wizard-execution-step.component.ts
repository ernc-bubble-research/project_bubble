import { Component, input, output, inject, OnInit, signal, DestroyRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { GENERATION_PARAM_KEY_MAP } from '@project-bubble/shared/web';
import type { WorkflowDefinition, GenerationParamSpecDto } from '@project-bubble/shared';
import { LlmModelService, LlmModel } from '../../../../core/services/llm-model.service';
import { ProviderTypeService } from '../../../../core/services/provider-type.service';
import { InfoTooltipComponent } from '../../../../shared/components/info-tooltip/info-tooltip.component';

const SNAKE_TO_CAMEL = GENERATION_PARAM_KEY_MAP;
const CAMEL_TO_SNAKE: Record<string, string> = Object.fromEntries(
  Object.entries(SNAKE_TO_CAMEL).map(([k, v]) => [v, k]),
);

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
  private readonly providerTypeService = inject(ProviderTypeService);
  private readonly destroyRef = inject(DestroyRef);

  state = input.required<Partial<WorkflowDefinition>>();
  stateChange = output<Partial<WorkflowDefinition>>();

  form!: FormGroup;
  models = signal<LlmModel[]>([]);
  modelsLoading = signal(true);
  modelsLoadError = signal<string | null>(null);

  /** Dynamic form group for generation params — rebuilt when model changes */
  generationParamsForm = new FormGroup<Record<string, FormControl>>({});

  /** Params for the currently selected model's provider (excludes stopSequences) */
  basicParams = signal<GenerationParamSpecDto[]>([]);
  advancedParams = signal<GenerationParamSpecDto[]>([]);
  advancedOpen = signal(false);

  /** Nuclear reset notification */
  resetNotification = signal<string | null>(null);
  private resetNotificationTimer: ReturnType<typeof setTimeout> | null = null;

  /** The currently selected model object */
  readonly selectedModel = computed(() => {
    const modelId = this.form?.get('model')?.value;
    return this.models().find((m) => m.id === modelId) ?? null;
  });

  ngOnInit(): void {
    this.initForm();
    this.loadModels();

    // Register cleanup for reset notification timer once (not per model change)
    this.destroyRef.onDestroy(() => {
      if (this.resetNotificationTimer) {
        clearTimeout(this.resetNotificationTimer);
      }
    });
  }

  private initForm(): void {
    const exec = this.state()?.execution;
    this.form = this.fb.group({
      processing: [exec?.processing || 'parallel'],
      model: [exec?.model || '', [Validators.required]],
      max_retries: [exec?.max_retries ?? null, [Validators.min(0), Validators.max(10)]],
    });

    // When model select changes, rebuild generation params
    this.form.get('model')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((modelId) => {
        const model = this.models().find((m) => m.id === modelId);
        if (model) {
          this.rebuildGenerationParams(model, true);
        }
      });

    // Sync form changes to parent
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
          const currentModelId = this.form.get('model')?.value;
          if (!currentModelId && models.length > 0) {
            this.form.patchValue({ model: models[0].id });
          }
          // If model already selected (from state), build params with existing overrides
          const selectedId = this.form.get('model')?.value;
          const model = models.find((m) => m.id === selectedId);
          if (model) {
            this.rebuildGenerationParams(model, false);
          }
        },
        error: () => {
          this.modelsLoading.set(false);
          this.modelsLoadError.set('Failed to load LLM models. Please refresh the page.');
        },
      });
  }

  private rebuildGenerationParams(model: LlmModel, isModelChange: boolean): void {
    const providerType = this.providerTypeService.types()
      .find((t) => t.providerKey === model.providerKey);
    const allParams = (providerType?.supportedGenerationParams ?? [])
      .filter((p) => p.key !== 'stopSequences');

    // Split into basic and advanced
    const basicKeys = ['temperature', 'maxOutputTokens'];
    this.basicParams.set(allParams.filter((p) => basicKeys.includes(p.key)));
    this.advancedParams.set(allParams.filter((p) => !basicKeys.includes(p.key)));

    // Build form controls
    const exec = this.state()?.execution;
    const controls: Record<string, FormControl> = {};
    for (const param of allParams) {
      const validators = [];
      if (param.min !== undefined) validators.push(Validators.min(param.min));
      if (param.max !== undefined) validators.push(Validators.max(param.max));

      let value = null;
      if (!isModelChange && exec) {
        // Load from existing workflow execution state (snake_case)
        const snakeKey = CAMEL_TO_SNAKE[param.key];
        if (snakeKey && (exec as unknown as Record<string, unknown>)[snakeKey] != null) {
          value = (exec as unknown as Record<string, unknown>)[snakeKey];
        }
      }
      // If model change (nuclear reset), leave all values null

      controls[param.key] = new FormControl(value, validators);
    }
    this.generationParamsForm = new FormGroup(controls);

    // Sync generation params changes to parent
    this.generationParamsForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncToParent());

    // Show nuclear reset notification
    if (isModelChange) {
      this.showResetNotification(model.displayName);
    }

    // Trigger sync immediately to reflect new params
    this.syncToParent();
  }

  private showResetNotification(modelName: string): void {
    if (this.resetNotificationTimer) {
      clearTimeout(this.resetNotificationTimer);
    }
    this.resetNotification.set(`Parameters reset to ${modelName} defaults`);
    this.resetNotificationTimer = setTimeout(() => {
      this.resetNotification.set(null);
      this.resetNotificationTimer = null;
    }, 5000);
  }

  /** Get the resolved default for a param (model default > spec default) */
  getResolvedDefault(param: GenerationParamSpecDto): string {
    const model = this.selectedModel();
    const modelDefault = model?.generationDefaults?.[param.key];
    if (modelDefault != null) return String(modelDefault);
    if (param.default != null) return String(param.default);
    return '';
  }

  /** Reset all generation params to empty (fall back to model defaults) */
  onResetToDefaults(): void {
    for (const param of [...this.basicParams(), ...this.advancedParams()]) {
      this.generationParamsForm.get(param.key)?.setValue(null);
    }
    this.dismissResetNotification();
  }

  dismissResetNotification(): void {
    if (this.resetNotificationTimer) {
      clearTimeout(this.resetNotificationTimer);
      this.resetNotificationTimer = null;
    }
    this.resetNotification.set(null);
  }

  toggleAdvanced(): void {
    this.advancedOpen.update((v) => !v);
  }

  hasGenerationParamError(key: string): boolean {
    const control = this.generationParamsForm.get(key);
    return !!control && control.invalid && control.touched;
  }

  getGenerationParamError(key: string): string {
    const control = this.generationParamsForm.get(key);
    if (!control || !control.errors) return '';
    if (control.errors['min']) return `Minimum: ${control.errors['min'].min}`;
    if (control.errors['max']) return `Maximum: ${control.errors['max'].max}`;
    return 'Invalid value';
  }

  private syncToParent(): void {
    const val = this.form.value;
    const execution: WorkflowDefinition['execution'] = {
      processing: val.processing,
      model: val.model,
    };
    if (val.max_retries != null && val.max_retries !== '') execution.max_retries = Number(val.max_retries);

    // Include generation params (convert camelCase keys → snake_case)
    const genValues = this.generationParamsForm.value;
    for (const [camelKey, rawValue] of Object.entries(genValues)) {
      if (rawValue != null && rawValue !== '') {
        const snakeKey = CAMEL_TO_SNAKE[camelKey];
        if (snakeKey) {
          (execution as unknown as Record<string, unknown>)[snakeKey] = Number(rawValue);
        }
      }
    }

    this.stateChange.emit({ execution });
  }

  isValid(): boolean {
    this.form.markAllAsTouched();
    this.generationParamsForm.markAllAsTouched();
    return this.form.valid && this.generationParamsForm.valid;
  }
}
