import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { LlmModelService, type LlmModel } from '../../core/services/llm-model.service';
import { ProviderTypeService } from '../../core/services/provider-type.service';
import type { CreateLlmModelDto, UpdateLlmModelDto, GenerationParamSpecDto } from '@project-bubble/shared';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, LucideAngularModule],
  selector: 'app-llm-model-form-dialog',
  templateUrl: './llm-model-form-dialog.component.html',
  styleUrl: './llm-model-form-dialog.component.scss',
})
export class LlmModelFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly llmModelService = inject(LlmModelService);
  private readonly providerTypeService = inject(ProviderTypeService);
  private readonly destroyRef = inject(DestroyRef);

  /** Model to edit (null = add mode) */
  model = input<LlmModel | null>(null);

  readonly saved = output<LlmModel>();
  readonly cancelled = output<void>();

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly providerOptions = computed(() =>
    this.providerTypeService.types().map((t) => ({
      value: t.providerKey,
      label: t.displayName,
    })),
  );

  readonly isEditMode = computed(() => this.model() !== null);
  readonly dialogTitle = computed(() =>
    this.isEditMode() ? 'Edit LLM Model' : 'Add LLM Model'
  );

  /** Provider params for the currently selected provider (excludes stopSequences) */
  readonly selectedProviderParams = signal<GenerationParamSpecDto[]>([]);

  /** Dynamic form group for generation defaults — rebuilt when provider changes */
  generationDefaultsForm = new FormGroup<Record<string, FormControl>>({});

  readonly form = this.fb.nonNullable.group({
    providerKey: ['', [Validators.required, Validators.maxLength(50)]],
    modelId: ['', [Validators.required, Validators.maxLength(100)]],
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    contextWindow: [1000000, [Validators.required, Validators.min(1)]],
    maxOutputTokens: [8192, [Validators.required, Validators.min(1)]],
    isActive: [false],
    costPer1kInput: [''],
    costPer1kOutput: [''],
  });

  constructor() {
    // Populate form when model input changes (edit mode)
    effect(() => {
      const m = this.model();
      if (m) {
        this.form.patchValue({
          providerKey: m.providerKey,
          modelId: m.modelId,
          displayName: m.displayName,
          contextWindow: m.contextWindow,
          maxOutputTokens: m.maxOutputTokens,
          isActive: m.isActive,
          costPer1kInput: m.costPer1kInput ?? '',
          costPer1kOutput: m.costPer1kOutput ?? '',
        });
        // Disable providerKey and modelId in edit mode (unique key cannot be changed)
        this.form.controls.providerKey.disable();
        this.form.controls.modelId.disable();
        this.rebuildGenerationDefaultsForm(m.providerKey, m.generationDefaults);
      } else {
        this.form.reset({
          providerKey: '',
          modelId: '',
          displayName: '',
          contextWindow: 1000000,
          maxOutputTokens: 8192,
          isActive: false,
          costPer1kInput: '',
          costPer1kOutput: '',
        });
        this.form.controls.providerKey.enable();
        this.form.controls.modelId.enable();
        this.selectedProviderParams.set([]);
        this.generationDefaultsForm = new FormGroup({});
      }
    });

    // Rebuild generation defaults form when provider changes in add mode
    this.form.controls.providerKey.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((key) => {
        if (!this.isEditMode()) {
          this.rebuildGenerationDefaultsForm(key, null);
        }
      });
  }

  private rebuildGenerationDefaultsForm(
    providerKey: string,
    existingDefaults: Record<string, unknown> | null,
  ): void {
    const providerType = this.providerTypeService.types().find((t) => t.providerKey === providerKey);
    const params = (providerType?.supportedGenerationParams ?? [])
      .filter((p) => p.key !== 'stopSequences');

    this.selectedProviderParams.set(params);

    const controls: Record<string, FormControl> = {};
    for (const param of params) {
      const validators = [];
      if (param.min !== undefined) validators.push(Validators.min(param.min));
      if (param.max !== undefined) validators.push(Validators.max(param.max));

      const existingValue = existingDefaults?.[param.key] ?? null;
      controls[param.key] = new FormControl(existingValue, validators);
    }
    this.generationDefaultsForm = new FormGroup(controls);
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onSubmit(): void {
    if (this.form.invalid || this.generationDefaultsForm.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      this.generationDefaultsForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const rawValue = this.form.getRawValue(); // Gets disabled fields too

    const generationDefaults = this.collectGenerationDefaults();

    if (this.isEditMode()) {
      const updateDto: UpdateLlmModelDto = {
        displayName: rawValue.displayName,
        contextWindow: rawValue.contextWindow,
        maxOutputTokens: rawValue.maxOutputTokens,
        isActive: rawValue.isActive,
        costPer1kInput: rawValue.costPer1kInput || undefined,
        costPer1kOutput: rawValue.costPer1kOutput || undefined,
        generationDefaults: generationDefaults ?? undefined,
      };

      this.llmModelService
        .updateModel(this.model()!.id, updateDto)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            this.submitting.set(false);
            this.saved.emit(updated);
          },
          error: (err: HttpErrorResponse) => {
            this.submitting.set(false);
            this.error.set(this.getErrorMessage(err));
          },
        });
    } else {
      const createDto: CreateLlmModelDto = {
        providerKey: rawValue.providerKey,
        modelId: rawValue.modelId,
        displayName: rawValue.displayName,
        contextWindow: rawValue.contextWindow,
        maxOutputTokens: rawValue.maxOutputTokens,
        isActive: rawValue.isActive,
        costPer1kInput: rawValue.costPer1kInput || undefined,
        costPer1kOutput: rawValue.costPer1kOutput || undefined,
        generationDefaults: generationDefaults ?? undefined,
      };

      this.llmModelService
        .createModel(createDto)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            this.submitting.set(false);
            this.saved.emit(created);
          },
          error: (err: HttpErrorResponse) => {
            this.submitting.set(false);
            this.error.set(this.getErrorMessage(err));
          },
        });
    }
  }

  private collectGenerationDefaults(): Record<string, unknown> | null {
    const params = this.selectedProviderParams();
    if (params.length === 0) return null;

    const defaults: Record<string, unknown> = {};
    let hasValue = false;
    for (const param of params) {
      const control = this.generationDefaultsForm.get(param.key);
      if (control && control.value != null && control.value !== '') {
        defaults[param.key] = Number(control.value);
        hasValue = true;
      }
    }
    return hasValue ? defaults : null;
  }

  hasGenerationDefaultError(key: string): boolean {
    const control = this.generationDefaultsForm.get(key);
    return !!control && control.invalid && control.touched;
  }

  getGenerationDefaultError(key: string): string {
    const control = this.generationDefaultsForm.get(key);
    if (!control || !control.errors) return '';
    if (control.errors['min']) return `Minimum value: ${control.errors['min'].min}`;
    if (control.errors['max']) return `Maximum value: ${control.errors['max'].max}`;
    return 'Invalid value';
  }

  private getErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 409) {
      return 'A model with this provider + model ID already exists.';
    }
    if (err.status === 400) {
      return 'Invalid form data. Please check your inputs.';
    }
    return 'An unexpected error occurred. Please try again.';
  }

  hasError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  getFieldError(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'This field is required';
    if (control.errors['maxlength']) {
      const max = control.errors['maxlength'].requiredLength;
      return `Maximum ${max} characters allowed`;
    }
    if (control.errors['min']) {
      return 'Value must be at least 1';
    }
    return 'Invalid value';
  }
}
