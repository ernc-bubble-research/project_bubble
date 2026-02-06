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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { LlmModelService, type LlmModel } from '../../core/services/llm-model.service';
import type { CreateLlmModelDto, UpdateLlmModelDto } from '@project-bubble/shared';
import { PROVIDER_OPTIONS } from './provider-constants';

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
  private readonly destroyRef = inject(DestroyRef);

  /** Model to edit (null = add mode) */
  model = input<LlmModel | null>(null);

  readonly saved = output<LlmModel>();
  readonly cancelled = output<void>();

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly providerOptions = PROVIDER_OPTIONS;

  readonly isEditMode = computed(() => this.model() !== null);
  readonly dialogTitle = computed(() =>
    this.isEditMode() ? 'Edit LLM Model' : 'Add LLM Model'
  );

  readonly form = this.fb.nonNullable.group({
    providerKey: ['', [Validators.required, Validators.maxLength(50)]],
    modelId: ['', [Validators.required, Validators.maxLength(100)]],
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    contextWindow: [1000000, [Validators.required, Validators.min(1)]],
    maxOutputTokens: [8192, [Validators.required, Validators.min(1)]],
    isActive: [true],
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
      } else {
        this.form.reset({
          providerKey: '',
          modelId: '',
          displayName: '',
          contextWindow: 1000000,
          maxOutputTokens: 8192,
          isActive: true,
          costPer1kInput: '',
          costPer1kOutput: '',
        });
        this.form.controls.providerKey.enable();
        this.form.controls.modelId.enable();
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const rawValue = this.form.getRawValue(); // Gets disabled fields too

    if (this.isEditMode()) {
      const updateDto: UpdateLlmModelDto = {
        displayName: rawValue.displayName,
        contextWindow: rawValue.contextWindow,
        maxOutputTokens: rawValue.maxOutputTokens,
        isActive: rawValue.isActive,
        costPer1kInput: rawValue.costPer1kInput || undefined,
        costPer1kOutput: rawValue.costPer1kOutput || undefined,
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
