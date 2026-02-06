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
import {
  LlmProviderService,
  type LlmProviderConfig,
} from '../../core/services/llm-provider.service';
import type {
  CreateLlmProviderConfigDto,
  UpdateLlmProviderConfigDto,
} from '@project-bubble/shared';
import { PROVIDER_OPTIONS } from './provider-constants';

/** Credential field definitions per provider */
const CREDENTIAL_FIELDS: Record<
  string,
  { key: string; label: string; placeholder: string; required: boolean }[]
> = {
  'google-ai-studio': [
    {
      key: 'apiKey',
      label: 'API Key',
      placeholder: 'AIza...',
      required: true,
    },
  ],
  vertex: [
    {
      key: 'projectId',
      label: 'Project ID',
      placeholder: 'my-gcp-project',
      required: true,
    },
    {
      key: 'location',
      label: 'Location',
      placeholder: 'us-central1',
      required: true,
    },
    {
      key: 'serviceAccountJson',
      label: 'Service Account JSON',
      placeholder: '{"type":"service_account",...}',
      required: false,
    },
  ],
  openai: [
    {
      key: 'apiKey',
      label: 'API Key',
      placeholder: 'sk-...',
      required: true,
    },
    {
      key: 'organizationId',
      label: 'Organization ID',
      placeholder: 'org-...',
      required: false,
    },
  ],
  mock: [],
};

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, LucideAngularModule],
  selector: 'app-provider-config-form-dialog',
  templateUrl: './provider-config-form-dialog.component.html',
  styleUrl: './provider-config-form-dialog.component.scss',
})
export class ProviderConfigFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly providerService = inject(LlmProviderService);
  private readonly destroyRef = inject(DestroyRef);

  /** Config to edit (null = add mode) */
  config = input<LlmProviderConfig | null>(null);

  readonly saved = output<LlmProviderConfig>();
  readonly cancelled = output<void>();

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly providerOptions = PROVIDER_OPTIONS;

  readonly isEditMode = computed(() => this.config() !== null);
  readonly dialogTitle = computed(() =>
    this.isEditMode() ? 'Edit Provider' : 'Add Provider',
  );

  readonly form = this.fb.nonNullable.group({
    providerKey: ['', [Validators.required, Validators.maxLength(50)]],
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    isActive: [true],
  });

  /** Currently selected provider key for dynamic credential fields */
  readonly selectedProviderKey = signal<string>('');

  /** Dynamic credential fields based on selected provider */
  readonly credentialFields = computed(() => {
    const key = this.selectedProviderKey();
    return CREDENTIAL_FIELDS[key] ?? [];
  });

  /** Credential values tracked separately (not in the reactive form) */
  readonly credentialValues = signal<Record<string, string>>({});

  constructor() {
    // Populate form when config input changes (edit mode)
    effect(() => {
      const c = this.config();
      if (c) {
        this.form.patchValue({
          providerKey: c.providerKey,
          displayName: c.displayName,
          isActive: c.isActive,
        });
        this.form.controls.providerKey.disable();
        this.selectedProviderKey.set(c.providerKey);
        // In edit mode, credential fields start empty (masked values not editable)
        this.credentialValues.set({});
      } else {
        this.form.reset({
          providerKey: '',
          displayName: '',
          isActive: true,
        });
        this.form.controls.providerKey.enable();
        this.selectedProviderKey.set('');
        this.credentialValues.set({});
      }
    });
  }

  onProviderKeyChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedProviderKey.set(value);
    this.credentialValues.set({});
  }

  onCredentialChange(key: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.credentialValues.update((prev) => ({ ...prev, [key]: value }));
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

    const rawValue = this.form.getRawValue();
    const credentials = this.buildCredentials();

    if (this.isEditMode()) {
      const updateDto: UpdateLlmProviderConfigDto = {
        displayName: rawValue.displayName,
        isActive: rawValue.isActive,
      };
      // Only include credentials if user entered any values
      if (credentials && Object.keys(credentials).length > 0) {
        updateDto.credentials = credentials;
      }

      this.providerService
        .updateConfig(this.config()!.id, updateDto)
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
      const createDto: CreateLlmProviderConfigDto = {
        providerKey: rawValue.providerKey,
        displayName: rawValue.displayName,
      };
      if (credentials && Object.keys(credentials).length > 0) {
        createDto.credentials = credentials;
      }

      this.providerService
        .createConfig(createDto)
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

  private buildCredentials(): Record<string, string> | null {
    const values = this.credentialValues();
    const nonEmpty: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value.trim()) {
        nonEmpty[key] = value.trim();
      }
    }
    return Object.keys(nonEmpty).length > 0 ? nonEmpty : null;
  }

  private getErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 409) {
      return 'A provider configuration with this key already exists.';
    }
    if (err.status === 400) {
      const message = err.error?.message;
      if (typeof message === 'string') return message;
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
    return 'Invalid value';
  }
}
